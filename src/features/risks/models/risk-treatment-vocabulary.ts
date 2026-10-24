// ==================== RISK TREATMENT VOCABULARY ====================
// Which names the treatment options carry, and which options are offered.
// ISO/SAE 21434 15.9 (RQ-15-17) names four options: avoiding, reducing,
// sharing and retaining the risk. The stored RiskTreatment values stay as
// they are (no migration); ISO projects only see other labels:
//
//   stored      default label   ISO label
//   eliminate   Eliminate       Avoid
//   reduce      Reduce          Reduce
//   share       Share           Share
//   accept      Accept          Retain
//   transfer    Transfer        Share (transfer) — not offered, review flag
//
// 15.9 EXAMPLE 2 counts transferring a risk (insurance) as sharing, but a
// label must not silently reinterpret a decision: a stored `transfer` stays
// `transfer` until the analyst picks Share (conformance plan §6, decision 3).

import type { RiskConfiguration } from "./risk-config-types";
import {
  RISK_TREATMENTS,
  type RiskTreatment,
  type RiskTreatmentDefinition,
} from "./risk-scale-types";

export type TreatmentVocabulary = "default" | "iso-21434";

/** ISO vocabulary for ISO/SAE 21434 projects (same switch as the other ISO
 * risk views: the risk method of the project). */
export function treatmentVocabulary(
  config: Pick<RiskConfiguration, "likelihoodMethod"> | undefined,
): TreatmentVocabulary {
  return config?.likelihoodMethod === "iso-21434" ? "iso-21434" : "default";
}

/** ISO 15.9 order: avoid, reduce, share, retain. */
const ISO_OFFERED: readonly RiskTreatment[] = [
  "eliminate",
  "reduce",
  "share",
  "accept",
];

const TREATMENT_BY_VALUE = new Map(RISK_TREATMENTS.map((tr) => [tr.value, tr]));

/**
 * The options to choose from. In ISO mode `transfer` is not offered; it is
 * still listed when `current` is `transfer`, so an existing decision stays
 * visible until the analyst changes it.
 */
export function offeredTreatments(
  vocabulary: TreatmentVocabulary,
  current?: RiskTreatment,
): RiskTreatmentDefinition[] {
  if (vocabulary === "default") return RISK_TREATMENTS;
  const values: RiskTreatment[] =
    current === "transfer" ? [...ISO_OFFERED, "transfer"] : [...ISO_OFFERED];
  return values.map((v) => TREATMENT_BY_VALUE.get(v)!);
}

/** i18n key prefix of a treatment: risks.treatment.<v> or risks.treatmentIso.<v>. */
export function treatmentI18nKey(
  treatment: RiskTreatment,
  vocabulary: TreatmentVocabulary,
): string {
  return vocabulary === "iso-21434"
    ? `risks.treatmentIso.${treatment}`
    : `risks.treatment.${treatment}`;
}

/** English fallback label (used as i18n defaultValue and in tests). */
export function treatmentFallbackLabel(
  treatment: RiskTreatment,
  vocabulary: TreatmentVocabulary,
): string {
  if (vocabulary === "iso-21434") {
    switch (treatment) {
      case "eliminate":
        return "Avoid";
      case "accept":
        return "Retain";
      case "transfer":
        return "Share (transfer)";
    }
  }
  return TREATMENT_BY_VALUE.get(treatment)?.label ?? treatment;
}

/** A stored `transfer` in an ISO project is a decision to review: ISO offers
 * no transfer option; the analyst confirms it as Share (or decides otherwise). */
export function isTreatmentToReview(
  treatment: RiskTreatment,
  vocabulary: TreatmentVocabulary,
): boolean {
  return vocabulary === "iso-21434" && treatment === "transfer";
}
