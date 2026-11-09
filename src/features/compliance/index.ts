// ==================== COMPLIANCE FEATURE INDEX ====================
// Public API of the compliance feature — IEC 62443-4-2 requirement matrices
// (classic 2019 and CRA edition prAA), iec-62443-4-2-cra-coverage.md §9.
// IEC-2a: types, evidence rules and the two editions; IEC-3: evaluator;
// CM-1: standard registry (model-coverage-implementation-plan.md §2.1);
// CM-11: EN 50742 Approach A module (§8.1).

// ==================== TYPES ====================
export type {
  AnyEdition,
  AnyEditionRow,
  AnyRequirementId,
  ChecklistAnswer,
  CraEssentialRequirement,
  DeviceCategory,
  Edition,
  EditionId,
  EditionRow,
  En50742RequirementId,
  EvidenceElementType,
  EvidenceQuantifier,
  EvidenceRule,
  EvidenceTarget,
  EvidenceType,
  ExternalEvidence,
  FoundationalRequirement,
  ProjectCheckId,
  NeighbourCheck,
  PropertyCheck,
  QualifiedRequirementId,
  RequirementId,
  RequirementNamespace,
  SecurityLevel,
  SlVector,
  StandardFamilyId,
} from "./models/compliance-types";
export type { En50742Risk, En50742SafetyFunction, En50742View, MandatedControl, SrslLevel, SrslSummary } from "./models/en50742-view";
export {
  EN50742_A_REQUIREMENT_IDS,
  FOUNDATIONAL_REQUIREMENTS,
  parseRequirementId,
  qualifyRequirementId,
  REQUIREMENT_IDS,
  REQUIREMENT_NAMESPACES,
} from "./models/compliance-types";

// ==================== DATA ====================
export { ALL_EVIDENCE_RULES, EVIDENCE_RULES } from "./data/evidence-rules";
export { EDITION_2019 } from "./data/edition-iec-62443-4-2-2019";
export { EDITION_EN50742_A, EN50742_A_GROUPS, type En50742Group } from "./data/edition-en-50742-a";
export { EN50742_A_RULES } from "./data/en50742-a-rules";
export { EN50742_A_TEXTS } from "./data/en50742-a-texts";
export { RULES_BY_ID, TEXTS_BY_ID } from "./data/requirement-registry";
export { EDITION_PRAA_2026 } from "./data/edition-en-iec-62443-4-2-praa-2026";

// ==================== EVALUATION ====================
export type {
  ComplianceInput,
  ComplianceResult,
  DeviceCategoryChoice,
  EvaluationRun,
  MatrixClaim,
  MitigationEvidence,
  PropertyView,
  RowResult,
  RowSource,
  RowStatement,
  RowStatus,
  StatementStatus,
  ViewElement,
  ViewFlow,
} from "./models/evaluation-types";
export { externalOutcome, srslReached, srslSummary, type ExternalOutcome } from "./services/evaluate-en50742";
export {
  countsForComponent,
  countsWithSupport,
  evaluateMatrix,
  vectorOf,
} from "./services/evaluate-matrix";
export {
  activeStandards,
  selectEdition,
  STANDARDS,
  TAG_EN_50742_A,
  TAG_EN_IEC_62443_CRA,
  TAG_IEC_62443,
  type StandardHeader,
  type StandardModule,
} from "./services/standard-registry";
export { buildPropertyView, type PropertyViewSource } from "./services/property-view";
export { proposeDeviceCategories, type DeviceCategoryProposal } from "./services/device-category";
export { editionStatements, statementKeyOf } from "./services/edition-statements";
export { buildTodoList, type ComponentTodo, type ElementTodo, type TodoItem, type TodoList, type TodoTarget } from "./services/todo-list";
export {
  mitigationRequirements,
  requirementsMetBy,
  ruleElementTypes,
  suggestMitigations,
  type MitigationRequirement,
  type MitigationRequirementSource,
  type PropertyEffect,
} from "./services/mitigation-requirements";
export { REQUIREMENT_TEXTS, type RequirementText } from "./data/requirement-texts";
export {
  describeLanguageOf,
  describeRequirement,
  describeRule,
  localizedChecklist,
  type DescribeLanguage,
  type RequirementDescription,
} from "./services/describe-requirement";

// ==================== UI ====================
export { ComplianceTab, type ComplianceTabProps } from "./components/compliance-tab";
export { ComplianceFrame, type ComplianceFrameProps } from "./components/compliance-frame";
// Multi-project TARA phase 4c: a claim of an imported component, citable in a row.
export type { ComponentClaimChoice } from "./components/matrix-claims";
