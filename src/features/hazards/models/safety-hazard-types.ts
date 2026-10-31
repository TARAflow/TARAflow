// shared/models/safety-hazard-types.ts
//
// Canonical, format-agnostic Safety Hazard model (import spec §3.4 / §3.5).
// Adapters translate any external format into SafetyHazard[]; nothing here
// depends on a concrete file format.
//
// NOTE: If these types already exist in `shared` from import-spec Phase 1,
// delete this file and import from there instead — this is the single source.

/**
 * Severity as an import reads it (hazard import HI-1 / HI-1a / HI-1b): the
 * canonical person-harm scale (`SafetyImpact`, as on the endangers edge,
 * "none" = no injury / S0 included) — or one of the four legacy values of the
 * earlier intermediate scale, still accepted as input (TARAflow JSON / CSV
 * files, value maps) and mapped as before.
 */
export type HazardSeverity = SafetyImpact | LegacyHazardSeverity;

/** The earlier intermediate scale — input only, mapped by the bridge. */
export type LegacyHazardSeverity =
  | "negligible" // no personal injury
  | "marginal" // minor, reversible injury
  | "critical" // severe, irreversible injury
  | "catastrophic"; // death or multiple severe injuries

export type HazardProbability =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

// ISO 12100 vocabulary.
// SINGLE SOURCE is hazard-types.ts (native hazard model). Re-exported here so
// import-side consumers keep one import path, WITHOUT redefining the union.
// Do not add categories here — edit hazard-types.ts.
import { SAFETY_IMPACTS, type HazardCategory, type SafetyImpact } from "shared";

export interface SafetyHazard {
  id: string; // project-unique, e.g. "H-01"
  description: string;
  hazardCategory: HazardCategory;
  /**
   * Undefined when the source has no (known) severity — the bridge then creates
   * no person edge instead of inventing an injury (hazard import HI-11).
   */
  severity?: HazardSeverity;
  probability?: HazardProbability;
  rpn?: number; // severity x probability, optionally precomputed
  sourceNorm?: string; // "ISO 12100", "ISO 14971", ...
  affectedElements?: string[]; // DFD element IDs — linked manually after import
  affectedAssets?: string[]; // asset IDs — linked manually after import
  affectedPersons?: string[];
  physicalHazardPotential?: string;
  importMeta?: Record<string, string>;
  notes?: string;
  // Provenance for traceability
  importedFrom?: string; // adapter id: "taraflow_json", "csv_generic", ...
  originalId?: string; // id in the source format if it differed
}

export interface SafetyHazardData {
  hazards: SafetyHazard[];
  lastImportedAt?: string; // ISO timestamp of the last import
  lastImportedFile?: string; // original file name
  lastImportedProfile?: string; // RegulatoryProfile id
}

// ---- Runtime guards used by the shared import validation -------------------

// Runtime guard for the import validation. The TYPE lives in hazard-types.ts;
// this enumerated set must be kept in sync with it (types are erased at runtime,
// so the list cannot be derived). If you add a category there, add it here too.
export const HAZARD_CATEGORIES: ReadonlySet<HazardCategory> = new Set([
  "mechanical",
  "electrical",
  "thermal",
  "noise",
  "vibration",
  "radiation",
  "material_substance",
  "ergonomic",
  "environment",
  "combined",
  "other",
]);

export const LEGACY_HAZARD_SEVERITIES: ReadonlySet<LegacyHazardSeverity> = new Set([
  "negligible",
  "marginal",
  "critical",
  "catastrophic",
]);

/** Every severity an import accepts: the canonical scale and the legacy values. */
export const HAZARD_SEVERITIES: ReadonlySet<HazardSeverity> = new Set<HazardSeverity>([
  ...SAFETY_IMPACTS,
  ...LEGACY_HAZARD_SEVERITIES,
]);

export const HAZARD_PROBABILITIES: ReadonlySet<HazardProbability> = new Set([
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
]);