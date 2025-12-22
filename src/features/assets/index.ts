// ==================== ASSETS FEATURE PUBLIC API ====================
// Only export what should be used by app and other features

// ==================== TYPES ====================
export type {
  // Core types
  Asset,
  AssetData,
  AssetValidation,
  AssetConfiguration,
  AssetProjectData,
  AssetUpdateResult,
  AssetTabProps,

  // Impact types
  ImpactScaleType,
  ImpactScaleConfig,
  ImpactLevel,
  ImpactCalculationMethod,
  ImpactCriteriaCategory,
  ImpactCriterionDefinition,
  ImpactRating,

  // Security goal types
  SecurityGoalType,
  SecurityGoalDefinition,
  SecurityGoal,

  // DFD link types
  DFDElementLink,
} from "./models/asset-types";

// ==================== CONSTANTS ====================
export {
  IMPACT_SCALES,
  PREDEFINED_IMPACT_CRITERIA,
  SECURITY_GOALS,
  DEFAULT_ASSET_CONFIGURATION,
} from "./models/asset-types";

// ==================== HELPERS ====================
export {
  generateNextAssetId,
  parseAssetId,
  renumberAssets,
  calculateOverallImpact,
  createEmptyAsset,
  createDefaultAssetData,
} from "./models/asset-types";

// ==================== COMPONENTS ====================
export { AssetsTab } from "./components/assets-tab";
export { AssetTable } from "./components/asset-table";
export { AssetDialog } from "./components/asset-dialog";
export { AssetConfigDialog } from "./components/asset-config-dialog";
export { DFDPreviewPanel } from "./components/dfd-preview-panel";

// ==================== SERVICES ====================
export { assetService } from "./services/asset-service";
export type {
  AssetSaveResult,
  AssetLoadResult,
  DFDAssetParseResult,
  ParsedDFDAsset,
} from "./services/asset-service";
