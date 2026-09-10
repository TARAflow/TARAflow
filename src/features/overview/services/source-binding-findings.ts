// src/features/overview/services/source-binding-findings.ts
// ==================== SOURCE BINDING — DRIFT FINDINGS (Phase 3) ====================
// Mirrors the *shape* of features/audit/services/verify/findings.ts
// (Finding = {id, severity, message?, commit?, context?}) but is a fully
// separate, closed rule catalog — Source Binding drift is not an Audit
// Verification Engine concern (plan §2, §6.2: reuse the Finding/severity
// PATTERN and the FindingRow rendering, never the AVE type or panel
// themselves — these track two unrelated repos: the TARA project's own
// audit trail vs. the analysed system's external implementation repos).
// Plain-language title/hint (the explainFinding-style i18n mapping) is a
// UI-layer concern, added alongside the panel component, not here.

import type { DriftStatus, DriftEvent } from "shared";

export type Severity = "error" | "warning" | "info";

/** One finding id per non-clean DriftStatus. "clean" never produces a
 * finding — nothing to report. */
export type DriftFindingId =
  | "source-binding.branch-advanced"
  | "source-binding.branch-advanced-expected"
  | "source-binding.tag-moved"
  | "source-binding.ref-missing"
  | "source-binding.unreachable";

const STATUS_TO_ID: Record<Exclude<DriftStatus, "clean">, DriftFindingId> = {
  branch_advanced: "source-binding.branch-advanced",
  branch_advanced_expected: "source-binding.branch-advanced-expected",
  tag_moved: "source-binding.tag-moved",
  ref_missing: "source-binding.ref-missing",
  unreachable: "source-binding.unreachable",
};

export const DEFAULT_SEVERITY: Record<DriftFindingId, Severity> = {
  "source-binding.tag-moved": "error",
  "source-binding.ref-missing": "error",
  "source-binding.unreachable": "warning",
  "source-binding.branch-advanced": "warning",
  "source-binding.branch-advanced-expected": "info",
};

export interface DriftFinding {
  id: DriftFindingId;
  severity: Severity;
  /** currentCommitSha, when available — absent for ref_missing/unreachable. */
  commit?: string;
}

/** Maps a persisted DriftEvent onto the same Finding-shaped object the
 * (separate) drift UI renders — see plan §6.2. Takes the DriftEvent itself
 * (not a bare status) so the mapping stays anchored to the actual
 * traceability record rather than a value the caller could reconstruct
 * differently. */
export function driftFindingFor(event: DriftEvent): DriftFinding {
  const id = STATUS_TO_ID[event.status];
  return {
    id,
    severity: DEFAULT_SEVERITY[id],
    ...(event.currentCommitSha ? { commit: event.currentCommitSha } : {}),
  };
}
