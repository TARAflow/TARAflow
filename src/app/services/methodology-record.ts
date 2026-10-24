// ==================== METHODOLOGY RECORD ====================
// ISO/SAE 21434 conformance plan, Phase 0 step 0b (decision 16): the
// methodology record is DERIVED from the project, never stored. Every item
// comes from the configuration or from a constant the calculation itself
// uses, so the report (0d) and the Methodology view (Phase 1) cannot describe
// a method other than the one applied.
//
// App layer: it reads the assets, risks and attack-tree configuration, and
// features must not depend on each other.

import type { Project } from "../models/project-types";
import {
  CIANAAA_TO_STRIDE,
  EMPTY_PROJECT_TAGS,
  getRegulationPreset,
  regulationPresetFromTags,
  type ImpactAggregation,
  type LikelihoodMethod,
  type RegulationPresetId,
  type SecurityGoalType,
} from "shared";
import { FEASIBILITY_GATE_RULES } from "features/attacktree/services/attacktree-calculator";
import {
  DEFAULT_FEASIBILITY_CONFIGURATION,
  type FeasibilityBand,
  type FeasibilityMethod,
  type LikelihoodModel,
} from "features/attacktree/models/attacktree-feasibility-types";
import type { CalcStamp } from "shared";
import { pathCalcStamp, riskCalcStamp } from "../utils/commit-calc-stamps";
import type { ImpactScaleType } from "features/assets/models/asset-impact-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import {
  offeredTreatments,
  treatmentFallbackLabel,
  treatmentVocabulary,
  type TreatmentVocabulary,
} from "features/risks/models/risk-treatment-vocabulary";
import type { RiskTreatment } from "features/risks/models/risk-scale-types";

export interface MethodologyRecord {
  /** Regulation preset (from the project tags) and its i18n name key. */
  presetId: RegulationPresetId;
  presetNameKey: string;
  impact: {
    scale: ImpactScaleType;
    /** Scale the preset prescribes (iso-21434 → 4-level); undefined = free. */
    requiredScale?: ImpactScaleType;
    /** False when the preset prescribes another scale (asset validator finding). */
    scaleConforms: boolean;
    criteriaIds: string[];
    /** Risk-side aggregation of impact factors; undefined in the project →
     * "weighted-mean" (see RiskConfiguration.impactAggregation). */
    aggregation: ImpactAggregation;
  };
  likelihood: {
    method: LikelihoodMethod;
    /** Attack-tree feasibility rating (RC-15-11) and likelihood model. */
    feasibilityMethod: FeasibilityMethod;
    likelihoodModel: LikelihoodModel;
    /** AND / OR rules per kind of rating, as the attack-tree calculator applies them. */
    gateRules: typeof FEASIBILITY_GATE_RULES;
    /** Attack potential → feasibility bands (Table G.7) of the project. */
    bands: readonly FeasibilityBand[];
  };
  treatment: {
    vocabulary: TreatmentVocabulary;
    /** Offered options: stored value → label (Avoid/Retain… under ISO). */
    options: { stored: RiskTreatment; label: string }[];
  };
  /** Cybersecurity properties the TARA rates (CIANAAA). ISO/SAE 21434
   * 3.1.20 names C, I, A only as examples ("include"), so the seven are used
   * as they are and explained in the report — no mapping onto CIA. */
  securityProperties: SecurityGoalType[];
  /** The calculation stamps a value computed NOW would carry (iso-21434
   * only) — what the report cites for reproducibility (plan 0c / 0d). */
  calcStamps?: { risk: CalcStamp; path: CalcStamp };
}

export function buildMethodologyRecord(project: Project): MethodologyRecord {
  const presetId = regulationPresetFromTags(
    project.info?.tags ?? EMPTY_PROJECT_TAGS,
  );
  const preset = getRegulationPreset(presetId);
  const assetConfig =
    project.assets?.configuration ?? DEFAULT_ASSET_CONFIGURATION;
  const riskConfig = project.risks?.configuration;
  const feasibilityConfig =
    project.attackTrees?.configuration?.feasibilityConfiguration ??
    DEFAULT_FEASIBILITY_CONFIGURATION;
  const vocabulary = treatmentVocabulary(riskConfig);
  const requiredScale = preset.requiredImpactScale;

  return {
    presetId,
    presetNameKey: preset.nameKey,
    impact: {
      scale: assetConfig.impactScale,
      requiredScale,
      scaleConforms: !requiredScale || requiredScale === assetConfig.impactScale,
      criteriaIds: (assetConfig.impactCriteria ?? []).map((c) => c.id),
      aggregation: riskConfig?.impactAggregation ?? "weighted-mean",
    },
    likelihood: {
      method: riskConfig?.likelihoodMethod ?? "weighted-mean",
      feasibilityMethod: feasibilityConfig.method,
      likelihoodModel: feasibilityConfig.likelihoodModel,
      gateRules: FEASIBILITY_GATE_RULES,
      bands: feasibilityConfig.bands,
    },
    treatment: {
      vocabulary,
      options: offeredTreatments(vocabulary).map((tr) => ({
        stored: tr.value,
        label: treatmentFallbackLabel(tr.value, vocabulary),
      })),
    },
    // Same set and order as the threat generator's CIANAAA_TO_STRIDE.
    securityProperties: Object.keys(CIANAAA_TO_STRIDE) as SecurityGoalType[],
    ...(presetId === "iso-21434"
      ? {
          calcStamps: {
            risk: riskCalcStamp(project),
            path: pathCalcStamp(feasibilityConfig),
          },
        }
      : {}),
  };
}
