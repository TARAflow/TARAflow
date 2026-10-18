// ==================== LOST DEFINITIONS ====================
// Leveled-DFD Phase 5k (leveled-dfd-multi-diagram-design.md §5.2 lifecycle
// "A linked cell is recreated"). A definition whose identity differs from
// its cell id (moved with "Make this the definition", adopted, promoted)
// lives on through its `definition` link. When that cell is deleted and
// drawn again — or cut and pasted, also in external draw.io — the new cell
// has a new id and no link: a new element. The old logical record has lost
// its definition:
//
//   - with context copies left it is dangling (§5.2.1, "Promote", 5g);
//   - without, it is gone — with its properties, asset relations and the
//     threats that refer to it. That case needs the analyst's decision:
//     re-attach the old identity to the new cell, or accept the deletion.
//
// The save itself cannot wait (autosave), so this compares the saved state
// with the one before and keeps the lost record for the decision. A plain
// cell (tfId = cell id) deleted and drawn again is a new element as in a
// classic DFD and is not reported. Pure.

import type { DFDConnection, DFDElement, DFDPage } from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import { readDrawioPages } from "../parsers/page-reader";

export interface LostDefinition {
  kind: "element" | "connection";
  tfId: string;
  /** displayId and name */
  label: string;
  type: string;
  /** Page the definition was on. */
  pageId: string;
  pageName: string;
  /** The record as it was — restored on re-attach. */
  record: DFDElement | DFDConnection;
  /**
   * New plain cells of the same kind and type on that page (not in the
   * state before), the one with the same displayId first: re-attach targets.
   */
  candidates: { cellId: string; label: string }[];
}

export interface DfdState {
  xml?: string;
  pages?: readonly DFDPage[];
  elements: readonly DFDElement[];
  connections: readonly DFDConnection[];
}

const cellsOf = (xml: string | undefined): Set<string> => {
  const cells = new Set<string>();
  for (const page of readDrawioPages(xml ?? "")) {
    for (const node of Array.from(page.doc.getElementsByTagName("*"))) {
      const id = node.getAttribute("id");
      if (id) cells.add(`${page.pageId}\u0000${id}`);
    }
  }
  return cells;
};

export function findLostDefinitions(
  before: DfdState,
  after: DfdState,
  afterParse: Pick<ParseResult, "pages" | "elements" | "connections" | "occurrences">,
): LostDefinition[] {
  if (!before.pages || !before.xml || !after.xml) return [];
  const cellsAfter = cellsOf(after.xml);
  const cellsBefore = cellsOf(before.xml);
  const recordsAfter = new Set([
    ...after.elements.map((e) => `element:${e.id}`),
    ...after.connections.map((c) => `connection:${c.id}`),
  ]);
  const pageNames = new Map(afterParse.pages.map((p) => [p.pageId, p.name || p.pageId]));
  for (const p of before.pages) if (!pageNames.has(p.pageId)) pageNames.set(p.pageId, p.name);
  const label = (r: { id: string; displayId?: string; name?: string }) =>
    [r.displayId, r.name].filter(Boolean).join(" ") || r.id;

  const lost: LostDefinition[] = [];
  for (const page of before.pages) {
    for (const link of page.links ?? []) {
      if (link.role !== "definition" || link.tfId === link.cellId) continue;
      if (cellsAfter.has(`${page.pageId}\u0000${link.cellId}`)) continue; // cell still there
      const element = before.elements.find((e) => e.id === link.tfId);
      const connection = element ? undefined : before.connections.find((c) => c.id === link.tfId);
      const record = element ?? connection;
      if (!record) continue;
      const kind = element ? "element" : "connection";
      if (recordsAfter.has(`${kind}:${link.tfId}`)) continue; // copies left: dangling, not lost
      const type = element ? element.type : "DataFlow";

      const records = kind === "element" ? afterParse.elements : afterParse.connections;
      const typeOf = (id: string) =>
        kind === "element" ? afterParse.elements.find((e) => e.id === id)?.type : "DataFlow";
      const candidates = afterParse.occurrences
        .filter(
          (o) =>
            o.kind === kind &&
            o.pageId === page.pageId &&
            o.role === "definition" &&
            o.tfId === o.cellId &&
            !cellsBefore.has(`${o.pageId}\u0000${o.cellId}`) &&
            typeOf(o.tfId) === type,
        )
        .map((o) => {
          const r = records.find((x) => x.id === o.tfId);
          return { cellId: o.cellId, label: r ? label(r) : o.cellId, same: r?.displayId === record.displayId };
        })
        .sort((a, b) => Number(b.same) - Number(a.same))
        .map(({ cellId, label: l }) => ({ cellId, label: l }));

      lost.push({
        kind,
        tfId: link.tfId,
        label: label(record),
        type,
        pageId: page.pageId,
        pageName: pageNames.get(page.pageId) ?? page.pageId,
        record,
        candidates,
      });
    }
  }
  return lost;
}

/**
 * dfd.pages with the old identity attached to the new cell: a `definition`
 * link (the cell then shows the lost record again).
 */
export function reattachDefinition(
  pages: readonly DFDPage[],
  lost: Pick<LostDefinition, "tfId" | "pageId">,
  cellId: string,
): DFDPage[] {
  return pages.map((p) =>
    p.pageId !== lost.pageId
      ? p
      : {
          ...p,
          links: [
            ...(p.links ?? []).filter((l) => l.cellId !== cellId),
            { cellId, tfId: lost.tfId, role: "definition" as const },
          ],
        },
  );
}
