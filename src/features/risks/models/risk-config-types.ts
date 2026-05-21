// ==================== RISK CONFIGURATION TYPES ====================
// RiskConfiguration, default configuration, RiskData container, RiskValidation.
//
// Dependencies:
//   risk-scale-types  (RiskMethodType, RiskScaleType, RiskRoundingMethod)
//   risk-factor-types (RiskFactorDefinition, ActiveFactor, AssetImpactMapping,
//                      DEFAULT_ASSET_IMPACT_MAPPINGS, ALL_PREDEFINED_FACTORS)

import type { StrideMethod } from "shared";
import type { RiskMethodType, RiskScaleType, RiskRoundingMethod } from "./risk-scale-types";
import type { RiskFactorDefinition, ActiveFactor, AssetImpactMapping } from "./risk-factor-types";
import { DEFAULT_ASSET_IMPACT_MAPPINGS } from "./risk-factor-types";

// ==================== RISK CONFIGURATION ====================

export interface RiskConfiguration {
  method: RiskMethodType;
  scale: RiskScaleType;
  roundingMethod: RiskRoundingMethod;
  activeStrideMethod: StrideMethod;
  activeFactors: ActiveFactor[];
  showIndividualFactors: boolean;
  customFactors: RiskFactorDefinition[];
  useAssetImpact: boolean;
  assetImpactMapping: AssetImpactMapping;
  severityThresholds?: Record<number, number>;
  pendingSafetySourceRemoval?: boolean;
}

// ==================== DEFAULT CONFIGURATION ====================

export const DEFAULT_CONFIGURATION: RiskConfiguration = {
  method: "complex",
  scale: "4-level",
  roundingMethod: "round",
  activeStrideMethod: "per-element",
  activeFactors: [
    { factorId: "skill_level",           enabled: true,  weight: 1.0 },
    { factorId: "motive",                enabled: true,  weight: 1.0 },
    { factorId: "opportunity",           enabled: true,  weight: 1.0 },
    { factorId: "ease_of_exploit",       enabled: true,  weight: 1.0 },
    { factorId: "deployment_scope",      enabled: true,  weight: 1.0 },
    { factorId: "window_of_opportunity", enabled: false, weight: 1.0 },
    { factorId: "attacker_capability",   enabled: false, weight: 1.0 },
    { factorId: "exposure_level",        enabled: false, weight: 1.0 },
    { factorId: "size",                  enabled: false, weight: 1.0 },
    { factorId: "ease_of_discovery",     enabled: false, weight: 1.0 },
    { factorId: "awareness",             enabled: false, weight: 1.0 },
    { factorId: "intrusion_detection",   enabled: false, weight: 1.0 },
    { factorId: "financial_damage",      enabled: false, weight: 1.0 },
    { factorId: "regulatory_compliance", enabled: false, weight: 1.0 },
    { factorId: "operational",           enabled: false, weight: 1.0 },
    { factorId: "recoverability",        enabled: false, weight: 1.0 },
    { factorId: "affected_users",        enabled: false, weight: 1.0 },
    { factorId: "reputation",            enabled: false, weight: 1.0 },
    { factorId: "privacy",               enabled: false, weight: 1.0 },
    { factorId: "accountability",        enabled: false, weight: 1.0 },
    { factorId: "physical_damage",       enabled: false, weight: 1.0 },
    { factorId: "environmental",         enabled: false, weight: 1.0 },
    { factorId: "supply_chain",          enabled: false, weight: 1.0 },
    { factorId: "safety",                enabled: false, weight: 1.0, autoEnabled: false },
  ],
  showIndividualFactors: false,
  customFactors: [],
  useAssetImpact: true,
  assetImpactMapping: DEFAULT_ASSET_IMPACT_MAPPINGS["4-level"],
};

// ==================== RISK VALIDATION ====================

export interface RiskValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}