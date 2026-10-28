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
  PHASE_STATUS_KEY,
  STRIDE_COLORS,
} from "./models/common-types";

export type {
  ProjectData,
  FeatureTabProps,
  ProjectActions,
  ExportService,
  StorageService,
} from "./models/feature-interfaces";

// DFD
export type {
  LinkedDFDElement,
  DataFlowReference,
  SafetySeverityRef,
  SafetyAnnotationRef,
  DFDProcessRef,
  DFDReference,
  // Graph reference — full analysis graph snapshot consumed by threat
  // generators, risk analysis, and audit features.
  // Moved here from features/threats/models/threat-types so that
  // dfd-graph-builder.ts and to-reference-graph.ts can import without
  // creating a circular dependency back into the threat feature.
  DFDElementReference,
  DFDConnectionReference,
  DFDAssetReference,
  DataFlowAnalysisReference,
  TrustBoundaryAnalysisReference,
  DFDGraphReference,
} from "./models/dfd-reference-types";
export {
  hasDFDSafetyAnnotations,
  toGraphReference,
} from "./models/dfd-reference-types";

// Calculation stamp (ISO/SAE 21434 conformance plan 0c)
export type { CalcStamp } from "./models/calc-stamp";

// CIANAAA
export type {
  CIANAAALevel,
  SecurityGoalType,
  SecurityGoalReference,
} from "./models/cianaaa-reference-types";
export { CIANAAA_TO_STRIDE } from "./models/cianaaa-reference-types";
export {
  FEASIBILITY_BAND_MINIMA,
  feasibilityBandFor,
  feasibilityLevelToRiskScale,
  LEGACY_LEVEL_TO_RISK_SCALE,
} from "./models/attack-feasibility-bands";
export type {
  FeasibilityBandLevel,
  RiskScaleLevels,
} from "./models/attack-feasibility-bands";

// Asset
export type {
  AssetImpactRatingRef,
  AssetReference,
  AssetDataReference,
} from "./models/asset-reference-types";
export {
  hasSafetyData,
  getWorstCriterionValue,
  normaliseImpactValue,
} from "./models/asset-reference-types";

// Threat
export type {
  ThreatRelevanceRef,
  MitigationDraftRef,
  ThreatReference,
  ThreatGoalLink,
} from "./models/threat-reference-types";
export { RELEVANCE_COLORS } from "./models/threat-reference-types";
export {
  ATTACK_VECTORS,
  ATTACK_VECTOR_ALIASES,
  parseAttackVector,
} from "./models/attack-vector";
export type { AttackVector } from "./models/attack-vector";

export type { ControlInstance } from "./models/control-instance";

export type { AttackTreeLikelihoodReference } from "./models/attacktree-reference-types";

export {
  DEFAULT_REGULATION_PRESET,
  REGULATION_PRESETS,
  REGULATION_PRESET_IDS,
  WINDOW_OF_OPPORTUNITY_OPTIONS,
  WINDOW_OF_OPPORTUNITY_MULTIPLIERS,
  getRegulationPreset,
  getDisabledThreatGenerators,
  isThreatGeneratorEnabled,
  getRequiredImpactScale,
  type RegulationPreset,
  type RequiredImpactScale,
  type RegulationPresetId,
  type LikelihoodMethod,
  type ImpactAggregation,
  type WindowOfOpportunity,
} from "./models/regulation-preset";

export type {
  CredentialRef,
  DriftStatus,
  DriftEvent,
  LocalCheckoutHint,
  SourceBinding,
  SourceRefType,
} from "./models/source-binding-types";

// ==================== ITEM DEFINITION (ISO/SAE 21434 9.3) ====================
export {
  ITEM_SECTION_IDS,
  LIFECYCLE_PHASES,
  emptyItemDefinition,
  newAssumption,
  nextAssumptionDisplayId,
  type Assumption,
  type AssumptionStatus,
  type ItemDefinition,
  type ItemFunction,
  type ItemSection,
  type ItemSectionId,
  type LifecyclePhase,
  type SourceRef,
} from "./models/item-definition-types";

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
  EnvironmentAssetRelationType,
  AnyAssetRelationType,
} from "./models/asset-relation-union-types";

