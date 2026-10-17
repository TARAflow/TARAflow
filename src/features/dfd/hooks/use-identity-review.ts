// ==================== USE IDENTITY REVIEW ====================
// Leveled-DFD Phase 5b (leveled-dfd-multi-diagram-design.md §11.2.1, §5.2):
// state behind the adoption / copy-assignment dialog and its two hints.
//
//   adoption pending  the draw.io XML has pages that are not in dfd.pages;
//                     saving is refused until the analyst adopts them
//   paste hint        cells pasted since the baseline that look like a copy
//                     of an existing element; the baseline moves on with
//                     every decision (apply or dismiss), so a cell is asked
//                     about once

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "../models/dfd-types";
import type { CellRef } from "../services/leveled";
import {
  confirmAdoption,
  confirmCopyAssignments,
  reviewAdoption,
  reviewCopyAssignments,
  type AdoptionReview,
  type AssignmentReview,
  type IdentityReview,
} from "../services/leveled";
import type { AdoptionDecisions } from "../services/leveled";
import { createDFDStorageAdapter } from "../services/dfd-storage-adapter";

export interface UseIdentityReviewOptions {
  /** The validation reports ID_ADOPTION_PENDING. */
  adoptionPending: boolean;
  savePages: (pages: DFDPage[]) => Promise<DFDUpdateResult | null>;
  /** Current draw.io XML (default: the storage adapter, like saveDFD). */
  readXml?: () => string | null;
}

export interface UseIdentityReviewReturn {
  adoptionPending: boolean;
  /** Pasted cells waiting for a decision (only "copy" candidates count). */
  pendingCopies: number;
  /** The review shown in the dialog, if open. */
  review: IdentityReview | null;
  openAdoption: () => void;
  openAssignment: () => void;
  close: () => void;
  /** Keep the pasted cells as new elements; the hint disappears. */
  dismissAssignment: () => void;
  applyAdoption: (decisions: AdoptionDecisions) => Promise<string | null>;
  applyAssignment: (copies: readonly CellRef[]) => Promise<string | null>;
}

interface Snapshot {
  xml?: string;
  pages?: readonly DFDPage[];
}

export function useIdentityReview(
  project: DFDProjectData,
  options: UseIdentityReviewOptions,
): UseIdentityReviewReturn {
  const { adoptionPending, savePages } = options;
  const readXml = useCallback(
    () =>
      options.readXml
        ? options.readXml()
        : (() => {
            const adapter = createDFDStorageAdapter(project.id);
            adapter.syncFromLegacy();
            return adapter.getXml();
          })(),
    [options.readXml, project.id],
  );

  const xml = project.dfd?.xml;
  const pages = project.dfd?.pages;

  // Baseline of the paste hint: the saved state the last decision was made
  // on. A classic project has no baseline; it is taken when pages appear
  // (adoption), so the adopted copies are not asked about again.
  const [baseline, setBaseline] = useState<Snapshot>(() => ({ xml, pages }));
  useEffect(() => {
    if (!baseline.pages && pages) setBaseline({ xml, pages });
  }, [baseline.pages, xml, pages]);

  const assignment = useMemo(
    () => (baseline.pages ? reviewCopyAssignments({ xml, pages }, baseline) : undefined),
    [xml, pages, baseline],
  );

  const [review, setReview] = useState<IdentityReview | null>(null);

  const openAdoption = useCallback(() => {
    const current = reviewAdoption(readXml(), project.dfd?.pages);
    setReview(current ?? null);
  }, [readXml, project.dfd?.pages]);

  const openAssignment = useCallback(() => {
    setReview(assignment ?? null);
  }, [assignment]);

  const close = useCallback(() => setReview(null), []);

  const dismissAssignment = useCallback(() => {
    setBaseline({ xml, pages });
    setReview(null);
  }, [xml, pages]);

  // Latest pages for the apply step (the dialog may stay open across saves).
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const applyAdoption = useCallback(
    async (decisions: AdoptionDecisions): Promise<string | null> => {
      if (review?.kind !== "adoption") return "NO_REVIEW";
      const result = confirmAdoption(review as AdoptionReview, pagesRef.current, decisions);
      if (!result.ok) return result.reason;
      const saved = await savePages(result.pages);
      if (!saved) return "SAVE_FAILED";
      setBaseline({ xml: saved.dfd.xml, pages: saved.dfd.pages });
      setReview(null);
      return null;
    },
    [review, savePages],
  );

  const applyAssignment = useCallback(
    async (copies: readonly CellRef[]): Promise<string | null> => {
      if (review?.kind !== "assignment") return "NO_REVIEW";
      const current = pagesRef.current;
      if (!current) return "NO_PAGES";
      const result = confirmCopyAssignments(review as AssignmentReview, current, copies);
      if (!result.ok) return result.reason;
      const saved = await savePages(result.pages);
      if (!saved) return "SAVE_FAILED";
      setBaseline({ xml: saved.dfd.xml, pages: saved.dfd.pages });
      setReview(null);
      return null;
    },
    [review, savePages],
  );

  return {
    adoptionPending,
    pendingCopies: assignment?.assignments.filter((a) => a.proposal === "copy").length ?? 0,
    review,
    openAdoption,
    openAssignment,
    close,
    dismissAssignment,
    applyAdoption,
    applyAssignment,
  };
}
