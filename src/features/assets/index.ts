// ==================== ASSETS FEATURE INDEX ====================
// Export all public components, types, and services

// Components
export {
  AssetsTab,
  default as AssetsTabDefault,
} from "./components/assets-tab";
export { AssetTable } from "./components/asset-table";
export { AssetDialog } from "./components/asset-dialog";
export { AssetConfigDialog } from "./components/asset-config-dialog";
export { DFDPreviewPanel } from "./components/dfd-preview-panel";
export {
  AssetExportImportDialog,
  type ExportImportMode,
} from "./components/asset-export-import-dialog";

// Types
export type {
  Asset,
  AssetData,
  AssetConfiguration,
  AssetValidation,
  AssetProjectData,
  AssetUpdateResult,
  AssetTabProps,
  AssetExportData,
  AssetExportOptions,
  AssetImportOptions,
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
  ImpactRating,
  SecurityGoal,
  SecurityGoalType,
  DFDElementLink,
  ImpactCriteriaCategory,
} from "./models/asset-types";

// Constants
export {
  IMPACT_SCALES,
  PREDEFINED_IMPACT_CRITERIA,
  SECURITY_GOALS,
  DEFAULT_ASSET_CONFIGURATION,
} from "./models/asset-types";

// Helper functions
export {
  createDefaultAssetData,
  createEmptyAsset,
  calculateOverallImpact,
  getImpactLevel,
  generateNextAssetId,
  parseAssetId,
  renumberAssets,
  migrateAssetConfiguration,
} from "./models/asset-types";

// Service
export { assetService } from "./services/asset-service";
export type {
  AssetSaveResult,
  AssetLoadResult,
  DFDAssetParseResult,
} from "./services/asset-service";
