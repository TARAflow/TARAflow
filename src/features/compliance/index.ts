// ==================== COMPLIANCE FEATURE INDEX ====================
// Public API of the compliance feature — IEC 62443-4-2 requirement matrices
// (classic 2019 and CRA edition prAA), iec-62443-4-2-cra-coverage.md §9.
// IEC-2a: types, evidence rules and the two editions; IEC-3: evaluator and
// edition selection.

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
  RequirementId,
  SecurityLevel,
  SlVector,
} from "./models/compliance-types";
export { FOUNDATIONAL_REQUIREMENTS, REQUIREMENT_IDS } from "./models/compliance-types";

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
export { selectEdition, TAG_EN_IEC_62443_CRA, TAG_IEC_62443 } from "./services/select-edition";
export { buildPropertyView, type PropertyViewSource } from "./services/property-view";
