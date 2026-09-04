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
  PhysicalBoundaryProperties,
  ChipBoundaryProperties,
} from "./element-properties";

import type { DFDGraph } from "./dfd-graph-types";
import type { DFDElementType } from "./dfd-element-types";
import type { DFDAsset } from "./dfd-asset-types";
import {
  AssetGroup,
  A2ARelationType,
  AnyAssetRelationType,
  DataAssetRelationType,
  FunctionAssetRelationType,
  ProcessAssetRelationType,
  SystemAssetRelationType,
  InfraAssetRelationType,
  PhysicalAssetRelationType,
  ServiceAssetRelationType,
  HumanAssetRelationType,
} from "shared";

import type { ExposureLevel } from "./element-shared-types";

import type {
  SensorProperties,
  ActuatorProperties,
} from "./transducer-properties";

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
  AssetRelation,
  IsAnRelation,

  // Data
  DataAssetRelation,
  DataAssetInteractionRelation,

  // Function (new)
  FunctionAssetRelation,
  FunctionAssetInteractionRelation,

  // Process
  ProcessAssetRelation,
  ProcessAssetInteractionRelation,

  // System
  SystemAssetRelation,
  SystemUsesRelation,
  SystemUsesQualifier,
  SystemOtherRelation,

  // Infrastructure
  InfraAssetRelation,
  InfraAccessesRelation,
  InfraAccessesQualifier,
  InfraOtherRelation,

  // Physical (new)
  PhysicalAssetRelation,
  PhysicalAccessesRelation,
  PhysicalContactQualifier,
  PhysicalOtherRelation,

  // Service (new)
  ServiceAssetRelation,
  ServiceUsesRelation,
  ServiceUsesQualifier,
  ServiceOtherRelation,

  // Human
  HumanAssetRelation,
  HumanAssetInteractionRelation,

  // Asset-to-Asset relations (Layer 2)
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
    | PhysicalBoundaryProperties
    | ChipBoundaryProperties
    | SensorProperties
    | ActuatorProperties;
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
   * Connector kind. Absent or "DataFlow" = information flow.
   * "PhysicalChannel" = physical coupling (stimulus / actuation).
   */
  connectionType?: "DataFlow";

  /**
   * Asset relations (DataFlow → Assets)
   * DataFlow allows: transports (Data), invokes (Process/Function), uses (System/Service)
   */
  assetRelations?: import("./asset-relation-types").AssetRelation[];

  /** Connection-specific properties (shape depends on connectionType). */
  properties?: DataFlowProperties;
}

// ==================== DFD VALIDATION ====================
//
// Every validator pushes a ValidationFinding instead of an ad-hoc encoded
// string. `params` is passed 1:1 as i18next interpolation values for `key` —
// no positional parsing, no parts.length branching in the notification panel.
//
// Two param keys carry identifiers that need a *second* i18n lookup, because
// they're names of things (an element type, a field) rather than plain text:
//   - params.type / params.elementType / params.targetType
//       → resolved against `dfdValidation.elementTypes.*`
//   - params.field (always paired with params.elementType in the same finding)
//       → resolved against `tabs.dfd.element_description.<ns>.fields.<field>.label`
// This resolution happens generically in the notification panel (two small
// helper functions), based on the param *name*, not on message shape.
// All other params are interpolated as plain values.
export interface ValidationFinding {
  /** i18next key, e.g. ValidationMessages.DF_DEPRECATED_VERB */
  key: string;
  /** Rendered as a clickable Chip in the notification panel. Purely cosmetic — NOT used for selection. */
  displayId?: string;
  /** Internal DFDElement/DFDConnection/DFDAsset id — used for cell selection on click. */
  elementId?: string;
  /** Passed 1:1 as i18next interpolation params for `key`. */
  params?: Record<string, string | number | string[]>;
}
export interface DFDValidation {
  isComplete: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
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
  physicalBoundaries: number;
  interfaces: number;
  sensors: number;
  actuators: number;

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
  /**
   * Canonical asset registry (id + name) from the feature store, used to
   * validate DFD asset relations against the single source of truth rather
   * than the dfd.assets mirror (which can lag). Optional: absent → validation
   * falls back to the mirror.
   */
  knownAssets?: readonly { id: string; name: string }[];
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