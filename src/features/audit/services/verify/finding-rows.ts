// ==================== FINDING ROWS (pure) ====================
// The Verify panel's rows (manual test 2026-11-17): the engine lists the
// findings check by check, so the newest problem — e.g. a snapshot changed in
// the last commit — came last, after a dozen old ones; and one commit with
// five non-canonical files gave five identical rows.
//
// Per severity: the findings without a commit (the working tree: REPO_DIRTY)
// first, then by commit, newest first (`commitOrder`: hashes newest first, as
// `git rev-list` prints them; commits it does not know keep the engine's
// order after the known ones). The same rule at the same commit is one row
// with a count and the files it names. The engine's result is untouched —
// only the view.

import type { Finding, Severity } from "./findings";

export interface FindingRow {
  id: Finding["id"];
  severity: Severity;
  commit?: string;
  /** Findings merged into this row. */
  count: number;
  /** Files the merged findings name (context.path), in order, without duplicates. */
  paths: string[];
  /** The first finding of the row — for its explanation. */
  first: Finding;
}

const pathOf = (f: Finding): string | undefined => {
  const p = f.context?.path;
  return typeof p === "string" ? p : undefined;
};

export function findingRows(
  findings: readonly Finding[],
  severity: Severity,
  commitOrder: readonly string[] = [],
): FindingRow[] {
  const rank = new Map(commitOrder.map((h, i) => [h, i]));
  const rows: FindingRow[] = [];
  const byKey = new Map<string, FindingRow>();
  for (const f of findings) {
    if (f.severity !== severity) continue;
    const key = `${f.id}|${f.commit ?? ""}`;
    const row = byKey.get(key);
    const path = pathOf(f);
    if (row) {
      row.count += 1;
      if (path && !row.paths.includes(path)) row.paths.push(path);
      continue;
    }
    const fresh: FindingRow = { id: f.id, severity, ...(f.commit ? { commit: f.commit } : {}), count: 1, paths: path ? [path] : [], first: f };
    byKey.set(key, fresh);
    rows.push(fresh);
  }
  const order = (r: FindingRow): number => {
    if (!r.commit) return -1;
    return rank.get(r.commit) ?? Number.MAX_SAFE_INTEGER;
  };
  // Array.prototype.sort is stable: equal ranks keep the engine's order
  return rows.sort((a, b) => order(a) - order(b));
}
