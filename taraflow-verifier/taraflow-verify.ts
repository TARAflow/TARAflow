#!/usr/bin/env node
// taraflow-verifier/taraflow-verify.ts
//
// CLI entry point for headless audit-trail VERIFICATION — no UI, no Electron.
// Sibling to taraflow-report (which only GENERATES docs); this one VERIFIES a
// repository's audit trail against a pinned bootstrap anchor.
//
// Usage:
//   tsx --tsconfig tsconfig.cli.json taraflow-verifier/taraflow-verify.ts <repo-path> \
//     (--anchor <hash> | --policy <file.json>) [--ref <ref>] [--strict] \
//     [--four-eyes] [--protected <b1,b2,...>] [--json]
//
// The bootstrap anchor is supplied OUT-OF-BAND (flag or policy file) — a repo
// cannot vouch for its own root. Flags override individual policy-file fields.
//
// Exit codes:
//   0  pass   — no error-severity findings
//   1  fail   — audit-trail findings (the trust chain / checks flagged something)
//   2  usage  — bad arguments / unreadable policy file / no anchor
//   3  engine — verification could not be performed (git missing, not a repo,
//               unresolvable ref, or an unexpected engine error)

import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { createGitReaderExec } from "../src/features/audit/services/verify/git-reader-exec";
import { verifyAudit } from "../src/features/audit/services/verify/engine";
import type { FindingsResult } from "../src/features/audit/services/verify/findings";
import { canonicalStringify } from "../src/app/services/tcs-serialize";
import {
  resolvePolicy,
  type PolicyFlags,
  type PolicyFile,
} from "./cli/resolve-policy";

const execFileAsync = promisify(execFile);

const EXIT = { PASS: 0, FINDINGS: 1, USAGE: 2, ENGINE: 3 } as const;

// ==================== ARG PARSING ====================

interface CliArgs {
  repo: string;
  flags: PolicyFlags;
  policyFile?: string;
  json: boolean;
}

function printUsageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    "Usage: taraflow-verify <repo-path> (--anchor <hash> | --policy <file.json>) " +
      "[--ref <ref>] [--strict] [--four-eyes] [--protected <b1,b2,...>] [--json]",
  );
  process.exit(EXIT.USAGE);
}

/** Read a value-carrying flag; error if the value is missing or another flag. */
function value(rest: string[], i: number, name: string): string {
  const v = rest[i];
  if (v === undefined || v.startsWith("--")) {
    printUsageAndExit(`Missing value for ${name}`);
  }
  return v;
}

function parseArgs(argv: string[]): CliArgs {
  const [repo, ...rest] = argv;
  if (!repo) printUsageAndExit("Missing <repo-path>");
  if (repo.startsWith("--")) printUsageAndExit("First argument must be <repo-path>");

  const flags: PolicyFlags = {};
  let policyFile: string | undefined;
  let json = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    switch (arg) {
      case "--anchor":
        flags.anchor = value(rest, ++i, "--anchor");
        break;
      case "--ref":
        flags.ref = value(rest, ++i, "--ref");
        break;
      case "--strict":
        flags.strict = true;
        break;
      case "--four-eyes":
        flags.fourEyes = true;
        break;
      case "--protected":
        flags.protectedBranches = value(rest, ++i, "--protected")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--policy":
        policyFile = value(rest, ++i, "--policy");
        break;
      case "--json":
        json = true;
        break;
      default:
        printUsageAndExit(`Unknown argument "${arg}"`);
    }
  }

  return { repo, flags, policyFile, json };
}

// ==================== OUTPUT ====================

function printHuman(r: FindingsResult): void {
  const s = r.summary;
  console.log(
    `${r.result.toUpperCase()}  ` +
      `(${s.error} error, ${s.warning} warning, ${s.info} info)  ` +
      `[AVE v${r.aveVersion}${r.strict ? ", strict" : ""}]`,
  );
  for (const f of r.findings) {
    const at = f.commit ? ` @${f.commit.slice(0, 10)}` : "";
    console.log(`  [${f.severity}] ${f.id}${at} — ${f.message}`);
  }
}

// ==================== MAIN ====================

async function main(): Promise<void> {
  const { repo, flags, policyFile, json } = parseArgs(process.argv.slice(2));

  // Preflight 1: is git available at all?
  try {
    await execFileAsync("git", ["--version"]);
  } catch {
    console.error("Error: git is not installed or not on PATH.");
    process.exit(EXIT.ENGINE);
  }

  // Preflight 2: is <repo-path> actually a git work tree? (clearer than letting
  // the first engine call fail with a cryptic ref error).
  try {
    await execFileAsync("git", ["-C", repo, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    console.error(`Error: not a git repository: ${repo}`);
    process.exit(EXIT.ENGINE);
  }

  // Optional policy file (flags override its fields below).
  let file: PolicyFile | undefined;
  if (policyFile) {
    try {
      file = JSON.parse(await fs.readFile(policyFile, "utf-8"));
    } catch (err: any) {
      printUsageAndExit(`Could not read --policy file: ${err.message}`);
    }
  }

  // Resolve the policy — throws (→ usage) if no anchor from flag or file.
  let policy;
  try {
    policy = resolvePolicy(flags, file);
  } catch (err: any) {
    printUsageAndExit(err.message);
  }

  const reader = createGitReaderExec(repo);
  const result = await verifyAudit({
    reader,
    policy,
    canonicalize: canonicalStringify,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  // An ENGINE_ERROR finding (e.g. unresolvable ref) is an environment/config
  // failure, not an audit-trail finding → exit 3, not 1.
  if (result.findings.some((f) => f.id === "ENGINE_ERROR")) {
    process.exit(EXIT.ENGINE);
  }
  process.exit(result.result === "fail" ? EXIT.FINDINGS : EXIT.PASS);
}

main().catch((error: any) => {
  // An unexpected throw is an engine/environment failure, not "findings".
  console.error(error?.message ?? error);
  process.exit(EXIT.ENGINE);
});
