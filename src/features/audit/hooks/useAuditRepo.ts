// ==================== useAuditRepo (React hook) ====================
// NOTE: this is a REACT custom hook (a use…() function), NOT a git hook.
// It is a THIN wrapper over the pure, unit-tested `runAuditRepoOpenFlow`. All
// logic lives there; this only wires real IPC deps and exposes UI actions.
//
// Lives at: src/features/audit/hooks/useAuditRepo.ts  (new hooks/ folder)

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createIpcGitRunner,
  createIpcFileIO,
} from "../services/audit-git-adapters";
import { createGitService } from "../services/git-service-renderer";
import { applyTaraAttributes } from "../services/audit-repo-attributes";
import { applyAuditRepoHooks } from "../services/audit-repo-hooks";
import {
  runAuditRepoOpenFlow,
  gitattributesPathOf,
  dirnameOf,
  type AuditRepoOpenOutcome,
  type OpenFlowProject,
} from "../services/audit-repo-open-flow";
import {
  applyAuditRepoIgnore,
  gitignorePathOf,
  IGNORE_COMMIT_SUBJECT,
} from "../services/audit-repo-ignore";
import type { AuditConfig } from "../models/audit-types";

// Machine-specific cache: per project, in localStorage — NEVER in the .tara.json
// (same privacy rule that strips filePath in prepare-for-disk). Advisory only:
// the open-flow re-derives on every open, so a moved repo self-heals.
const CACHE_PREFIX = "taraflow:auditRepoRoot:";

function cacheRepoRoot(projectId: string, root: string | null): Promise<void> {
  try {
    if (root) localStorage.setItem(CACHE_PREFIX + projectId, root);
    else localStorage.removeItem(CACHE_PREFIX + projectId);
  } catch {
    /* localStorage unavailable — cache is advisory, ignore */
  }
  return Promise.resolve();
}

/** chmod +x a written hook via the main process (git won't run a non-exec hook;
 *  harmless no-op on Windows). Injected into applyAuditRepoHooks.
 *
 *  Self-typed so this compiles whether or not window.electron.file's global
 *  type declares makeExecutable yet. (Adding it to that type is nice-to-have —
 *  see the note in the PR — but not required for this to build.) */
type FileMakeExecutable = {
  makeExecutable?: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

async function makeHookExecutable(path: string): Promise<void> {
  const api = window.electron?.file as FileMakeExecutable | undefined;
  if (!api?.makeExecutable) {
    throw new Error("File API (makeExecutable) not available");
  }
  const res = await api.makeExecutable(path);
  if (!res.success) {
    throw new Error(res.error ?? "Failed to make hook executable");
  }
}

export function useAuditRepo(project: OpenFlowProject) {
  const gitRunner = useMemo(() => createIpcGitRunner(), []);
  const fileIO = useMemo(() => createIpcFileIO(), []);
  const gitService = useMemo(() => createGitService(), []);

  const [outcome, setOutcome] = useState<AuditRepoOpenOutcome | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deps = useMemo(
    () => ({
      gitRunner,
      fileIO,
      setRepoPath: (root: string) => gitService.setRepoPath(root),
      cacheRepoRoot,
    }),
    [gitRunner, fileIO, gitService],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOutcome(await runAuditRepoOpenFlow(deps, project));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit repo check failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, project.id, project.filePath]);

  // Run on open and whenever the project (or its file) changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const o = await runAuditRepoOpenFlow(deps, project);
        if (!cancelled) setOutcome(o);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Audit repo check failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, project.id, project.filePath]);

  /** Write the managed .gitattributes block, then re-check. */
  const applyAttributes = useCallback(async () => {
    if (
      !outcome ||
      (outcome.kind !== "repo-needs-attributes" && outcome.kind !== "repo-ok")
    ) {
      return;
    }
    const repoRoot = outcome.repoRoot;
    setLoading(true);
    setError(null);
    try {
      await applyTaraAttributes(
        gitRunner,
        fileIO,
        repoRoot,
        gitattributesPathOf(repoRoot),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set .gitattributes");
      setLoading(false);
    }
  }, [outcome, gitRunner, fileIO, refresh]);

  /** Install/refresh the managed git hooks (core.hooksPath + .tara/hooks), then
   *  keep that local hook out of git and re-check. Same guard as applyAttributes
   *  — needs a bound repo root. `config` (from the audit tab) is used only to
   *  sign the .gitignore infra commit; hooks install fine without it. */
  const applyHooks = useCallback(
    async (config?: AuditConfig) => {
      if (
        !outcome ||
        (outcome.kind !== "repo-needs-attributes" && outcome.kind !== "repo-ok")
      ) {
        return;
      }
      const repoRoot = outcome.repoRoot;
      setLoading(true);
      setError(null);
      try {
        // 1) Install the managed hook + point core.hooksPath at .tara/hooks.
        await applyAuditRepoHooks(
          gitRunner,
          fileIO,
          makeHookExecutable,
          repoRoot,
        );

        // 2) Keep the hook out of git. It is non-authoritative (the CLI/CI with a
        //    pinned anchor is the authority), per-machine, and regenerated by the
        //    app per HOOKS_VERSION — so it must not be committed. Add a managed
        //    .gitignore block for /.tara/hooks/ (existing entries preserved) and,
        //    if the hook was ever tracked, un-track it. The trust root
        //    .tara/allowed_signers stays tracked — only the hooks dir is ignored.
        const ignore = await applyAuditRepoIgnore(
          gitRunner,
          fileIO,
          repoRoot,
          gitignorePathOf(repoRoot),
        );

        // 3) Commit ONLY the .gitignore (plus any un-track) as a signed audit:
        //    infra commit — same path as the manifest/.gitattributes commits. The
        //    audit: subject is exempt from the round schema, and .gitignore is not
        //    under .tara/, so the hook lets it through either way. Skipped when
        //    there is nothing to stage or no config to attribute/sign the commit.
        if (ignore.toStage.length > 0 && config) {
          const signCommit = !!(config.signing?.enabled ?? config.gpg.enabled);
          await gitService.setRepoPath(repoRoot);
          await gitService.stage(ignore.toStage);
          await gitService.commit(
            IGNORE_COMMIT_SUBJECT,
            config,
            signCommit,
            ignore.toStage,
          );
        }

        await refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to install git hooks",
        );
        setLoading(false);
      }
    },
    [outcome, gitRunner, fileIO, gitService, refresh],
  );

  /** `git init` in the project's directory, then re-run the flow. */
  const initRepo = useCallback(async () => {
    if (!project.filePath) return;
    const fileDir = dirnameOf(project.filePath);
    setLoading(true);
    setError(null);
    try {
      const res = await gitRunner(["init"], fileDir);
      if (res.code !== 0) throw new Error(res.stderr || "git init failed");
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to initialize repository",
      );
      setLoading(false);
    }
  }, [project.filePath, gitRunner, refresh]);

  return {
    outcome,
    loading,
    error,
    refresh,
    applyAttributes,
    applyHooks,
    initRepo,
  };
}