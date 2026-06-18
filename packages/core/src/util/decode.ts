import { gunzipSync, unzlibSync, inflateSync } from "fflate";
import type { Body } from "../model/flow.js";
import { bytesToText } from "./bytes.js";
import { baseMime, isTextualMime } from "./mime.js";

/**
 * Decompress a raw body given its `Content-Encoding`. gzip/deflate are handled
 * by fflate; `br` (Brotli) is NOT decodable here — the caller is told via the
 * `undecoded` flag and should surface a badge rather than fail.
 */
export function decompressBody(
  raw: Uint8Array,
  contentEncoding: string | undefined,
): { bytes: Uint8Array; undecoded?: string } {
  const enc = (contentEncoding ?? "").trim().toLowerCase();
  if (enc === "" || enc === "identity" || enc === "none") return { bytes: raw };

  // A header may list multiple encodings, e.g. "gzip, br". Use the last applied.
  const last = enc.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";

  try {
    if (last === "gzip" || last === "x-gzip") return { bytes: gunzipSync(raw) };
    if (last === "deflate") {
      // "deflate" is ambiguous: zlib-wrapped vs raw. Try zlib, fall back to raw.
      try {
        return { bytes: unzlibSync(raw) };
      } catch {
        return { bytes: inflateSync(raw) };
      }
    }
    if (last === "br" || last === "brotli") return { bytes: raw, undecoded: "br" };
  } catch {
    // Corrupt/partial compressed stream: keep raw bytes, flag the encoding.
    return { bytes: raw, undecoded: last };
  }
  // Unknown encoding: keep raw, flag it.
  return { bytes: raw, undecoded: last };
}

/**
 * De-chunk an HTTP/1.1 `Transfer-Encoding: chunked` body. Lenient: stops at the
 * terminating zero-length chunk or end of input, ignores trailers.
 */
export function dechunk(body: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [];
  let i = 0;
  const len = body.length;
  while (i < len) {
    // Read chunk-size line up to CRLF.
    let lineEnd = i;
    while (lineEnd + 1 < len && !(body[lineEnd] === 0x0d && body[lineEnd + 1] === 0x0a)) {
      lineEnd++;
    }
    if (lineEnd + 1 >= len && !(body[lineEnd] === 0x0d && body[lineEnd + 1] === 0x0a)) {
      break;
    }
    let sizeStr = "";
    for (let j = i; j < lineEnd; j++) sizeStr += String.fromCharCode(body[j]!);
    // Drop any chunk extensions after ';'.
    const semi = sizeStr.indexOf(";");
    if (semi >= 0) sizeStr = sizeStr.slice(0, semi);
    const size = parseInt(sizeStr.trim(), 16);
    if (!Number.isFinite(size) || Number.isNaN(size)) break;
    const dataStart = lineEnd + 2;
    if (size === 0) break; // last chunk
    const dataEnd = Math.min(dataStart + size, len);
    out.push(body.subarray(dataStart, dataEnd));
    // Advance past data + trailing CRLF.
    i = dataEnd + 2;
  }
  return concat(out);
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Build a {@link Body} from already-decompressed bytes: attach text only for
 * textual MIME types, keep raw bytes for binary/download, and propagate flags.
 */
export function buildBody(
  bytes: Uint8Array,
  opts: {
    mimeType?: string;
    encoding?: string;
    size?: number;
    truncated?: boolean;
    undecodedEncoding?: string;
  },
): Body {
  const body: Body = {
    bytes,
    size: opts.size ?? bytes.length,
  };
  if (opts.mimeType) body.mimeType = opts.mimeType;
  if (opts.encoding) body.encoding = opts.encoding;
  if (opts.truncated) body.truncated = true;
  if (opts.undecodedEncoding) body.undecodedEncoding = opts.undecodedEncoding;

  // Decode to text for textual types (and only if not flagged undecodable).
  if (!opts.undecodedEncoding && isTextualMime(baseMime(opts.mimeType))) {
    body.text = bytesToText(bytes);
  }
  return body;
}
