// Sets or bumps the extension version in package.json (the single source of
// truth the manifest reads from). Behaviour:
//
//   node scripts/version.mjs            -> bump the patch number (x.y.Z+1)
//   node scripts/version.mjs 1.4.0      -> set this exact version
//   SIFT_VERSION=1.4.0 node ...         -> same, via env (used by CI from a tag)
//
// Chrome Web Store versions are dot-separated integers, so we keep it to
// MAJOR.MINOR.PATCH and refuse anything else rather than ship a bad manifest.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const requested = (process.argv[2] || process.env.SIFT_VERSION || "").trim();

function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

let next;
if (requested) {
  if (!parse(requested)) {
    console.error(`Invalid version "${requested}". Expected MAJOR.MINOR.PATCH (e.g. 1.4.0).`);
    process.exit(1);
  }
  next = requested;
} else {
  const cur = parse(pkg.version);
  if (!cur) {
    console.error(`Current version "${pkg.version}" is not MAJOR.MINOR.PATCH; pass one explicitly.`);
    process.exit(1);
  }
  next = `${cur[0]}.${cur[1]}.${cur[2] + 1}`;
}

if (next === pkg.version) {
  console.log(`version unchanged (${next})`);
} else {
  const from = pkg.version;
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`version ${from} -> ${next}`);
}
