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

import type { DFDCellLink } from "../../models/dfd-types";
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
  /**
   * Identity links of the child page (dfd.pages[].links). A linked cell
   * counts as present even when the parser does not see it as an
   * occurrence — a copied flow whose free end is not attached yet — so it
   * is never copied a second time.
   */
  childLinks?: readonly DFDCellLink[];
}

/** The context of a multiprocess on its home page (§12). */
interface HomeContext {
  home: string;
  /** home-page cell → tfId */
  tfIdOf: Record<string, string>;
  /** Flow cells touching the MP (no self-loops). */
  flowCells: string[];
  neighbourCells: string[];
  boundaryCells: string[];
}

function contextOnHome(
  parse: Pick<ParseResult, "occurrences">,
  pageGeometry: ReadonlyMap<string, PageGeometry>,
  multiprocess: string,
  childPageId: string,
): HomeContext | undefined {
  const home = computeHomePages(parse.occurrences).elements.get(multiprocess);
  if (!home || home === childPageId) return undefined;

  const onHome = parse.occurrences.filter((o) => o.pageId === home);
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
  const geometry = pageGeometry.get(home);
  const boundaryCells = new Set<string>();
  for (const cell of [...elementCells(multiprocess), ...neighbourCells]) {
    for (const map of [geometry?.trust, geometry?.chip, geometry?.physical]) {
      for (const boundary of map?.get(cell) ?? []) boundaryCells.add(boundary);
    }
  }

  return {
    home,
    tfIdOf,
    flowCells: flows.map((f) => f.cellId),
    neighbourCells,
    boundaryCells: [...boundaryCells],
  };
}

export function planContextCopies(input: ContextCopyInput): ContextCopySpec | undefined {
  const { parse, multiprocess, childPageId } = input;
  const context = contextOnHome(parse, input.pageGeometry, multiprocess, childPageId);
  if (!context) return undefined;
  const { home, tfIdOf, flowCells, neighbourCells, boundaryCells } = context;

  const childCellOf = new Map<string, string>();
  for (const o of parse.occurrences) {
    if (o.pageId === childPageId && !childCellOf.has(o.tfId)) childCellOf.set(o.tfId, o.cellId);
  }
  for (const l of input.childLinks ?? []) {
    if (!childCellOf.has(l.tfId)) childCellOf.set(l.tfId, l.cellId);
  }

  // Only what the child page does not show yet.
  const missing = (cell: string) => {
    const tfId = tfIdOf[cell];
    return tfId !== undefined && !childCellOf.has(tfId);
  };
  const cells = [
    ...boundaryCells.filter(missing),
    ...neighbourCells.filter(missing),
    ...flowCells.filter(missing),
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

/**
 * Context copies on the child page that no longer belong to the context —
 * the copy of a flow deleted or re-routed on the home page, a neighbour
 * without a flow to the MP, a boundary around none of them. Only context
 * copies (a "ref" link) are ever proposed, never a definition. For PURE
 * context pages (no part of their own, D15) only: there the context
 * follows the parent page both ways; on a page with parts a copy whose
 * definition was deleted stays and reports BAL_DANGLING_REF (§5.2).
 *
 * Undefined home (the MP is dangling or gone): nothing — that is the
 * orphan-page question (5e), not a context change.
 */
export function planContextRemovals(input: ContextCopyInput): string[] {
  const { parse, multiprocess, childPageId } = input;
  const context = contextOnHome(parse, input.pageGeometry, multiprocess, childPageId);
  if (!context) return [];
  const { tfIdOf, flowCells, neighbourCells, boundaryCells } = context;
  const wanted = new Set(
    [...flowCells, ...neighbourCells, ...boundaryCells].map((cell) => tfIdOf[cell]),
  );

  const copies = new Map<string, string>(); // child cell → tfId
  for (const o of parse.occurrences) {
    if (o.pageId === childPageId && o.role === "ref") copies.set(o.cellId, o.tfId);
  }
  // Linked cells the parser does not see (a flow with a free end).
  for (const l of input.childLinks ?? []) {
    if (l.role === "ref" && !copies.has(l.cellId)) copies.set(l.cellId, l.tfId);
  }
  return [...copies]
    .filter(([, tfId]) => tfId !== multiprocess && !wanted.has(tfId))
    .map(([cell]) => cell);
}
