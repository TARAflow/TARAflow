// scripts/results-dump/main.ts
//
//   npm run dump:results -- <file|dir>… --out <dir> [--compare <ref-dir>]…
//
// Dumps the results of every *.tara.json given (directories recursively,
// *.backup.json skipped) into <out>/<relative path>.results.json. With
// --compare, each dump is compared with the file of the same name in
// <ref-dir>; differences are listed and the exit code is 1. Several
// --compare: the first reference that has the file counts — a release folder
// holds only the projects whose results changed (e.g. --compare 0.20
// --compare 0.19).
//
// Customer projects (roadmap rule 8): run it with --out OUTSIDE the
// repository — their dumps are never committed.
// See doc/Testing/results-dump/README.md.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { installDomParser } from "../../taraflow-reporter/cli/dom-parser-node";
import { initI18nNode } from "../../taraflow-reporter/cli/i18n-node";
import { dumpProject, stringifyDump } from "./core";
import { diffDumps } from "./diff";
import { THREAT_CATALOG_VERSION } from "../../src/features/threats/services/threat-catalog-version";

function usage(): never {
  console.error("usage: npm run dump:results -- <file|dir>… --out <dir> [--compare <ref-dir>]…");
  process.exit(2);
}

const args = process.argv.slice(2);
let out: string | undefined;
const compare: string[] = [];
const inputs: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = args[++i];
  else if (args[i] === "--compare") compare.push(args[++i]);
  else if (args[i].startsWith("--")) usage();
  else inputs.push(args[i]);
}
if (!out || inputs.length === 0) usage();

const git = (cwd: string, ...a: string[]): string | undefined => {
  try {
    return execFileSync("git", ["-C", cwd, ...a], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
};
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const taraflowVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")).version as string;
const taraflowCommit = git(repoRoot, "rev-parse", "HEAD") ?? "unknown";
const dirty = git(repoRoot, "status", "--porcelain", "--untracked-files=no", "--", "src");
const commitLabel = dirty ? `${taraflowCommit}+modified` : taraflowCommit;

/** [file, base dir the output path is relative to] */
function collect(input: string): [string, string][] {
  const abs = resolve(input);
  if (statSync(abs).isFile()) return [[abs, dirname(abs)]];
  const found: [string, string][] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".tara.json")) found.push([p, abs]);
    }
  };
  walk(abs);
  return found;
}

installDomParser();
await initI18nNode("en");

let failed = 0;
let differing = 0;
for (const [file, base] of inputs.flatMap(collect)) {
  const rel = relative(base, file);
  const target = join(out, rel.replace(/\.tara\.json$/, ".results.json"));
  try {
    const bytes = readFileSync(file);
    const fileDir = dirname(file);
    const inputCommit = git(fileDir, "rev-parse", "HEAD");
    const inputDirty = inputCommit ? git(fileDir, "status", "--porcelain", "--", basename(file)) : undefined;
    const text = stringifyDump(
      dumpProject(JSON.parse(bytes.toString("utf-8")), {
        taraflowVersion,
        taraflowCommit: commitLabel,
        threatCatalogVersion: THREAT_CATALOG_VERSION,
        ...(inputCommit ? { inputCommit: inputDirty ? `${inputCommit}+modified` : inputCommit } : {}),
        inputFile: rel,
        inputSha256: createHash("sha256").update(bytes).digest("hex"),
      }),
    );
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    if (compare.length > 0) {
      const refFile = compare.map((dir) => join(dir, relative(out, target))).find((f) => existsSync(f));
      if (!refFile) {
        console.log(`NEW   ${rel} (no reference)`);
        differing++;
        continue;
      }
      const lines = diffDumps(JSON.parse(readFileSync(refFile, "utf-8")), JSON.parse(text));
      if (lines.length === 0) console.log(`SAME  ${rel}`);
      else {
        differing++;
        console.log(`DIFF  ${rel} (${lines.length})`);
        for (const line of lines.slice(0, 200)) console.log(`      ${line}`);
        if (lines.length > 200) console.log(`      … ${lines.length - 200} more`);
      }
    } else {
      console.log(`dumped ${rel}`);
    }
  } catch (err) {
    failed++;
    console.error(`FAIL  ${rel}: ${(err as Error).stack ?? err}`);
  }
}
if (failed > 0 || differing > 0) process.exit(1);
