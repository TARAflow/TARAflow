// ==================== RISK CONFIGURATION TYPES ====================
// RiskConfiguration, default configuration, RiskData container, RiskValidation.
//
// Dependencies:
//   risk-scale-types  (RiskMethodType, RiskScaleType, RiskRoundingMethod)
//   risk-factor-types (RiskFactorDefinition, ActiveFactor, AssetImpactMapping,
//                      DEFAULT_ASSET_IMPACT_MAPPINGS, ALL_PREDEFINED_FACTORS)

import type { StrideMethod, LikelihoodMethod } from "shared";
import type { RiskMethodType, RiskScaleType, RiskRoundingMethod } from "./risk-scale-types";
import type { RiskFactorDefinition, ActiveFactor, AssetImpactMapping } from "./risk-factor-types";
import { DEFAULT_ASSET_IMPACT_MAPPINGS } from "./risk-factor-types";
import type { WindowOfOpportunity } from "./en50742-approach-a-core";

// ==================== RISK CONFIGURATION ====================

export interface RiskConfiguration {
  method: RiskMethodType;
  scale: RiskScaleType;
  roundingMethod: RiskRoundingMethod;
  activeStrideMethod: StrideMethod;
  activeFactors: ActiveFactor[];
  /**
   * The likelihood scoring method (derived from the regulation preset). Undefined
   * → "weighted-mean" (the default TARAflow factors). Score-table methods
   * (iso-21434 / etsi-tvra / en-50742-a) compute likelihood from per-level point
   * tables instead of a weighted mean; see calculateRiskValues.
   */
  likelihoodMethod?: LikelihoodMethod;
  /**
   * EN 50742 Approach A: project-global Window of Opportunity (Overview /
   * Security Context), threaded here from project.info by the preset
   * orchestrator. Read by calculateEN50742RiskValues; irrelevant to other
   * methods. Undefined until set on an en-50742-a project.
   */
  windowOfOpportunity?: WindowOfOpportunity;
  showIndividualFactors: boolean;
  customFactors: RiskFactorDefinition[];
  useAssetImpact: boolean;
  assetImpactMapping: AssetImpactMapping;
  severityThresholds?: Record<number, number>;
  pendingSafetySourceRemoval?: boolean;
  /**
   * 5b: project-wide choice for how an attack tree's likelihood feeds a
   * threat-anchored risk that also has OWASP factors (design doc §1 "Fall 1").
   * "factor" (default) — written as the attack_tree_likelihood factor, averages
   * in with the other likelihood factors.
   * "advisory" — shown as a provenance hint only; never written as an active
   * factor, so calculateRiskValues never sees it.
   * Asset-anchored (Fall 2) and ISO feasibility-only (Fall 3) trees are
   * unaffected by this setting — there are no other factors to average with,
   * so the tree drives the number regardless.
   * Mirrors TreeLikelihoodContribution (risk-calculation-service) structurally;
   * kept as an inline literal here to avoid a services→models import.
   */
  treeLikelihoodContribution?: "factor" | "advisory";
}

// ==================== DEFAULT CONFIGURATION ====================

export const DEFAULT_CONFIGURATION: RiskConfiguration = {
  method: "complex",
  scale: "4-level",
  roundingMethod: "round",
  activeStrideMethod: "per-element",
  activeFactors: [
    { factorId: "skill_level", enabled: true, weight: 1.0 },
    { factorId: "motive", enabled: true, weight: 1.0 },
    { factorId: "opportunity", enabled: true, weight: 1.0 },
    { factorId: "ease_of_exploit", enabled: true, weight: 1.0 },
    { factorId: "deployment_scope", enabled: true, weight: 1.0 },
    { factorId: "window_of_opportunity", enabled: false, weight: 1.0 },
    { factorId: "attacker_capability", enabled: false, weight: 1.0 },
    { factorId: "exposure_level", enabled: false, weight: 1.0 },
    { factorId: "size", enabled: false, weight: 1.0 },
    { factorId: "ease_of_discovery", enabled: false, weight: 1.0 },
    { factorId: "awareness", enabled: false, weight: 1.0 },
    { factorId: "intrusion_detection", enabled: false, weight: 1.0 },
    { factorId: "financial_damage", enabled: false, weight: 1.0 },
    { factorId: "regulatory_compliance", enabled: false, weight: 1.0 },
    { factorId: "operational", enabled: false, weight: 1.0 },
    { factorId: "recoverability", enabled: false, weight: 1.0 },
    { factorId: "affected_users", enabled: false, weight: 1.0 },
    { factorId: "reputation", enabled: false, weight: 1.0 },
    { factorId: "privacy", enabled: false, weight: 1.0 },
    { factorId: "accountability", enabled: false, weight: 1.0 },
    { factorId: "physical_damage", enabled: false, weight: 1.0 },
    { factorId: "environmental", enabled: false, weight: 1.0 },
    { factorId: "supply_chain", enabled: false, weight: 1.0 },
    { factorId: "safety", enabled: false, weight: 1.0, autoEnabled: false },
  ],
  showIndividualFactors: false,
  customFactors: [],
  useAssetImpact: true,
  assetImpactMapping: DEFAULT_ASSET_IMPACT_MAPPINGS["4-level"],
  treeLikelihoodContribution: "factor",
};

// ==================== RISK VALIDATION ====================

export interface RiskValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}