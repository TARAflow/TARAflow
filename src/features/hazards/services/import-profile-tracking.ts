// features/hazards/services/import-profile-tracking.ts
//
// Hazard import HI-10, part 1 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): a re-import recognises the project's stored
// profile and follows the sheet's changes. Pure.
//
// Recognition: same file name (case-insensitive) first, else the stored header
// row matched against the sheet — searched in the first rows, because rows
// inserted above move it. Column tracking: every mapped column is found again
// by its heading; moved columns are re-mapped, every change is reported for
// the analyst to check (decision: follow automatically, user 2026-10-25).

import { cellStr } from "./apply-import-profile";
import type {
  ImportProfile,
  SheetGrid,
  StoredImportProfile,
  WorkbookPreview,
} from "../models/import-profile-types";

/** How far down a moved header row is searched. */
const HEADER_SEARCH_ROWS = 15;
/** Share of the stored headings that must reappear for a header match. */
const HEADER_MATCH_SHARE = 0.6;

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function rowHeadings(sheet: SheetGrid, row: number): string[] {
  return (sheet.rows[row] ?? []).map((c) => cellStr(c) ?? "");
}

/** Share of the stored (non-empty) headings that appear in `headings`. */
function overlap(stored: readonly string[], headings: readonly string[]): number {
  const want = stored.map(norm).filter(Boolean);
  if (want.length === 0) return 0;
  const have = new Set(headings.map(norm).filter(Boolean));
  return want.filter((h) => have.has(h)).length / want.length;
}

/** The row in the first lines that best matches the stored header. */
function findHeaderRow(sheet: SheetGrid, stored: readonly string[]): { row: number; share: number } {
  let best = { row: -1, share: 0 };
  for (let r = 0; r < Math.min(sheet.rows.length, HEADER_SEARCH_ROWS); r++) {
    const share = overlap(stored, rowHeadings(sheet, r));
    if (share > best.share) best = { row: r, share };
  }
  return best;
}

export interface ProfileMatch {
  profile: StoredImportProfile;
  reason: "fileName" | "header";
}

/** The stored profile this file belongs to, if any. */
export function findMatchingProfile(
  stored: readonly StoredImportProfile[] | undefined,
  workbook: WorkbookPreview,
  fileName: string,
): ProfileMatch | null {
  const list = stored ?? [];
  const byName = list.find((p) => norm(p.source?.fileName) === norm(fileName));
  if (byName) return { profile: byName, reason: "fileName" };
  let best: { profile: StoredImportProfile; share: number } | null = null;
  for (const p of list) {
    if (!p.source?.header?.length) continue;
    const sheet = p.sheetName ? workbook.sheets.find((s) => s.name === p.sheetName) : workbook.sheets[0];
    if (!sheet) continue;
    const { share } = findHeaderRow(sheet, p.source.header);
    if (share >= HEADER_MATCH_SHARE && (!best || share > best.share)) best = { profile: p, share };
  }
  return best ? { profile: best.profile, reason: "header" } : null;
}

export type ColumnChange =
  | { kind: "headerRowMoved"; from: number; to: number }
  | { kind: "moved"; heading: string; from: number; to: number }
  | { kind: "renamed"; column: number; from: string; to: string }
  | { kind: "removed"; heading: string; column: number }
  | { kind: "added"; heading: string; column: number };

export interface TrackedProfile {
  profile: ImportProfile;
  changes: ColumnChange[];
}

/**
 * Follow the sheet: header row and mapped columns re-found by heading.
 * - same heading at the same index → unchanged;
 * - heading found elsewhere (once) → mapping moved there;
 * - heading gone, but the found neighbours agree on its new position and a
 *   new heading stands there → renamed (mapping follows; check it);
 * - otherwise gone → mapping dropped, reported as removed;
 * - headings the stored header did not have → reported as added (unmapped).
 */
