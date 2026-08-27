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
//   en50742-approach-a-core (Srsl, AttackPotentialBand — §11.2 gate output, D)

import type {
  AttackTreeLikelihoodReference,
  StrideCategory,
  StrideMethod,
  AssetDataReference,
  DFDReference,
  MitigationDraftRef,
  PhaseStatusMap,
  ThreatReference,
  ThreatRelevanceRef,
} from "shared";
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
import type { Srsl, AttackPotentialBand } from "./en50742-approach-a-core";

// ==================== RISK ====================
export interface RiskUpdateResult {
  risks: RiskData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

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
  /**
   * EN 50742 Approach A (§2.2 Output Model C; routed via the §11.2 gate,
   * calculateGatedRiskValues in en50742-risk-calculation.ts) — the primary,
   * authoritative output when this risk's anchor carries an Exposure Level.
   * calculatedLikelihood/calculatedRiskBeforeMitigation remain the secondary
   * R×L lens in that case (L = AP band on the project scale) — SRSL is NOT
   * derived from them, and is never "mitigated down" by
   * mitigatedFactorRatings (§3.8: SRSL is a target level, satisfied by
   * controls, not lowered by them).
   *
   * `undefined` — not an en-50742-a project; these fields simply don't apply.
   * `null` — en-50742-a project, but not (yet) determined for this risk:
   *   either the anchor carries no EL (gate inactive, standard R×L only) or
   *   EL/AC aren't fully rated. Deliberately distinct from `undefined` so a
   *   UI can tell "not applicable" apart from "applicable but not yet rated"
   *   — and both are distinct from a genuine SRSL0 result (§3.9).
   * concrete `Srsl` value — gate active, fully determined.
   */
  calculatedSrsl?: Srsl | null;
  /** EN 50742 Attack Potential score underlying calculatedSrsl — same undefined/null convention. */
  calculatedApScore?: number | null;
  /** EN 50742 Attack Potential band underlying calculatedSrsl — same undefined/null convention. */
  calculatedApBand?: AttackPotentialBand | null;
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
  /**
   * Provenance — records WHICH attack-tree branch informed this risk's
   * before-mitigation likelihood, for the audit trail and AT-Branch
   * traceability. Persisted in BOTH treeLikelihoodContribution modes: in
   * "factor" mode the active attack_tree_likelihood entry in factorRatings[]
   * does the actual work; in "advisory" mode THIS is all there is — shown to
   * the analyst, not applied. Never itself a discriminator — behaviour comes
   * from whether the factor was written, which the project setting decides.
   * Sole owner: syncRisksFromAttackTrees (risk-sync-service.ts).
   */
  attackTreeAssessment?: {
    treeId: string;
    pathKey: string;
    likelihoodComponent: number;
    strideCategory: StrideCategory;
  };
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
  /**
   * Attack-path threats emitted by asset-anchored attack trees (Phase 5a).
   * A third source alongside the two STRIDE methods; the Risk tab treats them
   * identically (sourceStrideMethod: "attack-path"). Optional: absent on
   * projects without attack trees, and the tab defaults it to [].
   */
  perAttackPathThreats?: ThreatReference[];
  /**
   * Attack-tree likelihood contributions (5b-2). One entry per risk an attack
   * tree feeds (asset-anchored: per emitted path; threat-anchored: aggregated).
   * mappedValue is already on the risk scale. Optional: absent without trees.
   */
  attackTreeLikelihoods?: AttackTreeLikelihoodReference[];
  assetDataRef?: AssetDataReference;
  dfdPreviewImage?: string;
  dfd?: DFDReference | null;
  /** Integration connection for Jira/ADO ticket linking in RiskMitigationStatusDialog */
  integration?: {
    connection: RiskIntegrationConnection | null;
  } | null;
  lastModified: string;
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
    // calculatedSrsl/calculatedApScore/calculatedApBand intentionally omitted
    // here (stay undefined) — the §11.2 gate wrapper (E) fills them in right
    // after creation for en-50742-a projects, same as calculatedImpact/
    // Likelihood/RiskBeforeMitigation are recomputed by the caller, not by
    // this factory.
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

export function getFactorDefinition(
  factorId: string,
  customFactors: RiskFactorDefinition[] = [],
): RiskFactorDefinition | undefined {
  return (
    ALL_PREDEFINED_FACTORS.find((f) => f.id === factorId) ||
    customFactors.find((f) => f.id === factorId)
  );
}