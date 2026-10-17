// ==================== CONTEXT COPIES ====================
// Leveled-DFD Phase 5f (leveled-dfd-multi-diagram-design.md §12
// "Decompose…" / "Sync context").
//
// What a child page needs from the multiprocess's home page so the analyst
// only has to add the parts and drag the flow ends onto them:
//
//   1. flow neighbours — every element connected to the MP by a flow
//   2. the flows touching the MP, as context occurrences whose MP end stays
//      free at the MP's border position (draw.io's cloneCells sets that
//      terminal point when the terminal is not cloned)
//   3. the boundaries containing the MP or a flow neighbour, so crossings
//      stay visible
//
// Not included: the MP itself (never on its own child page, §5.3),
// second-degree neighbours, unrelated elements, self-loops.
//
// Idempotent ("Sync context"): a logical element / flow that already occurs
// on the child page is not copied again — no BAL_DUPLICATE_OCCURRENCE can
// arise from it; a flow copied now is connected to the neighbour copy that
// is already there. Nothing is removed. Pure: cell ids in, cell ids out;
// draw.io clones with the original geometry, the caller links the clones.

import type { ParseResult } from "../dfd-parser";
import { computeHomePages } from "./home-pages";
import type { PageGeometry } from "./page-geometry";

export interface ContextCopySpec {
  /** Home page of the multiprocess — where the cells are cloned from. */
  fromPageId: string;
  /** The child page — where the clones go. */
  toPageId: string;
  /** Cells of fromPage to clone: boundaries, then elements, then flows. */
  cells: string[];
  /**
   * fromPage cell → cell on the child page that already shows the same
   * element: a cloned flow is connected to it instead of staying loose.
   */
  existing: Record<string, string>;
  /** fromPage cell → tfId: the clone becomes a context copy ("ref") of it. */
  tfIdOf: Record<string, string>;
}

export interface ContextCopyInput {
  parse: Pick<ParseResult, "occurrences">;
  /** analysePageGeometry(parse.pageCells) — boundaries per cell and page. */
  pageGeometry: ReadonlyMap<string, PageGeometry>;
  /** The decomposed multiprocess. */
  multiprocess: string;
  childPageId: string;
}

export function planContextCopies(input: ContextCopyInput): ContextCopySpec | undefined {
  const { parse, multiprocess, childPageId } = input;
  const home = computeHomePages(parse.occurrences).elements.get(multiprocess);
  if (!home || home === childPageId) return undefined;

  const onHome = parse.occurrences.filter((o) => o.pageId === home);
  const onChild = parse.occurrences.filter((o) => o.pageId === childPageId);
  const childCellOf = new Map<string, string>();
  for (const o of onChild) if (!childCellOf.has(o.tfId)) childCellOf.set(o.tfId, o.cellId);
  const tfIdOf: Record<string, string> = {};
  for (const o of onHome) tfIdOf[o.cellId] = o.tfId;

  const elementCells = (tfId: string) =>
    onHome.filter((o) => o.kind === "element" && o.tfId === tfId).map((o) => o.cellId);

  // 1. + 2. Flows touching the MP (not self-loops) and their other ends.
  const flows = onHome.filter(
    (o) =>
      o.kind === "connection" &&
      (o.sourceTfId === multiprocess) !== (o.targetTfId === multiprocess),
  );
  const neighbours = new Set<string>();
  for (const f of flows) {
    const other = f.sourceTfId === multiprocess ? f.targetTfId : f.sourceTfId;
    if (other) neighbours.add(other);
  }
  const neighbourCells = [...neighbours].flatMap(elementCells);

  // 3. Boundaries around the MP or a neighbour on the home page.
  const geometry = input.pageGeometry.get(home);
  const boundaryCells = new Set<string>();
  for (const cell of [...elementCells(multiprocess), ...neighbourCells]) {
    for (const map of [geometry?.trust, geometry?.chip, geometry?.physical]) {
      for (const boundary of map?.get(cell) ?? []) boundaryCells.add(boundary);
    }
  }

  // Only what the child page does not show yet.
  const missing = (cell: string) => {
    const tfId = tfIdOf[cell];
    return tfId !== undefined && !childCellOf.has(tfId);
  };
  const cells = [
    ...[...boundaryCells].filter(missing),
    ...neighbourCells.filter(missing),
    ...flows.map((f) => f.cellId).filter(missing),
  ];
  if (cells.length === 0) return undefined;

  const existing: Record<string, string> = {};
  for (const cell of neighbourCells) {
    const there = childCellOf.get(tfIdOf[cell]);
    if (there) existing[cell] = there;
  }
  const usedTfIds: Record<string, string> = {};
  for (const cell of cells) usedTfIds[cell] = tfIdOf[cell];

  return { fromPageId: home, toPageId: childPageId, cells, existing, tfIdOf: usedTfIds };
}
