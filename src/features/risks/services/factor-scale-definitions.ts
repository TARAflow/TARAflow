// ==================== FACTOR SCALE DEFINITIONS ====================
// The scale of a likelihood factor as the calculation of a project reads it —
// input for the methodology fingerprint of the multi-project TARA (design
// §7.2; the hashing and comparison are in shared/utils/methodology-
// fingerprint.ts, joined in the app layer). Pure.
//
// Which scale a factor has follows the same rules as the risk dialog's level
// options (factor-level-options.ts):
//   ISO/SAE 21434 attack-potential factors  → Table G levels + points
//   EN 50742 EL / AC (en-50742-a)           → norm levels + scores
//   ETSI TVRA factors (etsi-tvra)           → norm levels + points
//   everything else                         → the project's likelihood scale

import type { FactorScaleDefinition } from "shared";
import type { RiskConfiguration } from "../models/risk-config-types";
import { LIKELIHOOD_SCALES } from "../models/risk-scale-types";
import { factorClassOf, getFactorDefinition } from "../models/risk-factor-types";
import {
  ISO21434_FACTOR_LEVELS,
  ISO21434_ELAPSED_TIME_POINTS,
  ISO21434_EXPERTISE_POINTS,
  ISO21434_KNOWLEDGE_POINTS,
  ISO21434_WOO_POINTS,
  ISO21434_EQUIPMENT_POINTS,
} from "../models/iso21434-core";
import {
  TVRA_FACTOR_LEVELS,
  TVRA_TIME_POINTS,
  TVRA_EXPERTISE_POINTS,
  TVRA_KNOWLEDGE_POINTS,
  TVRA_OPPORTUNITY_POINTS,
  TVRA_EQUIPMENT_POINTS,
  TVRA_INTENSITY_POINTS,
} from "../models/etsi-tvra-core";
import {
  EN50742_FACTOR_LEVELS,
  EXPOSURE_LEVEL_SCORE,
  ATTACKER_CAPABILITY_SCORE,
} from "../models/en50742-approach-a-core";

const ISO_POINTS: Record<string, Record<string, number>> = {
  iso_elapsed_time: ISO21434_ELAPSED_TIME_POINTS,
  iso_expertise: ISO21434_EXPERTISE_POINTS,
  iso_knowledge: ISO21434_KNOWLEDGE_POINTS,
  iso_window_of_opportunity: ISO21434_WOO_POINTS,
  iso_equipment: ISO21434_EQUIPMENT_POINTS,
};

const TVRA_POINTS: Record<string, Record<string, number>> = {
  time: TVRA_TIME_POINTS,
  expertise: TVRA_EXPERTISE_POINTS,
  knowledge: TVRA_KNOWLEDGE_POINTS,
  etsi_opportunity: TVRA_OPPORTUNITY_POINTS,
  equipment: TVRA_EQUIPMENT_POINTS,
  etsi_intensity: TVRA_INTENSITY_POINTS,
};

const EN50742_SCORES: Record<string, Record<string, number>> = {
  exposure_level: EXPOSURE_LEVEL_SCORE,
  attacker_capability: ATTACKER_CAPABILITY_SCORE,
};

/** Levels stored as 1-based index with the points / score of each level. */
function scoredLevels(levels: readonly string[], points: Record<string, number> | undefined): FactorScaleDefinition {
  return {
    levels: levels.map((key, i) => ({
      key,
      value: i + 1,
      ...(points && points[key] !== undefined ? { points: points[key] } : {}),
    })),
  };
}

/** The scale of one likelihood factor under the project's configuration. */
export function factorScaleDefinition(
  factorId: string,
  configuration: Pick<RiskConfiguration, "scale" | "likelihoodMethod">,
): FactorScaleDefinition {
  const iso = (ISO21434_FACTOR_LEVELS as Record<string, readonly string[]>)[factorId];
  if (iso) return scoredLevels(iso, ISO_POINTS[factorId]);

  if (configuration.likelihoodMethod === "en-50742-a" && EN50742_FACTOR_LEVELS[factorId]) {
    return scoredLevels(EN50742_FACTOR_LEVELS[factorId], EN50742_SCORES[factorId]);
  }

  const tvra = (TVRA_FACTOR_LEVELS as Record<string, readonly string[]>)[factorId];
  if (configuration.likelihoodMethod === "etsi-tvra" && tvra) {
    return scoredLevels(tvra, TVRA_POINTS[factorId]);
  }

  return {
    levels: LIKELIHOOD_SCALES[configuration.scale].levels.map((l) => ({
      key: String(l.value),
      value: l.value,
    })),
  };
}

/**
 * The active (enabled) intrinsic likelihood factors of a project with their
 * scales, sorted by factor id — the input of the methodology fingerprint.
 */
export function intrinsicFactorScales(
  configuration: Pick<RiskConfiguration, "scale" | "likelihoodMethod" | "activeFactors" | "customFactors">,
): { factorId: string; scale: FactorScaleDefinition }[] {
  return configuration.activeFactors
    .filter((af) => af.enabled)
    .filter((af) => factorClassOf(getFactorDefinition(af.factorId, configuration.customFactors)) === "intrinsic")
    .map((af) => ({ factorId: af.factorId, scale: factorScaleDefinition(af.factorId, configuration) }))
    .sort((a, b) => (a.factorId < b.factorId ? -1 : a.factorId > b.factorId ? 1 : 0));
}

/** The likelihood method of a configuration, with the calculation's default. */
export function likelihoodMethodOf(configuration: Pick<RiskConfiguration, "likelihoodMethod">): string {
  return configuration.likelihoodMethod ?? "weighted-mean";
}
