/**
 * The canonical in-memory model. Every supported capture format is just a
 * serialization of the same thing: a list of request/response flows. Each
 * parser is an adapter that produces `Flow[]`; the UI, search, redaction, and
 * export operate ONLY on `Flow` and never learn which format produced it.
 */

export interface Header {
  name: string;
  value: string;
}

export interface QueryParam {
  name: string;
  value: string;
}

export interface Cookie {
  name: string;
  value: string;
  [k: string]: string | undefined;
}

export interface Body {
  /** Best-known MIME type for the payload. */
  mimeType?: string;
  /** Decoded & decompressed text, ready for display. */
  text?: string;
  /** Raw bytes, for binary preview / download. */
  bytes?: Uint8Array;
  /** Declared or computed byte length. */
  size?: number;
  /** Original transfer/content encoding, if relevant (e.g. "gzip", "br"). */
  encoding?: string;
  /** True when the body was clipped (e.g. capture-side truncation). */
  truncated?: boolean;
  /**
   * Set when an encoding could not be decoded (e.g. Brotli with fflate). The
   * UI shows the raw bytes plus this badge rather than failing.
   */
  undecodedEncoding?: string;
}

export type FlowSource = "har" | "saz" | "charles" | "live";

export interface FlowRequest {
  method: string;
  /** Absolute when known. */
  url: string;
  httpVersion?: string;
  headers: Header[];
  queryString: QueryParam[];
  cookies: Cookie[];
  postData?: Body;
}

export interface FlowResponse {
  status: number;
  statusText?: string;
  httpVersion?: string;
  headers: Header[];
  cookies: Cookie[];
  content: Body;
  redirectURL?: string;
}

export interface Flow {
  /** Stable within a session. */
  id: string;
  /** Order as parsed. */
  index: number;
  source: FlowSource;
  request: FlowRequest;
  response: FlowResponse;
  /** ISO 8601 when known. */
  startedDateTime?: string;
  timings?: Record<string, number>;
  serverIPAddress?: string;
  /** Source-specific extras (e.g. SAZ session flags). */
  meta?: Record<string, string>;
}

/** Status class used for color-coding and quick filters. */
export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "none";

export function statusClass(status: number): StatusClass {
  if (status >= 100 && status < 200) return "1xx";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "none";
}
