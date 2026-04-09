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
  DFDTabProps,
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
  AssetGroup,

  // Unified relation type
  AssetRelation,
  AnyAssetRelationType,

  // Data asset
  DataAssetRelationType,
  DataAssetRelation,
  DataAssetInteractionRelation,

  // Process asset
  ProcessAssetRelationType,
  ProcessAssetRelation,
  ProcessAssetInteractionRelation,

  // System asset
  SystemAssetRelationType,
  SystemAssetRelation,
  SystemUsesRelation,
  SystemUsesQualifier,
  SystemOtherRelation,

  // Infrastructure asset
  InfraAssetRelationType,
  InfraAssetRelation,
  InfraAccessesRelation,
  InfraAccessesQualifier,
  InfraOtherRelation,

  // Human asset
  HumanAssetRelationType,
  HumanAssetRelation,
  HumanAssetInteractionRelation,

  // is_an
  IsAnRelation,

  // Asset-to-Asset relations (Layer 2)
  A2ARelationType,
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

// ==================== SAFETY TYPES ====================
export type {
  SafetyRelevance,
  SafetyImpact,
  SafetyAnnotation,
} from "./models/safety-types";

export {
  isSafetyCritical,
  hasSafetyRelevance,
  createDefaultSafetyAnnotation,
} from "./models/safety-types";

// ==================== ASSET CONSTANTS ====================
export {
  ASSET_GROUP_CONFIG,
  ASSET_GROUP_TAB_ORDER,
  ALLOWED_DATA_RELATIONS,
  ALLOWED_PROCESS_RELATIONS,
  ALLOWED_SYSTEM_RELATIONS,
  ALLOWED_INFRA_RELATIONS,
  ALLOWED_HUMAN_RELATIONS,
  DATA_RELATION_LABELS,
  PROCESS_RELATION_LABELS,
  SYSTEM_RELATION_LABELS,
  INFRA_RELATION_LABELS,
  HUMAN_RELATION_LABELS,
  SYSTEM_USES_QUALIFIER_LABELS,
  INFRA_ACCESSES_QUALIFIER_LABELS,
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
export { DFDValidationPanel } from "./components/dfd-validation-panel";
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