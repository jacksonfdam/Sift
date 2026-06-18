import type { Cookie, Flow, Header, QueryParam } from "../model/flow.js";

/**
 * Central redaction policy. Both the UI (masking for display) and the
 * sanitized HAR export consume this module, so what is hidden on screen and
 * what is stripped from an export can never drift apart.
 */

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "authentication",
  "www-authenticate",
  "proxy-authenticate",
]);

/** Header-name patterns that commonly carry secrets (API keys, tokens). */
const SENSITIVE_HEADER_PATTERN =
  /(api[-_]?key|access[-_]?token|auth[-_]?token|x-?auth|secret|x-amz-security-token|x-csrf|x-xsrf|bearer|session[-_]?id)/i;

/** Query-param names that commonly carry secrets. */
const SENSITIVE_QUERY_PATTERN =
  /(token|api[-_]?key|apikey|access[-_]?token|auth|secret|password|sig|signature|session)/i;

/** Heuristic: a value that "looks like" a token (JWT, long opaque string). */
const TOKEN_SHAPED = /^(eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_\-+/=]{24,})$/;

export function isSensitiveHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return SENSITIVE_HEADERS.has(lower) || SENSITIVE_HEADER_PATTERN.test(lower);
}

/** Cookie values are always treated as sensitive. */
export function isSensitiveCookie(_name: string): boolean {
  return true;
}

export function isSensitiveQueryParam(name: string, value: string): boolean {
  if (SENSITIVE_QUERY_PATTERN.test(name)) return true;
  return TOKEN_SHAPED.test(value);
}

export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** A short, content-free mask. Length is fixed so it never leaks value length. */
export function maskedDisplay(): string {
  return "••••••••";
}

/** Should this header's value be masked given the current reveal state? */
export function shouldMaskHeader(h: Header, revealAll: boolean): boolean {
  return !revealAll && isSensitiveHeader(h.name);
}

export function shouldMaskCookie(_c: Cookie, revealAll: boolean): boolean {
  return !revealAll;
}

export function shouldMaskQueryParam(q: QueryParam, revealAll: boolean): boolean {
  return !revealAll && isSensitiveQueryParam(q.name, q.value);
}

/** Replace a sensitive value with the export placeholder (for sanitized HAR). */
export function sanitizeHeaderValue(h: Header): string {
  return isSensitiveHeader(h.name) ? REDACTED_PLACEHOLDER : h.value;
}

export function sanitizeCookieValue(_c: Cookie): string {
  return REDACTED_PLACEHOLDER;
}

export function sanitizeQueryValue(q: QueryParam): string {
  return isSensitiveQueryParam(q.name, q.value) ? REDACTED_PLACEHOLDER : q.value;
}

/** Does a flow contain anything that would be masked? (for UI summaries) */
export function flowHasSecrets(flow: Flow): boolean {
  if (flow.request.headers.some(isSensitiveHeaderH)) return true;
  if (flow.response.headers.some(isSensitiveHeaderH)) return true;
  if (flow.request.cookies.length > 0 || flow.response.cookies.length > 0) return true;
  if (flow.request.queryString.some((q) => isSensitiveQueryParam(q.name, q.value))) return true;
  return false;
}

function isSensitiveHeaderH(h: Header): boolean {
  return isSensitiveHeader(h.name);
}
