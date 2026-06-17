// ==================== ASSET COLOR CONSTANTS ====================
// shared/models/asset-color-constants.ts
//
// Display configuration for asset categories (colors + labels).
// Intentionally minimal — no dependency on dfd-types or asset-relation-types.
// Full asset-constants.ts with relation matrices stays in features/dfd/models.
//
// Used by:
//   - asset-table.tsx        (ID chip color, Type column badge)
//   - asset-relation-selector.tsx (tab bar, chip colors)
//   - DrawIO label color generation (future)

import type { AssetGroup } from "./asset-group-types";
export interface AssetGroupConfig {
  label: string;
  labelDE: string;
  /** Primary hex color — used for text, borders, icons */
  color: string;
  /** Light background hex — used for chip backgrounds */
  colorLight: string;
}

// ==================== CONFIG ====================

/**
 * Display configuration per asset group.
 * Colors are intentionally duplicated from features/dfd/models/asset-constants.ts
 * to keep this file dependency-free.
 * If colors change, update both files.
 */
export const ASSET_GROUP_CONFIG: Record<AssetGroup, AssetGroupConfig> = {
  // ---- Vertical hierarchy ----
  data: {
    label: "Data",
    labelDE: "Daten",
    color: "#1976D2", // Blue
    colorLight: "#E3F2FD",
  },
  function: {
    label: "Function",
    labelDE: "Funktion",
    color: "#00796B", // Teal
    colorLight: "#E0F2F1",
  },
  system: {
    label: "System",
    labelDE: "System",
    color: "#7B1FA2", // Purple
    colorLight: "#F3E5F5",
  },
  infrastructure: {
    label: "Infra",
    labelDE: "Infrastruktur",
    color: "#4E342E", // Brown
    colorLight: "#EFEBE9",
  },
  // ---- Orthogonal categories ----
  process: {
    label: "Process",
    labelDE: "Prozess",
    color: "#E65100", // Orange
    colorLight: "#FFF3E0",
  },
  physical: {
    label: "Physical",
    labelDE: "Physisches Asset",
    color: "#F57F17", // Amber
    colorLight: "#FFF8E1",
  },
  service: {
    label: "Service",
    labelDE: "Service",
    color: "#283593", // Deep Indigo
    colorLight: "#E8EAF6",
  },
  human: {
    label: "People",
    labelDE: "Personen",
    color: "#2E7D32", // Green
    colorLight: "#E8F5E9",
  },
  environment: {
    label: "Environment",
    labelDE: "Umwelt",
    color: "#558B2F",
    colorLight: "#F1F8E9", // Leaf green
  },
};