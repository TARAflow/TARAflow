// ==================== RISKS TAB HELPERS ====================
// Helper functions and constants for the Risks Tab
// Pure functions without side effects

import { RiskData, createDefaultRiskData } from "../models/risk-types";

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