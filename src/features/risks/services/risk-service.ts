// ==================== RISK SERVICE ====================
// Single Responsibility: CRUD operations and business rules for Risk entities.
//
// Sync logic  → risk-sync-service.ts
// Calculation → risk-calculation-service.ts

import type { PhaseStatusMap } from "shared";
import type {
  Risk,
  RiskData,
  RiskProjectData,
  ThreatReference,
} from "../models/risk-assessment-types";
import {
  getActiveRisks,
  getWontRisks,
  getRiskStatistics,
} from "../models/risk-assessment-types";
import type {
  RiskConfiguration,
  RiskValidation,
} from "../models/risk-config-types";
import { DEFAULT_CONFIGURATION } from "../models/risk-config-types";
import type { FactorRating } from "../models/risk-factor-types";
import { ALL_PREDEFINED_FACTORS } from "../models/risk-factor-types";
import type {
  MoSCoWPriority,
  RiskTreatment,
  RiskMethodType,
} from "../models/risk-scale-types";
import type { SelectedMitigation } from "../models/risk-mitigation-types";
import { calculateRiskValues } from "./risk-calculation-service";

// ==================== RESULT TYPES ====================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RiskSaveResult {
  success: boolean;
  risks: RiskData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== RISK SERVICE ====================

export const riskService = {
  // ==================== CRUD ====================

  /**
   * Update a single risk — recalculates scores after update.
   */
  updateRisk(riskData: RiskData, updatedRisk: Risk): RiskData {
    const now = new Date().toISOString();

    const beforeValues = calculateRiskValues(
      updatedRisk.factorRatings,
      riskData.configuration,
    );
    const afterValues = calculateRiskValues(
      updatedRisk.mitigatedFactorRatings,
      riskData.configuration,
    );

    const recalculated: Risk = {
      ...updatedRisk,
      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
      lastModified: now,
    };

    return {
      ...riskData,
      risks: riskData.risks.map((r) =>
        r.id === recalculated.id ? recalculated : r,
      ),
      lastModified: now,
    };
  },

  /** Update multiple risks (batch). */
  updateRisks(riskData: RiskData, updatedRisks: Risk[]): RiskData {
    let result = riskData;
    for (const risk of updatedRisks) {
      result = this.updateRisk(result, risk);
    }
    return result;
  },

  /** Update a single factor rating for a risk. */
  updateFactorRating(
    riskData: RiskData,
    riskId: string,
    factorId: string,
    value: number,
    isMitigated = false,
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    const ratings = isMitigated
      ? risk.mitigatedFactorRatings
      : risk.factorRatings;
    const updatedRatings = ratings.map((r) =>
      r.factorId === factorId ? { ...r, value } : r,
    );

    return this.updateRisk(riskData, {
      ...risk,
      ...(isMitigated
        ? { mitigatedFactorRatings: updatedRatings }
        : { factorRatings: updatedRatings }),
    });
  },

  // ==================== BUSINESS RULES ====================

  /**
   * Update MoSCoW priority — syncs status accordingly.
   */
  updatePriority(
    riskData: RiskData,
    riskId: string,
    priority: MoSCoWPriority,
    justification?: string,
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      moscowPriority: priority,
      wontJustification:
        priority === "wont" ? (justification ?? risk.wontJustification) : "",
    });
  },

  /**
   * Update selected mitigations for a risk.
   */
  updateMitigations(
    riskData: RiskData,
    riskId: string,
    mitigations: SelectedMitigation[],
    verifications?: string[],
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      selectedMitigations: mitigations,
      ...(verifications !== undefined
        ? { selectedVerifications: verifications }
        : {}),
    });
  },

  /**
   * Update risk treatment decision.
   * treatmentJustification required for accept / transfer / share.
   */
  updateTreatment(
    riskData: RiskData,
    riskId: string,
    treatment: RiskTreatment,
    justification?: string,
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      treatment,
      treatmentJustification: justification ?? risk.treatmentJustification,
    });
  },

  /** Copy before-mitigation ratings to after-mitigation ratings. */
  copyRatingsToMitigated(riskData: RiskData, riskId: string): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      mitigatedFactorRatings: risk.factorRatings.map((r) => ({ ...r })),
    });
  },

  // ==================== CONFIGURATION ====================

  /**
   * Update configuration — migrates all existing factor ratings to new structure.
   */
  updateConfiguration(riskData: RiskData, config: RiskConfiguration): RiskData {
    const now = new Date().toISOString();
    const enabledFactors = config.activeFactors.filter((f) => f.enabled);

    const updatedRisks = riskData.risks.map((risk) => {
      const merge = (old: FactorRating[]): FactorRating[] =>
        enabledFactors.map((af) => {
          const existing = old.find((r) => r.factorId === af.factorId);
          return {
            factorId: af.factorId,
            value: existing?.value ?? 0,
            weight: af.weight,
          };
        });

      const newRatings = merge(risk.factorRatings);
      const newMitigatedRatings = merge(risk.mitigatedFactorRatings);
      const beforeValues = calculateRiskValues(newRatings, config);
      const afterValues = calculateRiskValues(newMitigatedRatings, config);

      return {
        ...risk,
        factorRatings: newRatings,
        mitigatedFactorRatings: newMitigatedRatings,
        calculatedImpact: beforeValues.impact,
        calculatedLikelihood: beforeValues.likelihood,
        calculatedRiskBeforeMitigation: beforeValues.risk,
        calculatedRiskAfterMitigation: afterValues.risk,
        lastModified: now,
      };
    });

    return {
      ...riskData,
      configuration: config,
      risks: updatedRisks,
      lastModified: now,
    };
  },

  // ==================== VALIDATION ====================

  validate(riskData: RiskData): RiskValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date().toISOString();

    const unrated = riskData.risks.filter(
      (r) => r.calculatedRiskBeforeMitigation === 0,
    );
    if (unrated.length > 0)
      warnings.push(`${unrated.length} risk(s) have not been rated`);

    const wontNoJustification = riskData.risks.filter(
      (r) => r.moscowPriority === "wont" && !r.wontJustification.trim(),
    );
    if (wontNoJustification.length > 0)
      errors.push(
        `${wontNoJustification.length} "Won't" risk(s) missing justification`,
      );

    // Treatment justification is mandatory for accept / transfer / share
    const passiveTreatments = ["accept", "transfer", "share"] as const;
    const treatmentNoJustification = riskData.risks.filter(
      (r) =>
        passiveTreatments.includes(r.treatment as any) &&
        !r.treatmentJustification?.trim(),
    );
    if (treatmentNoJustification.length > 0)
      errors.push(
        `${treatmentNoJustification.length} risk(s) with accept/transfer/share treatment require a justification`,
      );

    const highUnmitigated = riskData.risks.filter(
      (r) =>
        r.calculatedRiskBeforeMitigation >= 3 &&
        r.selectedMitigations.filter((m) => m.status !== "rejected").length ===
          0 &&
        r.moscowPriority !== "wont",
    );
    if (highUnmitigated.length > 0)
      warnings.push(
        `${highUnmitigated.length} high-risk item(s) have no mitigation defined`,
      );

    const uncertainRisks = riskData.risks.filter(
      (r) => r.threatRelevance === "uncertain",
    );
    if (uncertainRisks.length > 0)
      warnings.push(
        `${uncertainRisks.length} risk(s) based on uncertain threats — confirm relevance in Threat Eval`,
      );

    return {
      isComplete:
        errors.length === 0 &&
        riskData.risks.length > 0 &&
        unrated.length === 0,
      errors,
      warnings,
      lastValidated: now,
    };
  },

  // ==================== SAVE ====================

  saveRiskData(project: RiskProjectData, riskData: RiskData): RiskSaveResult {
    const now = new Date().toISOString();
    const validation = this.validate(riskData);

    const updatedData: RiskData = {
      ...riskData,
      validation,
      lastModified: now,
    };

    let phaseStatus: PhaseStatusMap[4];
    if (riskData.risks.length === 0) phaseStatus = "not-started";
    else if (validation.isComplete) phaseStatus = "complete";
    else if (validation.errors.length > 0) phaseStatus = "incomplete";
    else phaseStatus = "in-progress";

    return {
      success: true,
      risks: updatedData,
      phaseStatus: { ...project.phaseStatus, 4: phaseStatus },
      lastModified: now,
    };
  },

  // ==================== HELPERS ====================

  getActiveRisks,
  getWontRisks,

  getStatistics(riskData: RiskData) {
    return getRiskStatistics(riskData.risks);
  },

  getActiveFactorDefinitions(configuration: RiskConfiguration) {
    const all = [...ALL_PREDEFINED_FACTORS, ...configuration.customFactors];
    return configuration.activeFactors
      .filter((af) => af.enabled)
      .map((af) => ({
        ...all.find((f) => f.id === af.factorId)!,
        weight: af.weight,
      }))
      .filter(Boolean);
  },

  getRisksByStride(risks: Risk[]): Record<string, Risk[]> {
    const grouped: Record<string, Risk[]> = {
      S: [],
      T: [],
      R: [],
      I: [],
      D: [],
      E: [],
    };
    for (const risk of risks) {
      grouped[risk.strideCategory]?.push(risk);
    }
    return grouped;
  },

  getRisksByTrustBoundary(
    risks: Risk[],
    threats: ThreatReference[],
  ): Map<string, { name: string; risks: Risk[] }> {
    const grouped = new Map<string, { name: string; risks: Risk[] }>();
    for (const risk of risks) {
      const threat = threats.find((t) => t.id === risk.threatId);
      const tbId = threat?.trustBoundaryId || "external";
      const tbName = threat?.trustBoundaryName || "External Entities";
      if (!grouped.has(tbId)) grouped.set(tbId, { name: tbName, risks: [] });
      grouped.get(tbId)!.risks.push(risk);
    }
    return grouped;
  },

  exportToJSON(riskData: RiskData): string {
    return JSON.stringify(
      { version: "1.0", exportDate: new Date().toISOString(), data: riskData },
      null,
      2,
    );
  },

  importFromJSON(json: string): ServiceResult<RiskData> {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.data?.configuration)
        return { success: false, error: "Invalid risk data format" };
      return { success: true, data: parsed.data as RiskData };
    } catch {
      return { success: false, error: "Failed to parse JSON" };
    }
  },
};

export default riskService;