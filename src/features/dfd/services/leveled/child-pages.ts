// ==================== CHILD PAGES ====================
// Leveled-DFD Phase 5d (leveled-dfd-multi-diagram-design.md §5.3, §12,
// D15–D17). What the page structure needs after a save:
//
//   D15  every multiprocess without a child page gets one (empty, named
//        like the MP, page link on the MP's cells). The decomposition only
//        takes effect with the page's first own part, so an empty page costs
//        the MP nothing. In a CLASSIC project only multiprocesses drawn after
//        opening count: opening a project never levels it.
//   D16  a child page's tab name follows its multiprocess's name (MP → tab).
//   D17  the root page is named "Top" from the second page on.
//
// Pure: returns the new dfd.pages and what draw.io has to do; the caller
// performs the draw.io part first, then saves the pages.

import type { DFDPage } from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import { computeHomePages } from "./home-pages";
import type { CellRef } from "./identity-links";
import { recordInfos, recordKey, signatureOf } from "./signatures";
import { readDrawioPages } from "../parsers/page-reader";

export const ROOT_PAGE_NAME = "Top";

export interface ChildPageCreation {
  pageId: string;
  name: string;
  /** tfId of the multiprocess the page details. */
  decomposes: string;
  /** Cells of the multiprocess that get the page link (all occurrences). */
  links: CellRef[];
}

export interface PageRename {
  pageId: string;
  name: string;
}

/** A cell of a decomposed multiprocess whose page link is missing or wrong. */
export interface PageLinkFix extends CellRef {
  /** pageId the link has to open. */
  target: string;
}

/** A child page whose multiprocess no longer exists (5e: ask to delete it). */
export interface OrphanPage {
  pageId: string;
  name: string;
  /** tfId of the deleted multiprocess. */
  decomposes: string;
}

export interface PageSyncPlan {
  /** dfd.pages after the sync. */
  pages: DFDPage[];
  create: ChildPageCreation[];
  rename: PageRename[];
  /** Page links for occurrences drawn after the page was created (5e). */
  link: PageLinkFix[];
  /** Child pages whose multiprocess was deleted — the analyst decides. */
  orphans: OrphanPage[];
}

export interface PageSyncInput {
  parse: Pick<ParseResult, "pages" | "elements" | "connections" | "occurrences">;
  pages: readonly DFDPage[] | undefined;
  /**
   * Multiprocess tfIds that get no page automatically: in a classic project
   * those that existed when the DFD was opened; plus those already tried in
   * this session. A leveled project ignores the first part (D15 for all).
   */
  knownMultiprocesses: ReadonlySet<string>;
  newPageId: () => string;
  /**
   * Current `link` attribute per cell ("pageId\u0000cellId", readCellLinks).
   * Absent: no link check.
   */
  cellLinks?: ReadonlyMap<string, string>;
}

const cellKey = (c: CellRef) => `${c.pageId}\u0000${c.cellId}`;

/** `link` attributes of the cells of every page, keyed by page and cell. */
export function readCellLinks(xml: string): Map<string, string> {
  const links = new Map<string, string>();
  for (const page of readDrawioPages(xml)) {
    for (const node of Array.from(page.doc.getElementsByTagName("*"))) {
      const link = node.getAttribute("link");
      const id = node.getAttribute("id");
      if (link && id) links.set(cellKey({ pageId: page.pageId, cellId: id }), link);
    }
  }
  return links;
}

/** draw.io page link to a page (double-click / Ctrl-click opens it). */
export const pageLink = (pageId: string) => `data:page/id,${pageId}`;

