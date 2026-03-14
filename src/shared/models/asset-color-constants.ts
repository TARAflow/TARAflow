// ==================== ASSET COLOR CONSTANTS ====================
// Shared display configuration for asset categories (colors + labels).
//
// Intentionally minimal — no dependency on dfd-types or asset-relation-types.
// Full asset-constants.ts with relation matrices stays in features/dfd/models.
//
// Used by:
//   - asset-table.tsx  (ID chip color, Type column badge)
//   - Future: DrawIO label color generation

// ==================== TYPES ====================

export type AssetGroup =
  | "data"
  | "system"
  | "process"
  | "infrastructure"
  | "human";

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
  data: {
    label: "Data",
    labelDE: "Daten",
    color: "#1976D2",       // Blue
    colorLight: "#E3F2FD",
  },
  system: {
    label: "System",
    labelDE: "System",
    color: "#7B1FA2",       // Purple
    colorLight: "#F3E5F5",
  },
  process: {
    label: "Process",
    labelDE: "Prozess",
    color: "#E65100",       // Orange
    colorLight: "#FFF3E0",
  },
  infrastructure: {
    label: "Infra",
    labelDE: "Infrastruktur",
    color: "#4E342E",       // Brown
    colorLight: "#EFEBE9",
  },
  human: {
    label: "People",
    labelDE: "Personen",
    color: "#2E7D32",       // Green
    colorLight: "#E8F5E9",
  },
};