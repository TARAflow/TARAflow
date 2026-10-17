// ==================== PAGE OUTLINE ====================
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12 "Page
// tree"): what the page tree in the DFD tab shows. Pure, derived from the
// parse, dfd.pages and the current findings.
//
//   - pages in tree order (root, then child pages depth-first by order),
//     with depth and the multiprocess each child page details
//   - whether that decomposition is in effect yet (D15: only once the page
//     defines a part of its own; until then the MP is analysed as a whole)
//   - finding counts per page: a finding belongs to the home page of the
//     element / flow it names (§5.4)
//   - pages the tree cannot place, after the tree

import type { DFDPage, ValidationFinding } from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import { pagesWithOwnParts } from "./effective-model";
import { computeHomePages } from "./home-pages";
import { buildPageTree } from "./page-tree";

export interface PageOutlineNode {
  pageId: string;
  /** Page name as in the XML (§5.3: the XML name wins). */
  name: string;
  /** Root = 0; undefined for a page the tree cannot place. */
  depth?: number;
  /** Detailed multiprocess (child pages only). */
  decomposes?: { tfId: string; label: string };
  /**
   * Child page that defines no part of its own yet: the multiprocess is
   * still analysed as a whole (D15).
   */
  pendingDecomposition: boolean;
  errors: number;
  warnings: number;
}

export interface PageOutline {
  /** Placed pages in tree order, then the unplaced ones in document order. */
  nodes: PageOutlineNode[];
  /** First page of the document — the one draw.io opens on load. */
  firstPageId?: string;
}

export interface PageOutlineInput {
  parse: Pick<ParseResult, "pages" | "elements" | "connections" | "occurrences">;
  pages: readonly DFDPage[] | undefined;
  errors?: readonly ValidationFinding[];
  warnings?: readonly ValidationFinding[];
}

export function buildPageOutline(input: PageOutlineInput): PageOutline {
  const { parse, pages } = input;
  const homePages = computeHomePages(parse.occurrences);
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages: pages,
    elements: parse.elements,
    occurrences: parse.occurrences,
    homePages,
  });

  const typeOf = new Map(parse.elements.map((e) => [e.id, e.type]));
  const withParts = pagesWithOwnParts(parse.occurrences, typeOf);
  const labels = new Map(
    parse.elements.map((e) => [e.id, [e.displayId, e.name].filter(Boolean).join(" ")]),
  );
  const names = new Map(parse.pages.map((p) => [p.pageId, p.name]));

  const count = (findings: readonly ValidationFinding[] | undefined) => {
    const perPage = new Map<string, number>();
    for (const f of findings ?? []) {
      if (!f.elementId) continue;
      const page =
        homePages.elements.get(f.elementId) ?? homePages.connections.get(f.elementId);
      if (page) perPage.set(page, (perPage.get(page) ?? 0) + 1);
    }
    return perPage;
  };
  const errors = count(input.errors);
  const warnings = count(input.warnings);

  const node = (pageId: string, decomposes: string | undefined): PageOutlineNode => ({
    pageId,
    name: names.get(pageId) ?? pageId,
    depth: tree.depthOf.get(pageId),
    ...(decomposes
      ? { decomposes: { tfId: decomposes, label: labels.get(decomposes) ?? decomposes } }
      : {}),
    pendingDecomposition: !!decomposes && !withParts.has(pageId),
    errors: errors.get(pageId) ?? 0,
    warnings: warnings.get(pageId) ?? 0,
  });

  const placed = tree.pages
    .filter((p) => tree.depthOf.has(p.pageId))
    .map((p) => node(p.pageId, p.decomposes));
  const placedIds = new Set(placed.map((n) => n.pageId));
  const unplaced = parse.pages
    .filter((p) => !placedIds.has(p.pageId))
    .map((p) => node(p.pageId, pages?.find((x) => x.pageId === p.pageId)?.decomposes));

  return { nodes: [...placed, ...unplaced], firstPageId: parse.pages[0]?.pageId };
}