export function trackProfileColumns(
  stored: StoredImportProfile,
  workbook: WorkbookPreview,
): TrackedProfile {
  const { source: _source, lastUsed: _lastUsed, ...mapping } = stored;
  const oldHeader = stored.source?.header;
  const sheet = stored.sheetName ? workbook.sheets.find((s) => s.name === stored.sheetName) : workbook.sheets[0];
  if (!oldHeader?.length || !sheet) return { profile: mapping, changes: [] };

  const changes: ColumnChange[] = [];
  const found = findHeaderRow(sheet, oldHeader);
  const headerRow = found.share > 0 ? found.row : stored.headerRow;
  const shift = headerRow - stored.headerRow;
  if (shift !== 0) changes.push({ kind: "headerRowMoved", from: stored.headerRow, to: headerRow });
  const newHeader = rowHeadings(sheet, headerRow);

  const indexOf = (heading: string): number => {
    const hits = newHeader.map((h, i) => (norm(h) === norm(heading) ? i : -1)).filter((i) => i >= 0);
    return hits.length === 1 ? hits[0] : -1;
  };

  // Every stored column found again by its heading (or not).
  const foundAt = oldHeader.map((h) => (norm(h) ? indexOf(h) : -1));
  const taken = new Set(foundAt.filter((i) => i >= 0));

  /**
   * A column whose heading is gone: where its neighbours went decides. If the
   * matched neighbours left and right agree on one position (consistent gap),
   * and that cell has a heading nobody else claims, it was renamed there;
   * otherwise it was removed.
   */
  const inferRenamed = (column: number): number => {
    let p = column - 1;
    while (p >= 0 && foundAt[p] < 0) p--;
    let n = column + 1;
    while (n < oldHeader.length && foundAt[n] < 0) n++;
    const fromLeft = p >= 0 ? foundAt[p] + (column - p) : undefined;
    const fromRight = n < oldHeader.length ? foundAt[n] - (n - column) : undefined;
    const candidate =
      fromLeft !== undefined && fromRight !== undefined
        ? fromLeft === fromRight ? fromLeft : -1
        : (fromLeft ?? fromRight ?? column);
    return candidate >= 0 && norm(newHeader[candidate]) && !taken.has(candidate) ? candidate : -1;
  };

  // undefined = mapping dropped
  const track = (column: number): number | undefined => {
    if (column < 0) return column;
    const heading = oldHeader[column] ?? "";
    if (!norm(heading)) return column; // nothing to recognise it by
    const at = foundAt[column];
    if (at === column) return column;
    if (at >= 0) {
      if (!changes.some((c) => c.kind === "moved" && c.from === column)) {
        changes.push({ kind: "moved", heading, from: column, to: at });
      }
      return at;
    }
    const renamed = inferRenamed(column);
    if (renamed >= 0) {
      if (!changes.some((c) => c.kind === "renamed" && c.column === renamed)) {
        changes.push({ kind: "renamed", column: renamed, from: heading, to: newHeader[renamed] });
      }
      return renamed;
    }
    if (!changes.some((c) => c.kind === "removed" && c.column === column)) {
      changes.push({ kind: "removed", heading, column });
    }
    return undefined;
  };

  const columns = mapping.columns.flatMap((c) => {
    const to = track(c.column);
    return to === undefined ? [] : [{ ...c, column: to }];
  });
  const markerGroups = mapping.markerGroups.map((g) => ({
    ...g,
    columns: g.columns.flatMap((mc) => {
      const to = track(mc.column);
      return to === undefined ? [] : [{ ...mc, column: to }];
    }),
  }));
  const metaColumns = (mapping.metaColumns ?? []).flatMap((m) => {
    const to = track(m.column);
    return to === undefined ? [] : [{ ...m, column: to }];
  });

  const known = new Set(oldHeader.map(norm).filter(Boolean));
  const renamedTo = new Set(changes.flatMap((c) => (c.kind === "renamed" ? [c.column] : [])));
  newHeader.forEach((h, i) => {
    if (norm(h) && !known.has(norm(h)) && !renamedTo.has(i)) {
      changes.push({ kind: "added", heading: h, column: i });
    }
  });

  return {
    profile: {
      ...mapping,
      headerRow,
      dataStartRow: mapping.dataStartRow + shift,
      columns,
      markerGroups,
      metaColumns,
    },
    changes,
  };
}
