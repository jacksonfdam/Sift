import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Guard: the core must contain no persistence or network egress. We scan the
 * source for forbidden symbols. The UI download path is allowed to use Blob +
 * createObjectURL (user-initiated, in-memory), but nothing here may reach for
 * storage or the network.
 */
const FORBIDDEN = [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/i,
  /\bchrome\s*\.\s*storage\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\s*\.\s*sendBeacon\b/,
  /\bEventSource\b/,
  /\bWebSocket\b/,
  /\bcaches\b/,
];

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("zero egress / zero persistence guard", () => {
  const files = walk(srcDir);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const pattern of FORBIDDEN) {
    it(`no source references ${pattern}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(offenders).toEqual([]);
    });
  }
});
