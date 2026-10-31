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
import { ALLOWED_SIGNERS_REL_PATH } from "./audit-signer-manifest";

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

/**
 * The signer manifest as committed at `ref` (default HEAD; `git show
 * <ref>:.tara/allowed_signers`) — what the verification engine checks the
 * next commit on that branch against. null when
 * HEAD has none (no manifest yet, unborn HEAD, git error); a deleted or edited
 * working-tree copy does not count.
 */
export async function loadCommittedManifest(raw: RawGit, ref = "HEAD"): Promise<string | null> {
  try {
    const res = await raw(["show", `${ref}:${ALLOWED_SIGNERS_REL_PATH}`]);
    return res.success && typeof res.data === "string" ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the repository's history ever introduced the signer manifest (the
 * audit anchor). From then on every commit is verified — signed and in a
 * repository-wide rule, whatever the project file says (user 2026-10-31:
 * once signing is on, only signed commits), even if the manifest was removed
 * later (the engine then reports SIGNER_NOT_AUTHORIZED / SIG_UNSIGNED).
 */
export async function loadManifestAnchored(raw: RawGit, ref = "HEAD"): Promise<boolean> {
  try {
    const res = await raw(["log", ref, "--diff-filter=A", "--format=%H", "--", ALLOWED_SIGNERS_REL_PATH]);
    return res.success && typeof res.data === "string" && res.data.trim() !== "";
  } catch {
    return false;
  }
}

/** The signing state of the branch a commit goes to (manifest + anchor). */
export async function loadSigningState(
  raw: RawGit,
  ref = "HEAD",
): Promise<{ manifest: string | null; anchored: boolean }> {
  const [manifest, anchored] = await Promise.all([loadCommittedManifest(raw, ref), loadManifestAnchored(raw, ref)]);
  return { manifest, anchored };
}
