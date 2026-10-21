// ==================== REPORT PAGES ====================
// Leveled-DFD Phase 7a (leveled-dfd-multi-diagram-design.md §12.1, item 4):
// the pages of a leveled DFD as the report shows them — one figure per page
// in page-tree order, each with its stored thumbnail and, for a child page,
// the multiprocess it decomposes. Undefined for a classic DFD (one page).

import type { DFDConnection, DFDElement, DFDPage } from "../../models/dfd-types";
import { isLeveled } from "../build-dfd-graph";
import { analyseLeveled } from "./leveled-analysis";

export interface ReportPage {
  pageId: string;
  name: string;
  /** 0 for the root page. */
  depth: number;
  /** SVG data URL; the root page falls back to dfd.thumbnail. */
  image?: string;
  /** displayId and name of the multiprocess this page decomposes. */
  decomposes?: string;
}

export interface ReportPagesSource {
  xml?: string;
  pages?: readonly DFDPage[];
  elements?: readonly DFDElement[];
  connections?: readonly DFDConnection[];
  thumbnail?: string;
}

export function reportPagesOf(dfd: ReportPagesSource | null | undefined): ReportPage[] | undefined {
  if (!dfd?.pages || dfd.pages.length < 2 || !isLeveled(dfd.xml)) return undefined;
  const elements = dfd.elements ?? [];
  const label = (tfId: string) => {
    const e = elements.find((x) => x.id === tfId);
    return e ? [e.displayId, e.name].filter(Boolean).join(" ") || tfId : tfId;
  };
  const toPage = (page: DFDPage, depth: number, root: boolean): ReportPage => {
    const image = page.thumbnail ?? (root ? dfd.thumbnail : undefined);
    return {
      pageId: page.pageId,
      name: page.name || page.pageId,
      depth,
      ...(image ? { image } : {}),
      ...(page.decomposes ? { decomposes: label(page.decomposes) } : {}),
    };
  };

  try {
    const { tree } = analyseLeveled({
      xml: dfd.xml,
      pages: dfd.pages,
      elements,
      connections: dfd.connections ?? [],
    });
    // Order and depth from the tree; the page itself (thumbnail) from the
    // input — the analysis is cached per page structure, not per thumbnail.
    const byId = new Map(dfd.pages.map((p) => [p.pageId, p]));
    const ordered = tree.pages.flatMap((p) => {
      const page = byId.get(p.pageId);
      return page ? [{ page, depth: tree.depthOf.get(p.pageId) ?? 0 }] : [];
    });
    if (ordered.length > 0) {
      return ordered.map(({ page, depth }) => toPage(page, depth, page.pageId === tree.rootPageId));
    }
  } catch {
    // Unreadable XML (e.g. a compressed page): the stored order below.
  }
  return [...dfd.pages]
    .sort((a, b) => a.order - b.order)
    .map((p, i) => toPage(p, p.decomposes ? 1 : 0, i === 0));
}
