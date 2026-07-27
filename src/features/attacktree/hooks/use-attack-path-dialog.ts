// src/features/attacktree/components/use-attack-path-dialog.ts
//
// Hook for the per-path assessment dialog (relevance + mitigation + verification
// moved out of the table row — see attacktree-path-dialog-design.md).
//
// Owns ONLY cross-path concerns: which path is open, Prev/Next over the ordered
// path list, progress (how many paths are fully assessed), and the single
// persistence entry point that routes a path's per-STRIDE decisions through
// setPathAssessment. Per-field draft state lives in the dialog component; the
// stateful glue here is a thin shell over pure helpers so it stays testable
// without rendering.

import { useCallback, useMemo, useState } from "react";
import type { StrideCategory, ThreatRelevanceRef } from "shared";
import type { AttackPath, AttackPathAssessment } from "../models/attacktree-types";
import { strideCategoriesForPath } from "../services/attacktree-threat-generator";
import {
  setPathAssessment,
  isPathAssessmentComplete,
} from "../services/attacktree-threat-sync";

const SEP = "\u241F";
const stKey = (pathKey: string, stride: StrideCategory) => `${pathKey}${SEP}${stride}`;

/** A path's decision for ONE stride category, as edited in the dialog. */
export interface PerStrideDecision {
  relevance: ThreatRelevanceRef;
  mitigationIds: string[];
  verificationIds: string[];
}

// ==================== PURE HELPERS (tested without rendering) ====================

/**
 * How many paths are FULLY assessed: every STRIDE category a path attacks has a
 * complete assessment (isPathAssessmentComplete). `stridesForPath` is injected
 * so tests need not reconstruct the generator's goal→STRIDE mapping.
 */
export function computePathProgress(
  paths: readonly AttackPath[],
  assessments: readonly AttackPathAssessment[],
  stridesForPath: (p: AttackPath) => StrideCategory[] = strideCategoriesForPath,
): { complete: number; total: number } {
  const byKey = new Map<string, AttackPathAssessment>();
  for (const a of assessments) byKey.set(stKey(a.pathKey, a.strideCategory), a);

  let complete = 0;
  for (const p of paths) {
    const strides = stridesForPath(p);
    if (strides.length === 0) continue;
    const allDone = strides.every((s) => {
      const a = byKey.get(stKey(p.pathKey, s));
      return a ? isPathAssessmentComplete(a) : false;
    });
    if (allDone) complete++;
  }
  return { complete, total: paths.length };
}

/**
 * Fold one path's per-STRIDE decisions through setPathAssessment. `evalNote` is
 * per-path: written to every stride entry (storage is per (path,stride)).
 * Strides absent from `perStride` are left untouched.
 */
export function applyPathSave(
  assessments: readonly AttackPathAssessment[],
  pathKey: string,
  perStride: Partial<Record<StrideCategory, PerStrideDecision>>,
  evalNote?: string,
): AttackPathAssessment[] {
  let next: AttackPathAssessment[] = [...assessments];
  for (const [stride, decision] of Object.entries(perStride) as [
    StrideCategory,
    PerStrideDecision | undefined,
  ][]) {
    if (!decision) continue;
    next = setPathAssessment(
      next,
      pathKey,
      stride,
      decision.relevance,
      evalNote,
      decision.mitigationIds,
      decision.verificationIds,
    );
  }
  return next;
}

/** Prev/Next target keyed off the ordered list; clamps at ends (no wrap). */
export function nextOpenKey(
  paths: readonly AttackPath[],
  current: string | null,
  delta: number,
): string | null {
  if (current == null) return current;
  const i = paths.findIndex((p) => p.pathKey === current);
  if (i < 0) return current;
  const j = i + delta;
  if (j < 0 || j >= paths.length) return current;
  return paths[j].pathKey;
}

// ==================== HOOK ====================

export interface UseAttackPathDialogArgs {
  paths: readonly AttackPath[];
  assessments: readonly AttackPathAssessment[];
  onAssessmentsChange: (next: AttackPathAssessment[]) => void;
}

export interface AttackPathDialog {
  openPathKey: string | null;
  openIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  progress: { complete: number; total: number };
  open: (pathKey: string) => void;
  close: () => void;
  goPrev: () => void;
  goNext: () => void;
  savePath: (
    pathKey: string,
    perStride: Partial<Record<StrideCategory, PerStrideDecision>>,
    evalNote?: string,
  ) => void;
}

export function useAttackPathDialog({
  paths,
  assessments,
  onAssessmentsChange,
}: UseAttackPathDialogArgs): AttackPathDialog {
  const [openPathKey, setOpenPathKey] = useState<string | null>(null);

  const openIndex = useMemo(
    () => (openPathKey == null ? -1 : paths.findIndex((p) => p.pathKey === openPathKey)),
    [paths, openPathKey],
  );

  const progress = useMemo(
    () => computePathProgress(paths, assessments),
    [paths, assessments],
  );

  const open = useCallback((pathKey: string) => setOpenPathKey(pathKey), []);
  const close = useCallback(() => setOpenPathKey(null), []);
  const goPrev = useCallback(() => setOpenPathKey((c) => nextOpenKey(paths, c, -1)), [paths]);
  const goNext = useCallback(() => setOpenPathKey((c) => nextOpenKey(paths, c, 1)), [paths]);

  const savePath = useCallback<AttackPathDialog["savePath"]>(
    (pathKey, perStride, evalNote) =>
      onAssessmentsChange(applyPathSave(assessments, pathKey, perStride, evalNote)),
    [assessments, onAssessmentsChange],
  );

  return {
    openPathKey,
    openIndex,
    hasPrev: openIndex > 0,
    hasNext: openIndex >= 0 && openIndex < paths.length - 1,
    progress,
    open,
    close,
    goPrev,
    goNext,
    savePath,
  };
}