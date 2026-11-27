// ==================== FILTER BY IMPLEMENTATION STATUS ====================
// 0.20.1 (user 2026-11-27): the risks tab could not be filtered by the
// implementation status of the mitigations. A risk has several selected
// mitigations, each with a status:
//   - a status (open … rejected): at least one selected mitigation has it;
//   - "none": no mitigation selected;
//   - "not_done" / "all_done": the risk's implementation progress
//     (deriveImplementationProgress — the rule the progress chip uses);
//   - "done_without_evidence": a done status without ticket, evidence note
//     or reference (the rule of the tracker finding, here without a tracker).

import type { Risk } from "../models/risk-assessment-types";
import { deriveImplementationProgress, type MitigationStatus } from "../models/risk-mitigation-types";
import { needsStatusEvidence } from "../services/mitigation-evidence";

export type ImplementationFilter = MitigationStatus | "none" | "not_done" | "all_done" | "done_without_evidence";

/** The statuses offered, in the order of the state machine. */
export const IMPLEMENTATION_STATUS_FILTERS: readonly MitigationStatus[] = [
  "open",
  "in_progress",
  "in_review",
  "implemented",
  "verified",
  "rejected",
];

/** The values beside the statuses, with their English labels. */
export const IMPLEMENTATION_EXTRA_FILTERS: readonly { value: Exclude<ImplementationFilter, MitigationStatus>; label: string }[] = [
  { value: "none", label: "No mitigation selected" },
  { value: "not_done", label: "Mitigations not done" },
  { value: "all_done", label: "All mitigations done" },
  { value: "done_without_evidence", label: "Done without evidence" },
];

const DONE_PROGRESS = new Set(["implemented", "verified", "rejected"]);

export function matchesImplementationFilter(risk: Pick<Risk, "selectedMitigations">, filter: ImplementationFilter): boolean {
  const selected = risk.selectedMitigations ?? [];
  switch (filter) {
    case "none":
      return selected.length === 0;
    case "all_done":
      return selected.length > 0 && DONE_PROGRESS.has(deriveImplementationProgress(selected));
    case "not_done":
      return selected.length > 0 && !DONE_PROGRESS.has(deriveImplementationProgress(selected));
    case "done_without_evidence":
      return selected.some((m) => needsStatusEvidence(m, true));
    default:
      return selected.some((m) => m.status === filter);
  }
}
