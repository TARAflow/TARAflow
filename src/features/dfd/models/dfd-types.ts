// ==================== DFD TYPES ====================
// Single Responsibility: type definitions for DFD-related data structures
//
// Types moved to dedicated files (backwards-compatible re-exports remain):
//   DFDElementType, SecurityLevel, TrustLevel → dfd-element-types.ts
//   AssetProperties, ElementRelation, DFDAsset → asset-types.ts

import type { ControlInstance, PhaseStatusMap } from "shared";
import type {
  ProcessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
  ExposureLevel,
  ChipBoundaryProperties,
} from "./element-properties";

import type { DFDGraph } from "./dfd-graph-types";
import type { DFDElementType } from "./dfd-element-types";
import type { DFDAsset } from "./dfd-asset-types";

// ==================== DFD ELEMENT TYPES ====================
// Re-exported from dfd-element-types.ts for backwards compatibility

export type {
  DFDElementType,
  SecurityLevel,
  TrustLevel,
} from "./dfd-element-types";

// ==================== ASSET RELATIONS ====================
// All asset relation types live in asset-relation-types.ts
// Re-exported here for convenient imports throughout the project

export type {
  // Core
  AssetGroup,
  AssetRelation,
  AnyAssetRelationType,
  IsAnRelation,

  // Data
  DataAssetRelationType,
  DataAssetRelation,
  DataAssetInteractionRelation,

  // Function (new)
  FunctionAssetRelationType,
  FunctionAssetRelation,
  FunctionAssetInteractionRelation,

  // Process
  ProcessAssetRelationType,
  ProcessAssetRelation,
  ProcessAssetInteractionRelation,

  // System
  SystemAssetRelationType,
  SystemAssetRelation,
  SystemUsesRelation,
  SystemUsesQualifier,
  SystemOtherRelation,

  // Infrastructure
  InfraAssetRelationType,
  InfraAssetRelation,
  InfraAccessesRelation,
  InfraAccessesQualifier,
  InfraOtherRelation,

  // Physical (new)
  PhysicalAssetRelationType,
  PhysicalAssetRelation,
  PhysicalAccessesRelation,
  PhysicalContactQualifier,
  PhysicalOtherRelation,

  // Service (new)
  ServiceAssetRelationType,
  ServiceAssetRelation,
  ServiceUsesRelation,
  ServiceUsesQualifier,
  ServiceOtherRelation,

  // Human
  HumanAssetRelationType,
  HumanAssetRelation,
  HumanAssetInteractionRelation,

  // Asset-to-Asset relations (Layer 2)
  A2ARelationType,
  AssetToAssetRelation,
} from "./asset-relation-types";

export {
  // Existing guards
  isIsAnRelation,
  isDataRelation,
  isSystemUsesRelation,
  isInfraAccessesRelation,
  hasQualifier,
  hasIsAnConflict,
  // New guards
  isFunctionRelation,
  isPhysicalRelation,
  isPhysicalAccessesRelation,
  isServiceRelation,
  isServiceUsesRelation,
} from "./asset-relation-types";

// ==================== BASE ENTITY ====================

/**
 * Shared base for DFDElement and DFDConnection.
 *
 * name:
 * - Elements:    own name       e.g. "Monitor Process", "Control System"
 * - Connections: action text    e.g. "send cmd", "request status"
 *   (In DrawIO, connection.label is mapped to name on import)
 */
export interface DFDBaseEntity {
  id: string;
  displayId: string;
  name: string;
  description?: string;
}

// ==================== DFD ELEMENT ====================

export interface DFDElement extends DFDBaseEntity {
  type: DFDElementType;
  position: { x: number; y: number };
  size: { width: number; height: number };

  /**
   * Asset relations (Element → Assets)
   * Type-safe via discriminated union from asset-relation-types.ts
   */
  assetRelations?: import("./asset-relation-types").AssetRelation[];

  /** Element-specific properties (type depends on element.type) */
  properties:
    | ProcessProperties
    | ExternalEntityProperties
    | DataStoreProperties
    | InterfaceProperties
    | TrustBoundaryProperties
    | ChipBoundaryProperties;
}

// ==================== DFD CONNECTION ====================

export interface DFDConnection extends DFDBaseEntity {
  from: string;
  to: string;

