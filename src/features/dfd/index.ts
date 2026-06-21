// ==================== DFD FEATURE PUBLIC API ====================
// Only export what should be used by app and other features

// ==================== CORE DFD TYPES ====================
export type {
  // Base
  DFDBaseEntity,

  // Elements
  DFDElement,
  DFDConnection,

  // Data containers
  DFDValidation,
  DFDStats,
  DFDData,

  // App integration
  DFDProjectData,
  DFDUpdateResult,
  DFDViewMode,

  // Export
  DFDExportData,
} from "./models/dfd-types";

export type {
  // Base
  DFDElementType,
  SecurityLevel,
  TrustLevel,
} from "./models/dfd-element-types";

// ==================== ASSET TYPES ====================
export type {
  AssetProperties,
  ElementRelation,
  DFDAsset,
} from "./models/dfd-asset-types";

// ==================== ASSET RELATION TYPES ====================
export type {
  // Asset group
  AssetRelation,
  // Data asset
  DataAssetRelation,
  DataAssetInteractionRelation,
  // Process asset
  ProcessAssetRelation,
  ProcessAssetInteractionRelation,
  // System asset
  SystemAssetRelation,
  SystemUsesRelation,
  SystemUsesQualifier,
  SystemOtherRelation,
  // Infrastructure asset
  InfraAssetRelation,
  InfraAccessesRelation,
  InfraAccessesQualifier,
  InfraOtherRelation,
  // Human asset
  HumanAssetRelation,
  HumanAssetInteractionRelation,

  // is_an
  IsAnRelation,

  // Asset-to-Asset relations (Layer 2)
  AssetToAssetRelation,
} from "./models/asset-relation-types";

// Type guards — needed by dfd-to-asset-mapper and other consumers
export {
  isIsAnRelation,
  isDataRelation,
  isSystemUsesRelation,
  isInfraAccessesRelation,
  hasQualifier,
  hasIsAnConflict,
} from "./models/asset-relation-types";

// ==================== ASSET CONSTANTS ====================
export {
  ASSET_GROUP_TAB_ORDER,
  ALLOWED_DATA_RELATIONS,
  ALLOWED_PROCESS_RELATIONS,
  ALLOWED_SYSTEM_RELATIONS,
  ALLOWED_INFRA_RELATIONS,
  ALLOWED_HUMAN_RELATIONS,
  DATA_RELATION_LABEL_KEYS,
  PROCESS_RELATION_LABEL_KEYS,
  SYSTEM_RELATION_LABEL_KEYS,
  INFRA_RELATION_LABEL_KEYS,
  HUMAN_RELATION_LABEL_KEYS,
  SYSTEM_USES_QUALIFIER_LABEL_KEYS,
  INFRA_ACCESSES_QUALIFIER_LABEL_KEYS,
  getAllowedRelations,
  hasAnyAllowedRelations,
  getQualifierLabel,
} from "./models/asset-constants";

// ==================== DFD ELEMENT CONFIG ====================
export { DFD_ELEMENT_CONFIG } from "./models/dfd-types";

// ==================== FORMATTERS ====================
export type { DocLanguage } from "./models/dfd-formatters";
export {
  getSecurityLevelText,
  getTrustLevelText,
  getDFDElementTypeText,
  getDFDElementTypePluralText,
  getAssetGroupText,
  getAssetGroupColor,
  getRelationTypeText,
  getDrawIOAssetLabel,
} from "./models/dfd-formatters";

// ==================== GRAPH TYPES ====================
export type {
  DFDGraph,
  DataFlowAnalysis,
  TrustBoundaryAnalysis,
} from "./models/dfd-graph-types";

export { DFDGraphAnalysisContext } from "./adapters/dfd-graph-analysis-context";

// ==================== INTERFACES ====================
export type {
  IXmlSource,
  IXmlSourceManager,
  IDrawioBridge,
  IAutoNumbering,
  IDFDService,
  IDFDStorageAdapter,
  IDrawioBridgeFactory,
  IStorageAdapterFactory,
  DFDEditorState,
  DFDEditorAction,
} from "./interfaces/dfd-editor-interfaces";

export {
  dfdEditorReducer,
  createInitialEditorState,
} from "./interfaces/dfd-editor-interfaces";

export { type ICrossingElements } from "./interfaces/drawio-interfaces";

// ==================== COMPONENTS ====================
export { DFDPreviewDialog } from "./components/dfd-preview-dialog";
export { DFDTab } from "./components/dfd-tab";
export { DefaultDFDGraphBuilder } from "./services/dfd-graph-builder";

// ==================== HOOKS ====================
export { useDFDEditor } from "./hooks/use-dfd-editor";
export type {
  UseDFDEditorOptions,
  UseDFDEditorReturn,
} from "./hooks/use-dfd-editor";

// ==================== SERVICES ====================
export { dfdService } from "./services/dfd-service";
export type { DFDSaveResult, DFDLoadResult } from "./services/dfd-service";

export {
  DFDStorageAdapter,
  createDFDStorageAdapter,
} from "./services/dfd-storage-adapter";
export { DFDValidator } from "./services/dfd-validator";
export { DFDParser } from "./services/dfd-parser";
export { DFDAutoNumbering } from "./services/dfd-auto-numbering";

// Bridge & Communication
export {
  DrawioBridge,
  DrawioBridgeFactory,
  drawioBridgeFactory,
} from "./services/drawio-bridge";
export { default as CORSCommunicator } from "./services/cors-communicator";
export { default as DrawioController } from "./services/drawio-controller";
export { default as LocalStorageModel } from "./services/local-storage-model";

// XML Source Management
export {
  XmlSourceManager,
  ControllerXmlSource,
  ProjectStorageXmlSource,
  LegacyStorageXmlSource,
  DotLegacyStorageXmlSource,
  createXmlSourceManager,
} from "./services/xml-source-manager";

export { addCreatedAssets } from "./services/dfd-asset-creation";
export { translateFinding } from "./utils/translate-finding";