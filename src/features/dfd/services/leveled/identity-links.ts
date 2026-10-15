// ==================== IDENTITY LINK WRITERS ====================
// Leveled-DFD Phase 1.4 (leveled-dfd-multi-diagram-design.md §5.2, §5.2.1).
//
// The only code that changes dfd.pages[].links. Every operation is pure:
// it takes dfd.pages and returns a new array (or the same array if nothing
// changes, so a no-op never churns the project file). The XML is never
// touched — identity is a JSON fact (rev. 4.1).
//
//   pruneStaleLinks      drop links whose (pageId, cellId) no longer exists
//                        in the XML — runs on every save
//   promoteToDefinition  repair of a dangling element: a chosen context copy
//                        becomes the definition (BAL_DANGLING_REF)
//   makeDefinition       "Make this the definition": a context copy becomes
//                        the definition, the former definition a copy
//   linkAsContextCopy    "Make this a context copy of …": a plain cell
//                        (pasted or redrawn) becomes a copy of an existing
//                        element / flow (assignment dialog, adoption)
//
// Lazy invariant kept by every writer: a cell whose identity equals its own
// cell id as a definition has NO link; everything else has exactly one.

import type { DFDCellLink, DFDPage } from "../../models/dfd-types";
import type { ParsedOccurrence } from "../dfd-parser";
import { readDrawioPages } from "../parsers/page-reader";

export interface CellRef {
  pageId: string;
  cellId: string;
}

export type LinkEditResult =
  { ok: true; pages: DFDPage[] } | { ok: false; reason: LinkEditRefusal };

export type LinkEditRefusal =
  /** No parsed element / flow cell at (pageId, cellId). */
  | "CELL_NOT_FOUND"
  /** The cell is already the definition of its tfId. */
  | "NOT_A_CONTEXT_COPY"
  /** promote: the tfId still has a definition — use makeDefinition. */
  | "NOT_DANGLING"
  /** makeDefinition: the tfId has no definition — use promote. */
  | "NO_DEFINITION"
  /** makeDefinition: several definitions (duplicate page) — resolve first. */
  | "DUPLICATE_DEFINITIONS"
  /** The page of a cell to relink has no entry in dfd.pages. */
  | "PAGE_NOT_IN_TREE"
  /** linkAsContextCopy: the cell already carries a link (copy or moved definition). */
  | "NOT_A_PLAIN_CELL"
  /** linkAsContextCopy: the cell would become a copy of itself. */
  | "SAME_IDENTITY"
  /** linkAsContextCopy: the cell type differs from the type of the target. */
  | "TYPE_MISMATCH";

export interface PrunedLink extends CellRef {
  tfId: string;
}

/**
 * Drop links whose cell no longer exists in the XML (§5.2 "stale links"),
 * so a link can never attach to a different cell later.
 *
 * Only cell EXISTENCE counts — a cell that is present but currently not
 * parsed as an element (e.g. label cleared) keeps its link. Pages that are
 * missing from the XML are left untouched: that is PAGE_MISSING, resolved
 * by the page-deletion flow, not silently here.
 */
export function pruneStaleLinks(
  pages: readonly DFDPage[] | undefined,
  xml: string,
): { pages: DFDPage[] | undefined; removed: PrunedLink[] } {
  if (!pages || !pages.some((p) => p.links && p.links.length > 0)) {
    return { pages: pages as DFDPage[] | undefined, removed: [] };
  }

  const cellsByPage = new Map<string, Set<string>>();
  for (const page of readDrawioPages(xml)) {
    const ids = new Set<string>();
    for (const tag of ["object", "UserObject", "mxCell"]) {
      for (const node of Array.from(page.doc.getElementsByTagName(tag))) {
        const id = node.getAttribute("id");
        if (id) ids.add(id);
      }
    }
    cellsByPage.set(page.pageId, ids);
  }

  const removed: PrunedLink[] = [];
  let changed = false;
  const next = pages.map((page) => {
    const cells = cellsByPage.get(page.pageId);
    if (!cells || !page.links || page.links.length === 0) return page;
    const kept = page.links.filter((link) => {
      if (cells.has(link.cellId)) return true;
      removed.push({
        pageId: page.pageId,
        cellId: link.cellId,
        tfId: link.tfId,
      });
      return false;
    });
    if (kept.length === page.links.length) return page;
    changed = true;
    return withLinks(page, kept);
  });

  return { pages: changed ? next : (pages as DFDPage[]), removed };
}

/**
 * "Promote to definition" (§5.2.1): repair a dangling element by making the
 * chosen context copy its definition. The home page and the geometric
 * boundaries change with it, which is why this is never done automatically.
 */
