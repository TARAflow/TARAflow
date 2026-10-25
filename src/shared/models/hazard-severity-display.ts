// ==================== HAZARD SEVERITY — DISPLAY ====================
// One ordinal rank across the target kinds of an `endangers` edge (person,
// environment, infrastructure) and its colour — for the hazard table's "max
// severity" column and the asset graph's hazard nodes (asset graph design
// G8: one source). Display heuristic only; person harm uses the 4-level
// safety factor (IEC 62061 Se1–Se4).
//
// In shared: the hazards feature and the DFD feature (asset graph) both use
// it, and features may not import each other.

import { isEndangers, type HazardRelation } from "./hazard-types";
import {
  normalizeLegacySafetyImpact,
  SAFETY_SEVERITIES,
  safetySeverityToFactor,
  type SafetySeverity,
} from "./safety-types";

/**
 * 0 (none) … 4 (worst) for any endangers severity. Person harm in the pre-v9
 * vocabulary ("fatality" …) ranks as its canonical value.
 */
export function hazardSeverityRank(severity: string): number {
  const person = normalizeLegacySafetyImpact(severity);
  if (person && (SAFETY_SEVERITIES as readonly string[]).includes(person)) {
    return safetySeverityToFactor(person as SafetySeverity);
  }
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

/** Colour per rank (0 = no edge). */
export const HAZARD_SEVERITY_RANK_COLOR: Readonly<Record<number, string>> = {
  0: "#cbd5e1",
  1: "#94a3b8",
  2: "#eab308",
  3: "#f97316",
  4: "#ef4444",
};

/** The worst severity of a hazard's endangers edges ("" / 0 without one). */
export function worstEndangersSeverity(
  hazardId: string,
  relations: readonly HazardRelation[],
): { severity: string; rank: number } {
  let worst = { severity: "", rank: 0 };
  for (const r of relations) {
    if (!isEndangers(r) || r.from !== hazardId) continue;
    const rank = hazardSeverityRank(r.impact.severity);
    if (rank > worst.rank) worst = { severity: r.impact.severity, rank };
  }
  return worst;
}
