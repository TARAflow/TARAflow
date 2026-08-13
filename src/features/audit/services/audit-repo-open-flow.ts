// ==================== AUDIT REPO OPEN-FLOW ====================
// The orchestration that runs when a project is opened:
//   locate the audit repo → bind it → cache the path → check .gitattributes
//   AND check the managed git hooks
// Pure and dependency-injected (no React, no window), so it is fully unit-
// testable. `useAuditRepo` is a thin React wrapper that supplies real deps.

import type { GitOperationResult } from "../models/git-types";
import { locateAuditRepo, type GitRunner } from "./audit-repo-locator";
import {
  inspectAuditRepoAttributes,
  type FileIO,
  type AttrStatus,
} from "./audit-repo-attributes";
import { inspectAuditRepoHooks, type HooksStatus } from "./audit-repo-hooks";
import { allowedSignersPathOf } from "./audit-signer-manifest";

// ── Path helpers (renderer, cross-platform, no node:path) ────────────────────

/** Directory of a file path, handling both `/` and `\` separators. */
export function dirnameOf(filePath: string): string {
  const norm = filePath.replace(/[/\\]+$/, "");
  const i = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return i >= 0 ? norm.slice(0, i) : ".";
}

/** `<repoRoot>/.gitattributes`, using the separator the root already uses. */
export function gitattributesPathOf(repoRoot: string): string {
  const sep = repoRoot.includes("\\") ? "\\" : "/";
  return repoRoot.replace(/[/\\]+$/, "") + sep + ".gitattributes";
}

// ── Deps + outcome ───────────────────────────────────────────────────────────

export interface AuditRepoOpenFlowDeps {
  gitRunner: GitRunner;
  fileIO: FileIO;
  /** Bind the main-process GitService to the discovered repo root. */
  setRepoPath: (root: string) => Promise<GitOperationResult<void>>;
  /** Cache the resolved root out-of-band (registry/localStorage), NOT the file. */
  cacheRepoRoot: (projectId: string, root: string | null) => Promise<void>;
}

export type AuditRepoOpenOutcome =
  | { kind: "no-file" } // project not saved yet — nothing to locate
  | { kind: "not-a-repo"; fileDir: string } // → offer to init
  | { kind: "repo-ok"; repoRoot: string; hooks: HooksStatus } // attributes fine
  | {
      kind: "repo-needs-attributes";
      repoRoot: string;
      status: AttrStatus;
      hooks: HooksStatus;
    }; // → offer to set .gitattributes
// NOTE: `hooks` rides along on BOTH repo-bound outcomes (independent of the
// attributes state) so the UI can offer "install hooks" without a third kind —
// keeping every existing `repo-ok || repo-needs-attributes` repoRoot check valid.

export interface OpenFlowProject {
  id: string;
  filePath?: string;
}

/**
 * Resolve + bind + check the audit repo for a freshly opened project.
 * Re-run on every open so a moved repo self-heals (the cache is advisory).
 */
export async function runAuditRepoOpenFlow(
  deps: AuditRepoOpenFlowDeps,
  project: OpenFlowProject,
): Promise<AuditRepoOpenOutcome> {
  if (!project.filePath) {
    return { kind: "no-file" };
  }

  const fileDir = dirnameOf(project.filePath);
  const loc = await locateAuditRepo(deps.gitRunner, fileDir);

  if (!loc.isRepo || !loc.repoRoot) {
    await deps.cacheRepoRoot(project.id, null);
    return { kind: "not-a-repo", fileDir };
  }

  // Bind the bound GitService and cache the path before any audit op.
  await deps.setRepoPath(loc.repoRoot);
  await deps.cacheRepoRoot(project.id, loc.repoRoot);

  // Point local git at the COMMITTED manifest so %G? / --show-signature verify
  // against .tara/allowed_signers, not a machine-local file. Harmless if the
  // manifest isn't committed yet (git just can't verify until it exists).
  await deps.gitRunner(
    [
      "config",
      "gpg.ssh.allowedSignersFile",
      allowedSignersPathOf(loc.repoRoot),
    ],
    loc.repoRoot,
  );

  const status = await inspectAuditRepoAttributes(
    deps.gitRunner,
    deps.fileIO,
    loc.repoRoot,
    gitattributesPathOf(loc.repoRoot),
  );

  // Managed git hooks (core.hooksPath + .tara/hooks). Rides along on the outcome
  // so the UI can prompt to install/update independently of .gitattributes.
  const hooks = await inspectAuditRepoHooks(
    deps.gitRunner,
    deps.fileIO,
    loc.repoRoot,
  );

  return status.ok
    ? { kind: "repo-ok", repoRoot: loc.repoRoot, hooks }
    : { kind: "repo-needs-attributes", repoRoot: loc.repoRoot, status, hooks };
}