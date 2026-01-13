// ==================== RISK PROGRESS UTILS ====================
// Pure functions for calculating risk completion progress
// Extracted from risk-table.tsx for reusability

import type { Risk } from "../models/risk-types";

export interface RiskProgress {
  done: number;
  total: number;
  percent: number;
}

/**
 * Calculate progress statistics for a group of risks
 * A risk is considered "done" if its status is:
 * - mitigated
 * - accepted
 * - wont-do
 */
export function calculateProgress(risks: Risk[]): RiskProgress {
  const total = risks.length;
  const done = risks.filter(
    (r) =>
      r.status === "mitigated" ||
      r.status === "accepted" ||
      r.status === "wont-do"
  ).length;

  return {
    done,
    total,
    percent: total > 0 ? (done / total) * 100 : 0,
  };
}

/**
 * Get progress color based on completion percentage
 */
export function getProgressColor(
  percent: number
): "success" | "warning" | "default" {
  if (percent === 100) return "success";
  if (percent > 50) return "warning";
  return "default";
}

/**
 * Get progress variant for LinearProgress
 */
export function getProgressVariant(
  percent: number
): "success" | "warning" | "primary" {
  if (percent === 100) return "success";
  if (percent > 50) return "warning";
  return "primary";
}