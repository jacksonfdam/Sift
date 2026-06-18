import type { Body, Header } from "../model/flow.js";
import { bytesToLatin1, indexOfDoubleCRLF } from "./bytes.js";
import { buildBody, dechunk, decompressBody } from "./decode.js";

export interface RawHead {
  startLine: string;
  headers: Header[];
  /** Body bytes exactly as they appeared after the blank line (still encoded). */
  rawBody: Uint8Array;
}

/**
 * Split a raw HTTP message into its start line, headers, and (still-encoded)
 * body. Shared by request and response parsing. Header bytes are read as
 * latin1 so byte values round-trip; the body is left as raw bytes.
 */
export function splitRawMessage(bytes: Uint8Array): RawHead {
  const sep = indexOfDoubleCRLF(bytes);
  const headBytes = sep >= 0 ? bytes.subarray(0, sep) : bytes;
  const rawBody = sep >= 0 ? bytes.subarray(sep + 4) : new Uint8Array(0);

  const headText = bytesToLatin1(headBytes);
  const lines = headText.split("\r\n");
  const startLine = lines.shift() ?? "";

  const headers: Header[] = [];
  for (const line of lines) {
    if (line === "") continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name) headers.push({ name, value });
  }
  return { startLine, headers, rawBody };
}

export function findHeader(headers: Header[], name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lower) return h.value;
  }
  return undefined;
}

/**
 * Process a raw (encoded) body using its headers: de-chunk if
 * `Transfer-Encoding: chunked`, then decompress per `Content-Encoding`. Returns
 * a display-ready {@link Body}. `br` bodies are returned raw with an undecoded
 * badge rather than failing.
 */
export function processBody(rawBody: Uint8Array, headers: Header[]): Body | undefined {
  const transferEncoding = findHeader(headers, "Transfer-Encoding");
  const contentEncoding = findHeader(headers, "Content-Encoding");
  const contentType = findHeader(headers, "Content-Type");

  if (rawBody.length === 0) return undefined;

  let bytes = rawBody;
  if (transferEncoding && /chunked/i.test(transferEncoding)) {
    bytes = dechunk(bytes);
  }

  const { bytes: decoded, undecoded } = decompressBody(bytes, contentEncoding);

  const opts: Parameters<typeof buildBody>[1] = {};
  if (contentType) opts.mimeType = contentType;
  if (contentEncoding) opts.encoding = contentEncoding;
  if (undecoded) opts.undecodedEncoding = undecoded;
  return buildBody(decoded, opts);
}

const REQUEST_LINE = /^([A-Z]+)\s+(\S+)\s+(HTTP\/[\d.]+)\s*$/i;
const STATUS_LINE = /^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)$/i;

export interface ParsedRequestLine {
  method: string;
  target: string;
  httpVersion: string;
}

export function parseRequestLine(line: string): ParsedRequestLine | undefined {
  const m = REQUEST_LINE.exec(line.trim());
  if (!m) return undefined;
  return { method: m[1]!.toUpperCase(), target: m[2]!, httpVersion: m[3]! };
}

export interface ParsedStatusLine {
  httpVersion: string;
  status: number;
  statusText: string;
}

export function parseStatusLine(line: string): ParsedStatusLine | undefined {
  const m = STATUS_LINE.exec(line.trim());
  if (!m) return undefined;
  return { httpVersion: m[1]!, status: parseInt(m[2]!, 10), statusText: m[3] ?? "" };
}

/**
 * Reconstruct an absolute URL from a request target + Host header. Handles
 * origin-form (`/path`), absolute-form (`http://...`), and authority-form
 * (CONNECT `host:port`). Scheme defaults to the supplied hint or `http`.
 */
export function reconstructUrl(
  target: string,
  host: string | undefined,
  schemeHint?: "http" | "https",
): string {
  if (/^https?:\/\//i.test(target)) return target;
  const scheme = schemeHint ?? "http";
  if (target.includes("://")) return target;
  // authority-form (CONNECT): "example.com:443"
  if (!target.startsWith("/") && /^[^/]+:\d+$/.test(target)) {
    return `${scheme}://${target}`;
  }
  const h = host ?? "";
  const path = target.startsWith("/") ? target : `/${target}`;
  return h ? `${scheme}://${h}${path}` : path;
}

/** Parse a request's `Cookie:` header into name/value cookies. */
export function parseCookieHeader(value: string): { name: string; value: string }[] {
  return value
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return { name: pair, value: "" };
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
    });
}

/** Parse a response `Set-Cookie:` header into a cookie with attributes. */
export function parseSetCookie(value: string): Record<string, string> & {
  name: string;
  value: string;
} {
  const parts = value.split(";").map((p) => p.trim());
  const first = parts.shift() ?? "";
  const eq = first.indexOf("=");
  const name = eq >= 0 ? first.slice(0, eq).trim() : first;
  const val = eq >= 0 ? first.slice(eq + 1).trim() : "";
  const cookie: Record<string, string> & { name: string; value: string } = {
    name,
    value: val,
  };
  for (const attr of parts) {
    if (!attr) continue;
    const aeq = attr.indexOf("=");
    if (aeq >= 0) {
      cookie[attr.slice(0, aeq).trim().toLowerCase()] = attr.slice(aeq + 1).trim();
    } else {
      cookie[attr.toLowerCase()] = "true";
    }
  }
  return cookie;
}

/** Extract query params from an absolute or relative URL string. */
export function parseQueryString(url: string): { name: string; value: string }[] {
  const q = url.indexOf("?");
  if (q < 0) return [];
  const search = url.slice(q + 1);
  const hash = search.indexOf("#");
  const clean = hash >= 0 ? search.slice(0, hash) : search;
  if (!clean) return [];
  const params: { name: string; value: string }[] = [];
  for (const pair of clean.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : "";
    params.push({ name: safeDecode(name), value: safeDecode(value) });
  }
  return params;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}
