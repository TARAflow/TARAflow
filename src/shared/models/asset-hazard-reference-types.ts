// shared/models/asset-hazard-reference-types.ts
//
// Read-only projection of the HazardItem bowtie around an asset, consumed by the
// assets feature. Lives in `shared` so features/assets needs no import from
// features/hazards (Dependency Inversion). Populated by the app layer
// (build-asset-hazard-links.ts), mirroring how AssetReference is populated.
//
// Bowtie model (the current safety source; legacy DFD SafetyAnnotation is fallback):
//   asset --contributes_to[relevance]--> Hazard --endangers[severity]--> person/env
// A cause asset inherits the worst severity of the hazard it contributes to.

import type { SafetyImpact, SafetyRelevance } from "./safety-types";

export interface AssetHazardLink {
  /** Hazard item id (UUID or H-xx). */
  hazardId: string;
  /** Human-readable id, e.g. "00.01". */
  externalRef?: string;
  label: string;
  /** endangers → "endangered" (asset is a protection target);
   *  contributes_to → "cause" (asset contributes to the hazard). */
  role: "endangered" | "cause";
  /**
   * Worst-case harm severity (canonical SafetyImpact vocabulary).
   * - role "endangered": the severity on the endangers edge.
   * - role "cause": the worst severity the contributed hazard endangers with
   *   (bowtie propagation — e.g. a robot arm causing a fatal collision
   *   inherits "fatality").
   */
  severity?: SafetyImpact;
  /** Causal relevance on the contributes_to edge ("direct" | "indirect").
   *  Drives the Safety Override Rule. Only set for role === "cause". */
  relevance?: SafetyRelevance;
  /** Hazard distance on the contributes_to edge. Only set for role === "cause". */
  hazardDistance?: number;
}

export interface AssetHazardSummary {
  /** Hazards that endanger this asset (asset is target). */
  endangeredBy: AssetHazardLink[];
  /** Hazards this asset contributes to (asset is cause). */
  contributesTo: AssetHazardLink[];
  /** Worst severity across BOTH roles — the asset's overall hazard severity (display). */
  worstSeverity?: SafetyImpact;
  /**
   * Worst severity over the CAUSE side (contributes_to) only — the asset's
   * attack-surface safety level. Drives physicalImpact/aggregatedImpact.
   * Undefined for pure protection targets (endangered but not a cause).
   */
  causeSeverity?: SafetyImpact;
  /** A direct contribution reaches causeSeverity → triggers the Safety Override. */
  causeDirect?: boolean;
  /** Convenience flag: endangeredBy.length > 0. */
  isHazardTarget: boolean;
}