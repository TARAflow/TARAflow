// ==================== RISKS TAB HELPERS ====================
// Helper functions and constants for the Risks Tab
// Pure functions without side effects

import type { ImpactAggregation } from "shared";
import {
  RiskData,
  createDefaultRiskData,
} from "../models/risk-assessment-types";

// ==================== CONSTANTS ====================

export const MIN_PANEL_HEIGHT = 100;
export const DEFAULT_TOP_HEIGHT = 250;

export type MainView = "table" | "matrix";

// ==================== HELPER FUNCTIONS ====================

/**
 * Ensures risk data is valid by filling in defaults for missing fields
 */
export function ensureValidRiskData(
  data: RiskData | null | undefined
): RiskData {
  const defaultData = createDefaultRiskData();
  if (!data) return defaultData;

  return {
    configuration: data.configuration ?? defaultData.configuration,
    risks: data.risks ?? [],
    validation: data.validation,
    lastModified: data.lastModified ?? defaultData.lastModified,
  };
}

/**
 * Take over the preset's impact aggregation while there are no risks — no
 * risk value can change then (risk-impact-aggregation design §6). Returns
 * null when nothing is to do (no recommendation, risks exist, already set).
 * With risks the change is an explicit decision in the configuration dialog.
 */
export function withRecommendedImpactAggregation(
  data: RiskData,
  recommended: ImpactAggregation | undefined,
): RiskData | null {
  if (!recommended || data.risks.length > 0) return null;
  if (data.configuration.impactAggregation === recommended) return null;
  return { ...data, configuration: { ...data.configuration, impactAggregation: recommended } };
}