export function promoteToDefinition(
  pages: readonly DFDPage[],
  occurrences: readonly ParsedOccurrence[],
  target: CellRef,
): LinkEditResult {
  const copy = findOccurrence(occurrences, target);
  if (!copy) return refuse("CELL_NOT_FOUND");
  if (copy.role !== "ref") return refuse("NOT_A_CONTEXT_COPY");
  if (definitionsOf(occurrences, copy).length > 0)
    return refuse("NOT_DANGLING");

  return setIdentity(pages, copy, "definition");
}

/**
 * "Make this the definition" (§5.2 lifecycle): the chosen context copy
 * becomes the definition, the former definition cell becomes a context
 * copy of the same tfId. A semantic change (home page, boundaries).
 */
export function makeDefinition(
  pages: readonly DFDPage[],
  occurrences: readonly ParsedOccurrence[],
  target: CellRef,
): LinkEditResult {
  const copy = findOccurrence(occurrences, target);
  if (!copy) return refuse("CELL_NOT_FOUND");
  if (copy.role !== "ref") return refuse("NOT_A_CONTEXT_COPY");

  const definitions = definitionsOf(occurrences, copy);
  if (definitions.length === 0) return refuse("NO_DEFINITION");
  if (definitions.length > 1) return refuse("DUPLICATE_DEFINITIONS");

  const demoted = setIdentity(pages, definitions[0], "ref");
  if (!demoted.ok) return demoted;
  return setIdentity(demoted.pages, copy, "definition");
}

/**
 * "Make this a context copy of …" (§5.2 lifecycle, assignment dialog): a
 * plain cell — pasted, redrawn, or adopted — becomes a context copy of an
 * existing element / flow with a definition. The cell's own logical record
 * ceases to exist; meant for cells that are new or were never analysed on
 * their own (the dialog only proposes those).
 *
 * @param types type per record (kind\0tfId → DFDElementType / "DataFlow"),
 *              e.g. from recordInfos(parse)
 */
export function linkAsContextCopy(
  pages: readonly DFDPage[],
  occurrences: readonly ParsedOccurrence[],
  types: ReadonlyMap<string, { type: string }>,
  cell: CellRef,
  tfId: string,
): LinkEditResult {
  const occurrence = findOccurrence(occurrences, cell);
  if (!occurrence) return refuse("CELL_NOT_FOUND");
  if (
    occurrence.role !== "definition" ||
    occurrence.tfId !== occurrence.cellId
  ) {
    return refuse("NOT_A_PLAIN_CELL");
  }
  if (tfId === occurrence.tfId) return refuse("SAME_IDENTITY");

  const target = { ...occurrence, tfId };
  if (definitionsOf(occurrences, target).length === 0) {
    return refuse("NO_DEFINITION");
  }
  const key = (id: string) => `${occurrence.kind}\u0000${id}`;
  if (types.get(key(tfId))?.type !== types.get(key(occurrence.tfId))?.type) {
    return refuse("TYPE_MISMATCH");
  }

  return setIdentity(pages, occurrence, "ref", tfId);
}

// ---------------------------------------------------------------------------

function setIdentity(
  pages: readonly DFDPage[],
  cell: ParsedOccurrence,
  role: DFDCellLink["role"],
  tfId: string = cell.tfId,
): LinkEditResult {
  const index = pages.findIndex((p) => p.pageId === cell.pageId);
  if (index < 0) return refuse("PAGE_NOT_IN_TREE");

  const page = pages[index];
  const others = (page.links ?? []).filter((l) => l.cellId !== cell.cellId);
  const plainDefinition = role === "definition" && tfId === cell.cellId;
  const links = plainDefinition
    ? others
    : [...others, { cellId: cell.cellId, tfId, role }];

  const next = [...pages];
  next[index] = withLinks(page, links);
  return { ok: true, pages: next };
}

function withLinks(page: DFDPage, links: DFDCellLink[]): DFDPage {
  if (links.length > 0) return { ...page, links };
  const { links: _dropped, ...rest } = page;
  return rest;
}

function findOccurrence(
  occurrences: readonly ParsedOccurrence[],
  target: CellRef,
): ParsedOccurrence | undefined {
  return occurrences.find(
    (o) => o.pageId === target.pageId && o.cellId === target.cellId,
  );
}

function definitionsOf(
  occurrences: readonly ParsedOccurrence[],
  of: ParsedOccurrence,
): ParsedOccurrence[] {
  return occurrences.filter(
    (o) => o.kind === of.kind && o.tfId === of.tfId && o.role === "definition",
  );
}

function refuse(reason: LinkEditRefusal): LinkEditResult {
  return { ok: false, reason };
}
