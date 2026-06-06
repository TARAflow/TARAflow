// shared/models/hazard-impact.ts
//
// Target-type-dependent harm model carried by the `endangers` edge.
//
// Decision (IMPLEMENTATION-hazard-tab-ui.md §2.1): severity lives on the endangers
// edge, not on the HazardItem. A single hazard can endanger a human (safety scale),
// the environment and infrastructure at the same time, with different dimensions.
// The discriminated union makes the dimension explicit via the `target` discriminator.
//
// Human harm REUSES the existing SafetyImpact scale (safety-types.ts) so the safety
// annotation layer and the endangers edge speak one language. Environment and
// infrastructure share the 4-level magnitude vocabulary already used by
// isHighValueAsset, to avoid introducing a third vocabulary.

import type { SafetyImpact } from "./safety-types";

// --- Human harm: reuse SafetyImpact -------------------------------------------------
// "none" is excluded on an actual endangers edge (an edge implies harm); the Phase 2
// validator enforces severity !== "none". The ordered array drives dropdown order;
// aggregation can reuse aggregateSafetyImpact() from safety-types.
export type HumanHarmSeverity = Exclude<SafetyImpact, "none">;
export const HUMAN_HARM_SEVERITY: readonly HumanHarmSeverity[] = [
  "reversible_injury",
  "irreversible_injury",
  "fatality",
] as const;

// --- Environment harm (PROPOSED wording — confirm) ----------------------------------
// Intent: reversible/local at the low end, persistent/widespread at the top.
// Aligned to the isHighValueAsset 4-level shape for consistency.
export const ENVIRONMENT_HARM_SEVERITY = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type EnvironmentHarmSeverity = (typeof ENVIRONMENT_HARM_SEVERITY)[number];

// --- Infrastructure destruction -----------------------------------------------------
// Aligned with the existing isHighValueAsset vocabulary (top tier = "critical")
// and the High-Value Override Rule.
export const INFRASTRUCTURE_DESTRUCTION_SEVERITY = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type InfrastructureDestructionSeverity =
  (typeof INFRASTRUCTURE_DESTRUCTION_SEVERITY)[number];

// --- Discriminated union ------------------------------------------------------------
// The `target` discriminator must match the category of the endangered asset
// (Human -> "human", Environment -> "environment", Infrastructure -> "infrastructure").
// Consistency between discriminator and actual target asset is checked in Phase 2.
export type HazardTargetKind = "human" | "environment" | "infrastructure";

export type HazardImpact =
  | { target: "human"; severity: HumanHarmSeverity }
  | { target: "environment"; severity: EnvironmentHarmSeverity }
  | { target: "infrastructure"; severity: InfrastructureDestructionSeverity };

// Pure data map backing the future resolveSeverityScale(targetKind) service.
export const SEVERITY_SCALE_BY_TARGET = {
  human: HUMAN_HARM_SEVERITY,
  environment: ENVIRONMENT_HARM_SEVERITY,
  infrastructure: INFRASTRUCTURE_DESTRUCTION_SEVERITY,
} as const;

// --- Narrowing guards (type-level only) ---------------------------------------------
export function isHumanImpact(
  impact: HazardImpact,
): impact is Extract<HazardImpact, { target: "human" }> {
  return impact.target === "human";
}

export function isEnvironmentImpact(
  impact: HazardImpact,
): impact is Extract<HazardImpact, { target: "environment" }> {
  return impact.target === "environment";
}

export function isInfrastructureImpact(
  impact: HazardImpact,
): impact is Extract<HazardImpact, { target: "infrastructure" }> {
  return impact.target === "infrastructure";
}
