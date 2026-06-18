import { readFileSync } from "node:fs";
import { defineManifest } from "@crxjs/vite-plugin";

// Single source of truth for the version: the package.json. Bump it with
// `node scripts/version.mjs` (see that script and the README).
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

// Minimal MV3 manifest. The ONLY capability tied to DevTools is `devtools_page`.
// No permissions, no host_permissions, no content scripts, no background worker
// holding state. Strict CSP forbids remote code and eval.
// `browser_specific_settings` is a Firefox/AMO key the Chrome-typed
// `defineManifest` signature does not know about, so we attach it via a cast.
// Chrome ignores it (a non-blocking "unrecognized key" warning at most).
export default defineManifest({
  manifest_version: 3,
  name: "Sift — HTTP capture viewer",
  version,
  description:
    "Privacy-first, in-memory viewer for HAR / Fiddler SAZ / Charles captures. Read-only; nothing is saved or sent.",
  minimum_chrome_version: "110",
  devtools_page: "src/devtools.html",
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
  },
  // Firefox / AMO: Manifest V3 requires an explicit add-on id.
  // (data_collection_permissions is rejected as "reserved" by the current
  // addons-linter, so it is intentionally omitted until Mozilla enables it.)
  browser_specific_settings: {
    gecko: {
      id: "sift@siftext.vercel.app",
    },
  },
} as Parameters<typeof defineManifest>[0]);
