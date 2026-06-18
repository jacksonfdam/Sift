// Verifies the privacy guarantees against the BUILT artifacts (not just
// source): no storage APIs, no network egress symbols. Run after building.
//
//   pnpm build && node scripts/verify-egress.mjs
//
// Exits non-zero if any forbidden symbol appears in a shipped bundle.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "chrome.storage",
  "XMLHttpRequest",
  "sendBeacon",
  "EventSource",
  "WebSocket",
  /fetch\s*\(/,
];

const TARGETS = [
  join(root, "apps/standalone/dist"),
  join(root, "apps/extension/dist"),
];

function jsAndHtml(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsAndHtml(full));
    else if (/\.(js|html|mjs|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

let failures = 0;
let scanned = 0;
const missing = [];

for (const target of TARGETS) {
  if (!existsSync(target)) {
    missing.push(target);
    continue;
  }
  for (const file of jsAndHtml(target)) {
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const sym of FORBIDDEN) {
      const re = sym instanceof RegExp ? sym : new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (re.test(text)) {
        console.error(`✗ ${sym} found in ${file.replace(root + "/", "")}`);
        failures++;
      }
    }
  }
}

if (missing.length) {
  console.error("Build artifacts not found — run `pnpm build` first:");
  for (const m of missing) console.error("  " + m.replace(root + "/", ""));
  process.exit(2);
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} forbidden symbol(s) in built bundles.`);
  process.exit(1);
}

console.log(`✓ Zero egress / zero storage verified across ${scanned} built file(s).`);
