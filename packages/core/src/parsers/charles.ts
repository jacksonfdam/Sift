import { XMLParser } from "fast-xml-parser";
import type { Body, Cookie, Flow, FlowRequest, FlowResponse, Header } from "../model/flow.js";
import {
  base64ToBytes,
  bytesToText,
  firstNonWhitespaceByte,
  textToBytes,
} from "../util/bytes.js";
import { baseMime, isTextualMime } from "../util/mime.js";
import {
  parseCookieHeader,
  parseQueryString,
  parseRequestLine,
  parseSetCookie,
  parseStatusLine,
} from "../util/http-raw.js";
import { ParserError, type FlowParser, type ParseInput } from "./types.js";

/* ------------------------------------------------------------------ *
 * Charles XML
 *
 * The exact schema varies across Charles versions, so this parser reads
 * defensively: every field is looked up as either an attribute or a child
 * element, and headers are collected by structure (any node with name+value)
 * rather than by a fixed path.
 * ------------------------------------------------------------------ */

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Get the scalar text of a node value, whether plain string or { #text }. */
function scalar(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (isNode(v) && typeof v["#text"] === "string") return v["#text"];
  return undefined;
}

/** First present value among attribute (@_name) or child element, by name list. */
function pick(node: Node, ...names: string[]): string | undefined {
  for (const name of names) {
    const attr = node[`@_${name}`];
    if (typeof attr === "string") return attr;
    const child = scalar(node[name]);
    if (child !== undefined) return child;
  }
  return undefined;
}

/** Recursively collect {name,value} header pairs within a subtree. */
function collectHeaders(subtree: unknown): Header[] {
  const out: Header[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (!isNode(v)) return;
    const name = scalar(v["name"]) ?? (typeof v["@_name"] === "string" ? v["@_name"] : undefined);
    const value =
      scalar(v["value"]) ?? (typeof v["@_value"] === "string" ? v["@_value"] : undefined);
    if (name !== undefined && value !== undefined) {
      out.push({ name, value });
      return; // a header leaf; don't descend further
    }
    for (const key of Object.keys(v)) {
      if (key.startsWith("@_") || key === "#text") continue;
      visit(v[key]);
    }
  };
  // Only descend through structures named like header containers when possible,
  // but fall back to scanning the whole subtree.
  visit(subtree);
  return out;
}

/** Extract a body from a request/response subtree. */
function extractBody(part: Node | undefined, headerMime: string | undefined): Body | undefined {
  if (!part) return undefined;
  const bodyNode = isNode(part["body"]) ? (part["body"] as Node) : part;

  const mimeType =
    pick(bodyNode, "mimeType", "contentType") ??
    pick(part, "mimeType", "contentType") ??
    headerMime;

  // Charles stores body text under <text> (sometimes base64) or directly.
  const textNode = bodyNode["text"];
  const encodingAttr =
    (isNode(textNode) && typeof textNode["@_encoding"] === "string"
      ? textNode["@_encoding"]
      : undefined) ?? pick(bodyNode, "encoding");

  const rawText = scalar(textNode) ?? scalar(bodyNode["#text"]);
  if (rawText === undefined || rawText === "") return undefined;

  const body: Body = {};
  if (mimeType) body.mimeType = mimeType;

  if (encodingAttr && /base64/i.test(encodingAttr)) {
    try {
      const bytes = base64ToBytes(rawText);
      body.bytes = bytes;
      body.size = bytes.length;
      if (isTextualMime(baseMime(mimeType))) body.text = bytesToText(bytes);
      return body;
    } catch {
      body.text = rawText;
      return body;
    }
  }
  body.text = rawText;
  body.bytes = textToBytes(rawText);
  body.size = body.bytes.length;
  return body;
}

function headerMimeOf(headers: Header[]): string | undefined {
  for (const h of headers) {
    if (h.name.toLowerCase() === "content-type") return h.value;
  }
  return undefined;
}

function buildUrl(t: Node): string {
  // Prefer an explicit absolute URL if present.
  const explicit = pick(t, "url", "uri");
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;

  const scheme = (pick(t, "scheme", "protocol") ?? "http").toLowerCase().replace(/[^a-z]/g, "") || "http";
  const host = pick(t, "host", "remoteHost") ?? "";
  const port = pick(t, "actualPort", "port");
  const path = pick(t, "path") ?? "/";
  let query = pick(t, "query") ?? "";
  if (query && !query.startsWith("?")) query = `?${query}`;

  const defaultPort = scheme === "https" ? "443" : "80";
  const authority = port && port !== defaultPort ? `${host}:${port}` : host;
  if (!host) return `${path}${query}`;
  return `${scheme}://${authority}${path}${query}`;
}

function transactionToFlow(t: Node, index: number): Flow | undefined {
  const method = (pick(t, "method") ?? "GET").toUpperCase();
  const url = buildUrl(t);

  const reqPart = isNode(t["request"]) ? (t["request"] as Node) : undefined;
  const resPart = isNode(t["response"]) ? (t["response"] as Node) : undefined;

  const reqHeaders = collectHeaders(reqPart ?? {});
  const resHeaders = collectHeaders(resPart ?? {});

  // Cookies derived from headers.
  const reqCookies: Cookie[] = [];
  for (const h of reqHeaders) {
    if (h.name.toLowerCase() === "cookie") {
      for (const c of parseCookieHeader(h.value)) reqCookies.push(c);
    }
  }
  const resCookies: Cookie[] = [];
  for (const h of resHeaders) {
    if (h.name.toLowerCase() === "set-cookie") resCookies.push(parseSetCookie(h.value));
  }

  const request: FlowRequest = {
    method,
    url,
    headers: reqHeaders,
    queryString: parseQueryString(url),
    cookies: reqCookies,
  };
  const protoVer = pick(t, "protocolVersion");
  if (protoVer) request.httpVersion = protoVer;
  const reqBody = extractBody(reqPart, headerMimeOf(reqHeaders));
  if (reqBody) request.postData = reqBody;

  const statusStr = pick(t, "responseCode", "status", "code");
  const status = statusStr ? parseInt(statusStr, 10) || 0 : 0;
  const response: FlowResponse = {
    status,
    headers: resHeaders,
    cookies: resCookies,
    content: extractBody(resPart, headerMimeOf(resHeaders)) ?? {},
  };

  const flow: Flow = { id: `charles-${index}`, index, source: "charles", request, response };
  const started = pick(t, "startTime", "requestBeginTime", "transactionBegin");
  if (started) flow.startedDateTime = started;
  return flow;
}

function parseCharlesXml(input: ParseInput): Flow[] {
  let doc: Node;
  try {
    doc = xml.parse(bytesToText(input.bytes)) as Node;
  } catch {
    throw new ParserError("malformed", "Could not parse Charles XML.", {
      parser: "charles",
      fileName: input.name,
    });
  }
  const root = (doc["charles-session"] ?? doc["session"] ?? doc) as Node;
  const transactions = asArray(root["transaction"] ?? root["transactions"]);
  if (transactions.length === 0) {
    throw new ParserError("malformed", "No transactions found in Charles session.", {
      parser: "charles",
      fileName: input.name,
    });
  }
  const flows: Flow[] = [];
  let index = 0;
  for (const t of transactions) {
    if (!isNode(t)) continue;
    const flow = transactionToFlow(t, index);
    if (flow) {
      flows.push(flow);
      index++;
    }
  }
  if (flows.length === 0) {
    throw new ParserError("malformed", "Charles session had no HTTP transactions.", {
      parser: "charles",
      fileName: input.name,
    });
  }
  return flows;
}

/* ------------------------------------------------------------------ *
 * Charles .trace (plain text)
 *
 * Transactions are separated by a delimiter line; each block holds a raw
 * request followed by a raw response, themselves separated by a blank line.
 * The exact delimiter is detected from the content rather than hardcoded.
 * ------------------------------------------------------------------ */

const TRACE_DELIM = /^[=\-]{3,}.*$/;

function parseTraceText(text: string, fileName: string): Flow[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (TRACE_DELIM.test(line.trim())) {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const flows: Flow[] = [];
  let index = 0;
  for (const block of blocks) {
    const flow = parseTraceBlock(block, index);
    if (flow) {
      flows.push(flow);
      index++;
    }
  }
  if (flows.length === 0) {
    throw new ParserError("malformed", "No transactions found in Charles trace.", {
      parser: "charles",
      fileName,
    });
  }
  return flows;
}

function parseTraceBlock(block: string[], index: number): Flow | undefined {
  // Find request start (a request line) and split request/response on a blank
  // line that precedes a status line.
  let reqStart = -1;
  for (let i = 0; i < block.length; i++) {
    if (parseRequestLine(block[i]!.trim())) {
      reqStart = i;
      break;
    }
  }
  if (reqStart < 0) return undefined;

  const reqLine = parseRequestLine(block[reqStart]!.trim())!;
  const reqHeaders: Header[] = [];
  let i = reqStart + 1;
  for (; i < block.length; i++) {
    const line = block[i]!;
    if (line.trim() === "") break;
    const colon = line.indexOf(":");
    if (colon > 0) {
      reqHeaders.push({ name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() });
    }
  }

  // Locate response status line in the remainder.
  let resStart = -1;
  for (let j = i; j < block.length; j++) {
    if (parseStatusLine(block[j]!.trim())) {
      resStart = j;
      break;
    }
  }
  const resHeaders: Header[] = [];
  let status = 0;
  let statusText = "";
  let resVer = "";
  if (resStart >= 0) {
    const sl = parseStatusLine(block[resStart]!.trim())!;
    status = sl.status;
    statusText = sl.statusText;
    resVer = sl.httpVersion;
    for (let k = resStart + 1; k < block.length; k++) {
      const line = block[k]!;
      if (line.trim() === "") break;
      const colon = line.indexOf(":");
      if (colon > 0) {
        resHeaders.push({ name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() });
      }
    }
  }

  const host = reqHeaders.find((h) => h.name.toLowerCase() === "host")?.value;
  const scheme = "http";
  const url =
    /^https?:\/\//i.test(reqLine.target)
      ? reqLine.target
      : host
        ? `${scheme}://${host}${reqLine.target.startsWith("/") ? "" : "/"}${reqLine.target}`
        : reqLine.target;

  const reqCookies: Cookie[] = [];
  for (const h of reqHeaders) {
    if (h.name.toLowerCase() === "cookie") {
      for (const c of parseCookieHeader(h.value)) reqCookies.push(c);
    }
  }
  const resCookies: Cookie[] = [];
  for (const h of resHeaders) {
    if (h.name.toLowerCase() === "set-cookie") resCookies.push(parseSetCookie(h.value));
  }

  const request: FlowRequest = {
    method: reqLine.method,
    url,
    httpVersion: reqLine.httpVersion,
    headers: reqHeaders,
    queryString: parseQueryString(reqLine.target),
    cookies: reqCookies,
  };
  const response: FlowResponse = {
    status,
    headers: resHeaders,
    cookies: resCookies,
    content: {},
  };
  if (statusText) response.statusText = statusText;
  if (resVer) response.httpVersion = resVer;

  return { id: `charles-${index}`, index, source: "charles", request, response };
}

export const charlesParser: FlowParser = {
  id: "charles",

  canParse(input: ParseInput): boolean {
    if (/\.trace$/i.test(input.name)) return true;
    if (/\.xml$/i.test(input.name)) return true;
    // Magic: XML starts with '<'.
    return firstNonWhitespaceByte(input.bytes) === 0x3c; // '<'
  },

  async parse(input: ParseInput): Promise<Flow[]> {
    const first = firstNonWhitespaceByte(input.bytes);
    const looksXml = first === 0x3c || /\.xml$/i.test(input.name);
    if (looksXml) return parseCharlesXml(input);
    return parseTraceText(bytesToText(input.bytes), input.name);
  },
};
