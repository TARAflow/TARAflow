// ==================== useAuditHints (React hook) ====================
// What the Audit entry of the phase bar points out without the Audit tab
// being open (user 2026-10-30): no audit repository for the project file, and
// TARA verification entries not committed yet. Same repo discovery as the
// Audit tab (useAuditRepo → runAuditRepoOpenFlow, read-only apart from the
// repo binding), same commit lookup (findVerificationCommits).
//
// Re-checked on `refreshKey` (the app passes the active phase and the audit
// data), so a repo set up or a commit made in the Audit tab shows on return.
// null = nothing known (project not saved, no Electron git, check running).

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuditRepo } from "./useAuditRepo";
import { createGitService } from "../services/git-service-renderer";
import { findVerificationCommits } from "../services/verification-commits";

export interface AuditHints {
  /** The project file is not inside a git repository. */
  repoMissing: boolean;
  /** Verification entries without a commit (only with a repository). */
  uncommittedVerifications: number;
}

export function useAuditHints(input: {
  id: string;
  filePath?: string;
  verificationIds: readonly string[];
  refreshKey: unknown;
}): AuditHints | null {
  const { id, filePath, verificationIds, refreshKey } = input;
  const repo = useAuditRepo({ id, filePath });
  const gitService = useMemo(() => createGitService(), []);
  const [uncommitted, setUncommitted] = useState(0);

  // Re-run the discovery when the analyst comes back (not on mount — the
  // repo hook runs it then itself).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (filePath) void repo.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const repoRoot =
    repo.outcome?.kind === "repo-ok" || repo.outcome?.kind === "repo-needs-attributes"
      ? repo.outcome.repoRoot
      : undefined;
  const idsKey = verificationIds.join(",");

  useEffect(() => {
    let alive = true;
    if (!repoRoot || !filePath || verificationIds.length === 0) {
      setUncommitted(0);
      return;
    }
    void findVerificationCommits((command) => gitService.raw(command), repoRoot, filePath, verificationIds)
      .then((found) => {
        if (alive) setUncommitted(verificationIds.filter((v) => !found.has(v)).length);
      })
      .catch(() => {
        if (alive) setUncommitted(0);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoRoot, filePath, idsKey, refreshKey, gitService]);

  if (!filePath || !repo.outcome || repo.outcome.kind === "no-file") return null;
  return {
    repoMissing: repo.outcome.kind === "not-a-repo",
    uncommittedVerifications: repoRoot ? uncommitted : 0,
  };
}
