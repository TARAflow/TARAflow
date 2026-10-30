// ==================== VERIFICATION COMMITS ====================
// Which TARA verification entry went in with which commit — from git
// (pickaxe on the entry id in the project file), never stored (plan Phase 4,
// decision 25). Shared by the Audit tab (chip per entry) and the Audit hint of
// the phase bar (uncommitted entries, user 2026-10-30).

import { repoRelativePath } from "./audit-prev-state";

type RawGit = (command: string[]) => Promise<{ success: boolean; data?: string }>;

/** Entry id → short hash of the first commit that contains it (absent = not committed). */
export async function findVerificationCommits(
  raw: RawGit,
  repoRoot: string,
  filePath: string,
  entryIds: readonly string[],
): Promise<Map<string, string>> {
  const relPath = repoRelativePath(repoRoot, filePath);
  const found = new Map<string, string>();
  for (const id of entryIds) {
    const res = await raw(["log", "--format=%h", "--reverse", `-S${id}`, "--", relPath]);
    const hash = res.success ? res.data?.trim().split("\n")[0] : undefined;
    if (hash) found.set(id, hash);
  }
  return found;
}
