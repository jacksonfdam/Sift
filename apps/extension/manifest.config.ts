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
});
