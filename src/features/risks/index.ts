// ==================== RISK FEATURE EXPORTS ====================
// Public API for the Risk Assessment feature.
// Only export what external features actually need.
// Internal sub-modules should be imported directly by path.

// ==================== MODELS — public surface ====================

// Scale / method / treatment / priority
export type {
  RiskMethodType,
  RiskRoundingMethod,
  RiskScaleType,
  RiskScaleLevel,
  RiskScaleConfig,
  RiskTreatment,
  RiskTreatmentDefinition,
  MoSCoWPriority,
  MoSCoWDefinition,
  RiskMatrixCell,
} from "./models/risk-scale-types";
export {
  RISK_SCALES,
  RISK_TREATMENTS,
  MOSCOW_PRIORITIES,
  generateRiskMatrix,
  getRiskColor,
  getRiskLabel,
} from "./models/risk-scale-types";

// Factor definitions
export type {
  RiskFactorCategory,
  RiskFactorDefinition,
  FactorRating,
  ActiveFactor,
  AssetImpactLevel,
  AssetImpactMapping,
} from "./models/risk-factor-types";
export {
  STANDARD_LIKELIHOOD_FACTORS,
  IMPACT_FACTORS,
  ETSI_FACTORS,
  EN50742_FACTORS,
  TARAFLOW_FACTORS,
  ALL_PREDEFINED_FACTORS,
  DEFAULT_ASSET_IMPACT_MAPPINGS,
  FACTOR_ID_MIGRATION_MAP,
  migrateFactorRatings,
  migrateActiveFactors,
  getFactorDefinition,
} from "./models/risk-factor-types";

// Mitigation lifecycle
export type {
  MitigationStatus,
  MitigationStatusConfig,
  ImplementationProgress,
  SelectedMitigation,
} from "./models/risk-mitigation-types";
export {
  MITIGATION_STATUS_CONFIGS,
  deriveImplementationProgress,
  normalizeMitigationEntry,
  normalizeMitigations,
} from "./models/risk-mitigation-types";

// Integration ticket types
export type {
  TicketStatus,
  TicketSummary,
  CreateTicketInput,
  CreateTicketResult,
  TicketSyncResult,
  RiskIntegrationConnection,
} from "./models/risk-integration-types";
export {
  mapRawStatusToTicketStatus,
  mapTicketStatusToMitigationStatus,
} from "./models/risk-integration-types";

// Configuration
export type {
  RiskConfiguration,
  RiskValidation,
} from "./models/risk-config-types";
export { DEFAULT_CONFIGURATION } from "./models/risk-config-types";

// Assessment — Risk entity, data container, project interface
export type {
  Risk,
  RiskData,
  RiskProjectData,
  RiskUpdateResult,
} from "./models/risk-assessment-types";
export {
  generateRiskId,
  createEmptyRisk,
  createDefaultRiskData,
  migrateRiskData,
  getActiveRisks,
  getWontRisks,
  getRisksByStrideMethod,
  getActiveRisksByStrideMethod,
  getWontRisksByStrideMethod,
  getRiskStatistics,
} from "./models/risk-assessment-types";

export {
  ISO21434_FACTOR_LEVELS,
  ISO21434_ELAPSED_TIME_POINTS,
  ISO21434_EXPERTISE_POINTS,
  ISO21434_KNOWLEDGE_POINTS,
  ISO21434_WOO_POINTS,
  ISO21434_EQUIPMENT_POINTS,
} from "./models/iso21434-core";

export {
  TVRA_FACTOR_LEVELS,
  TVRA_TIME_POINTS,
  TVRA_EXPERTISE_POINTS,
  TVRA_KNOWLEDGE_POINTS,
  TVRA_OPPORTUNITY_POINTS,
  TVRA_EQUIPMENT_POINTS,
  TVRA_INTENSITY_POINTS,
} from "./models/etsi-tvra-core";

// ==================== SERVICES ====================
export { riskService } from "./services/risk-service";
export { calculateRiskValues } from "./services/risk-calculation-service";

// ==================== COMPONENTS ====================
export { RisksTab } from "./components/risks-tab";
export { RiskTableView } from "./components/risk-table-view";
export { RiskConfigDialog } from "./components/risk-config-dialog";
export { RiskMatrix } from "./components/risk-matrix";
export { WontRiskTable } from "./components/wont-risk-table";

// ==================== DEFAULT EXPORT ====================
export { RisksTab as default } from "./components/risks-tab";

// ==================== UTILS ====================
export {
  iso21434AttackPotential,
  iso21434Feasibility,
  iso21434RateFeasibility,
} from "./models/iso21434-core";

export { tvraAttackPotential, tvraApLevel, tvraRate } from "./models/etsi-tvra-core";