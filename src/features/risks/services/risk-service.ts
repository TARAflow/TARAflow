// ==================== RISK SERVICE ====================
// Business logic for Risk Assessment feature
// Handles calculations, validation, sync, and persistence
// Follows Single Responsibility Principle

import type { PhaseStatusMap } from "shared";
import {
  Risk,
  RiskData,
  RiskConfiguration,
  RiskValidation,
  RiskProjectData,
  ThreatReference,
  FactorRating,
  MoSCoWPriority,
  RiskStatus,
  createEmptyRisk,
  createDefaultRiskData,
  calculateRiskValues,
  getActiveRisks,
  getWontRisks,
  getRiskStatistics,
  generateRiskId,
  DEFAULT_SIMPLE_CONFIGURATION,
  DEFAULT_COMPLEX_CONFIGURATION,
  RiskMethodType,
  ALL_PREDEFINED_FACTORS,
} from "../models/risk-types";

// ==================== SERVICE RESULT TYPES ====================

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

interface RiskSyncResult {
  success: boolean;
  riskData: RiskData;
  added: number;
  removed: number;
  warnings: string[];
}

// ==================== RISK SERVICE ====================

export const riskService = {
  // ==================== SYNC FROM THREATS ====================

  /**
   * Synchronize risks with threats
   * - Creates risks for new threats
   * - Removes risks for deleted threats
   * - Preserves existing risk assessments
   */
  syncFromThreats(
    riskData: RiskData,
    threats: ThreatReference[]
  ): RiskSyncResult {
    const warnings: string[] = [];
    let added = 0;
    let removed = 0;

    const existingRiskIds = new Set(riskData.risks.map((r) => r.threatId));
    const threatIds = new Set(threats.map((t) => t.id));

    // Find threats without risks (to add)
    const threatsToAdd = threats.filter((t) => !existingRiskIds.has(t.id));

    // Find risks without threats (to remove)
    const risksToRemove = riskData.risks.filter(
      (r) => !threatIds.has(r.threatId)
    );

    // Create new risks
    const newRisks = threatsToAdd.map((threat) =>
      createEmptyRisk(threat, riskData.configuration)
    );
    added = newRisks.length;

    // Keep existing risks that still have threats
    const keptRisks = riskData.risks.filter((r) => threatIds.has(r.threatId));
    removed = risksToRemove.length;

    // Update threat descriptions for kept risks (in case they changed)
    const updatedKeptRisks = keptRisks.map((risk) => {
      const threat = threats.find((t) => t.id === risk.threatId);
      if (!threat) return risk;

      // Check if any fields changed
      const descChanged = threat.threatDescription !== risk.threatDescription;
      const mitigationChanged = threat.mitigation !== risk.originalMitigation;

      // Also check if selectedMitigations is empty but we now have a mitigation
      const needsMitigationInit =
        risk.selectedMitigations.length === 0 &&
        threat.mitigation &&
        threat.mitigation.trim() !== "";

      if (descChanged || mitigationChanged || needsMitigationInit) {
        return {
          ...risk,
          threatDescription: threat.threatDescription,
          originalMitigation: threat.mitigation || "",
          // Initialize selectedMitigations if empty and we have a mitigation
          selectedMitigations: needsMitigationInit
            ? [threat.mitigation]
            : risk.selectedMitigations,
          lastModified: new Date().toISOString(),
        };
      }
      return risk;
    });

    if (added > 0) {
      warnings.push(`Added ${added} new risk(s) for new threats`);
    }
    if (removed > 0) {
      warnings.push(`Removed ${removed} risk(s) for deleted threats`);
    }

    return {
      success: true,
      riskData: {
        ...riskData,
        risks: [...updatedKeptRisks, ...newRisks],
        lastModified: new Date().toISOString(),
      },
      added,
      removed,
      warnings,
    };
  },

  // ==================== CRUD OPERATIONS ====================

  /**
   * Update a single risk
   */
  updateRisk(riskData: RiskData, updatedRisk: Risk): RiskData {
    const now = new Date().toISOString();

    // Recalculate values
    const beforeValues = calculateRiskValues(
      updatedRisk.factorRatings,
      riskData.configuration
    );
    const afterValues = calculateRiskValues(
      updatedRisk.mitigatedFactorRatings,
      riskData.configuration
    );

    const recalculatedRisk: Risk = {
      ...updatedRisk,
      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
      lastModified: now,
    };

    // Update status based on priority
    if (recalculatedRisk.moscowPriority === "wont") {
      recalculatedRisk.status = "wont-do";
    }

    return {
      ...riskData,
      risks: riskData.risks.map((r) =>
        r.id === recalculatedRisk.id ? recalculatedRisk : r
      ),
      lastModified: now,
    };
  },

  /**
   * Update multiple risks at once (for batch operations)
   */
  updateRisks(riskData: RiskData, updatedRisks: Risk[]): RiskData {
    let result = riskData;
    for (const risk of updatedRisks) {
      result = this.updateRisk(result, risk);
    }
    return result;
  },

  /**
   * Update factor rating for a risk
   */
  updateFactorRating(
    riskData: RiskData,
    riskId: string,
    factorId: string,
    value: number,
    isMitigated: boolean = false
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    const ratings = isMitigated
      ? risk.mitigatedFactorRatings
      : risk.factorRatings;
    const updatedRatings = ratings.map((r) =>
      r.factorId === factorId ? { ...r, value } : r
    );

    const updatedRisk: Risk = isMitigated
      ? { ...risk, mitigatedFactorRatings: updatedRatings }
      : { ...risk, factorRatings: updatedRatings };

    return this.updateRisk(riskData, updatedRisk);
  },

  /**
   * Update MoSCoW priority for a risk
   */
  updatePriority(
    riskData: RiskData,
    riskId: string,
    priority: MoSCoWPriority,
    justification?: string
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    const updatedRisk: Risk = {
      ...risk,
      moscowPriority: priority,
      wontJustification:
        priority === "wont" ? justification || risk.wontJustification : "",
      status: priority === "wont" ? "wont-do" : risk.status,
    };

    return this.updateRisk(riskData, updatedRisk);
  },

  /**
   * Update status for a risk
   */
  updateStatus(
    riskData: RiskData,
    riskId: string,
    status: RiskStatus
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    const updatedRisk: Risk = {
      ...risk,
      status,
      moscowPriority: status === "wont-do" ? "wont" : risk.moscowPriority,
    };

    return this.updateRisk(riskData, updatedRisk);
  },

  /**
   * Update mitigations for a risk
   */
  updateMitigations(
    riskData: RiskData,
    riskId: string,
    mitigations: string[]
  ): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      selectedMitigations: mitigations,
    });
  },

  // ==================== CONFIGURATION ====================

  /**
   * Update configuration
   */
  updateConfiguration(
    riskData: RiskData,
    config: RiskConfiguration
  ): RiskData {
    const now = new Date().toISOString();
    const enabledFactors = config.activeFactors.filter((f) => f.enabled);

    // Update all risks with new factor structure
    const updatedRisks = riskData.risks.map((risk) => {
      // Merge existing ratings with new factor structure
      const newRatings: FactorRating[] = enabledFactors.map((af) => {
        const existing = risk.factorRatings.find(
          (r) => r.factorId === af.factorId
        );
        return {
          factorId: af.factorId,
          value: existing?.value ?? 0,
          weight: af.weight,
        };
      });

      const newMitigatedRatings: FactorRating[] = enabledFactors.map((af) => {
        const existing = risk.mitigatedFactorRatings.find(
          (r) => r.factorId === af.factorId
        );
        return {
          factorId: af.factorId,
          value: existing?.value ?? 0,
          weight: af.weight,
        };
      });

      // Recalculate with new config
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

  /**
   * Switch method (simple/complex)
   */
  switchMethod(riskData: RiskData, method: RiskMethodType): RiskData {
    const defaultConfig =
      method === "simple"
        ? DEFAULT_SIMPLE_CONFIGURATION
        : DEFAULT_COMPLEX_CONFIGURATION;

    return this.updateConfiguration(riskData, {
      ...defaultConfig,
      scale: riskData.configuration.scale,
      showIndividualFactors: riskData.configuration.showIndividualFactors,
      customFactors: riskData.configuration.customFactors,
    });
  },

  // ==================== VALIDATION ====================

  /**
   * Validate risk data
   */
  validate(riskData: RiskData): RiskValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date().toISOString();

    // Check for unrated risks
    const unratedRisks = riskData.risks.filter(
      (r) => r.calculatedRiskBeforeMitigation === 0
    );
    if (unratedRisks.length > 0) {
      warnings.push(`${unratedRisks.length} risk(s) have not been rated`);
    }

    // Check for Won't without justification
    const wontWithoutJustification = riskData.risks.filter(
      (r) => r.moscowPriority === "wont" && !r.wontJustification.trim()
    );
    if (wontWithoutJustification.length > 0) {
      errors.push(
        `${wontWithoutJustification.length} "Won't" risk(s) missing justification`
      );
    }

    // Check for high risks without mitigation
    const highUnmitigated = riskData.risks.filter(
      (r) =>
        r.calculatedRiskBeforeMitigation >= 3 &&
        r.selectedMitigations.length === 0 &&
        r.moscowPriority !== "wont"
    );
    if (highUnmitigated.length > 0) {
      warnings.push(
        `${highUnmitigated.length} high-risk item(s) have no mitigation defined`
      );
    }

    // Check for open critical risks
    const openCritical = riskData.risks.filter(
      (r) =>
        r.calculatedRiskBeforeMitigation >= 4 &&
        r.status === "open" &&
        r.moscowPriority === "must"
    );
    if (openCritical.length > 0) {
      warnings.push(
        `${openCritical.length} critical "Must" risk(s) are still open`
      );
    }

    const isComplete =
      errors.length === 0 &&
      riskData.risks.length > 0 &&
      unratedRisks.length === 0;

    return {
      isComplete,
      errors,
      warnings,
      lastValidated: now,
    };
  },

  // ==================== SAVE ====================

  /**
   * Save risk data and update phase status
   */
  saveRiskData(
    project: RiskProjectData,
    riskData: RiskData
  ): RiskSaveResult {
    const now = new Date().toISOString();
    const validation = this.validate(riskData);

    const updatedRiskData: RiskData = {
      ...riskData,
      validation,
      lastModified: now,
    };

    // Determine phase status
    let phaseStatus: PhaseStatusMap[4];
    if (riskData.risks.length === 0) {
      phaseStatus = "not-started";
    } else if (validation.isComplete) {
      phaseStatus = "complete";
    } else if (validation.errors.length > 0) {
      phaseStatus = "incomplete";
    } else {
      phaseStatus = "in-progress";
    }

    return {
      success: true,
      risks: updatedRiskData,
      phaseStatus: {
        ...project.phaseStatus,
        4: phaseStatus,
      },
      lastModified: now,
    };
  },

  // ==================== STATISTICS ====================

  /**
   * Get risk statistics
   */
  getStatistics(riskData: RiskData) {
    return getRiskStatistics(riskData.risks);
  },

  /**
   * Get risks grouped by STRIDE category
   */
  getRisksByStride(
    risks: Risk[]
  ): Record<string, Risk[]> {
    const grouped: Record<string, Risk[]> = {
      S: [],
      T: [],
      R: [],
      I: [],
      D: [],
      E: [],
    };

    for (const risk of risks) {
      if (grouped[risk.strideCategory]) {
        grouped[risk.strideCategory].push(risk);
      }
    }

    return grouped;
  },

  /**
   * Get risks grouped by trust boundary
   */
  getRisksByTrustBoundary(
    risks: Risk[],
    threats: ThreatReference[]
  ): Map<string, { name: string; risks: Risk[] }> {
    const grouped = new Map<string, { name: string; risks: Risk[] }>();

    for (const risk of risks) {
      const threat = threats.find((t) => t.id === risk.threatId);
      const tbId = threat?.trustBoundaryId || "external";
      const tbName = threat?.trustBoundaryName || "External Entities";

      if (!grouped.has(tbId)) {
        grouped.set(tbId, { name: tbName, risks: [] });
      }
      grouped.get(tbId)!.risks.push(risk);
    }

    return grouped;
  },

  // ==================== EXPORT / IMPORT ====================

  /**
   * Export risks to JSON
   */
  exportToJSON(riskData: RiskData): string {
    return JSON.stringify(
      {
        version: "1.0",
        exportDate: new Date().toISOString(),
        data: riskData,
      },
      null,
      2
    );
  },

  /**
   * Import risks from JSON
   */
  importFromJSON(json: string): ServiceResult<RiskData> {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.data || !parsed.data.configuration) {
        return { success: false, error: "Invalid risk data format" };
      }
      return { success: true, data: parsed.data as RiskData };
    } catch (e) {
      return { success: false, error: "Failed to parse JSON" };
    }
  },

  // ==================== HELPERS ====================

  /**
   * Get active (non-Won't) risks
   */
  getActiveRisks,

  /**
   * Get Won't risks
   */
  getWontRisks,

  /**
   * Get factor definitions for current configuration
   */
  getActiveFactorDefinitions(configuration: RiskConfiguration) {
    const allFactors = [
      ...ALL_PREDEFINED_FACTORS,
      ...configuration.customFactors,
    ];
    return configuration.activeFactors
      .filter((af) => af.enabled)
      .map((af) => ({
        ...allFactors.find((f) => f.id === af.factorId)!,
        weight: af.weight,
      }))
      .filter((f) => f !== undefined);
  },

  /**
   * Copy factor ratings from before to after mitigation
   */
  copyRatingsToMitigated(riskData: RiskData, riskId: string): RiskData {
    const risk = riskData.risks.find((r) => r.id === riskId);
    if (!risk) return riskData;

    return this.updateRisk(riskData, {
      ...risk,
      mitigatedFactorRatings: risk.factorRatings.map((r) => ({ ...r })),
    });
  },
};

export default riskService;