// features/hazards/models/hazard-data-types.ts
//
// Persisted hazard model for a project — the Hazard-phase counterpart to
// AssetData / DFDData, held in Project.hazards. The hazard graph (items +
// contributes_to / endangers edges) is the single source of truth; the Hazard
// tab and the DFD tab are views over it.
//
// v2 (UI step): added an OPTIONAL `configuration` block (project-level hazard
// defaults). Optional on purpose — old projects without it keep working and
// the tab falls back to DEFAULT_HAZARD_CONFIGURATION, so no migration is needed.

import type { HazardCombinationType, HazardItem, HazardRelation } from "shared";
import { DEFAULT_HAZARD_COMBINATION_TYPE } from "shared";

// ==================== CONFIGURATION ====================

export interface HazardConfiguration {
  /** Combination type applied to newly created Hazard Items. */
  defaultCombinationType: HazardCombinationType;
  /** Require an ISO 12100 hazardType on every hazard (UI gate, not data validation). */
  requireHazardType: boolean;
  /** Propagation hop limit reserved for the future safety derivation (1 or 2). */
  maxHops: 1 | 2;
}

export const DEFAULT_HAZARD_CONFIGURATION: HazardConfiguration = {
  defaultCombinationType: DEFAULT_HAZARD_COMBINATION_TYPE,
  requireHazardType: false,
  maxHops: 1,
};

// ==================== DATA CONTAINER ====================

export interface HazardData {
  hazards: HazardItem[];
  relations: HazardRelation[];
  /** Optional — absent on pre-UI projects; treat as DEFAULT_HAZARD_CONFIGURATION. */
  configuration?: HazardConfiguration;
  lastModified: string;
}

export function createEmptyHazardData(): HazardData {
  return {
    hazards: [],
    relations: [],
    configuration: { ...DEFAULT_HAZARD_CONFIGURATION },
    lastModified: new Date().toISOString(),
  };
}