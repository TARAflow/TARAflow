// ==================== RISK PROGRESS UTILS ====================
// Pure functions for calculating risk completion progress.
// Progress is derived from MitigationStatus — Risk no longer has a status field.

import type { Risk } from "../models/risk-assessment-types";
import { deriveImplementationProgress } from "../models/risk-mitigation-types";

export interface RiskProgress {
  done: number;
  total: number;
  percent: number;
  /** Not done because their SRSL controls are open (EN 50742 A, patch 29). */
  srslOpen: number;
}

/**
 * Calculate progress statistics for a group of risks.
 * A risk is considered "done" if its implementation status is:
 *   implemented | verified | rejected (all active mitigations resolved)
 * Or if treatment is accept / transfer / share (no mitigation needed —
 * "share" is the ISO/SAE 21434 name of transfer; user 2026-10-30).
 */
export function calculateProgress(
  risks: Risk[],
  /**
   * EN 50742 A (patch 29): risks whose SRSL controls are not all done. They
   * stay open whatever their treatment — acceptance or "won't" in the cyber
   * risk lifts no safety requirement. The app layer's set (the matrix test).
   */
  srslOpen?: ReadonlySet<string>,
): RiskProgress {
  const total = risks.length;
  const open = risks.filter((r) => srslOpen?.has(r.id)).length;
  const done = risks.filter((r) => isRiskDone(r, srslOpen)).length;
  return {
    done,
    total,
    percent: total > 0 ? (done / total) * 100 : 0,
    srslOpen: open,
  };
}

/**
 * The one rule of "done" (progress chip, toolbar status, phase tooltip):
 * a treatment without implementation of its own (accept / transfer / share /
 * won't) or every selected mitigation implemented / verified / rejected —
 * and, in EN 50742 A, no SRSL control open.
 */
export function isRiskDone(r: Risk, srslOpen?: ReadonlySet<string>): boolean {
  if (srslOpen?.has(r.id)) return false;
  if (r.treatment === "accept" || r.treatment === "transfer" || r.treatment === "share" || r.moscowPriority === "wont") return true;
  const impl = deriveImplementationProgress(r.selectedMitigations);
  return impl === "implemented" || impl === "verified" || impl === "rejected";
}

/** Why a risk is not done (0.20 item 14: the status said "In Progress" without a reason). */
export type OpenRiskReason = "srslOpen" | "noMitigation" | "mitigationsOpen";

/** The risks not done, by reason, as their labels (threat display id) — in the order given. */
export function openRiskReasons(risks: readonly Risk[], srslOpen?: ReadonlySet<string>): Record<OpenRiskReason, string[]> {
  const out: Record<OpenRiskReason, string[]> = { srslOpen: [], noMitigation: [], mitigationsOpen: [] };
  for (const r of risks) {
    if (isRiskDone(r, srslOpen)) continue;
    const label = r.threatDisplayId || r.id;
    if (srslOpen?.has(r.id)) out.srslOpen.push(label);
    else if ((r.selectedMitigations ?? []).length === 0) out.noMitigation.push(label);
    else out.mitigationsOpen.push(label);
  }
  return out;
}

/** The English default text per reason ("{{count}}" risks, "{{list}}" of labels). */
export const OPEN_RISK_REASON_TEXTS: Record<OpenRiskReason, string> = {
  srslOpen: "SRSL controls missing (EN 50742) ({{count}}): {{list}}",
  noMitigation: "to reduce, no mitigation selected yet ({{count}}): {{list}}",
  mitigationsOpen: "mitigations not implemented yet ({{count}}): {{list}}",
};

/** One line per reason with risks, at most `max` labels each. */
export function openRiskReasonLines(
  reasons: Record<OpenRiskReason, readonly string[]>,
  t: (key: string, options: Record<string, unknown>) => string,
  max = 8,
): string[] {
  return (Object.keys(OPEN_RISK_REASON_TEXTS) as OpenRiskReason[])
    .filter((k) => reasons[k].length > 0)
    .map((k) =>
      t(`tabs.risks.openReasons.${k}`, {
        count: reasons[k].length,
        list: reasons[k].slice(0, max).join(", ") + (reasons[k].length > max ? " …" : ""),
        defaultValue: OPEN_RISK_REASON_TEXTS[k],
      }),
    );
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