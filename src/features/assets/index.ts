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
export {
  AssetExportImportDialog,
  type ExportImportMode,
} from "./components/asset-export-import-dialog";

// Types
export type {
  Asset,
  AssetData,
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
  AssetConfiguration,
  AssetValidation,
  AssetProjectData,
  AssetUpdateResult,
  AssetExportData,
  AssetExportOptions,
  AssetImportOptions,
  DFDElementLink,
} from "./models/asset-types";

export type {
  DFDAssetReference,
  DFDElementReference,
  DFDConnectionReference,
} from "./models/dfd-asset-link-types";

export type {
  ImpactRating,
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactCriteriaCategory,
  ImpactRoundingMethod,
} from "./models/asset-impact-types";

export {
  deriveAllImpacts,
  deriveAggregatedImpact,
  overallImpactToBusinessLevel,
  type PhysicalImpactLevel,
} from "./services/asset-physical-impact-deriver";

export type {
  SecurityGoal,
  SecurityGoalType,
} from "./models/asset-security-goals-types";

// Constants
export { DEFAULT_ASSET_CONFIGURATION } from "./models/asset-types";

export {
  IMPACT_SCALES,
  PREDEFINED_IMPACT_CRITERIA,
} from "./models/asset-impact-types";

export { SECURITY_GOALS } from "./models/asset-security-goals-types";

// Helper functions
export {
  createDefaultAssetData,
  generateNextAssetId,
  parseAssetId,
  renumberAssets,
} from "./services/asset-factory";

export { createEmptyAsset } from "./services/asset-factory";

export {
  calculateOverallImpact,
  getImpactLevel,
} from "./services/asset-impact-calculator";

export { migrateAssetConfiguration } from "./services/asset-migration";

// Service
export { assetService } from "./services/asset-service";
export type {
  AssetSaveResult,
  AssetLoadResult,
} from "./services/asset-service";
