import type { BodyKind } from "../util/mime.js";

/**
 * Minimal, dependency-free syntax highlighter. It returns tokens (never HTML)
 * so the UI renders them as escaped <span>s — capture content is untrusted and
 * must never be injected as markup. Coverage is pragmatic, not a full grammar.
 */

export type TokenClass =
  | "key"
  | "str"
  | "num"
  | "bool"
  | "punct"
  | "tag"
  | "attr"
  | "comment"
  | "kw"
  | "plain";

export interface Token {
  text: string;
  cls: TokenClass;
}

interface Rule {
  re: RegExp;
  cls: TokenClass | ((match: RegExpExecArray) => TokenClass);
}

/** Scan text with ordered rules; gaps become plain tokens. */
function tokenize(text: string, rules: Rule[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;
  outer: while (i < n) {
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(text);
      if (m && m.index === i && m[0].length > 0) {
        const cls = typeof rule.cls === "function" ? rule.cls(m) : rule.cls;
        tokens.push({ text: m[0], cls });
        i += m[0].length;
        continue outer;
      }
    }
    // No rule matched at i: accumulate one plain char (merge with previous).
    const last = tokens[tokens.length - 1];
    if (last && last.cls === "plain") last.text += text[i];
    else tokens.push({ text: text[i]!, cls: "plain" });
    i++;
  }
  return tokens;
}

const STRING = /"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"\n])*"/y;

const JSON_RULES: Rule[] = [
  {
    re: /"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"\n])*"(?=\s*:)/y,
    cls: "key",
  },
  { re: STRING, cls: "str" },
  { re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, cls: "num" },
  { re: /\b(?:true|false|null)\b/y, cls: "bool" },
  { re: /[{}[\]:,]/y, cls: "punct" },
];

const MARKUP_RULES: Rule[] = [
  { re: /<!--[\s\S]*?-->/y, cls: "comment" },
  { re: /<\/?[a-zA-Z][\w:-]*/y, cls: "tag" },
  { re: /\/?>/y, cls: "tag" },
  { re: /[a-zA-Z_:][\w:.-]*(?==)/y, cls: "attr" },
  { re: /"[^"]*"|'[^']*'/y, cls: "str" },
];

const CODE_KEYWORDS =
  /\b(?:function|return|const|let|var|if|else|for|while|new|class|import|export|from|await|async|true|false|null|undefined|this|typeof|instanceof)\b/y;

const CODE_RULES: Rule[] = [
  { re: /\/\/[^\n]*/y, cls: "comment" },
  { re: /\/\*[\s\S]*?\*\//y, cls: "comment" },
  { re: /"[^"\n]*"|'[^'\n]*'|`[^`]*`/y, cls: "str" },
  { re: CODE_KEYWORDS, cls: "kw" },
  { re: /-?\d+(?:\.\d+)?(?:[a-z%]+)?/y, cls: "num" },
  { re: /[{}()[\];:,]/y, cls: "punct" },
];

const CSS_RULES: Rule[] = [
  { re: /\/\*[\s\S]*?\*\//y, cls: "comment" },
  { re: /[.#]?[a-zA-Z_-][\w-]*(?=\s*\{)/y, cls: "tag" },
  { re: /[a-zA-Z-]+(?=\s*:)/y, cls: "attr" },
  { re: /"[^"\n]*"|'[^'\n]*'/y, cls: "str" },
  { re: /-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?/y, cls: "num" },
  { re: /[{}();:,]/y, cls: "punct" },
];

/** Cap highlighting work for very large bodies (caller also guards rendering). */
const MAX_HIGHLIGHT = 200_000;

export function highlight(text: string, kind: BodyKind): Token[] {
  if (text.length > MAX_HIGHLIGHT) return [{ text, cls: "plain" }];
  switch (kind) {
    case "json":
      return tokenize(text, JSON_RULES);
    case "xml":
    case "html":
      return tokenize(text, MARKUP_RULES);
    case "js":
      return tokenize(text, CODE_RULES);
    case "css":
      return tokenize(text, CSS_RULES);
    default:
      return [{ text, cls: "plain" }];
  }
}
