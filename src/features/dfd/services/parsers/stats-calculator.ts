// ==================== STATS CALCULATOR ====================
// Single Responsibility: Calculate DFD statistics

import type { DFDElement, DFDConnection, DFDAsset, DFDStats } from "../../models/dfd-types";
import { createEmptyStats, updateStats } from "./parser-utils";

/**
 * Calculate complete DFD statistics
 */
export function calculateStats(
  elements: DFDElement[],
  connections: DFDConnection[],
  assets: DFDAsset[]
): DFDStats {
  const stats = createEmptyStats();

  // Count elements by type
  elements.forEach((element) => {
    updateStats(stats, element.type);
  });

  // Count dataflows
  stats.dataFlows = connections.length;

  // Count assets (unique IDs, not placements)
  stats.assets = assets.length;

  // Calculate description completion
  stats.describedElements = countDescribedElements(elements);
  stats.describedConnections = countDescribedConnections(connections);
  stats.describedAssets = countDescribedAssets(assets);

  return stats;
}

/**
 * Count elements with descriptions
 */
function countDescribedElements(elements: DFDElement[]): number {
  return elements.filter((e) => {
    const desc = e.description;
    return desc && desc.trim().length > 0;
  }).length;
}

/**
 * Count connections with descriptions
 */
function countDescribedConnections(connections: DFDConnection[]): number {
  return connections.filter((c) => {
    const desc = c.description;
    return desc && desc.trim().length > 0;
  }).length;
}

/**
 * Count assets with descriptions
 */
function countDescribedAssets(assets: DFDAsset[]): number {
  return assets.filter((a) => {
    const desc = a.description;
    return desc && desc.trim().length > 0;
  }).length;
}

/**
 * Check if statistics indicate minimum viable DFD
 */
export function hasMinimumElements(stats: DFDStats): boolean {
  return (
    stats.totalElements > 0 &&
    (stats.processes > 0 || stats.multiprocesses > 0 || stats.dataStores > 0)
  );
}