// ==================== AUDIT REPO LOCATOR ====================
// Implements the HYBRID repo-path model: discover the audit repo from the
// project file's location instead of asking the user to configure a path.
//
//   - the audit repo is the git repo that CONTAINS the project's .tara.json
//   - found via `git rev-parse --show-toplevel` run in the file's directory,
//     so a file in a SUBFOLDER still resolves to the repo ROOT (an ancestor)
//   - the resolved path is machine-specific → the caller caches it in the
//     registry/localStorage, NEVER in the .tara.json (same privacy rule that
//     strips `filePath` in prepare-for-disk), and re-derives on each open so a
//     moved repo self-heals
//
// SINGLE GIT PATH: the injected GitRunner MUST be backed by the one main-process
// GitService (via IPC), not a second `execFile("git")`. This module never spawns
// git itself — it only shapes args and interprets results, so it stays unit-
// testable with a fake runner.

export interface GitRunner {
  /** Run git with args in `cwd`. Must resolve (not throw) on non-zero exit. */
  (args: string[], cwd: string): Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }>;
}

export type AuditRepoNextAction = "inspect-attributes" | "offer-init";

export interface AuditRepoLocation {
  /** True if `fileDir` is inside a git work tree. */
  isRepo: boolean;
  /** The repo top-level (may be an ancestor of fileDir), or null. */
  repoRoot: string | null;
  /** The directory we probed (dirname of the project file). */
  fileDir: string;
  /**
   * What the UI should do next:
   *   - inspect-attributes → run the .gitattributes guard (repo exists)
   *   - offer-init         → show the hint + offer to `git init` here
   */
  nextAction: AuditRepoNextAction;
}

/**
 * Resolve the audit repo for a project file's directory.
 *
 * @param run      git runner backed by the single main-process GitService
 * @param fileDir  directory containing the project's .tara.json
 *                 (caller computes this via node:path in the main process)
 */
export async function locateAuditRepo(
  run: GitRunner,
  fileDir: string,
): Promise<AuditRepoLocation> {
  const res = await run(["rev-parse", "--show-toplevel"], fileDir);
  const root = res.stdout.trim();

  if (res.code === 0 && root.length > 0) {
    return {
      isRepo: true,
      repoRoot: root,
      fileDir,
      nextAction: "inspect-attributes",
    };
  }

  // code !== 0 (typically 128 "not a git repository") → not in a repo
  return {
    isRepo: false,
    repoRoot: null,
    fileDir,
    nextAction: "offer-init",
  };
}

/**
 * git args to read ONE project's trail from a repo that may hold several
 * projects. Path-based separation is message-independent and therefore the
 * robust per-project filter (each project == one .tara.json).
 *
 * @param repoRelativeProjectPath  the .tara.json path relative to the repo root
 *                                 (POSIX separators), e.g. "tara/foo.tara.json"
 */
export function perProjectLogArgs(repoRelativeProjectPath: string): string[] {
  return ["log", "--", repoRelativeProjectPath];
}
