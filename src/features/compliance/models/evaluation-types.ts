// ==================== EVALUATION TYPES ====================
// Input and result of the matrix evaluator (iec-62443-4-2-cra-coverage.md
// §9.4). Plain data — the app layer builds the input from the project
// (component scope, property view per run, statements, claims, mitigations).

import type { RowReason } from "../services/row-reasons";
import type { ComplianceRowStatus, ComplianceStatement, DeviceCategoryChoice } from "shared";
import type {
  AnyEdition,
  EditionRow,
  RequirementId,
  SlVector,
} from "./compliance-types";
import type { En50742View, SrslSummary } from "./en50742-view";

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
  /**
   * Multiprocesses without a child page (leaves of the analysis view): they
   * contain processes and stores the model does not show. A rule on Process
   * or DataStore with no such element in scope is unknown there, not n/a
   * (D-30). Absent = none.
   */
  blackBoxes?: ReadonlySet<string>;
}

// ==================== ANALYST INPUT ====================

export type { StatementStatus } from "shared";

/** What the evaluator reads of a stored statement (D-8); wins over the model (§9.4 step 3). */
export type RowStatement = Pick<ComplianceStatement, "status" | "reasoning" | "supportingMeasure" | "modelStatusAtStatement">;

/** A claim covering rows of the matrix (D-5): another party covers the gap. */
export interface MatrixClaim {
  /** "CLM-03" */
  displayId: string;
  rowLabels: readonly string[];
  /**
   * A claim cited from an imported component (multi-project TARA phase 4c):
   * it covers only these elements — a row is claimed only when every
   * element still open there is one of them. Absent: the whole row (the
   * project's own claims).
   */
  concernsElementIds?: readonly string[];
  /** Its effectiveness in the instance (the I7 rule); absent = counts. */
  state?: "effective" | "unclear" | "not_effective";
}

/** A mitigation that names IEC 62443 requirements (D-6). */
export interface MitigationEvidence {
  mitigationId: string;
  requirementIds: readonly RequirementId[];
  /** In a done status (DONE_MITIGATION_STATUSES); the achieved run counts only these. */
  done: boolean;
  /** Elements the threats of its risks concern — must meet the component scope (D-16). */
  concernsElementIds: readonly string[];
  /**
   * Its effectiveness is unclear (multi-project TARA phase 4b: an imported
   * component's measure whose assumption of use lacks evidence here). Counts
   * in neither run — not as planned either: "planned" is coming, "unclear"
   * needs another action (evidence for the assumption). Shown on the row.
   */
  unclear?: boolean;
}

export type { DeviceCategoryChoice };

export type EvaluationRun = "achieved" | "planned";

export interface ComplianceInput {
  edition: AnyEdition;
  view: PropertyView;
  /** Element ids of the component and its descendants (D-7); flows touching them are in scope too. */
  scope: ReadonlySet<string>;
  /** The component under evaluation — model fields of the whole component are read on it (CM-6). */
  componentId?: string;
  run: EvaluationRun;
  /** Keyed by row label. */
  statements?: Readonly<Record<string, RowStatement>>;
  claims?: readonly MatrixClaim[];
  mitigations?: readonly MitigationEvidence[];
  deviceCategories?: DeviceCategoryChoice;
  /** EN 50742 A: risks, safety functions, hazards, WoO (CM-12); absent for other standards. */
  en50742?: En50742View;
}

// ==================== RESULT ====================

export type RowStatus = ComplianceRowStatus;

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
  /** FR for IEC 62443-4-2, the provision group for other standards. */
  group: string;
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
  /**
   * FX-21: unknown element id → its unset fields (property paths) the row
   * reads; absent where the unknown comes from a neighbour.
   */
  unsetFields?: Record<string, string[]>;
  /** EN 50742 A: risks (labels) that fail the row or are not rated yet. */
  risks?: string[];
  /** Environment elements that meet the row as a supporting measure (D-20). */
  supportingElements: string[];
  mitigationIds: string[];
  /** Mitigations naming the row whose effectiveness is unclear — not counted (phase 4b). */
  unclearMitigationIds?: string[];
  claimIds: string[];
  /**
   * Cited component claims on the row that do not count (phase 4c): unclear
   * (an assumption open / without implemented evidence) or not effective
   * (an assumption not fulfilled), or covering only part of the row's open
   * elements.
   */
  uncountedClaims?: { id: string; reason: "unclear" | "not_effective" | "partial" }[];
  /** Unmodelled criteria of type B rules. */
  checklist: string[];
  /** Why the row is n/a, derived or from the edition. */
  reasoning?: string;
  /** Why: the reason as a code with values — texts in the reader's language (0.19 i18n follow-up); absent on statement rows. */
  reason?: RowReason;
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
  /** EN 50742 A: the `srsl` header (coverage §9.3). */
  srsl?: SrslSummary;
}
