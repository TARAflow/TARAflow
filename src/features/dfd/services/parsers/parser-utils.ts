// ==================== PARSER UTILS ====================
// Shared utilities for DFD parsing

import type { DFDElementType, DFDStats } from "../../models/dfd-types";

/**
 * Map TARAflow type attribute to DFD element type
 */
export function mapTARAflowType(type: string): DFDElementType | "Asset" | null {
  const typeMap: Record<string, DFDElementType | "Asset"> = {
    // External entities
    externalentity: "ExternalEntity",
    interactor: "ExternalEntity",
    actor: "ExternalEntity",
    external: "ExternalEntity",

    // Process
    process: "Process",

    // Multiprocess
    multiprocess: "Multiprocess",
    "multi-process": "Multiprocess",

    // Data Store
    datastore: "DataStore",
    datastorage: "DataStore",
    database: "DataStore",
    storage: "DataStore",

    // Trust Boundary
    trustboundary: "TrustBoundary",
    boundary: "TrustBoundary",

    chipboundary: "ChipBoundary",
    "chip-boundary": "ChipBoundary",
    chip: "ChipBoundary",

    // Interface (PhysicalInterface migrated to Interface)
    physicalinterface: "Interface", // MIGRATION
    interface: "Interface",

    // Asset
    asset: "Asset",

    // DataFlow (handled as connection, but included for completeness)
    dataflow: "DataFlow",
    flow: "DataFlow",
  };
  
  return typeMap[type.toLowerCase()] || null;
}

/**
 * Map DrawIO style to DFD element type (fallback detection for old format).
 * Only used when no explicit type= attribute is present.
 * Intentionally strict — unknown shapes return null and are skipped.
 */
export function mapStyleToType(style: string): DFDElementType | null {
  if (style.includes("ellipse")) return "Process";
  if (style.includes("cylinder") || style.includes("parallelogram"))
    return "DataStore";
  // TrustBoundary: must have dashed + red stroke color — dashed alone is too broad
  if (style.includes("dashed") && style.includes("strokeColor=#FF3333"))
    return "TrustBoundary";
  // ExternalEntity: plain rectangle only (no rounded, no other shapes)
  if (
    style.includes("rounded=0") &&
    !style.includes("dashed") &&
    !style.includes("shape=") &&
    !style.includes("ellipse")
  )
    return "ExternalEntity";
  return null;
}

/**
 * Determine element type from cell
 */
export function determineElementType(cell: Element): DFDElementType | "Asset" | null {
  // TARAflow Library can use either 'type' or 'Type' attribute
  const taraflowType = cell.getAttribute("type") || cell.getAttribute("Type");
  if (taraflowType) {
    return mapTARAflowType(taraflowType);
  }

  // Fallback: style-based detection
  const style = cell.getAttribute("style") || "";
  return mapStyleToType(style);
}

/**
 * Extract trust boundary ID from name
 * Must match: /\[([a-zA-Z0-9_-]+)\]\s*$/
 */
export function extractTrustBoundaryId(name: string): string | undefined {
  if (!name) return undefined;

  const match = name.match(/\[([a-zA-Z0-9_-]+)\]/);
  if (!match) return undefined;

  return match[1];
}

/**
 * Create empty statistics object
 */
export function createEmptyStats(): DFDStats {
  return {
    totalElements: 0,
    externalEntities: 0,
    processes: 0,
    multiprocesses: 0,
    dataStores: 0,
    dataFlows: 0,
    trustBoundaries: 0,
    chipBoundaries: 0,
    interfaces: 0, // Includes migrated PhysicalInterface
    assets: 0,
    describedElements: 0,
    describedAssets: 0,
    describedConnections: 0,
  };
}

/**
 * Update statistics for a given element type
 */
export function updateStats(stats: DFDStats, type: DFDElementType): void {
  stats.totalElements++;
  
  switch (type) {
    case "ExternalEntity":
      stats.externalEntities++;
      break;
    case "Process":
      stats.processes++;
      break;
    case "Multiprocess":
      stats.multiprocesses++;
      break;
    case "DataStore":
      stats.dataStores++;
      break;
    case "TrustBoundary":
      stats.trustBoundaries++;
      break;
    case "ChipBoundary":
      stats.chipBoundaries++;
      break;
    case "Interface":
      stats.interfaces++;
      break;
  }
}