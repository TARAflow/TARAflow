// ==================== DUPLICATE DEFINITIONS ====================
// Leveled-DFD Phase 1.3 (leveled-dfd-multi-diagram-design.md §5.2, D8).
//
// Two definition cells with the same tfId arise from draw.io "Duplicate
// page": the copy keeps the plain cell ids on a new pageId. (Identity links
// are page-local, so linked cells never take their identity along.) Rule:
// "paste = new element" — never merged. The cell that was NOT in the last
// saved state is to get a fresh tfId (a "definition" link in dfd.pages) and
// a new displayId (info finding ID_PASTE_REASSIGNED).
//
// This module only DECIDES which cell keeps the identity. Applying it needs
// a new displayId, which lives in the id label in the XML and comes from the
// numbering high-water mark — so it lands in Phase 3. Until then the parser
// keeps the first definition in document order as the record.
//
// Keeper, per (kind, tfId):
//   1. the one definition cell that already existed with this tfId in the
//      last saved state (same page, same cell id);
//   2. if none or several did (first save, import, external editing): among
//      those candidates — or all definitions if none existed — the one on
//      the page first in tree order, then first in document order.

import type { ParsedOccurrence } from "../dfd-parser";

export interface DuplicateDefinition {
  kind: ParsedOccurrence["kind"];
  tfId: string;
  /** Definition cell that keeps the tfId. */
  keep: ParsedOccurrence;
  /** Definition cells that are to get a fresh tfId, in document order. */
  reassign: ParsedOccurrence[];
}

/**
 * @param occurrences      occurrences of the current XML (document order)
 * @param previous         occurrences of the last saved XML; absent = unknown
 * @param pageTreeOrder    pageIds in tree order (PageTree.pages); pages not
 *                         listed sort after all listed ones
 */
export function findDuplicateDefinitions(
  occurrences: readonly ParsedOccurrence[],
  previous: readonly ParsedOccurrence[] = [],
  pageTreeOrder: readonly string[] = [],
): DuplicateDefinition[] {
  const groups = new Map<string, ParsedOccurrence[]>();
  for (const occurrence of occurrences) {
    if (occurrence.role !== "definition") continue;
    const key = `${occurrence.kind}\u0000${occurrence.tfId}`;
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }

  const savedBefore = new Set(
    previous.filter((o) => o.role === "definition").map((o) => cellKey(o)),
  );
  const treeIndex = new Map(pageTreeOrder.map((id, index) => [id, index]));
  const docIndex = new Map(occurrences.map((o, index) => [o, index]));
  const rank = (o: ParsedOccurrence) =>
    treeIndex.get(o.pageId) ?? pageTreeOrder.length;

  const result: DuplicateDefinition[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const existed = group.filter((o) => savedBefore.has(cellKey(o)));
    const candidates = existed.length > 0 ? existed : group;
    const keep =
      candidates.length === 1
        ? candidates[0]
        : [...candidates].sort(
            (a, b) => rank(a) - rank(b) || docIndex.get(a)! - docIndex.get(b)!,
          )[0];

    result.push({
      kind: keep.kind,
      tfId: keep.tfId,
      keep,
      reassign: group.filter((o) => o !== keep),
    });
  }
  return result;
}

function cellKey(o: ParsedOccurrence): string {
  return `${o.kind}\u0000${o.tfId}\u0000${o.pageId}\u0000${o.cellId}`;
}
