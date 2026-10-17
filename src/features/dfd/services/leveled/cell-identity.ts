// ==================== CELL IDENTITY INDEX ====================
// Leveled-DFD Phase 5a (leveled-dfd-multi-diagram-design.md §5.2, §13
// Phase 5 prerequisite).
//
// The UI talks to draw.io in cells, the model in logical identities:
//
//   draw.io → TARAflow   a selected cell (pageId, cellId) → its tfId, so the
//                        side panel opens the logical record — also for a
//                        context copy or a moved / adopted definition
//   TARAflow → draw.io   a tfId → the cell to select, preferring the page the
//                        user is looking at, then the definition
//
// Classic projects have no links, so both directions are the identity
// (tfId = cell id) and nothing changes for them. Pure; nothing persisted.

import type { DFDPage } from "../../models/dfd-types";
import type { ParsedOccurrence } from "../dfd-parser";
import {
  collectCellIdentities,
  identityOf,
  type CellIdentity,
  type OccurrenceRole,
} from "../parsers/identity-reader";
import type { CellRef } from "./identity-links";

export interface CellOccurrenceRef extends CellRef {
  role: OccurrenceRole;
}

export interface CellIdentityIndex {
  /**
   * Logical identity of a cell selected in draw.io. Without a page id (an
   * old draw.io plugin, browser dev mode) the cell is looked up on all
   * pages; if that is not unique, the cell id itself is returned — the
   * classic single-page behaviour.
   */
  tfIdOf(cellId: string, pageId?: string | null): string;
  /**
   * The cell that shows a logical element / flow: an occurrence on the
   * preferred page (the definition, if it is there), otherwise the
   * definition, otherwise the first context copy (dangling, §5.2.1).
   * Undefined if the XML has no cell for it.
   */
  cellOf(tfId: string, preferredPageId?: string | null): CellRef | undefined;
  /** All occurrences of a tfId, in document order. */
  occurrencesOf(tfId: string): readonly CellOccurrenceRef[];
}

export function buildCellIdentityIndex(
  pages: readonly DFDPage[] | undefined,
  occurrences: readonly ParsedOccurrence[],
): CellIdentityIndex {
  // Links per page, read like the parser does (same malformed-link rules).
  // They answer the draw.io → TARAflow direction also for a cell that the
  // last parse has not seen yet.
  const linksByPage = new Map<string, Map<string, CellIdentity>>(
    (pages ?? []).map((page) => [page.pageId, collectCellIdentities(page.links)]),
  );

  const byTfId = new Map<string, CellOccurrenceRef[]>();
  const tfIdsByCellId = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const ref: CellOccurrenceRef = {
      pageId: occurrence.pageId,
      cellId: occurrence.cellId,
      role: occurrence.role,
    };
    const list = byTfId.get(occurrence.tfId);
    if (list) list.push(ref);
    else byTfId.set(occurrence.tfId, [ref]);

    const tfIds = tfIdsByCellId.get(occurrence.cellId);
    if (tfIds) tfIds.add(occurrence.tfId);
    else tfIdsByCellId.set(occurrence.cellId, new Set([occurrence.tfId]));
  }

  return {
    tfIdOf(cellId, pageId) {
      if (pageId != null) {
        const identities = linksByPage.get(pageId);
        if (identities) return identityOf(identities, cellId).tfId;
      }
      const tfIds = tfIdsByCellId.get(cellId);
      if (tfIds && tfIds.size === 1) return tfIds.values().next().value as string;
      return cellId;
    },

    cellOf(tfId, preferredPageId) {
      const list = byTfId.get(tfId);
      if (!list || list.length === 0) return undefined;
      const pick =
        (preferredPageId != null
          ? (list.find((o) => o.pageId === preferredPageId && o.role === "definition") ??
            list.find((o) => o.pageId === preferredPageId))
          : undefined) ??
        list.find((o) => o.role === "definition") ??
        list[0];
      return { pageId: pick.pageId, cellId: pick.cellId };
    },

    occurrencesOf(tfId) {
      return byTfId.get(tfId) ?? [];
    },
  };
}