// ==================== SAFETY TYPES ====================
export type {
  PhysicalHazardPotential,
  SafetyRelevance,
  SafetyImpact,
  SafetyAnnotation,
  ValueSource,
} from "./models/safety-types";

export {
  isSafetyCritical,
  hasSafetyRelevance,
  createDefaultSafetyAnnotation,
  SAFETY_SEVERITIES,
  SAFETY_IMPACTS,
  SAFETY_SEVERITY_COLOR,
  safetyImpactI18nKey,
  safetyImpactRank,
  worseSafetyImpact,
  worstSafetySeverity,
  isIrreversibleOrWorse,
  isOverrideSeverity,
  safetySeverityToFactor,
  normalizeLegacySafetyImpact,
  iso26262SeverityClass,
  withSeverityClass,
  type Iso26262SeverityClass,
  type SafetySeverity,
} from "./models/safety-types";

// ==================== HAZARD TYPES ====================
export {
  DEFAULT_HAZARD_COMBINATION_TYPE,
  isContributesTo,
  isEndangers,
  type ContributesToRelation,
  type EndangersRelation,
  type HazardCategory,
  type HazardCombinationType,
  type HazardItem,
  type HazardItemId,
  type HazardRelation,
  type HazardSource,
} from "./models/hazard-types";
export {
  type HazardImpact,
  type HazardTargetKind,
  type HumanHarmSeverity,
  HUMAN_HARM_SEVERITY,
  SEVERITY_SCALE_BY_TARGET,
  isHumanImpact,
} from "./models/hazard-impact";
export {
  HAZARD_SEVERITY_RANK_COLOR,
  endangersSeverityRank,
  hazardSeverityRank,
  worstEndangersSeverity,
} from "./models/hazard-severity-display";

// ==================== UI COMPONENTS ====================
export { Button } from "./components/button";
export { Toast, ToastContainer } from "./components/toast";
export { Badge } from "./components/badge";
export { GenericAccordion } from "./components/generic-accordion";
export {
  GroupAccordions,
  type GroupAccordionSection,
  type GroupSummaryRow,
} from "./components/group-accordions";
export { LazyTooltip } from "./components/lazy-tooltip";
export { OuterHeader } from "./components/outer-header";
export { InnerHeader } from "./components/inner-header";
export { DFDPreviewPanel } from "./components/dfd-preview-panel";
export {
  TOP_LEVEL_GROUP,
  dfdItemRefOfThreat,
  groupsOfDfdItem,
  type DfdItemRef,
  type DfdTableGroup,
  type DfdTableGroups,
} from "./models/dfd-table-groups";
export {
  NO_DFD_SCOPE_FILTER,
  dfdItemOf,
  dfdScopePredicate,
  isDfdScopeFilterActive,
  pageWithSubPages,
  type DfdScopeFilter,
  type DfdScopeIndex,
  type DfdScopePage,
} from "./models/dfd-scope";
export { DfdScopeFilterControls } from "./components/dfd-scope-filter-controls";
export {
  dfdPreviewPagesOf,
  type DFDPreviewPage,
} from "./utils/dfd-preview-pages";
export { MitigationCoverageBadge } from "./components/mitigation-coverage-badge";
export {
  type DataColumn,
  DataTable,
  type DataTableProps,
} from "./components/data-table";

// ==================== DIALOGS ====================
export { ConfirmDialog } from "./components/dialogs/confirm-dialog";
export type {
  ConfirmDialogProps,
  ConfirmDialogVariant,
} from "./components/dialogs/confirm-dialog";

