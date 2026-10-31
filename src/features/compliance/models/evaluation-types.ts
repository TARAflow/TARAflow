// ==================== EVALUATION TYPES ====================
// Input and result of the matrix evaluator (iec-62443-4-2-cra-coverage.md
// §9.4). Plain data — the app layer builds the input from the project
// (component scope, property view per run, statements, claims, mitigations).

import type {
  DeviceCategory,
  Edition,
  EditionRow,
  FoundationalRequirement,
  RequirementId,
  SlVector,
} from "./compliance-types";

// ==================== PROPERTY VIEW ====================

/** An element of the analysis graph (leaf of the effective model, D-24). */
export interface ViewElement {
  id: string;
  /** DFD element type, e.g. "Process", "Interface". */
  type: string;
  properties?: Record<string, unknown>;
}

/** A flow sender → receiver; interfaces sit on flows, never at their ends (D-24). */
export interface ViewFlow {
  id: string;
  from: string;
  to: string;
  properties?: Record<string, unknown>;
}

/**
 * What the evaluator sees of the model in one run (D-4): achieved = the IS
 * properties, planned = the IS properties overlaid with the SHOULD values of
 * the chosen mitigations.
 */
export interface PropertyView {
  elements: readonly ViewElement[];
  /**
   * Every drawn flow with its resolved endpoints, including flows excluded
   * from threat generation (excludeFromThreatGen) — excluding a flow from
   * the threats says nothing about who accesses the component, so it counts
   * as a neighbour relation (D-24). Analysis view: `validationConnections`.
   */
  flows: readonly ViewFlow[];
  /**
   * Elements inside a decomposed multiprocess that a flow reaches only in
   * fallback state (drawn to the multiprocess, never below it): neighbour
   * checks on them are unknown, never n/a (D-24).
   */
  fallbackContained?: ReadonlySet<string>;
}

// ==================== ANALYST INPUT ====================

export type StatementStatus = "met" | "not-met" | "n/a";

/** Analyst statement on one row (D-8); wins over the model (§9.4 step 3). */
export interface RowStatement {
  status: StatementStatus;
  reasoning: string;
  /** Names the supporting measure that meets the row (D-14, D-20). */
  supportingMeasure?: string;
  /** The model result when the statement was made (D-17). */
  modelStatusAtStatement?: RowStatus;
}

/** A claim covering rows of the matrix (D-5): another party covers the gap. */
export interface MatrixClaim {
  /** "CLM-03" */
  displayId: string;
  rowLabels: readonly string[];
}

/** A mitigation that names IEC 62443 requirements (D-6). */
export interface MitigationEvidence {
  mitigationId: string;
  requirementIds: readonly RequirementId[];
  /** In a done status (DONE_MITIGATION_STATUSES); the achieved run counts only these. */
  done: boolean;
  /** Elements the threats of its risks concern — must meet the component scope (D-16). */
  concernsElementIds: readonly string[];
}

/** Device categories of the component (2019 edition, K-C1). */
export interface DeviceCategoryChoice {
  categories: readonly DeviceCategory[];
  /** "derived" = proposal, not yet confirmed → device rows pending. */
  source: "derived" | "manual";
}

export type EvaluationRun = "achieved" | "planned";

export interface ComplianceInput {
  edition: Edition;
  view: PropertyView;
  /** Element ids of the component and its descendants (D-7); flows touching them are in scope too. */
  scope: ReadonlySet<string>;
  run: EvaluationRun;
  /** Keyed by row label. */
  statements?: Readonly<Record<string, RowStatement>>;
  claims?: readonly MatrixClaim[];
  mitigations?: readonly MitigationEvidence[];
  deviceCategories?: DeviceCategoryChoice;
}

// ==================== RESULT ====================

export type RowStatus =
  | "met"
  | "claimed"
  | "n/a"
  | "unknown"
  | "pending-category"
  | "needs-statement"
  | "gap";

export type RowSource =
  | "model"
  | "mitigation"
  | "supporting-measure"
  | "statement"
  | "claim"
  | "edition"
  | "device-category";

export interface RowResult {
  label: string;
  fr: FoundationalRequirement;
  minSl: EditionRow["minSl"];
  status: RowStatus;
  /** Where the status comes from — the report names it (§5). */
  source?: RowSource;
  /** Status from the model alone (no statement) — compared with the statement's snapshot (D-17). */
  modelStatus: RowStatus;
  /** Applicable elements that clearly fail. */
  failing: string[];
  /** Elements whose applicability or satisfaction is unknown (D-12). */
  unknown: string[];
  /** Environment elements that meet the row as a supporting measure (D-20). */
  supportingElements: string[];
  mitigationIds: string[];
  claimIds: string[];
  /** Unmodelled criteria of type B rules. */
  checklist: string[];
  /** Why the row is n/a, derived or from the edition. */
  reasoning?: string;
  /** A done mitigation meets the row while the model shows it not met (D-21). */
  contradiction?: boolean;
  /** The statement's snapshot differs from the current model result (D-17). */
  statementModelChanged?: boolean;
  /** A statement on a device row that no longer applies is kept, not deleted (K-C1). */
  statementSuperseded?: boolean;
  /** The statement names a supporting measure. */
  statementSupportingMeasure?: string;
  supportingMeasuresAllowed: boolean;
}

export interface ComplianceResult {
  rows: RowResult[];
  /** SL-C (component): model / mitigation, allowed supporting measures, n/a (D-14). */
  component: SlVector;
  /** SL-C with supporting measures and claims (D-14). */
  withSupport: SlVector;
}