export function planPageSync(input: PageSyncInput): PageSyncPlan | undefined {
  const { parse, knownMultiprocesses, newPageId } = input;
  if (parse.pages.length === 0) return undefined;

  const homePages = computeHomePages(parse.occurrences);
  const decomposed = new Set(
    (input.pages ?? []).map((p) => p.decomposes).filter((id): id is string => !!id),
  );

  // A new multiprocess that looks like a copy of an existing one (same real
  // displayId) waits for the copy assignment (5b) instead of getting a page.
  const infos = recordInfos(parse);
  const signatureCount = new Map<string, number>();
  for (const info of infos.values()) {
    const signature = signatureOf(info);
    if (signature) signatureCount.set(signature, (signatureCount.get(signature) ?? 0) + 1);
  }
  const looksLikeCopy = (tfId: string) => {
    const info = infos.get(recordKey("element", tfId));
    const signature = info && signatureOf(info);
    return !!signature && (signatureCount.get(signature) ?? 0) > 1;
  };

  const occurrencesOf = (tfId: string) =>
    parse.occurrences
      .filter((o) => o.kind === "element" && o.tfId === tfId)
      .map((o) => ({ pageId: o.pageId, cellId: o.cellId }));

  const create: ChildPageCreation[] = parse.elements
    .filter(
      (e) =>
        e.type === "Multiprocess" &&
        homePages.elements.has(e.id) &&
        !decomposed.has(e.id) &&
        !knownMultiprocesses.has(e.id) &&
        !looksLikeCopy(e.id),
    )
    .map((e) => ({
      pageId: newPageId(),
      name: pageNameOf(e),
      decomposes: e.id,
      links: occurrencesOf(e.id),
    }));

  // dfd.pages: a classic project gets its root entry with the first page.
  let pages: DFDPage[] = input.pages
    ? [...input.pages]
    : create.length > 0
      ? [{ pageId: parse.pages[0].pageId, name: parse.pages[0].name, order: 0 }]
      : [];
  if (pages.length === 0) return undefined;
  let order = Math.max(...pages.map((p) => p.order)) + 1;
  for (const c of create) {
    pages.push({ pageId: c.pageId, name: c.name, decomposes: c.decomposes, order: order++ });
  }

  // Names: D17 for the root, D16 for the child pages. The XML name is the
  // current one (§5.3); new pages are created with their name already.
  const xmlName = new Map(parse.pages.map((p) => [p.pageId, p.name]));
  const byId = new Map(parse.elements.map((e) => [e.id, e]));
  const rename: PageRename[] = [];
  const pageCount = parse.pages.length + create.length;
  pages = pages.map((p) => {
    const wanted = p.decomposes
      ? byId.has(p.decomposes)
        ? pageNameOf(byId.get(p.decomposes)!)
        : undefined
      : pageCount >= 2
        ? ROOT_PAGE_NAME
        : undefined;
    if (wanted === undefined) return p;
    if (xmlName.has(p.pageId) && xmlName.get(p.pageId) !== wanted) {
      rename.push({ pageId: p.pageId, name: wanted });
    }
    return p.name === wanted ? p : { ...p, name: wanted };
  });

  // Page links on every occurrence of a decomposed multiprocess — also on
  // copies drawn after the page was created (§12: double-click opens the
  // child page on its copies too). New pages get theirs with `create`.
  const link: PageLinkFix[] = [];
  if (input.cellLinks) {
    for (const p of input.pages ?? []) {
      if (!p.decomposes || !xmlName.has(p.pageId)) continue;
      for (const cell of occurrencesOf(p.decomposes)) {
        if (input.cellLinks.get(cellKey(cell)) !== pageLink(p.pageId)) {
          link.push({ ...cell, target: p.pageId });
        }
      }
    }
  }

  // Child pages whose multiprocess is gone (a dangling MP keeps its record
  // from its copies and is not an orphan).
  const orphans: OrphanPage[] = (input.pages ?? [])
    .filter((p) => p.decomposes && xmlName.has(p.pageId) && !byId.has(p.decomposes))
    .map((p) => ({ pageId: p.pageId, name: xmlName.get(p.pageId) ?? p.name, decomposes: p.decomposes! }));

  const pagesChanged =
    create.length > 0 ||
    !input.pages ||
    pages.some((p, i) => p !== input.pages![i]);
  if (
    create.length === 0 &&
    rename.length === 0 &&
    link.length === 0 &&
    orphans.length === 0 &&
    !pagesChanged
  ) {
    return undefined;
  }
  return { pages, create, rename, link, orphans };
}

function pageNameOf(mp: { name?: string; displayId?: string; id: string }): string {
  return (mp.name ?? "").trim() || (mp.displayId ?? "").trim() || mp.id;
}
