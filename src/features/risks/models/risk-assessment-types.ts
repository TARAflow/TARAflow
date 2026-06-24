// ==================== RISK ASSESSMENT TYPES ====================
// Core Risk entity, ThreatReference, RiskData container.
// Factory functions: createEmptyRisk, createDefaultRiskData.
// Migration: migrateRiskData.
//
// Dependencies:
//   shared               (StrideCategory, StrideMethod, LinkedDFDElement, DataFlowReference,
//                         AssetDataReference, MitigationPropertyRole)
//   risk-scale-types     (RiskScaleType, RISK_SCALES)
//   risk-factor-types    (FactorRating, ALL_PREDEFINED_FACTORS, migrateFactorRatings)
//   risk-config-types    (RiskConfiguration, DEFAULT_CONFIGURATION, RiskValidation)
//   risk-mitigation-types (SelectedMitigation, MitigationStatus)

import type {
  StrideCategory,
  StrideMethod,
  LinkedDFDElement,
  DataFlowReference,
  AssetDataReference,
  DFDReference,
  MitigationPropertyRole,
  PhaseStatusMap,
} from "shared";
import type { RiskScaleType } from "./risk-scale-types";
import { RISK_SCALES } from "./risk-scale-types";
import type { FactorRating, RiskFactorDefinition } from "./risk-factor-types";
import {
  ALL_PREDEFINED_FACTORS,
  migrateFactorRatings,
  migrateActiveFactors,
} from "./risk-factor-types";
import type { RiskConfiguration, RiskValidation } from "./risk-config-types";
import { DEFAULT_CONFIGURATION } from "./risk-config-types";
import type { SelectedMitigation } from "./risk-mitigation-types";
import type { MoSCoWPriority, RiskTreatment } from "./risk-scale-types";
import type { RiskIntegrationConnection } from "./risk-integration-types";

// ==================== THREAT REFERENCE ====================

export type ThreatRelevanceRef = "unrated" | "relevant" | "not_relevant" | "uncertain";

export interface MitigationDraftRef {
  id?: string;
  /** Resolved display text — populated at sync time from threat catalog */
  text?: string;
  notes?: string;
  isCustom?: boolean;
}

export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  attackDescription: string;
  sourceStrideMethod: StrideMethod;
  relevance: ThreatRelevanceRef;
  proposedMitigations: MitigationDraftRef[];
  proposedVerifications: MitigationDraftRef[];
  causeDescription?: string;
  linkedAssetIds?: string[];
  elementName?: string;
  dataFlowName?: string;
  trustBoundaryId: string | null;
  trustBoundaryName: string | null;
  linkedElement?: LinkedDFDElement | null;
  dataFlow?: DataFlowReference | null;
}

// ==================== RISK ====================

export interface Risk {
  id: string;
  threatId: string;
  threatDescription: string;
  attackDescription: string;
  causeDescription?: string;
  linkedAssetIds?: string[];
  threatRelevance: ThreatRelevanceRef;
  proposedMitigations: MitigationDraftRef[];
  proposedVerifications: MitigationDraftRef[];
  strideCategory: StrideCategory;
  sourceStrideMethod: StrideMethod;
  factorRatings: FactorRating[];
  calculatedImpact: number;
  calculatedLikelihood: number;
  calculatedRiskBeforeMitigation: number;
  selectedMitigations: SelectedMitigation[];
  selectedVerifications: string[];
  mitigatedFactorRatings: FactorRating[];
  calculatedRiskAfterMitigation: number;
  treatment: RiskTreatment;
  treatmentJustification: string;
  moscowPriority: MoSCoWPriority;
  wontJustification: string;
  /** Rationale for the before-mitigation assessment (why these L/I factors). */
  riskBeforeRationale: string;
  /** Rationale for the residual assessment (why L/I changed after mitigation). */
  riskAfterRationale: string;
  created: string;
  lastModified: string;
}

// ==================== RISK DATA CONTAINER ====================

export interface RiskData {
  configuration: RiskConfiguration;
  risks: Risk[];
  validation?: RiskValidation;
  lastModified: string;
}

// ==================== RISK PROJECT INTERFACE ====================

export interface RiskProjectData {
  id: string;
  name: string;
  risks: RiskData | null;
  phaseStatus: PhaseStatusMap;
  perElementThreats: ThreatReference[];
  perInteractionThreats: ThreatReference[];
  assetDataRef?: AssetDataReference;
  dfdPreviewImage?: string;
  dfd?: DFDReference | null;
  /** Integration connection for Jira/ADO ticket linking in RiskMitigationStatusDialog */
  integration?: {
    connection: RiskIntegrationConnection | null;
  } | null;
  lastModified: string;
}

// ==================== RESULT / PROPS ====================

