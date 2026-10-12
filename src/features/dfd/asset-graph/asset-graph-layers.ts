// features/dfd/asset-graph/asset-graph-layers.ts
//
// Layers (asset groups) and presets of the asset graph view (FR-V2, FR-V3).

import type { AssetGroup } from "shared";

/** Vertical hierarchy, bottom → top (FR-V3, asset-group-types.ts). */
export const VERTICAL_LAYERS: readonly AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
];

/** Orthogonal categories — a side column; environment next to human. */
export const ORTHOGONAL_LAYERS: readonly AssetGroup[] = [
  "process",
  "service",
  "physical",
  "human",
  "environment",
];

export const ALL_LAYERS: readonly AssetGroup[] = [
  ...VERTICAL_LAYERS,
  ...ORTHOGONAL_LAYERS,
];

/** Display order of layers (vertical first, then the side column). */
export function layerRank(group: string): number {
  const i = ALL_LAYERS.indexOf(group as AssetGroup);
  return i === -1 ? ALL_LAYERS.length : i;
}

export type AssetGraphPresetId =
  | "architecture"
  | "flow"
  | "services"
  | "protection"
  | "all";

/** Named layer combinations (FR-V2). */
export const ASSET_GRAPH_PRESETS: Readonly<
  Record<AssetGraphPresetId, readonly AssetGroup[]>
> = {
  architecture: ["data", "function", "system", "infrastructure"],
  flow: ["process", "function", "data", "system"],
  services: ["service", "system", "function", "infrastructure"],
  protection: ["human", "environment", "physical"],
  all: ALL_LAYERS,
};

/** Display order of the presets — "All" first. */
export const ASSET_GRAPH_PRESET_ORDER: readonly AssetGraphPresetId[] = [
  "all",
  "architecture",
  "flow",
  "services",
  "protection",
];

/**
 * The preset a layer selection corresponds to, or "custom" once the user has
 * changed a preset by hand (FR-V2). Order does not matter.
 */
export function presetOfLayers(
  layers: readonly AssetGroup[],
): AssetGraphPresetId | "custom" {
  const wanted = new Set(layers);
  for (const id of ASSET_GRAPH_PRESET_ORDER) {
    const preset = ASSET_GRAPH_PRESETS[id];
    if (preset.length === wanted.size && preset.every((g) => wanted.has(g))) {
      return id;
    }
  }
  return "custom";
}
