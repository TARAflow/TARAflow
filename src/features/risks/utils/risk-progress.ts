// ==================== RISK PROGRESS UTILS ====================
// Pure functions for calculating risk completion progress.
// Progress is derived from MitigationStatus — Risk no longer has a status field.

import type { Risk } from "../models/risk-assessment-types";
import { deriveImplementationProgress } from "../models/risk-mitigation-types";

export interface RiskProgress {
  done: number;
  total: number;
  percent: number;
}

/**
 * Calculate progress statistics for a group of risks.
 * A risk is considered "done" if its implementation status is:
 *   implemented | verified | rejected (all active mitigations resolved)
 * Or if treatment is accept/transfer (no mitigation needed).
 */
export function calculateProgress(risks: Risk[]): RiskProgress {
  const total = risks.length;
  const done = risks.filter((r) => {
    // accept / transfer / wont = decision made, no implementation needed
    if (
      r.treatment === "accept" ||
      r.treatment === "transfer" ||
      r.moscowPriority === "wont"
    )
      return true;

    const impl = deriveImplementationProgress(r.selectedMitigations);
    return impl === "implemented" || impl === "verified" || impl === "rejected";
  }).length;

  return {
    done,
    total,
    percent: total > 0 ? (done / total) * 100 : 0,
  };
}

/**
 * Get progress color based on completion percentage
 */
export function getProgressColor(
  percent: number,
): "success" | "warning" | "default" {
  if (percent === 100) return "success";
  if (percent > 50) return "warning";
  return "default";
}

/**
 * Get progress variant for LinearProgress
 */
export function getProgressVariant(
  percent: number,
): "success" | "warning" | "primary" {
  if (percent === 100) return "success";
  if (percent > 50) return "warning";
  return "primary";
}