// ==================== useAuditGit (React hook) ====================
// Extracts git init, branch state, and the commit flow out of the fat
// audit-tab.tsx. The commit orchestration lives in the tested pure
// `runCommitFlow`; this hook only wires the real GitService methods and holds
// React state. (React custom hook — NOT a git hook.)
//
// Lives at: src/features/audit/hooks/useAuditGit.ts
//
// Requires the signing-wiring patch: git-service-renderer.commit(message, config,
// signCommit) — the per-commit toggle is now threaded end-to-end.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createGitService } from "../services/git-service-renderer";
import {
  runCommitFlow,
  type CommitFlowResult,
} from "../services/audit-commit-flow";
import type {
  AuditConfig,
  BranchInfo,
  CommitOptions,
} from "../models/audit-types";

export function useAuditGit(config: AuditConfig) {
  const gitService = useMemo(() => createGitService(), []);

  const [currentBranch, setCurrentBranch] = useState<string>("main");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isGitInitialized, setIsGitInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBranches = useCallback(async () => {
    const branch = await gitService.getCurrentBranch();
    if (branch) setCurrentBranch(branch);

    const res = await gitService.getBranches();
    if (res.success && res.data) {
      setBranches(
        Object.entries(res.data.branches).map(([name, detail]) => ({
          name,
          current: detail.current,
          commit: detail.commit,
          label: detail.label,
        })),
      );
    }
  }, [gitService]);

  const initialize = useCallback(async () => {
    try {
      setError(null);
      if (!(await gitService.isRepository())) {
        const init = await gitService.initRepository();
        if (!init.success) {
          setError(init.error ?? "Failed to initialize Git repository");
          return;
        }
      }
      setIsGitInitialized(true);
      await refreshBranches();

      if (config.remoteUrl && !(await gitService.remoteExists("origin"))) {
        await gitService.addRemote("origin", config.remoteUrl);
      }
    } catch (err) {
      setError(
        "Failed to initialize Git. Make sure Git is installed and the audit repo is selected.",
      );
    }
  }, [gitService, refreshBranches, config.remoteUrl]);

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Stage → branch → (signed) commit → optional push. */
  const commit = useCallback(
    async (
      options: CommitOptions,
      relPaths: string[],
    ): Promise<CommitFlowResult> => {
      setError(null);
      const result = await runCommitFlow(
        {
          stage: () => gitService.stage(relPaths),
          createBranch: (n, c) => gitService.createBranch(n, c),
          checkoutBranch: (n) => gitService.checkoutBranch(n),
          commit: (m, cfg, sign) => gitService.commit(m, cfg, sign, relPaths),
          push: (r, b, cfg) => gitService.push(r, b, cfg),
        },
        { options, config, currentBranch, relPaths },
      );

      if (!result.ok) {
        setError(result.error);
      } else {
        setCurrentBranch(result.branchName);
        if (result.pushWarning) setError(result.pushWarning);
        await refreshBranches();
      }
      return result;
    },
    [gitService, config, currentBranch, refreshBranches],
  );

  return {
    gitService,
    currentBranch,
    branches,
    isGitInitialized,
    error,
    setError,
    initialize,
    refreshBranches,
    commit,
  };
}
