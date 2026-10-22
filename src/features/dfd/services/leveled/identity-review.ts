// ==================== IDENTITY REVIEW ====================
// Leveled-DFD Phase 5b (leveled-dfd-multi-diagram-design.md §11.2.1, §5.2
// lifecycle, D8, D13).
//
// One review, two entry points — both only ever change dfd.pages (identity
// links, decomposition), never the XML:
//
//   adoption     a multi-page XML whose pages are not all in dfd.pages yet
//                (ID_ADOPTION_PENDING): propose the page tree and which
//                cells show the same element (proposeAdoption, 1.5)
//   assignment   after a save of an adopted DFD: new plain cells that look
//                like a copy of an existing element (same displayId and
//                type) — "context copy of X" or "new element"
//                (proposeCopyAssignments, 1.5)
//
// The analyst confirms in the dialog; nothing is merged silently.

import { parseDfd } from "./leveled-analysis";
import type { DFDPage } from "../../models/dfd-types";
import { inspectDrawioPages } from "shared";
import { dfdParser, type ParseResult } from "../dfd-parser";
import {
  applyAdoption,
  proposeAdoption,
  type AdoptionApplyResult,
  type AdoptionDecisions,
  type AdoptionProposal,
} from "./adoption";
import {
  applyCopyAssignments,
  proposeCopyAssignments,
  type CopyAssignment,
  type CopyAssignmentResult,
} from "./copy-assignment";
import type { CellRef } from "./identity-links";

export interface AdoptionReview {
  kind: "adoption";
  /** The XML the proposal was made for — applied against exactly this. */
  xml: string;
  parse: ParseResult;
  proposal: AdoptionProposal;
}

export interface AssignmentReview {
  kind: "assignment";
  xml: string;
  parse: ParseResult;
  assignments: CopyAssignment[];
}

export type IdentityReview = AdoptionReview | AssignmentReview;

/**
 * True when the XML has several pages and at least one is not in dfd.pages.
 * Compressed pages are a different problem (refused, not adoptable).
 */
export function isAdoptionPending(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): boolean {
  const layout = inspectDrawioPages(xml, pages?.map((p) => p.pageId));
  return layout.unadoptedPageNames.length > 0 && layout.compressedPageNames.length === 0;
}

/**
 * Entries of dfd.pages the page tree cannot use (§5.3): a page without
 * `decomposes` is a root, so every root after the first (by order, then
 * document order — as buildPageTree) is an extra root (PAGE_MULTIPLE_ROOTS);
 * an entry whose page is gone from the XML is missing (PAGE_MISSING).
 */
export function misplacedPages(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): { extraRoots: string[]; missing: string[] } {
  if (!xml || !pages || pages.length === 0) return { extraRoots: [], missing: [] };
  const docIndex = new Map(
    inspectDrawioPages(xml).pageIds.map((pageId, index) => [pageId, index]),
  );
  const missing = pages.filter((p) => !docIndex.has(p.pageId)).map((p) => p.pageId);
  const roots = pages
    .filter((p) => docIndex.has(p.pageId) && p.decomposes === undefined)
    .sort(
      (a, b) =>
        a.order - b.order || (docIndex.get(a.pageId) ?? 0) - (docIndex.get(b.pageId) ?? 0),
    );
  return { extraRoots: roots.slice(1).map((p) => p.pageId), missing };
}

/**
 * The page tree needs the analyst: unadopted pages, or adopted entries the
 * tree cannot use (extra roots, missing pages). The same dialog repairs
 * them — extra roots are placed again like unadopted pages.
 */
export function needsPageReview(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): boolean {
  if (isAdoptionPending(xml, pages)) return true;
  const { extraRoots, missing } = misplacedPages(xml, pages);
  return extraRoots.length > 0 || missing.length > 0;
}

/**
 * The page tree needs the analyst's decision ("Review pages…" hint): an
 * extra root page, or a missing ROOT page. A missing CHILD page needs none —
 * a child page deleted in draw.io leaves dfd.pages automatically (5d), so a
 * hint for it would only flash until that save.
 */
export function needsPageRepair(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): boolean {
  const { extraRoots, missing } = misplacedPages(xml, pages);
  const childPages = new Set(
    (pages ?? []).filter((p) => p.decomposes !== undefined).map((p) => p.pageId),
  );
  return extraRoots.length > 0 || missing.some((pageId) => !childPages.has(pageId));
}

/** Adoption proposal for the current XML; undefined if nothing is pending. */
export function reviewAdoption(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): AdoptionReview | undefined {
  if (!xml || !needsPageReview(xml, pages)) return undefined;
  if (inspectDrawioPages(xml).compressedPageNames.length > 0) return undefined;
  const parse = parseDfd(xml, pages);
  // Extra roots and missing pages are proposed anew; their links still
  // apply (parse above) and are kept by applyAdoption.
  const { extraRoots, missing } = misplacedPages(xml, pages);
  const drop = new Set([...extraRoots, ...missing]);
  const persistedPages = pages?.filter((p) => !drop.has(p.pageId));
  return {
    kind: "adoption",
    xml,
    parse,
    proposal: proposeAdoption({ parse, persistedPages }),
  };
}

/**
 * Pasted cells since `baseline` (an earlier saved state) that look like a
 * copy of an existing element. Only for an adopted DFD (links need a
 * dfd.pages entry), and only if at least one cell is proposed as a copy —
 * a duplicate on the definition's own page alone is an ordinary paste
 * (default "new element") and raises no hint.
 */
export function reviewCopyAssignments(
  current: { xml?: string; pages?: readonly DFDPage[] },
  baseline: { xml?: string; pages?: readonly DFDPage[] },
): AssignmentReview | undefined {
  const { xml, pages } = current;
  if (!xml || !pages || pages.length === 0) return undefined;
  if (!inspectDrawioPages(xml, pages.map((p) => p.pageId)).supported) return undefined;

  const parse = parseDfd(xml, pages);
  const previous = baseline.xml
    ? parseDfd(baseline.xml, baseline.pages).occurrences
    : [];
  const assignments = proposeCopyAssignments(parse, previous);
  if (!assignments.some((a) => a.proposal === "copy")) return undefined;
  return { kind: "assignment", xml, parse, assignments };
}

/** dfd.pages after the confirmed adoption. */
export function confirmAdoption(
  review: AdoptionReview,
  persistedPages: readonly DFDPage[] | undefined,
  decisions: AdoptionDecisions,
): AdoptionApplyResult {
  return applyAdoption(review.proposal, persistedPages, decisions);
}

/** dfd.pages after linking the cells chosen as copies ("new" = untouched). */
export function confirmCopyAssignments(
  review: AssignmentReview,
  pages: readonly DFDPage[],
  copies: readonly CellRef[],
): CopyAssignmentResult {
  const key = (c: CellRef) => `${c.pageId}\u0000${c.cellId}`;
  const chosen = new Set(copies.map(key));
  return applyCopyAssignments(
    pages,
    review.parse,
    review.assignments.filter((a) => chosen.has(key(a.cell))),
  );
}
