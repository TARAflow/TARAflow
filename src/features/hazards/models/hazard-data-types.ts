// features/hazards/models/hazard-data-types.ts
import type { HazardItem, HazardRelation } from "shared";

/**
 * Persisted hazard model for a project — the Hazard-phase counterpart to
 * AssetData / DFDData, held in Project.hazards. The hazard graph (items +
 * contributes_to / endangers edges) is the single source of truth; the Hazard
 * tab and the DFD tab are views over it.
 */
export interface HazardData {
  hazards: HazardItem[];
  relations: HazardRelation[];
  lastModified: string;
}

export function createEmptyHazardData(): HazardData {
  return { hazards: [], relations: [], lastModified: new Date().toISOString() };
}