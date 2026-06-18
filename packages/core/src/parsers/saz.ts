import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { Cookie, Flow, FlowRequest, FlowResponse } from "../model/flow.js";
import { startsWith } from "../util/bytes.js";
import {
  findHeader,
  parseCookieHeader,
  parseQueryString,
  parseRequestLine,
  parseSetCookie,
  parseStatusLine,
  processBody,
  reconstructUrl,
  splitRawMessage,
} from "../util/http-raw.js";
import { ParserError, type FlowParser, type ParseInput } from "./types.js";

const ZIP_LOCAL = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

/**
 * Scan ZIP local-file headers for the "encrypted" general-purpose bit (bit 0).
 * fflate cannot read encrypted entries, so we detect and fail clearly instead
 * of producing a confusing low-level error.
 */
function hasEncryptedEntry(bytes: Uint8Array): boolean {
  for (let i = 0; i + 8 < bytes.length; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 &&
      bytes[i + 3] === 0x04
    ) {
      const flag = bytes[i + 6]! | (bytes[i + 7]! << 8);
      if (flag & 0x1) return true;
    }
  }
  return false;
}

interface SessionFiles {
  client?: Uint8Array;
  server?: Uint8Array;
  meta?: Uint8Array;
}

const RAW_PATH = /(?:^|\/)raw\/[^/]*?(\d+)_([csm])\.(?:txt|xml)$/i;

function groupSessions(entries: Record<string, Uint8Array>): Map<number, SessionFiles> {
  const sessions = new Map<number, SessionFiles>();
  for (const [path, data] of Object.entries(entries)) {
    const m = RAW_PATH.exec(path);
    if (!m) continue;
    const id = parseInt(m[1]!, 10);
    const kind = m[2]!.toLowerCase();
    let entry = sessions.get(id);
    if (!entry) {
      entry = {};
      sessions.set(id, entry);
    }
    if (kind === "c") entry.client = data;
    else if (kind === "s") entry.server = data;
    else if (kind === "m") entry.meta = data;
  }
  return sessions;
}

const metaXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
});

