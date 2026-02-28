// ==================== DFD TYPES ====================
// Single Responsibility: Type definitions for DFD-related data structures

import type { PhaseStatusMap } from "shared";
import type {
  ProcessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
  AssetProperties,
} from "./element-properties";

import type { DFDGraph } from "./dfd-graph-types";

// ==================== DFD ELEMENT TYPES ====================

export type DFDElementType =
  | "ExternalEntity"
  | "Process"
  | "Multiprocess"
  | "DataStore"
  | "DataFlow"
  | "TrustBoundary"
  | "Interface";

export type SecurityLevel = "public" | "internal" | "confidential" | "secret";
export type TrustLevel = "trusted" | "untrusted" | "unknown";

// ==================== ASSET RELATIONS ====================
// AssetRelationType und AssetRelation leben jetzt in asset-relation-types.ts
// Hier nur Re-Export für einfache Imports im Rest des Projekts

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
} from "./asset-relation-types";

export {
  isIsAnRelation,
  isDataRelation,
  isSystemUsesRelation,
  isInfraAccessesRelation,
  hasQualifier,
  hasIsAnConflict,
} from "./asset-relation-types";

// ==================== BASE ENTITY ====================

/**
 * Gemeinsame Basis für DFDElement und DFDConnection
 * Vermeidet Duplikate bei gemeinsamen Feldern
 *
 * name:
 * - Bei Elementen:   Eigenname     z.B. "Monitor Process", "Control System"
 * - Bei Connections: Aktionstext   z.B. "send cmd", "request status"
 *   (In DrawIO wird connection.label beim Einlesen auf name gemappt)
 */
export interface DFDBaseEntity {
  id: string;
  displayId: string;
  name: string;
  description?: string;
}

// ==================== ELEMENT RELATION ====================

/**
 * Element relation from Asset perspective (Asset → Element)
 * Mirrored representation stored in DFDAsset.linkedElements
 * Wird beim Speichern einer AssetRelation automatisch gespiegelt
 */
export interface ElementRelation {
  /** Element ID */
  elementId: string;

  /** Element name */
  elementName: string;

  /** Element type */
  elementType: DFDElementType;

  /** Display ID (e.g., "P-1", "DS-1") */
  displayId: string;

  /**
   * Relation type — typsicher über alle Asset-Gruppen
   * z.B. "reads", "stores", "controls", "is_an", "affects_safety"
   */
  relationType?: import("./asset-relation-types").AnyAssetRelationType;

  /**
   * Qualifier — nur bei SystemUsesRelation (relationType === "uses")
   * z.B. "authentication", "api", "storage"
   */
  qualifier?:
    | import("./asset-relation-types").SystemUsesQualifier
    | import("./asset-relation-types").InfraAccessesQualifier;

  /** Optional notes */
  notes?: string;
}

// ==================== DFD ASSET ====================

/**
 * Asset in TARAflow
 *
 * Assets entstehen kontextuell aus dem Element-Beschreibungsformular
 * oder direkt aus dem Asset-Accordion der Description View.
 *
 * NICHT mehr via DrawIO-Marker (Marker-Logik entfernt).
 */
export interface DFDAsset {
  /** Asset identifier (e.g. "A-001") */
  id: string;

  /** Display ID (same as id for consistency) */
  displayId: string;

  /** Asset name */
  name: string;

  description?: string;

  /**
   * Asset-Gruppe - Top-Level Attribut (nicht in properties vergraben)
   * Steuert die Tab-Leiste [Data] [Systems] [Process] [Infra] [People]
   * und die Farb-Kodierung im DrawIO-Layer
   */
  assetGroup: import("./asset-relation-types").AssetGroup;

  /**
   * Protection Need - Top-Level Attribut
   * Wird direkt im AssetRelationSelector angezeigt (Chip-Farbe)
   * ohne tief in properties zu graben
   */
  protectionNeed?: "low" | "medium" | "high" | "critical";

  /**
   * DFD-Elemente die mit diesem Asset verknüpft sind
   * Wird beim Speichern einer AssetRelation automatisch gespiegelt
   * Ermöglicht "Asset → welche Elemente?" Abfragen
   */
  linkedElements?: ElementRelation[];

  /** Asset-spezifische Eigenschaften (detailliert, für Asset-Tab) */
  properties?: AssetProperties;
}

// ==================== DFD ELEMENT ====================

export interface DFDElement extends DFDBaseEntity {
  type: DFDElementType;
  position: { x: number; y: number };
  size: { width: number; height: number };

  /**
   * Asset relations (Element → Assets)
   * Typsicher via Discriminated Union aus asset-relation-types.ts
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
   * DataFlow erlaubt: transports (Data), invokes (Process), uses (System)
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

  /** Anzahl einzigartiger Assets im Projekt */
  assets: number;

  /** Asset-Verteilung pro Gruppe */
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

  /** Elemente ohne Asset-Relation (für Vollständigkeitsanzeige) */
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
