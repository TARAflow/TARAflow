#!/usr/bin/env node
// scripts/verify-vendored.mjs
//
// npm does NOT verify the lockfile `integrity` of `file:` tarball
// dependencies — a swapped tarball under vendor/ would install silently.
// This preinstall guard closes that gap: every `file:*.tgz` entry in
// package-lock.json is hashed and compared against its recorded integrity.
// The lockfile stays the single source of truth; no hash is duplicated here.
//
// Node builtins only (runs before any dependency is installed).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));

let failed = false;
for (const [name, entry] of Object.entries(lock.packages ?? {})) {
  const ref = entry.resolved;
  if (typeof ref !== "string" || !ref.startsWith("file:") || !ref.endsWith(".tgz")) continue;

  const file = resolve(root, ref.slice("file:".length));
  if (!existsSync(file)) {
    console.error(`[verify-vendored] ${name}: missing ${ref} (see vendor/README.md)`);
    failed = true;
    continue;
  }
  if (typeof entry.integrity !== "string") {
    console.error(`[verify-vendored] ${name}: no integrity recorded in package-lock.json`);
    failed = true;
    continue;
  }
  const [algo, expected] = entry.integrity.split("-", 2);
  const actual = createHash(algo).update(readFileSync(file)).digest("base64");
  if (actual !== expected) {
    console.error(
      `[verify-vendored] ${name}: integrity MISMATCH for ${ref}\n` +
        `  expected ${entry.integrity}\n  actual   ${algo}-${actual}`,
    );
    failed = true;
  } else {
    console.log(`[verify-vendored] ${name}: ${ref} ok`);
  }
}
if (failed) process.exit(1);
