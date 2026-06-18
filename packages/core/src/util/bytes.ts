/** Byte ↔ text helpers. All decoding is lossy-tolerant (no throws). */

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
const utf8Encoder = new TextEncoder();

export function bytesToText(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

export function textToBytes(text: string): Uint8Array {
  return utf8Encoder.encode(text);
}

/** ASCII-only decode for parsing raw HTTP head sections (header bytes). */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

/** Standard base64 → bytes. Tolerates whitespace; throws nothing useful-leaking. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Find the first `\r\n\r\n` (header/body separator). Returns -1 if absent. */
export function indexOfDoubleCRLF(bytes: Uint8Array): number {
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (
      bytes[i] === 0x0d &&
      bytes[i + 1] === 0x0a &&
      bytes[i + 2] === 0x0d &&
      bytes[i + 3] === 0x0a
    ) {
      return i;
    }
  }
  return -1;
}

/** Does a byte buffer start with the given ASCII/byte prefix? */
export function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

/** Skip a UTF-8/UTF-16 BOM and leading whitespace, return first meaningful byte. */
export function firstNonWhitespaceByte(bytes: Uint8Array): number | undefined {
  let i = 0;
  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  for (; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) continue;
    return b;
  }
  return undefined;
}
