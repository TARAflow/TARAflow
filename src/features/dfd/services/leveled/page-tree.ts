// ==================== PAGE TREE ====================
// Leveled-DFD Phase 1.3 (leveled-dfd-multi-diagram-design.md §5.3, §5.4).
//
// Reconciles the persisted page tree (dfd.pages) with the pages actually
// present in the XML and derives what the later phases need: the root, each
// page's parent page and depth, and the tree order.
//
//   parent(page P that decomposes MP) = home page of MP (§5.3.1)
//   depth(root) = 0, depth(child) = depth(parent) + 1 (§5.4)
//   tree order = root, then child pages depth-first by `order` (§8)
//
// Pure and read-only: it never repairs dfd.pages. Every inconsistency is
// returned as an issue; the validator (Phase 4) turns them into findings.
// A page that cannot be placed in the tree keeps no depth — it is never
// silently attached somewhere.

import type { DFDPage } from "../../models/dfd-types";
import type { DFDElementType } from "../../models/dfd-element-types";
import type { ParsedOccurrence, ParsedPageInfo } from "../dfd-parser";
import type { HomePages } from "./home-pages";

export type PageTreeIssue =
  /** Page in the XML but not in dfd.pages (with >1 page: adoption pending, §11.2.1). */
  | { code: "PAGE_UNASSIGNED"; pageId: string }
  /** Entry in dfd.pages whose page no longer exists in the XML. */
  | { code: "PAGE_MISSING"; pageId: string }
  | { code: "PAGE_NO_ROOT" }
  /** The first by `order` is used as root; the others stay outside the tree. */
  | { code: "PAGE_MULTIPLE_ROOTS"; pageIds: string[] }
  /** `decomposes` names no element of the model. */
  | { code: "PAGE_DECOMPOSES_UNKNOWN"; pageId: string; tfId: string }
  /** Only multiprocesses can be decomposed (D1). */
  | { code: "PAGE_DECOMPOSES_NOT_MULTIPROCESS"; pageId: string; tfId: string }
  /** A multiprocess has at most one child page. */
  | { code: "PAGE_DECOMPOSED_TWICE"; tfId: string; pageIds: string[] }
  /** The decomposed MP has no definition (dangling) or its home page is outside the tree. */
  | { code: "PAGE_PARENT_UNRESOLVED"; pageId: string; tfId: string }
  /** Following parent pages loops (e.g. an MP defined on its own child page). */
  | { code: "PAGE_CYCLE"; pageIds: string[] }
  /** A decomposed MP appears on its own child page (§5.3, §7). */
  | { code: "BAL_DECOMPOSED_ON_OWN_PAGE"; pageId: string; tfId: string };

export interface PageTree {
  /** Pages placed in the tree, in tree order. */
  pages: DFDPage[];
  rootPageId?: string;
  /** child pageId → parent pageId */
  parentOf: Map<string, string>;
  /** pageId → depth (root = 0); only for pages placed in the tree */
  depthOf: Map<string, number>;
  /** decomposed multiprocess tfId → its child pageId */
  childPageOf: Map<string, string>;
  issues: PageTreeIssue[];
}

export interface PageTreeInput {
  /** Pages of the XML in document order (ParseResult.pages). */
  parsedPages: readonly ParsedPageInfo[];
  /** dfd.pages; absent = classic project. */
  persistedPages?: readonly DFDPage[];
  /** Logical elements (ParseResult.elements). */
  elements: readonly { id: string; type: DFDElementType }[];
  occurrences: readonly ParsedOccurrence[];
  homePages: HomePages;
}