/** Best-effort metadata: timing + flags. Never blocks parsing. */
function readMeta(metaBytes: Uint8Array | undefined): {
  meta: Record<string, string>;
  timings?: Record<string, number>;
  https: boolean;
} {
  const meta: Record<string, string> = {};
  let https = false;
  if (!metaBytes || metaBytes.length === 0) return { meta, https };

  try {
    const text = new TextDecoder().decode(metaBytes);
    const doc = metaXmlParser.parse(text) as Record<string, unknown>;
    const session = (doc?.["Session"] ?? {}) as Record<string, unknown>;

    const bitFlags = session["@_BitFlags"];
    if (typeof bitFlags === "string") {
      const n = parseInt(bitFlags, 10);
      if (Number.isFinite(n) && n & 0x1) https = true; // IsHTTPS hint
    }

    // SessionFlags → flat string map (skip obvious secrets defensively).
    const flagsContainer = (session["SessionFlags"] ?? {}) as Record<string, unknown>;
    const flags = flagsContainer["SessionFlag"];
    const flagList = Array.isArray(flags) ? flags : flags ? [flags] : [];
    for (const f of flagList) {
      const rec = f as Record<string, unknown>;
      const name = rec["@_N"];
      const value = rec["@_V"];
      if (typeof name === "string" && typeof value === "string") {
        meta[name] = value;
        if (name.toLowerCase() === "x-egressport" && value === "443") https = true;
      }
    }

    const timers = (session["SessionTimers"] ?? {}) as Record<string, unknown>;
    const total = computeDuration(
      asString(timers["@_ClientConnected"]),
      asString(timers["@_ClientDoneResponse"]),
    );
    if (total !== undefined) return { meta, timings: { total }, https };
  } catch {
    // Best-effort: ignore malformed metadata entirely.
  }
  return { meta, https };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function computeDuration(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return undefined;
  return b - a;
}

function parseSession(
  id: number,
  files: SessionFiles,
  index: number,
): Flow | undefined {
  if (!files.client) return undefined;

  const { meta, timings, https } = readMeta(files.meta);
  const schemeHint = https ? "https" : "http";

  // Request
  const reqMsg = splitRawMessage(files.client);
  const reqLine = parseRequestLine(reqMsg.startLine);
  if (!reqLine) return undefined;
  const host = findHeader(reqMsg.headers, "Host");
  const url = reconstructUrl(reqLine.target, host, schemeHint);

  const reqCookies: Cookie[] = [];
  const cookieHeader = findHeader(reqMsg.headers, "Cookie");
  if (cookieHeader) {
    for (const c of parseCookieHeader(cookieHeader)) reqCookies.push(c);
  }

  const request: FlowRequest = {
    method: reqLine.method,
    url,
    httpVersion: reqLine.httpVersion,
    headers: reqMsg.headers,
    queryString: parseQueryString(reqLine.target),
    cookies: reqCookies,
  };
  const reqBody = processBody(reqMsg.rawBody, reqMsg.headers);
  if (reqBody) request.postData = reqBody;

  // Response (may be absent for aborted sessions).
  let response: FlowResponse = { status: 0, headers: [], cookies: [], content: {} };
  if (files.server) {
    const resMsg = splitRawMessage(files.server);
    const statusLine = parseStatusLine(resMsg.startLine);
    const resCookies: Cookie[] = [];
    for (const h of resMsg.headers) {
      if (h.name.toLowerCase() === "set-cookie") resCookies.push(parseSetCookie(h.value));
    }
    response = {
      status: statusLine?.status ?? 0,
      headers: resMsg.headers,
      cookies: resCookies,
      content: processBody(resMsg.rawBody, resMsg.headers) ?? {},
    };
    if (statusLine?.statusText) response.statusText = statusLine.statusText;
    if (statusLine?.httpVersion) response.httpVersion = statusLine.httpVersion;
  }

  const flow: Flow = {
    id: `saz-${index}`,
    index,
    source: "saz",
    request,
    response,
  };
  if (timings) flow.timings = timings;
  if (Object.keys(meta).length) flow.meta = meta;
  // Keep the numeric session id available for ordering/debugging (non-secret).
  flow.meta = { ...(flow.meta ?? {}), sazSessionId: String(id) };
  return flow;
}

export const sazParser: FlowParser = {
  id: "saz",

  canParse(input: ParseInput): boolean {
    if (/\.saz$/i.test(input.name)) return true;
    return startsWith(input.bytes, ZIP_LOCAL);
  },

  async parse(input: ParseInput): Promise<Flow[]> {
    if (hasEncryptedEntry(input.bytes)) {
      throw new ParserError(
        "encrypted",
        "This SAZ is password-protected. Re-export it without encryption to view it.",
        { parser: "saz", fileName: input.name },
      );
    }

    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(input.bytes);
    } catch {
      throw new ParserError("malformed", "Could not read the SAZ archive.", {
        parser: "saz",
        fileName: input.name,
      });
    }

    const sessions = groupSessions(entries);
    if (sessions.size === 0) {
      throw new ParserError(
        "malformed",
        "No Fiddler sessions found in this SAZ (expected a raw/ folder).",
        { parser: "saz", fileName: input.name },
      );
    }

    const orderedIds = [...sessions.keys()].sort((a, b) => a - b);
    const flows: Flow[] = [];
    let index = 0;
    for (const id of orderedIds) {
      const flow = parseSession(id, sessions.get(id)!, index);
      if (flow) {
        flows.push(flow);
        index++;
      }
    }
    if (flows.length === 0) {
      throw new ParserError("malformed", "SAZ contained no parseable sessions.", {
        parser: "saz",
        fileName: input.name,
      });
    }
    return flows;
  },
};
