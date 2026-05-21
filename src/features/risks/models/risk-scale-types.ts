// ==================== RISK SCALE TYPES ====================
// Scale definitions, risk method, treatment options, risk matrix.
// No internal risk dependencies.

// ==================== RISK METHOD ====================

export type RiskMethodType = "complex";

export type RiskRoundingMethod = "round" | "ceil";

// ==================== QUALITATIVE SCALE ====================

export type RiskScaleType = "3-level" | "4-level" | "5-level";

export interface RiskScaleLevel {
  value: number;
  label: string;
  color: string;
  threshold: number;
}

export interface RiskScaleConfig {
  type: RiskScaleType;
  levels: RiskScaleLevel[];
}

export const RISK_SCALES: Record<RiskScaleType, RiskScaleConfig> = {
  "3-level": {
    type: "3-level",
    levels: [
      { value: 1, label: "Low",    color: "#22c55e", threshold: 2 },
      { value: 2, label: "Medium", color: "#eab308", threshold: 6 },
      { value: 3, label: "High",   color: "#ef4444", threshold: 9 },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low",      color: "#22c55e", threshold: 3  },
      { value: 2, label: "Medium",   color: "#eab308", threshold: 6  },
      { value: 3, label: "High",     color: "#f97316", threshold: 11 },
      { value: 4, label: "Critical", color: "#ef4444", threshold: 16 },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low",       color: "#22c55e", threshold: 4  },
      { value: 2, label: "Medium",    color: "#eab308", threshold: 8  },
      { value: 3, label: "High",      color: "#f97316", threshold: 14 },
      { value: 4, label: "Very High", color: "#ef4444", threshold: 20 },
      { value: 5, label: "Critical",  color: "#a855f7", threshold: 25 },
    ],
  },
};

// ==================== RISK TREATMENT ====================

export type RiskTreatment =
  | "eliminate"
  | "reduce"
  | "accept"
  | "transfer"
  | "share";

export interface RiskTreatmentDefinition {
  value: RiskTreatment;
  label: string;
  description: string;
  color: string;
}

export const RISK_TREATMENTS: RiskTreatmentDefinition[] = [
  { value: "eliminate", label: "Eliminate", description: "Remove the risk source entirely",          color: "#16a34a" },
  { value: "reduce",    label: "Reduce",    description: "Mitigate via countermeasures",             color: "#2563eb" },
  { value: "accept",    label: "Accept",    description: "Consciously retain the risk without action", color: "#d97706" },
  { value: "transfer",  label: "Transfer",  description: "Move risk to third party",                 color: "#7c3aed" },
  { value: "share",     label: "Share",     description: "Distribute risk across multiple parties",  color: "#0891b2" },
];

// ==================== MOSCOW PRIORITY ====================

export type MoSCoWPriority = "must" | "should" | "could" | "wont";

export interface MoSCoWDefinition {
  value: MoSCoWPriority;
  label: string;
  description: string;
  color: string;
}

export const MOSCOW_PRIORITIES: MoSCoWDefinition[] = [
  { value: "must",   label: "Must",   description: "Critical - must be addressed",                         color: "#ef4444" },
  { value: "should", label: "Should", description: "Important - should be addressed if possible",          color: "#f97316" },
  { value: "could",  label: "Could",  description: "Nice to have - could be addressed",                    color: "#eab308" },
  { value: "wont",   label: "Won't",  description: "Accepted risk - won't be addressed this iteration",    color: "#6b7280" },
];

// ==================== RISK MATRIX ====================

export interface RiskMatrixCell {
  impact: number;
  likelihood: number;
  riskLevel: number;
  color: string;
  label: string;
}

export function generateRiskMatrix(scale: RiskScaleType): RiskMatrixCell[][] {
  const scaleConfig = RISK_SCALES[scale];
  const size = scaleConfig.levels.length;
  const matrix: RiskMatrixCell[][] = [];

  for (let i = size; i >= 1; i--) {
    const row: RiskMatrixCell[] = [];
    for (let l = 1; l <= size; l++) {
      const riskLevel = Math.ceil((i * l) / size);
      const level = scaleConfig.levels[Math.min(riskLevel - 1, size - 1)];
      row.push({ impact: i, likelihood: l, riskLevel, color: level.color, label: level.label });
    }
    matrix.push(row);
  }
  return matrix;
}

// ==================== RISK COLOR / LABEL HELPERS ====================

function calculateLevelIndex(
  value: number,
  maxLevels: number,
  roundingMethod: RiskRoundingMethod = "round",
): number {
  if (roundingMethod === "ceil") {
    return Math.min(Math.max(Math.ceil(value) - 1, 0), maxLevels - 1);
  }
  return Math.min(Math.max(Math.round(value) - 1, 0), maxLevels - 1);
}

export function getRiskColor(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round",
): string {
  if (value <= 0) return "#6b7280";
  const scaleConfig = RISK_SCALES[scale];
  const levelIndex = calculateLevelIndex(value, scaleConfig.levels.length, roundingMethod);
  return scaleConfig.levels[levelIndex].color;
}

export function getRiskLabel(
  value: number,
  scale: RiskScaleType,
  roundingMethod: RiskRoundingMethod = "round",
): string {
  if (value <= 0) return "-";
  const scaleConfig = RISK_SCALES[scale];
  const levelIndex = calculateLevelIndex(value, scaleConfig.levels.length, roundingMethod);
  return scaleConfig.levels[levelIndex].label;
}