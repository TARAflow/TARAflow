// ==================== COMPLIANCE FEATURE INDEX ====================
// Public API of the compliance feature — IEC 62443-4-2 requirement matrices
// (classic 2019 and CRA edition prAA), iec-62443-4-2-cra-coverage.md §9.
// IEC-2a: types, evidence rules and the two editions; IEC-3: evaluator;
// CM-1: standard registry (model-coverage-implementation-plan.md §2.1).

// ==================== TYPES ====================
export type {
  CraEssentialRequirement,
  DeviceCategory,
  Edition,
  EditionId,
  EditionRow,
  EvidenceElementType,
  EvidenceQuantifier,
  EvidenceRule,
  EvidenceTarget,
  EvidenceType,
  FoundationalRequirement,
  NeighbourCheck,
  PropertyCheck,
  QualifiedRequirementId,
  RequirementId,
  RequirementNamespace,
  SecurityLevel,
  SlVector,
  StandardFamilyId,
} from "./models/compliance-types";
export {
  FOUNDATIONAL_REQUIREMENTS,
  parseRequirementId,
  qualifyRequirementId,
  REQUIREMENT_IDS,
  REQUIREMENT_NAMESPACES,
} from "./models/compliance-types";

// ==================== DATA ====================
export { ALL_EVIDENCE_RULES, EVIDENCE_RULES } from "./data/evidence-rules";
export { EDITION_2019 } from "./data/edition-iec-62443-4-2-2019";
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
  TAG_EN_IEC_62443_CRA,
  TAG_IEC_62443,
  type StandardModule,
} from "./services/standard-registry";
export { buildPropertyView, type PropertyViewSource } from "./services/property-view";
export { proposeDeviceCategories, type DeviceCategoryProposal } from "./services/device-category";
export { editionStatements, statementKeyOf } from "./services/edition-statements";
export { buildTodoList, type ComponentTodo, type ElementTodo, type TodoItem, type TodoList } from "./services/todo-list";
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
  type DescribeLanguage,
  type RequirementDescription,
} from "./services/describe-requirement";

// ==================== UI ====================
export { ComplianceTab, type ComplianceTabProps } from "./components/compliance-tab";
export { ComplianceFrame, type ComplianceFrameProps } from "./components/compliance-frame";
