// ==================== AUDIT PREV-STATE (pure) ====================
// Replaces the reconstructProjectFromCommitState stub: the previous project
// state for a diff is simply the committed `.tara.json` at HEAD, read from git.
// This makes DiffService produce real per-round changes instead of treating
// everything as "added".
//
// Pure + injected git runner (window.git.raw, bound to the current audit repo),
// so it stays on the single git path and is unit-testable.

import type { Project } from "app";
import type { GitOperationResult } from "../models/git-types";

/** A raw git runner bound to the current repo — window.git.raw. */
export type RawGit = (args: string[]) => Promise<GitOperationResult<string>>;

/**
 * Path of the project file relative to the repo root (POSIX separators — git
 * tree paths always use `/`). Handles a file in a subfolder and Windows roots;
 * falls back to the basename if the file isn't under the root.
 */
export function repoRelativePath(repoRoot: string, filePath: string): string {
  const root = repoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const file = filePath.replace(/\\/g, "/");
  if (file === root) return "";
  if (file.startsWith(root + "/")) return file.slice(root.length + 1);
  const i = file.lastIndexOf("/");
  return i >= 0 ? file.slice(i + 1) : file;
}

/**
 * Load the project state from the last commit (`git show HEAD:<relpath>`).
 * Returns null when there is no previous state to compare against — an unborn
 * HEAD (first-ever commit), a file not yet in HEAD, or unparseable content —
 * in which case the diff correctly reports everything as new.
 */
export async function loadPreviousProjectFromGit(
  raw: RawGit,
  repoRoot: string,
  filePath: string,
): Promise<Project | null> {
  const rel = repoRelativePath(repoRoot, filePath);
  if (!rel) return null;

  let res: GitOperationResult<string>;
  try {
    res = await raw(["show", `HEAD:${rel}`]);
  } catch {
    return null; // unborn HEAD / git error → treat as no previous state
  }
  if (!res.success || !res.data) return null;

  try {
    return JSON.parse(res.data) as Project;
  } catch {
    return null; // corrupt/partial content — don't crash the diff
  }
}
