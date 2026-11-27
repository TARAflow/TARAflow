// ==================== GIT CALLS WITH FIXED ARGUMENTS ====================
// Roadmap-to-1.0 0.20: what changes a repository no longer goes through the
// free-argument channel git:rawInDir. Each operation has its own IPC channel
// that takes only the directory; the arguments are fixed here, in the main
// process — the renderer cannot turn them into `config core.hooksPath
// /tmp/evil` or `fetch --upload-pack=…`.
//
//   initRepo         git init                                    (audit repo setup)
//   setHooksPath     git config core.hooksPath .tara/hooks       (audit hooks)
//   untrackHookFile  git rm --cached --ignore-unmatch .tara/hooks/commit-msg
//   fetchTags        git fetch --quiet --tags                    (component drift check)
//
// fetchTags reaches a remote: it runs with the user's git environment
// (git-environment.ts) — SSH command, askpass, CA certificates — and ssh in
// BatchMode unless the user runs ssh their own way.

import { HOOKS_PATH_REL } from "../../src/features/audit/services/audit-repo-hooks";
import { HOOK_REL_PATH } from "../../src/features/audit/services/audit-repo-ignore";
import { userGitEnvironment, withSshBatchMode } from "../services/git-environment";
import { runGitInDir, type RawGitResult } from "./git-raw-in-dir";

/** The fixed argument lists, by operation — the renderer adapter maps onto them. */
export const FIXED_GIT_OPS = {
  initRepo: ["init"],
  setHooksPath: ["config", "core.hooksPath", HOOKS_PATH_REL],
  untrackHookFile: ["rm", "--cached", "--ignore-unmatch", HOOK_REL_PATH],
  fetchTags: ["fetch", "--quiet", "--tags"],
} as const satisfies Record<string, readonly string[]>;

export type FixedGitOp = keyof typeof FIXED_GIT_OPS;

export function isFixedGitOp(op: unknown): op is FixedGitOp {
  return typeof op === "string" && Object.hasOwn(FIXED_GIT_OPS, op);
}

/** Runs one fixed operation in `dir`; never throws (same contract as rawInDir). */
export async function runFixedGitOp(op: FixedGitOp, dir: string): Promise<RawGitResult> {
  const args = [...FIXED_GIT_OPS[op]];
  switch (op) {
    case "fetchTags":
      // ssh never asks (BatchMode, git-environment.ts)
      return runGitInDir(dir, args, await withSshBatchMode(userGitEnvironment(), dir));
    case "setHooksPath":
      // the one call that may set core.hooksPath — to the fixed .tara/hooks
      return runGitInDir(dir, args, { env: {}, options: { unsafe: { allowUnsafeHooksPath: true } } });
    default:
      return runGitInDir(dir, args);
  }
}
