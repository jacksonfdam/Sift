/** MIME classification used to decide text-vs-binary and syntax highlighting. */

export type BodyKind = "json" | "xml" | "html" | "css" | "js" | "text" | "binary";

const TEXTUAL = /^(text\/|application\/(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql)|.*\+(json|xml)\b)/i;

export function isTextualMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return TEXTUAL.test(mimeType.trim());
}

export function bodyKind(mimeType: string | undefined): BodyKind {
  const m = (mimeType ?? "").toLowerCase();
  if (/json/.test(m)) return "json";
  if (/html/.test(m)) return "html";
  if (/(xml|\+xml)/.test(m)) return "xml";
  if (/css/.test(m)) return "css";
  if (/(javascript|ecmascript)/.test(m)) return "js";
  if (m.startsWith("text/")) return "text";
  if (m === "") return "text";
  return "binary";
}

/** Strip charset/boundary params: "application/json; charset=utf-8" → "application/json". */
export function baseMime(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;
  const semi = mimeType.indexOf(";");
  return (semi >= 0 ? mimeType.slice(0, semi) : mimeType).trim().toLowerCase();
}
