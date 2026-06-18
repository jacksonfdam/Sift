// Assembles the Vercel deploy output: the static marketing/docs site plus the
// standalone viewer served at /app. Vercel runs this via `pnpm build:site`
// (see vercel.json) and serves the resulting `vercel-out/` directory.
//
//   node scripts/build-site.mjs
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "vercel-out");
const siteDir = join(root, "site");
const standaloneDist = join(root, "apps", "standalone", "dist");

// 1. Build the standalone single-file viewer.
execSync("pnpm --filter @sift/standalone build", { cwd: root, stdio: "inherit" });

// 2. Assemble the output directory from scratch.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The static site (only the public files; not README/vercel.json/.gitignore).
for (const entry of [
  "index.html",
  "docs.html",
  "privacy.html",
  "terms.html",
  "styles.css",
  "assets",
]) {
  cpSync(join(siteDir, entry), join(out, entry), { recursive: true });
}

// The standalone viewer, served at /app (clean URL maps app/index.html -> /app).
mkdirSync(join(out, "app"), { recursive: true });
cpSync(join(standaloneDist, "index.html"), join(out, "app", "index.html"));

console.log("assembled vercel-out/ (static site + standalone viewer at /app)");
