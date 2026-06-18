import type {
  Body,
  Cookie,
  Flow,
  FlowRequest,
  FlowResponse,
  Header,
  QueryParam,
} from "../model/flow.js";
import { base64ToBytes, bytesToText, firstNonWhitespaceByte, textToBytes } from "../util/bytes.js";
import { baseMime, isTextualMime } from "../util/mime.js";
import { parseQueryString } from "../util/http-raw.js";
import { ParserError, type FlowParser, type ParseInput } from "./types.js";

/** Loose shapes for the HAR fields we read. We tolerate missing/extra keys. */
interface HarNameValue {
  name?: unknown;
  value?: unknown;
}
interface HarPostData {
  mimeType?: unknown;
  text?: unknown;
  params?: HarNameValue[];
}
interface HarContent {
  size?: unknown;
  mimeType?: unknown;
  text?: unknown;
  encoding?: unknown;
}
interface HarRequest {
  method?: unknown;
  url?: unknown;
  httpVersion?: unknown;
  headers?: HarNameValue[];
  queryString?: HarNameValue[];
  cookies?: HarNameValue[];
  postData?: HarPostData;
}
interface HarResponse {
  status?: unknown;
  statusText?: unknown;
  httpVersion?: unknown;
  headers?: HarNameValue[];
  cookies?: HarNameValue[];
  content?: HarContent;
  redirectURL?: unknown;
}
interface HarEntry {
  startedDateTime?: unknown;
  request?: HarRequest;
  response?: HarResponse;
  timings?: Record<string, unknown>;
  serverIPAddress?: unknown;
}
interface HarLog {
  log?: { entries?: HarEntry[] };
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function mapNameValues(items: HarNameValue[] | undefined): Header[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => typeof i?.name === "string")
    .map((i) => ({ name: str(i.name), value: str(i.value) }));
}

function mapCookies(items: HarNameValue[] | undefined): Cookie[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => typeof i?.name === "string")
    .map((i) => {
      const c: Cookie = { name: str(i.name), value: str(i.value) };
      // Preserve any extra string attributes (path, domain, expires, ...).
      for (const [k, v] of Object.entries(i)) {
        if (k !== "name" && k !== "value" && typeof v === "string") c[k] = v;
      }
      return c;
    });
}

function buildRequestBody(post: HarPostData | undefined): Body | undefined {
  if (!post) return undefined;
  const mimeType = str(post.mimeType) || undefined;
  if (typeof post.text === "string" && post.text.length > 0) {
    const bytes = textToBytes(post.text);
    const body: Body = { bytes, size: bytes.length };
    if (mimeType) body.mimeType = mimeType;
    if (isTextualMime(baseMime(mimeType)) || mimeType === undefined) body.text = post.text;
    return body;
  }
  if (Array.isArray(post.params) && post.params.length > 0) {
    const text = post.params
      .map((p) => `${str(p.name)}=${str(p.value)}`)
      .join("&");
    const bytes = textToBytes(text);
    const body: Body = { bytes, size: bytes.length, text };
    body.mimeType = mimeType ?? "application/x-www-form-urlencoded";
    return body;
  }
  return undefined;
}

function buildResponseBody(content: HarContent | undefined): Body {
  if (!content) return { size: 0 };
  const mimeType = str(content.mimeType) || undefined;
  const size = num(content.size, undefined as unknown as number);
  const text = typeof content.text === "string" ? content.text : undefined;
  const encoding = str(content.encoding) || undefined;

  const body: Body = {};
  if (mimeType) body.mimeType = mimeType;
  if (typeof size === "number") body.size = size;

  if (text === undefined) return body;

  if (encoding === "base64") {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(text);
    } catch {
      // Malformed base64: keep the literal text, do not throw on one bad entry.
      body.text = text;
      return body;
    }
    body.bytes = bytes;
    if (body.size === undefined) body.size = bytes.length;
    if (isTextualMime(baseMime(mimeType))) body.text = bytesToText(bytes);
  } else {
    body.text = text;
    body.bytes = textToBytes(text);
    if (body.size === undefined) body.size = body.bytes.length;
  }
  return body;
}

function timings(t: Record<string, unknown> | undefined): Record<string, number> | undefined {
  if (!t || typeof t !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function entryToFlow(entry: HarEntry, index: number): Flow {
  const req = entry.request ?? {};
  const res = entry.response ?? {};
  const url = str(req.url);

  const declaredQuery = mapNameValues(req.queryString) as QueryParam[];
  const request: FlowRequest = {
    method: str(req.method, "GET").toUpperCase(),
    url,
    headers: mapNameValues(req.headers),
    queryString: declaredQuery.length ? declaredQuery : parseQueryString(url),
    cookies: mapCookies(req.cookies),
  };
  const reqVer = str(req.httpVersion);
  if (reqVer) request.httpVersion = reqVer;
  const postBody = buildRequestBody(req.postData);
  if (postBody) request.postData = postBody;

  const response: FlowResponse = {
    status: num(res.status),
    headers: mapNameValues(res.headers),
    cookies: mapCookies(res.cookies),
    content: buildResponseBody(res.content),
  };
  const statusText = str(res.statusText);
  if (statusText) response.statusText = statusText;
  const resVer = str(res.httpVersion);
  if (resVer) response.httpVersion = resVer;
  const redirect = str(res.redirectURL);
  if (redirect) response.redirectURL = redirect;

  const flow: Flow = {
    id: `har-${index}`,
    index,
    source: "har",
    request,
    response,
  };
  const started = str(entry.startedDateTime);
  if (started) flow.startedDateTime = started;
  const t = timings(entry.timings);
  if (t) flow.timings = t;
  const ip = str(entry.serverIPAddress);
  if (ip) flow.serverIPAddress = ip;
  return flow;
}

export const harParser: FlowParser = {
  id: "har",

  canParse(input: ParseInput): boolean {
    if (/\.har$/i.test(input.name)) return true;
    // Magic: JSON starting with '{' or '['.
    const b = firstNonWhitespaceByte(input.bytes);
    return b === 0x7b || b === 0x5b; // '{' or '['
  },

  async parse(input: ParseInput): Promise<Flow[]> {
    let json: HarLog;
    try {
      json = JSON.parse(bytesToText(input.bytes)) as HarLog;
    } catch {
      throw new ParserError("malformed", "File is not valid JSON.", {
        parser: "har",
        fileName: input.name,
      });
    }
    const entries = json?.log?.entries;
    if (!Array.isArray(entries)) {
      throw new ParserError("malformed", "Not a HAR file: missing log.entries.", {
        parser: "har",
        fileName: input.name,
      });
    }
    return entries.map((e, i) => entryToFlow(e, i));
  },
};
