// ==================== AUDIT COMMIT FLOW (pure) ====================
// The commit orchestration extracted from audit-tab's handleCommit: branch →
// stage → (signed) commit → optional push. Pure and dependency-injected so it
// is unit-testable; `useAuditGit` supplies the real GitService methods.
//
// Signing is threaded through as `options.signCommit` (previously dropped before
// reaching main). Push failure is non-fatal (returns a warning), matching the
// existing behaviour.
//
// The branch comes first (FX-2): staging before the switch left the project
// file staged on the old branch whenever the switch failed — the next plain
// `git commit` there would have taken it along.

import type { AuditConfig, CommitOptions } from "../models/audit-types";
import type {
  GitCommitResult,
  GitPushResult,
  GitOperationResult,
} from "../models/git-types";

export interface CommitFlowDeps {
  stage: (relPaths: string[]) => Promise<GitOperationResult<void>>;
  createBranch: (
    name: string,
    checkout: boolean,
  ) => Promise<GitOperationResult<void>>;
  checkoutBranch: (name: string) => Promise<GitOperationResult<void>>;
  commit: (
    message: string,
    config: AuditConfig,
    signCommit: boolean,
    relPaths: string[],
  ) => Promise<GitOperationResult<GitCommitResult>>;
  push: (
    remote: string,
    branch: string,
    config: AuditConfig,
  ) => Promise<GitOperationResult<GitPushResult>>;
}

export interface CommitFlowInput {
  options: CommitOptions;
  config: AuditConfig;
  currentBranch: string;
  relPaths: string[];
}

export type CommitFlowResult =
  | {
      ok: true;
      commit: GitCommitResult;
      branchName: string;
      /** Non-fatal push problem, if any. */
      pushWarning?: string;
    }
  | { ok: false; error: string };

export async function runCommitFlow(
  deps: CommitFlowDeps,
  input: CommitFlowInput,
): Promise<CommitFlowResult> {
  const { options, config, currentBranch } = input;

  // Branch: create new, or switch to an existing one that isn't current.
  if (options.createBranch) {
    const c = await deps.createBranch(options.branchName, true);
    if (!c.success) {
      return { ok: false, error: c.error ?? "Failed to create branch" };
    }
  } else if (options.branchName !== currentBranch) {
    const co = await deps.checkoutBranch(options.branchName);
    if (!co.success) {
      return { ok: false, error: co.error ?? "Failed to checkout branch" };
    }
  }

  const stage = await deps.stage(input.relPaths);
  if (!stage.success) {
    return { ok: false, error: stage.error ?? "Failed to stage changes" };
  }

  const commit = await deps.commit(
    options.message,
    config,
    options.signCommit,
    input.relPaths,
  );
  if (!commit.success || !commit.data) {
    return { ok: false, error: commit.error ?? "Failed to commit" };
  }

  let pushWarning: string | undefined;
  if (options.pushAfterCommit && config.remoteUrl) {
    const p = await deps.push("origin", options.branchName, config);
    if (!p.success) {
      pushWarning = `Commit succeeded, but push failed: ${p.error}`;
    }
  }

  return {
    ok: true,
    commit: commit.data,
    branchName: options.branchName,
    pushWarning,
  };
}
