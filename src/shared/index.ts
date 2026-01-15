// ==================== SHARED INDEX ====================
// Public API of the shared module
// Only export what should be used by app and features

// ==================== TYPES ====================
export type {
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

// ==================== UI COMPONENTS ====================
export { Button } from "./components/button";
export { Toast } from "./components/toast";
export { Badge } from "./components/badge";
export { GenericAccordion } from "./components/generic-accordion";
export { OuterHeader } from "./components/outer-header";
export { InnerHeader } from "./components/inner-header";

// ==================== DIALOGS ====================
// ==================== SHARED DIALOGS ====================
// Generic, reusable dialog components

export { ConfirmDialog } from "./components/dialogs/confirm-dialog";
export type {
  ConfirmDialogProps,
  ConfirmDialogVariant,
} from "./components/dialogs/confirm-dialog";

export { ConfirmDeleteDialog } from "./components/dialogs/confirm-delete-dialog";

export { SaveDiscardDialog } from "./components/dialogs/save-discard-dialog";
export type { SaveDiscardDialogProps } from "./components/dialogs/save-discard-dialog";

// ==================== UTILS ====================
export { formatExportFilename } from "./utils/formatters";
export {
  getPhaseStatusBgColor,
  getPhaseStatusColor,
  getPhaseStatusIcon,
  getPhaseStatusLabel,
} from "./models/common-types";

// Tag Categories
export type { TagCategoryKey, TagDefinition, TagCategory } from "./utils/tag-categories";

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

export { type OAuthCallbackData } from "./models/electron";