export interface RiskUpdateResult {
  risks: RiskData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

export interface RiskTabProps {
  project: RiskProjectData;
  onUpdate: (updates: RiskUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== FACTORY FUNCTIONS ====================

export function generateRiskId(threatId: string): string {
  return `R-${threatId}`;
}

export function createEmptyRisk(
  threatRef: ThreatReference,
  configuration: RiskConfiguration,
): Risk {
  const enabledFactors = configuration.activeFactors.filter((f) => f.enabled);

  return {
    id: generateRiskId(threatRef.id),
    threatId: threatRef.id,
    threatDescription: threatRef.threatDescription,
    attackDescription: threatRef.attackDescription || "",
    causeDescription: threatRef.causeDescription,
    linkedAssetIds: threatRef.linkedAssetIds ?? [],
    threatRelevance: threatRef.relevance,
    proposedMitigations: threatRef.proposedMitigations ?? [],
    proposedVerifications: threatRef.proposedVerifications ?? [],
    strideCategory: threatRef.strideCategory,
    sourceStrideMethod: threatRef.sourceStrideMethod,
    factorRatings: enabledFactors.map((f) => ({
      factorId: f.factorId,
      value: 0,
      weight: f.weight,
    })),
    calculatedImpact: 0,
    calculatedLikelihood: 0,
    calculatedRiskBeforeMitigation: 0,
    selectedMitigations: [],
    selectedVerifications: [],
    mitigatedFactorRatings: enabledFactors.map((f) => ({
      factorId: f.factorId,
      value: 0,
      weight: f.weight,
    })),
    calculatedRiskAfterMitigation: 0,
    treatment: "reduce",
    treatmentJustification: "",
    moscowPriority: "should",
    wontJustification: "",
    riskBeforeRationale: "",
    riskAfterRationale: "",
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

export function createDefaultRiskData(): RiskData {
  return {
    configuration: { ...DEFAULT_CONFIGURATION },
    risks: [],
    lastModified: new Date().toISOString(),
  };
}

// ==================== MIGRATION ====================

export function migrateRiskData(data: RiskData | null | undefined): RiskData | null {
  if (!data) return null;

  const risksArray = Array.isArray(data.risks) ? data.risks : [];

  if (!data.configuration) {
    return {
      ...data,
      configuration: { ...DEFAULT_CONFIGURATION },
      risks: risksArray.map((risk) => ({
        ...risk,
        riskBeforeRationale: risk.riskBeforeRationale ?? "",
        riskAfterRationale: risk.riskAfterRationale ?? "",
        factorRatings: migrateFactorRatings(risk.factorRatings ?? []),
        mitigatedFactorRatings: migrateFactorRatings(
          risk.mitigatedFactorRatings ?? [],
        ),
      })),
    };
  }

  return {
    ...data,
    configuration: {
      ...data.configuration,
      activeFactors: migrateActiveFactors(
        data.configuration.activeFactors ?? [],
      ),
      useAssetImpact: true,
    },
    risks: risksArray.map((risk) => ({
      ...risk,
      riskBeforeRationale: risk.riskBeforeRationale ?? "",
      riskAfterRationale: risk.riskAfterRationale ?? "",
      factorRatings: migrateFactorRatings(risk.factorRatings ?? []),
      mitigatedFactorRatings: migrateFactorRatings(
        risk.mitigatedFactorRatings ?? [],
      ),
    })),
  };
}

// ==================== HELPER FUNCTIONS ====================

export function getActiveRisks(risks: Risk[]): Risk[] {
  return risks.filter((r) => r.moscowPriority !== "wont");
}

export function getWontRisks(risks: Risk[]): Risk[] {
  return risks.filter((r) => r.moscowPriority === "wont");
}

export function getRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter((r) => r.sourceStrideMethod === method);
}

export function getActiveRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter(
    (r) => r.moscowPriority !== "wont" && r.sourceStrideMethod === method,
  );
}

export function getWontRisksByStrideMethod(risks: Risk[], method: StrideMethod): Risk[] {
  return risks.filter(
    (r) => r.moscowPriority === "wont" && r.sourceStrideMethod === method,
  );
}

export function getRiskStatistics(risks: Risk[]): {
  total: number;
  byPriority: Record<MoSCoWPriority, number>;
  byTreatment: Record<RiskTreatment, number>;
  highRiskCount: number;
  unratedCount: number;
} {
  const byPriority: Record<MoSCoWPriority, number> = { must: 0, should: 0, could: 0, wont: 0 };
  const byTreatment: Record<RiskTreatment, number> = {
    reduce: 0, eliminate: 0, accept: 0, transfer: 0, share: 0,
  };
  let highRiskCount = 0;
  let unratedCount = 0;

  for (const risk of risks) {
    byPriority[risk.moscowPriority]++;
    if (risk.treatment) byTreatment[risk.treatment]++;
    if (risk.calculatedRiskBeforeMitigation >= 3) highRiskCount++;
    if (risk.calculatedRiskBeforeMitigation === 0) unratedCount++;
  }

  return { total: risks.length, byPriority, byTreatment, highRiskCount, unratedCount };
}

/**
 * @deprecated Use risk-calculation-service.calculateRiskValues() instead.
 */
export function calculateRiskValues(
  ratings: FactorRating[],
  configuration: RiskConfiguration,
): { impact: number; likelihood: number; risk: number } {
  const scale = RISK_SCALES[configuration.scale];
  const maxValue = scale.levels.length;
  const allFactors = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];

  const impactRatings = ratings.filter((r) => {
    const factor = allFactors.find((f) => f.id === r.factorId);
    return factor?.category === "impact" && r.value > 0;
  });
  const likelihoodRatings = ratings.filter((r) => {
    const factor = allFactors.find((f) => f.id === r.factorId);
    return factor?.category === "likelihood" && r.value > 0;
  });

  const weightedAvg = (items: FactorRating[]): number => {
    if (items.length === 0) return 0;
    const weightedSum = items.reduce((sum, r) => sum + r.value * r.weight, 0);
    const totalWeight = items.reduce((sum, r) => sum + r.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  const impact = weightedAvg(impactRatings);
  const likelihood = weightedAvg(likelihoodRatings);
  const risk = (impact * likelihood) / maxValue;

  return {
    impact: Math.round(impact * 10) / 10,
    likelihood: Math.round(likelihood * 10) / 10,
    risk: Math.round(risk * 10) / 10,
  };
}

export function getFactorDefinition(
  factorId: string,
  customFactors: RiskFactorDefinition[] = [],
): RiskFactorDefinition | undefined {
  return (
    ALL_PREDEFINED_FACTORS.find((f) => f.id === factorId) ||
    customFactors.find((f) => f.id === factorId)
  );
}