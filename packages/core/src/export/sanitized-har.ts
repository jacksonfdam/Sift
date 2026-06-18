import type { Body, Cookie, Flow, Header, QueryParam } from "../model/flow.js";
import { bytesToBase64 } from "../util/bytes.js";
import { baseMime, isTextualMime } from "../util/mime.js";
import {
  REDACTED_PLACEHOLDER,
  sanitizeCookieValue,
  sanitizeHeaderValue,
  sanitizeQueryValue,
  isSensitiveQueryParam,
} from "../redaction/policy.js";

/**
 * Produce a valid HAR 1.2 object from `Flow[]` with all sensitive values
 * replaced by a placeholder. This is the one place Sift emits output — and
 * only via a user-initiated download (see {@link downloadSanitizedHar}); it
 * never writes automatically.
 */

interface HarNameValue {
  name: string;
  value: string;
}

function sanitizeUrl(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const base = url.slice(0, q);
  const search = url.slice(q + 1);
  const parts = search.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 0) return pair;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const decodedName = safeDecode(name);
    const decodedValue = safeDecode(value);
    return isSensitiveQueryParam(decodedName, decodedValue)
      ? `${name}=${encodeURIComponent(REDACTED_PLACEHOLDER)}`
      : pair;
  });
  return `${base}?${parts.join("&")}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

function harHeaders(headers: Header[]): HarNameValue[] {
  return headers.map((h) => ({ name: h.name, value: sanitizeHeaderValue(h) }));
}

function harQuery(query: QueryParam[]): HarNameValue[] {
  return query.map((q) => ({ name: q.name, value: sanitizeQueryValue(q) }));
}

function harCookies(cookies: Cookie[]): Record<string, string>[] {
  return cookies.map((c) => {
    const out: Record<string, string> = { name: c.name, value: sanitizeCookieValue(c) };
    for (const [k, v] of Object.entries(c)) {
      if (k !== "name" && k !== "value" && typeof v === "string") out[k] = v;
    }
    return out;
  });
}

function harPostData(body: Body | undefined): Record<string, unknown> | undefined {
  if (!body) return undefined;
  const mimeType = body.mimeType ?? "application/octet-stream";
  const post: Record<string, unknown> = { mimeType };
  if (body.text !== undefined) post["text"] = body.text;
  else if (body.bytes) post["text"] = "";
  return post;
}

function harContent(body: Body): Record<string, unknown> {
  const content: Record<string, unknown> = {
    size: body.size ?? body.bytes?.length ?? 0,
    mimeType: body.mimeType ?? "",
  };
  if (body.text !== undefined && isTextualMime(baseMime(body.mimeType))) {
    content["text"] = body.text;
  } else if (body.bytes && body.bytes.length > 0) {
    content["text"] = bytesToBase64(body.bytes);
    content["encoding"] = "base64";
  }
  return content;
}

function flowToEntry(flow: Flow): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    startedDateTime: flow.startedDateTime ?? new Date(0).toISOString(),
    time: flow.timings?.["total"] ?? 0,
    request: {
      method: flow.request.method,
      url: sanitizeUrl(flow.request.url),
      httpVersion: flow.request.httpVersion ?? "HTTP/1.1",
      headers: harHeaders(flow.request.headers),
      queryString: harQuery(flow.request.queryString),
      cookies: harCookies(flow.request.cookies),
      headersSize: -1,
      bodySize: flow.request.postData?.size ?? -1,
      ...(flow.request.postData ? { postData: harPostData(flow.request.postData) } : {}),
    },
    response: {
      status: flow.response.status,
      statusText: flow.response.statusText ?? "",
      httpVersion: flow.response.httpVersion ?? "HTTP/1.1",
      headers: harHeaders(flow.response.headers),
      cookies: harCookies(flow.response.cookies),
      content: harContent(flow.response.content),
      redirectURL: flow.response.redirectURL ?? "",
      headersSize: -1,
      bodySize: flow.response.content.size ?? -1,
    },
    cache: {},
    timings: flow.timings ?? { send: 0, wait: 0, receive: 0 },
  };
  if (flow.serverIPAddress) entry["serverIPAddress"] = flow.serverIPAddress;
  return entry;
}

export function buildSanitizedHar(flows: Flow[]): unknown {
  return {
    log: {
      version: "1.2",
      creator: { name: "Sift", version: "0.1.0" },
      entries: flows.map(flowToEntry),
    },
  };
}

/**
 * Trigger a user-initiated download of the sanitized HAR. Builds an in-memory
 * Blob and revokes the object URL afterwards — no persistence, no auto-write.
 */
export function downloadSanitizedHar(flows: Flow[], fileName = "sanitized-capture.har"): void {
  const json = JSON.stringify(buildSanitizedHar(flows), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
