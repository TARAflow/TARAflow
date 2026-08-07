// ==================== useAuditSigners (React hook) ====================
// Wires the pure signer flow (audit-signer-flow) to real I/O: reads the
// committed manifest via IPC FileIO to show the list, and runs add/remove
// through the BOUND GitService (path-scoped, signed `audit:` commits). Holds
// the entry list + loading/error for the Signers tab.
//
// Lives at: src/features/audit/hooks/useAuditSigners.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { createIpcFileIO } from "../services/audit-git-adapters";
import {
  runAddSigner,
  runRemoveSigner,
  runSetRole,
} from "../services/audit-signer-flow";
import {
  parseAllowedSigners,
  allowedSignersPathOf,
  type SignerEntry,
} from "../services/audit-signer-manifest";
import type { AuditConfig } from "../models/audit-types";
import type { GitOperationResult, GitCommitResult } from "../models/git-types";

/** The minimal slice of the bound GitService the signer flow needs. */
export interface SignerGit {
  stage: (relPaths: string[]) => Promise<GitOperationResult<void>>;
  commit: (
    message: string,
    config: AuditConfig,
    signCommit: boolean,
    relPaths: string[],
  ) => Promise<GitOperationResult<GitCommitResult>>;
}

export function useAuditSigners(
  repoRoot: string | undefined,
  git: SignerGit | undefined,
  config: AuditConfig,
) {
  const [entries, setEntries] = useState<SignerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileIO = useMemo(() => createIpcFileIO(), []);

  /** Read + parse the committed manifest to populate the list. */
  const refresh = useCallback(async () => {
    if (!repoRoot) {
      setEntries([]);
      return;
    }
    setError(null);
    try {
      const text = await fileIO.read(allowedSignersPathOf(repoRoot));
      setEntries(text ? parseAllowedSigners(text) : []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to read signer manifest",
      );
    }
  }, [repoRoot, fileIO]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Flow deps: wrap the bound methods so `this` binding can't bite later.
  const deps = useMemo(
    () =>
      git
        ? {
            fileIO,
            stage: (relPaths: string[]) => git.stage(relPaths),
            commit: (
              m: string,
              c: AuditConfig,
              s: boolean,
              r: string[],
            ) => git.commit(m, c, s, r),
          }
        : null,
    [git, fileIO],
  );

  const addSigner = useCallback(
    async (
      principal: string,
      pubkey: string,
      maintainer = false,
    ): Promise<boolean> => {
      if (!repoRoot || !deps) {
        setError("Audit repo not bound");
        return false;
      }
      setLoading(true);
      setError(null);
      const res = await runAddSigner(deps, {
        repoRoot,
        config,
        principal,
        pubkey,
        maintainer,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      await refresh();
      return true;
    },
    [repoRoot, deps, config, refresh],
  );

  const setRole = useCallback(
    async (
      keyType: string,
      keyBlob: string,
      maintainer: boolean,
    ): Promise<boolean> => {
      if (!repoRoot || !deps) {
        setError("Audit repo not bound");
        return false;
      }
      setLoading(true);
      setError(null);
      const res = await runSetRole(deps, {
        repoRoot,
        config,
        keyType,
        keyBlob,
        maintainer,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      await refresh();
      return true;
    },
    [repoRoot, deps, config, refresh],
  );

  const removeSigner = useCallback(
    async (keyType: string, keyBlob: string): Promise<boolean> => {
      if (!repoRoot || !deps) {
        setError("Audit repo not bound");
        return false;
      }
      setLoading(true);
      setError(null);
      const res = await runRemoveSigner(deps, {
        repoRoot,
        config,
        keyType,
        keyBlob,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      await refresh();
      return true;
    },
    [repoRoot, deps, config, refresh],
  );

  return {
    entries,
    loading,
    error,
    setError,
    refresh,
    addSigner,
    removeSigner,
    setRole,
  };
}
