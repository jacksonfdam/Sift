// Packs the built extension (apps/extension/dist) into a Chrome Web Store zip.
// The store wants manifest.json at the archive root, so we zip the CONTENTS of
// dist, not the dist folder. Run after `pnpm build`:
//
//   node scripts/pack.mjs
//
// Output: sift-extension-<version>.zip in the package root.
import { zipSync } from "fflate";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(pkgDir, "dist");

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(distDir, "manifest.json"), "utf8"));
} catch {
  console.error("No build found. Run `pnpm build` first.");
  process.exit(1);
}

function collect(dir) {
  const files = {};
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) Object.assign(files, collect(full));
    else {
      // Zip paths use forward slashes regardless of platform.
      const rel = relative(distDir, full).split(sep).join("/");
      files[rel] = new Uint8Array(readFileSync(full));
    }
  }
  return files;
}

const files = collect(distDir);
if (!files["manifest.json"]) {
  console.error("manifest.json missing from dist root; refusing to pack.");
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const zipName = `sift-extension-${version}.zip`;
// Fixed in-range mtime (ZIP only allows 1980-2099) so repeated packs of the
// same build are byte-identical.
const FIXED_MTIME = Date.UTC(2020, 0, 1);
const zip = zipSync(files, { level: 9, mtime: FIXED_MTIME });
writeFileSync(join(pkgDir, zipName), zip);

console.log(`packed ${Object.keys(files).length} files -> ${zipName} (manifest v${manifest.version}, ${zip.length} bytes)`);
