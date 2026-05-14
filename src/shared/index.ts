// ==================== SHARED INDEX ====================
// Public API of the shared module
// Only export what should be used by app and features

// ==================== TYPES ====================
export type {
  MitigationPropertyRole,
  PhaseStatus,
  ProjectStatus,
  StrideMethod,
  StrideCategory,
  PhaseStatusMap,
  PhaseDefinition,
  ValidationResult,
} from "./models/common-types";

export {
  PHASES,
  PHASE_STATUS_CONFIG,
  STRIDE_COLORS,
} from "./models/common-types";

export type {
  ProjectData,
  FeatureTabProps,
  ProjectActions,
  ExportService,
  StorageService,
} from "./models/feature-interfaces";

export type {
  AssetDataReference,
  AssetReference,
  CIANAAALevel,
  DFDReference,
  DataFlowReference,
  LinkedDFDElement,
  SecurityGoalReference,
} from "./models/reference-types";

export { CIANAAA_TO_STRIDE } from "./models/reference-types";

export type { ControlInstance } from "./models/control-instance";

// ==================== ASSET RELATION UNION TYPES ====================
// String union types for asset relations — used by dfd and threats features.
export type {
  DataAssetRelationType,
  FunctionAssetRelationType,
  ProcessAssetRelationType,
  SystemAssetRelationType,
  InfraAssetRelationType,
  PhysicalAssetRelationType,
  ServiceAssetRelationType,
  HumanAssetRelationType,
  AnyAssetRelationType,
} from "./models/asset-relation-union-types";

// ==================== UI COMPONENTS ====================
export { Button } from "./components/button";
export { Toast, ToastContainer } from "./components/toast";
export { Badge } from "./components/badge";
export { GenericAccordion } from "./components/generic-accordion";
export { OuterHeader } from "./components/outer-header";
export { InnerHeader } from "./components/inner-header";
export { DFDPreviewPanel } from "./components/dfd-preview-panel";
export { MitigationCoverageBadge } from "./components/mitigation-coverage-badge";

// ==================== DIALOGS ====================
export { ConfirmDialog } from "./components/dialogs/confirm-dialog";
export type {
  ConfirmDialogProps,
  ConfirmDialogVariant,
} from "./components/dialogs/confirm-dialog";

export { ConfirmDeleteDialog } from "./components/dialogs/confirm-delete-dialog";

export { SaveDiscardDialog } from "./components/dialogs/save-discard-dialog";
export type { SaveDiscardDialogProps } from "./components/dialogs/save-discard-dialog";

// ==================== CONSTANTS ====================
export {
  MIN_PANEL_HEIGHT,
  DEFAULT_TOP_HEIGHT,
} from "./hooks/use-split-view-resize";

// ==================== UTILS ====================
export { useToast } from "./components/toast";
export { useSplitViewResize } from "./hooks/use-split-view-resize";
export { formatExportFilename } from "./utils/formatters";
export {
  getPhaseStatusBgColor,
  getPhaseStatusColor,
  getPhaseStatusIcon,
  getPhaseStatusLabel,
} from "./models/common-types";

// Tag Categories
export type {
  TagCategoryKey,
  TagDefinition,
  TagCategory,
} from "./utils/tag-categories";

export {
  TAG_CATEGORIES,
  getAllPredefinedTagNames,
  isPredefinedTag,
  isRegulationTag,
  getTagCategory,
  getTagDefinition,
  getTagStyles,
  getTagsByCategory,
  getRegulationTags,
  getAvailablePredefinedTags,
} from "./utils/tag-categories";

export { computeAllMitigationCoverage } from "./utils/mitigation-coverage";

export { type DFDAnalysisContext } from "./ports/dfd-analysis-context";

// ==================== ASSET GROUP TYPES ====================
// Single source of truth for AssetGroup and A2ARelationType.
// Used by both dfd and assets features without cross-feature dependency.
export type { AssetGroup, A2ARelationType } from "./models/asset-group-types";

// ==================== ASSET COLORS ====================
// Display config for asset categories (colors, labels).
// AssetGroupConfig is re-exported here for consumers that need the config shape.
export type { AssetGroupConfig } from "./models/asset-color-constants";
export { ASSET_GROUP_CONFIG } from "./models/asset-color-constants";

export {
  type ProjectTags,
  EMPTY_PROJECT_TAGS,
  migrateProjectTags,
  addTagToProject,
  removeTagFromProject,
  flattenProjectTags,
  isProjectTags,
} from "./models/project-tags";