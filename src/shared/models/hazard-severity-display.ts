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

/**
 * Rank of one endangers edge: 1–4 for a known severity, 0 for a person edge
 * rated "none" (no injury, S0 — ISO plan decision 13 C), −1 for a value no
 * scale knows (stays below the display).
 */
export function endangersSeverityRank(impact: { target: string; severity: string }): number {
  if (impact.target === "human" && normalizeLegacySafetyImpact(impact.severity) === "none") return 0;
  const rank = hazardSeverityRank(impact.severity);
  return rank > 0 ? rank : -1;
}

/**
 * The worst severity of a hazard's endangers edges. Without a rated edge:
 * severity "" and rank 0; a hazard whose worst edge is "none" (S0) has
 * severity "none" and rank 0 — the severity tells the two apart.
 */
export function worstEndangersSeverity(
  hazardId: string,
  relations: readonly HazardRelation[],
): { severity: string; rank: number } {
  let worst = { severity: "", rank: -1 };
  for (const r of relations) {
    if (!isEndangers(r) || r.from !== hazardId) continue;
    const rank = endangersSeverityRank(r.impact);
    if (rank > worst.rank) worst = { severity: r.impact.severity, rank };
  }
  return worst.rank < 0 ? { severity: "", rank: 0 } : worst;
}
