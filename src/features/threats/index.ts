// ==================== TYPES ====================
export type {
  AssetReference,
  AssetDataReference,
  StrideMethod,
  ThreatProjectData,
  ThreatData,
  ThreatUpdateResult,
  Threat,
  ThreatTable,
  ThreatConfiguration,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
  ThreatSyncStatus,
  ThreatSyncResult,
  DFDConnectionReference,
} from "./models/threat-types";

export type { LinkedDFDElement } from "./models/per-element-types";

export type {
  DataFlowReference,
  InteractionContext,
  InteractionDirection,
} from "./models/per-interaction-types";

export type {
  DFDGraphReference,
  DataFlowAnalysisReference,
  TrustBoundaryAnalysisReference,
} from "./models/threat-types";

// ==================== COMPONENTS ====================
export { ThreatsTab } from "./components/threats-tab";
export { ThreatDialog } from "./components/shared/threat-dialog";
export { ThreatConfigDialog } from "./components/shared/threat-config-dialog";

// Shared Components
export { ThreatToolbar } from "./components/shared/threat-toolbar";
export { ThreatFilters } from "./components/shared/threat-filters";
export { ThreatSyncBanner } from "./components/shared/threat-sync-banner";

// Per-Element Components
export { ElementThreatsView } from "./components/per-element/element-threats-view";
export { ElementThreatTable } from "./components/per-element/element-threat-table";

// Per-Interaction Components
export { InteractionThreatsView } from "./components/per-interaction/interaction-threats-view";
export { InteractionThreatTable } from "./components/per-interaction/interaction-threat-table";

// ==================== HOOKS ====================
export { useThreatFilters } from "./hooks/shared/use-threat-filters";
export { useThreatValidation } from "./hooks/shared/use-threat-validation";
export { useElementThreats } from "./hooks/per-element/use-element-threats";
export { useInteractionThreats } from "./hooks/per-interaction/use-interaction-threats";

// Hook Types
export type { UseThreatFiltersResult } from "./hooks/shared/use-threat-filters";

export type { ValidationResult } from "./hooks/shared/use-threat-validation";

export type {
  UseElementThreatsResult,
  UseElementThreatsOptions,
} from "./hooks/per-element/use-element-threats";

export type {
  UseInteractionThreatsResult,
  UseInteractionThreatsOptions,
} from "./hooks/per-interaction/use-interaction-threats";

// ==================== SERVICES ====================
// Base Service Types
export type {
  ThreatService,
  ThreatCatalog,
  GenerationResult,
  ValidationResult as ServiceValidationResult,
  StatisticsResult,
} from "./services/threat-service";

// Per-Element Service
export { elementThreatService } from "./services/per-element/element-threat-service";

// Per-Interaction Service
export { interactionThreatService } from "./services/per-interaction/interaction-threat-service";

// ==================== UTILITIES ====================
export {
  getLocalizedThreatText,
  shouldUseTemplateLocalization,
  getSuggestedMitigations,
  getEffectiveThreatDescription,
  getEffectiveAttackDescription,
  formatInteractionDirection,
  getDirectionColor,
} from "./services/interaction-templates";

export {
  createDefaultThreatData,
  createEmptyThreat,
  getActiveThreatTables,
  isInterfaceTable,
  isInterfaceThreat,
} from "./models/threat-types";

export { formatDataFlowDisplay } from "./models/per-interaction-types";