  // Visual layout (from draw.io)
  waypoints?: Array<{ x: number; y: number }>;
  sourcePoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
  offset?: { x: number; y: number };
  curved?: boolean;
  arrow?: {
    start?: string;
    end?: string;
    bidirectional?: boolean;
  };

  /**
   * Asset relations (DataFlow → Assets)
   * DataFlow allows: transports (Data), invokes (Process/Function), uses (System/Service)
   */
  assetRelations?: import("./asset-relation-types").AssetRelation[];

  /** DataFlow-specific properties */
  properties?: DataFlowProperties;
}

// ==================== DFD VALIDATION ====================

export interface DFDValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== DFD STATS ====================

export interface DFDStats {
  totalElements: number;
  externalEntities: number;
  processes: number;
  multiprocesses: number;
  dataStores: number;
  dataFlows: number;
  trustBoundaries: number;
  chipBoundaries: number;
  interfaces: number;

  /** Number of unique assets in the project */
  assets: number;

  /**
   * Asset distribution per group (all 8 groups).
   * Vertical hierarchy: data / function / system / infrastructure
   * Orthogonal:         process / physical / service / human
   */
  assetsByGroup?: {
    data: number;
    function: number;
    system: number;
    infrastructure: number;
    process: number;
    physical: number;
    service: number;
    human: number;
  };

  // Description completion stats
  describedElements: number;
  describedAssets: number;
  describedConnections: number;

  /** Elements without an asset relation (for completeness display) */
  elementsWithoutAssets?: number;
}

// ==================== DFD AUTO-NUMBERING CONFIG ====================

export type DFDSortStrategy = "top-down" | "left-right" | "diagonal";

export interface DFDAutoNumberingConfig {
  /**
   * Sorting strategy for numbering order.
   *  top-down:   top wins, left as tiebreaker
   *  left-right: left wins, top as tiebreaker
   *  diagonal:   weightX*x + weightY*y — weighted, default 0.8x + 1.0y
   */
  sortStrategy: DFDSortStrategy;
  /** Tolerance (px) within which two elements are treated as aligned. Default: 50 */
  tolerance: number;
  /** X weight for diagonal scoring (default: 0.8). Only used in diagonal mode. */
  weightX?: number;
  /** Y weight for diagonal scoring (default: 1.0). Only used in diagonal mode. */
  weightY?: number;
}

export const DEFAULT_AUTONUMBERING_CONFIG: DFDAutoNumberingConfig = {
  sortStrategy: "diagonal",
  tolerance: 50,
  weightX: 0.8,
  weightY: 1.0,
};

// ==================== DFD DATA ====================

export interface DFDData {
  xml?: string;
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[];
  validation?: DFDValidation;
  stats?: DFDStats;
  lastModified?: string;
  thumbnail?: string;
  graph?: DFDGraph;
  /** Auto-numbering configuration — persisted per project */
  autoNumberingConfig?: DFDAutoNumberingConfig;
}

// ==================== DFD EXPORT/IMPORT ====================

export interface DFDExportData {
  version: string;
  projectName: string;
  exportDate: string;
  xml: string;
  elements: DFDElement[];
  assets: DFDAsset[];
  connections: DFDConnection[];
}

// ==================== DFD PROJECT INTERFACE ====================

export interface DFDProjectData {
  id: string;
  name: string;
  dfd: DFDData | null;
  phaseStatus: PhaseStatusMap;
  settings: {
    autoSave: boolean;
    autoSaveInterval?: number;
  };
  lastModified: string;
}

// ==================== DFD UPDATE RESULT ====================

export interface DFDUpdateResult {
  dfd: DFDData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== DFD VIEW MODE ====================

export type DFDViewMode = "draw" | "describe";

// ==================== RE-EXPORTS ====================

export { DFD_ELEMENT_CONFIG } from "./dfd-constants";

export {
  type DocLanguage,
  getSecurityLevelText,
  getTrustLevelText,
  getDFDElementTypeText,
  getDFDElementTypePluralText,
} from "./dfd-formatters";

// REMOVED: ALLOWED_ASSET_RELATIONS → now in asset-constants.ts
// REMOVED: getAllowedAssetRelations, isAssetRelationAllowed, getAssetRelationTypeText
//          → now in asset-constants.ts and asset-relation-types.ts