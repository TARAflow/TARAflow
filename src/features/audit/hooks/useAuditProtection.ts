// ==================== useAuditProtection (React hook) ====================
// Runs the local git checks over the audit line and produces the protection
// result + a ready-to-render markdown checklist. Also owns the per-repo
// "don't auto-show again" flag (localStorage — out-of-band, never in .tara.json).
//
// Lives at: src/features/audit/hooks/useAuditProtection.ts

import { useCallback, useEffect, useState } from "react";
import {
  checkProtection,
  type ProtectionCheckResult,
} from "../services/audit-protection-check";
import {
  buildProtectionChecklist,
} from "../services/audit-protection-checklist";
import { parseRemote } from "../services/audit-git-host";
import { ALLOWED_SIGNERS_REL_PATH } from "../services/audit-signer-manifest";
import type { GitOperationResult } from "../models/git-types";

/** The bits of the bound GitService this hook needs. */
export interface ProtectionGit {
  raw: (command: string[]) => Promise<GitOperationResult<string>>;
}

export interface AuditProtection {
  result: ProtectionCheckResult | null;
  markdown: string;
  anchor: string | null;
  branch: string;
  loading: boolean;
  error: string | null;
  /** True when there is a real, locally-provable violation → auto-warn. */
  hasViolation: boolean;
  /** Per-repo "don't auto-show" flag. */
  dismissed: boolean;
  setDismissed: (v: boolean) => void;
  refresh: () => Promise<void>;
}

const dismissKey = (repoRoot: string) => `taraflow:audit:protect:dismiss:${repoRoot}`;

/** Read stdout from a raw git call, or null on failure (missing tag, etc.). */
async function tryRaw(git: ProtectionGit, args: string[]): Promise<string | null> {
  const res = await git.raw(args);
  return res.success ? (res.data ?? "").trim() : null;
}

export function useAuditProtection(
  repoRoot: string | undefined,
  git: ProtectionGit | undefined,
  branch: string,
): AuditProtection {
  const [result, setResult] = useState<ProtectionCheckResult | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissedState] = useState(false);

  useEffect(() => {
    setDismissedState(
      repoRoot ? localStorage.getItem(dismissKey(repoRoot)) === "1" : false,
    );
  }, [repoRoot]);

  const setDismissed = useCallback(
    (v: boolean) => {
      setDismissedState(v);
      if (repoRoot) {
        if (v) localStorage.setItem(dismissKey(repoRoot), "1");
        else localStorage.removeItem(dismissKey(repoRoot));
      }
    },
    [repoRoot],
  );

  const refresh = useCallback(async () => {
    if (!repoRoot || !git) {
      setResult(null);
      setMarkdown("");
      setAnchor(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Anchor = the commit that first ADDED the manifest (oldest such line).
      const addLog = await tryRaw(git, [
        "log",
        "--format=%H",
        "--diff-filter=A",
        "--",
        ALLOWED_SIGNERS_REL_PATH,
      ]);
      const anchorHash = addLog
        ? addLog.split(/\r?\n/).filter(Boolean).pop() ?? null
        : null;

      if (!anchorHash) {
        // No manifest yet → nothing to protect. Not an error; empty state.
        setAnchor(null);
        setResult(null);
        setMarkdown("");
        setLoading(false);
        return;
      }

      const range = `${anchorHash}..HEAD`;
      const [signatureLog, mergeLog, tagTarget, remoteUrl] = await Promise.all([
        tryRaw(git, ["log", "--format=%H %G?", range]),
        tryRaw(git, ["log", "--merges", "--format=%H", range]),
        tryRaw(git, ["rev-list", "-n", "1", "audit-root"]),
        tryRaw(git, ["remote", "get-url", "origin"]),
      ]);

      const res = checkProtection({
        signatureLog: signatureLog ?? "",
        mergeLog: mergeLog ?? "",
        anchorTagTarget: tagTarget,
        expectedAnchor: anchorHash,
      });

      const md = buildProtectionChecklist({
        remote: parseRemote(remoteUrl),
        result: res,
        branch,
        anchor: anchorHash,
      });

      setAnchor(anchorHash);
      setResult(res);
      setMarkdown(md);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Protection check failed");
    } finally {
      setLoading(false);
    }
  }, [repoRoot, git, branch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasViolation = result ? !result.localOk : false;

  return {
    result,
    markdown,
    anchor,
    branch,
    loading,
    error,
    hasViolation,
    dismissed,
    setDismissed,
    refresh,
  };
}
