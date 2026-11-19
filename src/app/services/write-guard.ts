// ==================== WRITE GUARD ====================
// Manual test 2026-11-17: opening a project, and the autosave after an
// Audit commit, rewrote the .tara.json with nothing changed but timestamps
// (info / dfd / risk lastModified, the DFD validation's lastValidated) —
// the repository was dirty again (AVE: REPO_DIRTY) and the next commit
// carried only that noise.
//
// The file is written in the canonical form (TCS), so two writes of the same
// content are the same text; masking the timestamps tells whether anything
// else changed. A write that would change only timestamps is skipped — the
// file keeps its timestamps until the content really changes.

const TIMESTAMP = /"(lastModified|lastValidated)": "[^"]*"/g;

const masked = (text: string) => text.replace(TIMESTAMP, '"$1": ""');

/** True when `next` is the file `current` except for its timestamps (or the same text). */
export function sameButTimestamps(current: string | null | undefined, next: string): boolean {
  if (current === null || current === undefined) return false;
  if (current === next) return true;
  return masked(current) === masked(next);
}
