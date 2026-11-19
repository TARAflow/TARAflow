// ==================== RISK DIALOG — LOCAL STATE ====================
// Split out of risk-dialog.tsx (MT-2): the editable copy of a risk, the ISO attack-potential
// helpers and the STRIDE colours — no React.

import { MitigationStatus, SelectedMitigation } from "../../models/risk-mitigation-types";
import { FactorRating } from "../../models/risk-factor-types";
import { ISO21434_FACTOR_LEVELS, ISO21434_ELAPSED_TIME_POINTS, ISO21434_EXPERTISE_POINTS, ISO21434_KNOWLEDGE_POINTS, ISO21434_WOO_POINTS, ISO21434_EQUIPMENT_POINTS } from "../../models/iso21434-core";
import { Risk } from "../../models/risk-assessment-types";
import { MoSCoWPriority, RiskTreatment } from "../../models/risk-scale-types";
import type { StrideCategory } from "shared";

// The five ISO/SAE 21434 Annex G (18045) attack-potential factors, in the order
// they are shown. Editable in the residual (after) lens; read-only (from the
// tree) in the before lens.
export const ISO_AP_FACTOR_IDS = [
  "iso_elapsed_time",
  "iso_expertise",
  "iso_knowledge",
  "iso_window_of_opportunity",
  "iso_equipment",
] as const;

// factorId → Table G.6 points, keyed by the factor's level string.
export const ISO_AP_POINTS_BY_FACTOR: Record<string, Record<string, number>> = {
  iso_elapsed_time: ISO21434_ELAPSED_TIME_POINTS,
  iso_expertise: ISO21434_EXPERTISE_POINTS,
  iso_knowledge: ISO21434_KNOWLEDGE_POINTS,
  iso_window_of_opportunity: ISO21434_WOO_POINTS,
  iso_equipment: ISO21434_EQUIPMENT_POINTS,
};

// Mapping B (feasibility level → risk scale) comes from the risk scale
// (shared feasibilityLevelToRiskScale, decision 21) — not from the snapshot
// stored on the risk, which carried the 5-level default before.

/** Table G.6 points for a factor at a given 1-based rating value. */
export function isoFactorPoints(factorId: string, value: number): number {
  const levels =
    ISO21434_FACTOR_LEVELS[factorId as keyof typeof ISO21434_FACTOR_LEVELS];
  if (!levels || value < 1 || value > levels.length) return 0;
  return ISO_AP_POINTS_BY_FACTOR[factorId]?.[levels[value - 1]] ?? 0;
}

// ==================== CONSTANTS ====================

export const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

// ==================== LOCAL STATE ====================

export interface LocalRiskState {
  factorRatings: FactorRating[];
  mitigatedFactorRatings: FactorRating[];
  selectedMitigations: SelectedMitigation[];
  selectedVerifications: string[];
  treatment: RiskTreatment;
  treatmentJustification: string;
  moscowPriority: MoSCoWPriority;
  wontJustification: string;
  riskBeforeRationale: string;
  riskAfterRationale: string;
}

export function riskToLocal(risk: Risk): LocalRiskState {
  return {
    factorRatings: risk.factorRatings.map((r) => ({ ...r })),
    mitigatedFactorRatings: risk.mitigatedFactorRatings.map((r) => ({ ...r })),
    selectedMitigations: (
      risk.selectedMitigations as (string | SelectedMitigation)[]
    ).map((m) =>
      typeof m === "string"
        ? { id: m, status: "open" as MitigationStatus }
        : { ...m },
    ),
    selectedVerifications: (
      (risk.selectedVerifications ?? []) as (
        | string
        | { id?: string; notes?: string }
      )[]
    ).map((v) => (typeof v === "string" ? v : v.id ?? v.notes ?? "")),
    treatment: risk.treatment ?? "reduce",
    treatmentJustification: risk.treatmentJustification ?? "",
    moscowPriority: risk.moscowPriority,
    wontJustification: risk.wontJustification ?? "",
    riskBeforeRationale: risk.riskBeforeRationale ?? "",
    riskAfterRationale: risk.riskAfterRationale ?? "",
  };
}
