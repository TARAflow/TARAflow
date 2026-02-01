// ==================== DFD FEATURE PUBLIC API ====================
// Only export what should be used by app and other features

// ==================== TYPES ====================
export type {
  DFDAsset,
  DFDElementType,
  DFDElement,
  DFDConnection,
  DFDValidation,
  DFDStats,
  DFDData,
  DFDProjectData,
  DFDUpdateResult,
  DFDTabProps,
} from "./models/dfd-types";

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

// ==================== CONSTANTS ====================
export { DFD_ELEMENT_CONFIG } from "./models/dfd-types";

export type {
  DFDGraph,
  DataFlowAnalysis,
  TrustBoundaryAnalysis,
} from "./models/dfd-graph-types";

// ==================== COMPONENTS ====================
export { DFDPreviewDialog } from "./components/dfd-preview-dialog";
export { DFDTab } from "./components/dfd-tab";
export { DFDValidationPanel } from "./components/dfd-validation-panel";

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

export { type ICrossingElements } from "./interfaces/drawio-interfaces";
