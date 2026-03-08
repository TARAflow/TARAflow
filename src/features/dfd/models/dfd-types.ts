// ==================== DFD TYPES ====================
// Single Responsibility: type definitions for DFD-related data structures
//
// Types moved to dedicated files (backwards-compatible re-exports remain):
//   DFDElementType, SecurityLevel, TrustLevel → dfd-element-types.ts
//   AssetProperties, ElementRelation, DFDAsset → asset-types.ts

import type { PhaseStatusMap } from "shared";
import type {
  ProcessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
} from "./element-properties";

import type { DFDGraph } from "./dfd-graph-types";
import type { DFDElementType } from "./dfd-element-types";
import type { DFDAsset } from "./asset-types";

// ==================== DFD ELEMENT TYPES ====================
// Re-exported from dfd-element-types.ts for backwards compatibility

export type {
  DFDElementType,
  SecurityLevel,
  TrustLevel,
} from "./dfd-element-types";

// ==================== ASSET RELATIONS ====================
// AssetRelationType and AssetRelation live in asset-relation-types.ts
// Re-exported here for convenient imports throughout the project

export type {
  AssetGroup,
  AssetRelation,
  AnyAssetRelationType,
  DataAssetRelationType,
  DataAssetRelation,
  DataAssetInteractionRelation,
  ProcessAssetRelationType,
  ProcessAssetRelation,
  ProcessAssetInteractionRelation,
  SystemAssetRelationType,
  SystemAssetRelation,
  SystemUsesRelation,
  SystemUsesQualifier,
  SystemOtherRelation,
  InfraAssetRelationType,
  InfraAssetRelation,
  InfraAccessesRelation,
  InfraAccessesQualifier,
  InfraOtherRelation,
  HumanAssetRelationType,
  HumanAssetRelation,
  HumanAssetInteractionRelation,
  IsAnRelation,
  // Asset-to-Asset relations (Layer 2)
  A2ARelationType,
  AssetToAssetRelation,
} from "./asset-relation-types";

export {
  isIsAnRelation,
  isDataRelation,
  isSystemUsesRelation,
  isInfraAccessesRelation,
  hasQualifier,
  hasIsAnConflict,
} from "./asset-relation-types";

// ==================== ASSET TYPES RE-EXPORTS ====================
// ElementRelation and DFDAsset now live in asset-types.ts
// Re-exported for backwards compatibility

//export type { AssetProperties, ElementRelation, DFDAsset } from "./asset-types";

// ==================== BASE ENTITY ====================

/**
 * Shared base for DFDElement and DFDConnection
 * Avoids duplication of common fields
 *
 * name:
 * - Elements:    own name     e.g. "Monitor Process", "Control System"
 * - Connections: action text  e.g. "send cmd", "request status"
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
    | TrustBoundaryProperties;
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
   * DataFlow allows: transports (Data), invokes (Process), uses (System)
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
  interfaces: number;

  /** Number of unique assets in the project */
  assets: number;

  /** Asset distribution per group */
  assetsByGroup?: {
    data: number;
    system: number;
    process: number;
    infrastructure: number;
    human: number;
  };

  // Description completion stats
  describedElements: number;
  describedAssets: number;
  describedConnections: number;

  /** Elements without an asset relation (for completeness display) */
  elementsWithoutAssets?: number;
}

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

// ==================== DFD TAB PROPS ====================

export interface DFDTabProps {
  project: DFDProjectData;
  onUpdate: (updates: DFDUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
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

// REMOVED: ALLOWED_ASSET_RELATIONS → jetzt in asset-constants.ts
// REMOVED: getAllowedAssetRelations, isAssetRelationAllowed, getAssetRelationTypeText
//          → jetzt in asset-constants.ts und asset-relation-types.ts
