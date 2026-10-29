#!/usr/bin/env node
// scripts/secret-scan.mjs
//
// Secret scan for this repository (2026-10-29). Runs in CI over every tracked
// file and as the versioned pre-commit hook (.githooks/pre-commit) over the
// staged contents. Prints file, line and rule — never the value.
//
//   node scripts/secret-scan.mjs            all tracked files
//   node scripts/secret-scan.mjs --staged   the staged contents (hook)
//
// Rules — the same patterns as the managed pre-commit hook TARAflow installs
// in audit repositories (src/features/audit/services/audit-repo-hooks.ts; a
// unit test keeps both lists equal):
//   KEY    a secret-named field with a value — in project files and test
//          fixtures only (*.tara.json, src/tests/fixtures/**/*.json); the i18n
//          files legitimately use "password" / "token" as label keys
//   VALUE  well-known token formats — in every text file
// Local extra patterns (e.g. an organisation's domains): one ERE per line in
// .secret-scan.local (git-ignored), applied to JSON files — like the former
// local hook; docs and tests may name such domains on purpose.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SECRET_KEY_PATTERN =
  '"(apiToken|personalAccessToken|accessToken|refreshToken|clientSecret|password)"[ \t]*:[ \t]*"[^"]+"';
export const SECRET_VALUE_PATTERNS = [
  "ATATT[A-Za-z0-9_=-]{20,}", // Atlassian API token
  "gh[pousr]_[A-Za-z0-9]{30,}", // GitHub tokens
  "github_pat_[A-Za-z0-9_]{30,}", // GitHub fine-grained PAT
  "glpat-[A-Za-z0-9_-]{20,}", // GitLab PAT
  "AKIA[0-9A-Z]{16}", // AWS access key id
  "xox[baprs]-[A-Za-z0-9-]{10,}", // Slack token
  "-----BEGIN [A-Z ]*PRIVATE KEY-----", // private key
];

const BINARY = /\.(png|jpe?g|gif|ico|icns|pdf|xlsx?|docx?|woff2?|ttf|otf|zip|gz|7z|exe|dll|so|dylib|node|mp4|webm)$/i;
const KEY_SCOPE = /(\.tara\.json$)|(^src\/tests\/fixtures\/.*\.json$)/;

/** Findings in one file's text: [{ line, rule }]. Pure, exported for tests. */
export function scanText(path, text, extra = []) {
  const rules = [
    ...(KEY_SCOPE.test(path) ? [["secret field", new RegExp(SECRET_KEY_PATTERN)]] : []),
    ...SECRET_VALUE_PATTERNS.map((p) => ["token format", new RegExp(p)]),
    ...(path.endsWith(".json") ? extra.map((p) => ["local pattern", new RegExp(p)]) : []),
  ];
  const findings = [];
  text.split("\n").forEach((line, i) => {
    for (const [rule, re] of rules) {
      if (re.test(line)) {
        findings.push({ line: i + 1, rule });
        break;
      }
    }
  });
  return findings;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function main() {
  const staged = process.argv.includes("--staged");
  const extra = existsSync(".secret-scan.local")
    ? readFileSync(".secret-scan.local", "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [];
  const files = (staged
    ? git(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"])
    : git(["ls-files", "-z"])
  )
    .split("\0")
    .filter((f) => f && !BINARY.test(f));

  let count = 0;
  for (const f of files) {
    let text;
    try {
      text = staged ? git(["show", `:${f}`]) : readFileSync(f, "utf8");
    } catch {
      continue; // deleted in the work tree / unreadable
    }
    if (text.includes("\0")) continue; // binary
    for (const { line, rule } of scanText(f, text, extra)) {
      console.error(`secret-scan: ${f}:${line} (${rule})`);
      count += 1;
    }
  }
  if (count > 0) {
    console.error(`secret-scan: ${count} possible secret(s) — remove them, or rotate them if already committed.`);
    process.exit(1);
  }
  console.log(`secret-scan: ${files.length} file(s), no secrets found.`);
}

// Run when invoked directly (also on Windows), not when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