export function buildPageTree(input: PageTreeInput): PageTree {
  const issues: PageTreeIssue[] = [];
  const docIndex = new Map(input.parsedPages.map((p) => [p.pageId, p.index]));

  const assigned = reconcile(input, issues);

  const byOrder = (a: DFDPage, b: DFDPage) =>
    a.order - b.order ||
    (docIndex.get(a.pageId) ?? 0) - (docIndex.get(b.pageId) ?? 0);

  // ---- root ---------------------------------------------------------------
  const roots = assigned
    .filter((p) => p.decomposes === undefined)
    .sort(byOrder);
  if (roots.length === 0 && assigned.length > 0)
    issues.push({ code: "PAGE_NO_ROOT" });
  if (roots.length > 1) {
    issues.push({
      code: "PAGE_MULTIPLE_ROOTS",
      pageIds: roots.map((p) => p.pageId),
    });
  }
  const root = roots[0];

  // ---- decomposition --------------------------------------------------------
  const typeOf = new Map(input.elements.map((e) => [e.id, e.type]));
  const assignedIds = new Set(assigned.map((p) => p.pageId));
  const parentOf = new Map<string, string>();
  const childPageOf = new Map<string, string>();
  const decomposers = new Map<string, string[]>();

  for (const page of assigned) {
    const mp = page.decomposes;
    if (mp === undefined) continue;

    const type = typeOf.get(mp);
    if (type === undefined) {
      issues.push({
        code: "PAGE_DECOMPOSES_UNKNOWN",
        pageId: page.pageId,
        tfId: mp,
      });
      continue;
    }
    if (type !== "Multiprocess") {
      issues.push({
        code: "PAGE_DECOMPOSES_NOT_MULTIPROCESS",
        pageId: page.pageId,
        tfId: mp,
      });
      continue;
    }
    decomposers.set(mp, [...(decomposers.get(mp) ?? []), page.pageId]);

    const home = input.homePages.elements.get(mp);
    if (home === undefined || !assignedIds.has(home)) {
      issues.push({
        code: "PAGE_PARENT_UNRESOLVED",
        pageId: page.pageId,
        tfId: mp,
      });
      continue;
    }
    parentOf.set(page.pageId, home);
  }

  for (const [mp, pageIds] of decomposers) {
    if (pageIds.length > 1) {
      issues.push({ code: "PAGE_DECOMPOSED_TWICE", tfId: mp, pageIds });
    }
    childPageOf.set(mp, pageIds[0]);
  }

  for (const occurrence of input.occurrences) {
    if (occurrence.kind !== "element") continue;
    const own = childPageOf.get(occurrence.tfId);
    if (own !== undefined && own === occurrence.pageId) {
      issues.push({
        code: "BAL_DECOMPOSED_ON_OWN_PAGE",
        pageId: occurrence.pageId,
        tfId: occurrence.tfId,
      });
    }
  }

  // ---- depth and tree order (depth-first from the root) ---------------------
  const children = new Map<string, DFDPage[]>();
  for (const page of assigned) {
    const parent = parentOf.get(page.pageId);
    if (parent === undefined) continue;
    children.set(parent, [...(children.get(parent) ?? []), page]);
  }

  const depthOf = new Map<string, number>();
  const ordered: DFDPage[] = [];
  const visit = (page: DFDPage, depth: number) => {
    if (depthOf.has(page.pageId)) return; // defensive; cycles never reach the root
    depthOf.set(page.pageId, depth);
    ordered.push(page);
    for (const child of [...(children.get(page.pageId) ?? [])].sort(byOrder)) {
      visit(child, depth + 1);
    }
  };
  if (root) visit(root, 0);

  // ---- cycles among the pages that were not reached ------------------------
  const reported = new Set<string>();
  for (const page of assigned) {
    if (depthOf.has(page.pageId) || reported.has(page.pageId)) continue;
    const path: string[] = [];
    let current: string | undefined = page.pageId;
    while (
      current !== undefined &&
      !path.includes(current) &&
      !reported.has(current)
    ) {
      path.push(current);
      current = parentOf.get(current);
    }
    if (current !== undefined && path.includes(current)) {
      const cycle = path.slice(path.indexOf(current));
      cycle.forEach((id) => reported.add(id));
      issues.push({ code: "PAGE_CYCLE", pageIds: cycle });
    }
    path.forEach((id) => reported.add(id));
  }

  return {
    pages: ordered,
    rootPageId: root?.pageId,
    parentOf,
    depthOf,
    childPageOf,
    issues,
  };
}

/**
 * dfd.pages restricted to the pages present in the XML, names taken from the
 * XML. Without dfd.pages the first XML page is the implicit root.
 */
function reconcile(input: PageTreeInput, issues: PageTreeIssue[]): DFDPage[] {
  const { parsedPages, persistedPages } = input;
  const xmlPages = new Map(parsedPages.map((p) => [p.pageId, p]));

  if (!persistedPages || persistedPages.length === 0) {
    if (parsedPages.length === 0) return [];
    const [first, ...rest] = parsedPages;
    rest.forEach((p) =>
      issues.push({ code: "PAGE_UNASSIGNED", pageId: p.pageId }),
    );
    return [{ pageId: first.pageId, name: first.name, order: 0 }];
  }

  const result: DFDPage[] = [];
  const seen = new Set<string>();
  for (const page of persistedPages) {
    if (seen.has(page.pageId)) continue; // first entry wins
    seen.add(page.pageId);
    const xmlPage = xmlPages.get(page.pageId);
    if (!xmlPage) {
      issues.push({ code: "PAGE_MISSING", pageId: page.pageId });
      continue;
    }
    result.push({ ...page, name: xmlPage.name });
  }
  for (const xmlPage of parsedPages) {
    if (!seen.has(xmlPage.pageId)) {
      issues.push({ code: "PAGE_UNASSIGNED", pageId: xmlPage.pageId });
    }
  }
  return result;
}
