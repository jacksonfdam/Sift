import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export function fixtureBytes(relPath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(here, "fixtures", relPath)));
}

export function fixtureName(relPath: string): string {
  const parts = relPath.split("/");
  return parts[parts.length - 1]!;
}

export function loadFixture(relPath: string): { name: string; bytes: Uint8Array } {
  return { name: fixtureName(relPath), bytes: fixtureBytes(relPath) };
}
