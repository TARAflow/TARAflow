// shared/models/compliance-data-types.ts
//
// IEC 62443-4-2 requirement matrix — the data stored in the project
// (iec-62443-4-2-cra-coverage.md D-8, schema 12): the component under
// evaluation (D-7), the target SL-C vector (D-2), the device categories of
// the 2019 edition with their origin (K-C1) and the analyst statements per
// row (D-8, D-17). Everything else of the matrix is derived from the model
// by the compliance feature.
//
// In shared: the app stores and edits it, the compliance feature evaluates
// it, the report renders it — no feature imports another.

// ==================== PRIMITIVES ====================

export const FOUNDATIONAL_REQUIREMENTS = ["IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"] as const;

/** FR 1 … FR 7 by their SL-C abbreviation. */
export type FoundationalRequirement = (typeof FOUNDATIONAL_REQUIREMENTS)[number];

/** A level 1 … 4 an analyst can target. */
export type TargetSecurityLevel = 1 | 2 | 3 | 4;

export type ComplianceEditionId = "iec-62443-4-2-2019" | "en-iec-62443-4-2-praa-2026";

/** 2019 component types (Clauses 12–15). */
export type DeviceCategory = "SAR" | "EDR" | "HDR" | "NDR";

/** Result of one matrix row (iec-62443-4-2-cra-coverage.md §9.4). */
export type ComplianceRowStatus =
  | "met"
  | "claimed"
  | "n/a"
  | "unknown"
  | "pending-category"
  | "needs-statement"
  | "gap";

export type StatementStatus = "met" | "not-met" | "n/a";

// ==================== STORED DATA ====================

/** Analyst statement on one row; wins over the model (D-8). */
export interface ComplianceStatement {
  status: StatementStatus;
  reasoning: string;
  /** Names the supporting measure that meets the row (D-14, D-20). */
  supportingMeasure?: string;
  /** Where the evidence is, e.g. a test report or a manual section. */
  evidenceRef?: string;
  /** The model result when the statement was made (D-17). */
  modelStatusAtStatement?: ComplianceRowStatus;
  /** ISO date of the statement. */
  date: string;
}

export interface DeviceCategoryChoice {
  categories: DeviceCategory[];
  /** "derived" = proposal from the model, not yet confirmed (K-C1). */
  source: "derived" | "manual";
}

export interface ComplianceData {
  /** Element id of the component under evaluation; absent = the whole model (D-7). */
  componentId?: string;
  /** Target SL-C per FR (D-2); an FR without a target is not set. */
  target?: Partial<Record<FoundationalRequirement, TargetSecurityLevel>>;
  /** Device categories of the component — 2019 edition only (K-C1). */
  deviceCategories?: DeviceCategoryChoice;
  /**
   * Statements per edition and row label: the editions number their rows
   * differently, and switching the tags must not lose either set.
   */
  statements?: Partial<Record<ComplianceEditionId, Record<string, ComplianceStatement>>>;
}

// ==================== HELPERS ====================
// Pure updates for the UI (IEC-8); `undefined` data = nothing stored yet.

export function withComplianceStatement(
  data: ComplianceData | undefined,
  edition: ComplianceEditionId,
  rowLabel: string,
  statement: ComplianceStatement,
): ComplianceData {
  const statements = data?.statements ?? {};
  return { ...data, statements: { ...statements, [edition]: { ...(statements[edition] ?? {}), [rowLabel]: statement } } };
}

export function withoutComplianceStatement(
  data: ComplianceData | undefined,
  edition: ComplianceEditionId,
  rowLabel: string,
): ComplianceData {
  const { [rowLabel]: _removed, ...rest } = data?.statements?.[edition] ?? {};
  return { ...data, statements: { ...data?.statements, [edition]: rest } };
}

export function withComplianceTarget(
  data: ComplianceData | undefined,
  fr: FoundationalRequirement,
  level: TargetSecurityLevel | undefined,
): ComplianceData {
  const { [fr]: _old, ...rest } = data?.target ?? {};
  return { ...data, target: level === undefined ? rest : { ...rest, [fr]: level } };
}

/**
 * A changed device category never deletes statements: rows that no longer
 * apply show them as superseded (K-C1, evaluator step 2).
 */
export function withDeviceCategories(data: ComplianceData | undefined, choice: DeviceCategoryChoice | undefined): ComplianceData {
  const { deviceCategories: _old, ...rest } = data ?? {};
  return choice ? { ...rest, deviceCategories: { categories: [...choice.categories], source: choice.source } } : rest;
}

export function withComplianceComponent(data: ComplianceData | undefined, componentId: string | undefined): ComplianceData {
  const { componentId: _old, ...rest } = data ?? {};
  return componentId ? { ...rest, componentId } : rest;
}