export { ConfirmDeleteDialog } from "./components/dialogs/confirm-delete-dialog";
export { ConfirmAssetDeleteDialog } from "./components/dialogs/confirm-asset-delete-dialog";
export type { ConfirmAssetDeleteDialogProps } from "./components/dialogs/confirm-asset-delete-dialog";

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
export { useSplitPercentResize } from "./hooks/use-split-percent-resize";
export { formatExportFilename } from "./utils/formatters";
export { formatRiskLabel } from "./models/risk-label";
export type { RiskLabelSource } from "./models/risk-label";
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
export {
  resolveThreatImpactAssets,
  violatesGoal,
  goalTypesFor,
} from "./utils/threat-impact";
export { formatAssetLabel } from "./utils/asset-label";
export {
  inspectDrawioPages,
  describeUnsupportedPageLayout,
} from "./utils/drawio-page-layout";
export type { DrawioPageLayout } from "./utils/drawio-page-layout";
export type { ThreatImpactAssets } from "./utils/threat-impact";
export {
  ELEMENT_TYPE_ORDER,
  STRIDE_ORDER,
  compareDisplayIds,
  compareElementTypes,
  compareStride,
  compareByTypeAndDisplayId,
} from "./utils/display-order";

export { type DFDAnalysisContext } from "./ports/dfd-analysis-context";

export {
  type CreatedAsset,
  createAsset,
  generateAssetId,
} from "./services/asset-creation";

// ==================== ASSET GROUP TYPES ====================
// Single source of truth for AssetGroup and A2ARelationType.
// Used by both dfd and assets features without cross-feature dependency.
export type { AssetGroup, A2ARelationType } from "./models/asset-group-types";

// ==================== ASSET-TO-ASSET RULES ====================
// Allowed A2A relation types per source × target group (Core Rules).
export {
  ALLOWED_A2A_RELATIONS,
  getAllowedA2ARelations,
  KERN_A2A_RELATIONS,
  isKernA2ARelation,
  getA2ARelationOptions,
  classifyA2ATargetGroup,
  classifyA2ATargets,
  A2A_MIRROR_PAIRS,
  getA2AMirror,
  A2A_INVERSE_NAMES,
  a2aRelationName,
  A2A_STEP_TYPES,
  a2aTypeHasStep,
} from "./models/asset-a2a-rules";
export type {
  A2ARelationOption,
  A2ATargetClass,
  A2ATargetClassification,
  A2AEdgeShape,
  A2AMirrorPair,
} from "./models/asset-a2a-rules";

// ==================== A2A RELATIONS (CANONICAL) ====================
// Edge-list shape (D1) and the single write path for A2A relations (AR-5).
export type {
  A2ARelation,
  A2ARelationAttributes,
} from "./models/a2a-relation-types";
export {
  addA2ARelation,
  removeA2ARelation,
  updateA2ARelationAttributes,
  changeA2ARelationType,
  relationsOfAsset,
  removeA2ARelationsOfAsset,
  validateA2ARelations,
  sortA2ARelations,
  findMirrorRelation,
  applyA2AOps,
} from "./services/a2a-relation-service";
export type {
  AssetGroupLookup,
  A2ARejection,
  A2AResult,
  A2AFinding,
  NewA2ARelation,
  A2AOp,
  A2AOpsResult,
} from "./services/a2a-relation-service";

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

export {
  regulationPresetFromTags,
  getRegulationConflicts,
  hasTagConflicts,
  getTagWarnings,
  requiresHazardAnalysis,
} from "./services/tag-validator";

export { SafetyAnalysisToggle } from "./components/safety-analysis-toggle";
export { ProjectTagsEditor } from "./components/project-tags-editor";
// Asset deletion impact (shared by the DFD and Asset tabs' confirm dialog).
export type {
  AssetUsage,
  AssetUsageBlocker,
  AssetUsageLookup,
} from "./models/asset-usage-types";
