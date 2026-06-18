// Cuts a release of the extension: pick a version, build, zip, commit the
// version bump, tag vX.Y.Z, push, and create a GitHub Release with the zip
// attached (via the gh CLI).
//
//   node scripts/release.mjs            -> bump patch, then release
//   node scripts/release.mjs 1.4.0      -> release this exact version
//   SIFT_VERSION=1.4.0 node ...         -> same, via env
//   node scripts/release.mjs --dry-run  -> print the plan, change nothing
//
// Pushing the tag also triggers the release-extension GitHub Actions workflow
// (store publish), so this script only handles the GitHub Release + asset.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(scriptDir, "..");
const repoRoot = resolve(pkgDir, "..", "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || process.env.SIFT_RELEASE_DRY_RUN === "1";
const explicit = args.find((a) => /^\d+\.\d+\.\d+$/.test(a)) || process.env.SIFT_VERSION || "";

function run(file, fileArgs, opts = {}) {
  return execFileSync(file, fileArgs, { cwd: repoRoot, stdio: "inherit", ...opts });
}
function cap(file, fileArgs, opts = {}) {
  return execFileSync(file, fileArgs, { cwd: repoRoot, encoding: "utf8", ...opts }).trim();
}
function fail(msg) {
  console.error(`release: ${msg}`);
  process.exit(1);
}

// ---- preflight ----
try {
  cap("git", ["rev-parse", "--is-inside-work-tree"]);
} catch {
  fail("not inside a git work tree.");
}
const branch = cap("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
try {
  cap("git", ["remote", "get-url", "origin"]);
} catch {
  fail('no "origin" remote. Add one with: git remote add origin <url>');
}
try {
  cap("gh", ["--version"]);
} catch {
  fail("the GitHub CLI (gh) is not installed. See https://cli.github.com");
}

// ---- resolve version (read-only for the plan) ----
const pkgPath = join(pkgDir, "package.json");
const curVersion = JSON.parse(readFileSync(pkgPath, "utf8")).version;
function bumpPatch(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) fail(`current version "${v}" is not MAJOR.MINOR.PATCH; pass one explicitly.`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}
const version = explicit || bumpPatch(curVersion);
const tag = `v${version}`;
const zipPath = join(pkgDir, `sift-extension-${version}.zip`);

if (cap("git", ["tag", "-l", tag])) fail(`tag ${tag} already exists locally.`);

if (dryRun) {
  console.log("release plan (dry run, nothing changed):");
  console.log(`  version:  ${curVersion} -> ${version}`);
  console.log(`  branch:   ${branch}`);
  console.log(`  tag:      ${tag}`);
  console.log(`  build:    pnpm --filter @sift/extension build`);
  console.log(`  zip:      ${zipPath}`);
  console.log(`  commit:   chore(extension): release ${tag}`);
  console.log(`  push:     git push origin ${branch} && git push origin ${tag}`);
  console.log(`  release:  gh release create ${tag} <zip> --title "Sift extension ${tag}"`);
  process.exit(0);
}

const dirty = cap("git", ["status", "--porcelain"]);
if (dirty) fail("working tree is not clean. Commit or stash your changes first.");
cap("gh", ["auth", "status"]); // throws if not logged in

// ---- set version, build, pack ----
run("node", [join(pkgDir, "scripts", "version.mjs"), version], { cwd: pkgDir });
run("pnpm", ["build"], { cwd: pkgDir });
run("node", [join(pkgDir, "scripts", "pack.mjs")], { cwd: pkgDir });
if (!existsSync(zipPath)) fail(`expected zip not found: ${zipPath}`);

// ---- commit (only if the bump changed anything), tag, push ----
run("git", ["add", "apps/extension/package.json"]);
if (cap("git", ["status", "--porcelain", "apps/extension/package.json"])) {
  run("git", ["commit", "-m", `chore(extension): release ${tag}`]);
}
run("git", ["tag", "-a", tag, "-m", `Sift extension ${tag}`]);
run("git", ["push", "origin", branch]);
run("git", ["push", "origin", tag]);

// ---- GitHub Release with the zip attached ----
const notes = [
  `Sift HTTP capture viewer ${tag}.`,
  "",
  `The attached \`sift-extension-${version}.zip\` is the packaged Manifest V3`,
  "extension, with `manifest.json` at the archive root. Upload it to the Chrome",
  "Web Store, or unzip it and load it unpacked.",
].join("\n");
run("gh", ["release", "create", tag, zipPath, "--title", `Sift extension ${tag}`, "--notes", notes]);

console.log(`\nreleased ${tag} and uploaded ${zipPath.split("/").pop()}`);
