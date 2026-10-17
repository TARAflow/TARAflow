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

/** Adoption proposal for the current XML; undefined if nothing is pending. */
export function reviewAdoption(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
): AdoptionReview | undefined {
  if (!xml || !isAdoptionPending(xml, pages)) return undefined;
  const parse = dfdParser.parse(xml, pages);
  return {
    kind: "adoption",
    xml,
    parse,
    proposal: proposeAdoption({ parse, persistedPages: pages }),
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

  const parse = dfdParser.parse(xml, pages);
  const previous = baseline.xml
    ? dfdParser.parse(baseline.xml, baseline.pages).occurrences
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
