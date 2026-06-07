// features/hazards/models/hazard-tab-types.ts
//
// Tab contract for the Hazard feature slice — the narrowed project view the
// HazardsTab receives, and the result it emits back to the app layer.
// Mirrors the Asset slice (AssetProjectData / AssetUpdateResult).
//
// Dependency note: the tab reads EXISTING assets only via the shared
// AssetReference snapshot (Dependency Inversion) — no import of the heavy
// Asset type, no feature -> feature dependency. Asset CREATION from the Bowtie
// (IMPLEMENTATION-hazard-tab-ui_v2.md §4.2) is deferred until the shared
// AssetStore lands (§7.1).

import type { AssetDataReference, CreatedAsset, PhaseStatusMap } from "shared";
import type { HazardData } from "./hazard-data-types";

/** Narrowed project view passed into the HazardsTab. */
export interface HazardProjectData {
  id: string;
  name: string;
  hazards: HazardData | null;
  phaseStatus: PhaseStatusMap;
  /**
   * Existing assets (read-only) feeding the Bowtie autocompletes.
   * Reuses the memoizedAssetDataRef already built in workspace-layout —
   * undefined while the Asset phase has produced nothing yet.
   */
  assetDataRef?: AssetDataReference;
  lastModified: string;
}

/**
 * Result emitted by the tab. The app layer maps it onto Project.hazards and
 * derives phaseStatus[PhaseId.Hazard] via hazardService.deriveHazardPhaseStatus
 * (PhaseId lives in app/, so the numeric key is set there, not in the feature).
 */
export interface HazardUpdateResult {
  hazards: HazardData;
  lastModified: string;
  /**
   * Assets newly created inline in the Bowtie (quick-capture). The app layer
   * folds them into project.dfd.assets (the canonical asset store) via the DFD
   * feature's addCreatedAssets; from there the asset sync surfaces them in the
   * Asset tab. Undefined when nothing was created.
   */
  createdAssets?: CreatedAsset[];
}