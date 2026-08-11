// ==================== useAuditVerify (React hook) ====================
// Thin wrapper over the `audit:verify` IPC (verifyAuditRepo → engine in main).
// Unlike useAuditProtection (a lightweight, auto-running local check), FULL
// verification runs the whole trust walk + checks and spawns a `git
// verify-commit` per commit, so this is BUTTON-TRIGGERED, not auto-run.
//
// The anchor is passed IN (today: the derived `protection.anchor` — see
// docs/decisions/audit-anchor-source.md). When a pinned anchor lands
// (.tara/policy.json), pass that instead; nothing here changes.
//
// Lives at: src/features/audit/hooks/useAuditVerify.ts

import { useCallback, useState } from "react";
import { verifyAuditRepo } from "../services/audit-verify-renderer";
import type { FindingsResult } from "../services/verify/findings";

export interface UseAuditVerify {
  result: FindingsResult | null;
  loading: boolean;
  error: string | null;
  strict: boolean;
  setStrict: (v: boolean) => void;
  /** True when a verification can actually run (repo bound + anchor known). */
  canRun: boolean;
  /** Run the engine now. No-op guard when !canRun. */
  run: () => Promise<void>;
  /** Clear the last result/error (e.g. when the repo/anchor changes). */
  reset: () => void;
}

export function useAuditVerify(
  repoRoot: string | undefined,
  anchor: string | null,
  branch: string,
): UseAuditVerify {
  const [result, setResult] = useState<FindingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strict, setStrict] = useState(false);

  const canRun = !!repoRoot && !!anchor;

  const run = useCallback(async () => {
    if (!repoRoot || !anchor) {
      setError("No audit repo or anchor available to verify.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyAuditRepo({
        repoPath: repoRoot,
        policy: { bootstrapAnchor: anchor, ref: branch, strict },
      });
      setResult(res);
    } catch (e) {
      // Engine could not run (no repo bound, git failure, bad policy).
      setError(e instanceof Error ? e.message : "Verification failed to run.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [repoRoot, anchor, branch, strict]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    loading,
    error,
    strict,
    setStrict,
    canRun,
    run,
    reset,
  };
}
