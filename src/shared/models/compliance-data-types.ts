// shared/models/compliance-data-types.ts
//
// Requirement matrices — the data stored in the project
// (iec-62443-4-2-cra-coverage.md D-8, schema 12; one block per standard
// family since schema 13, model coverage plan §2.4): the component under
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

/**
 * A standard family — the editions of one standard; statements and the
 * component are shared inside a family, never across (model coverage plan
 * §2.4, K-6). Further families (EN 303 645, EN 18031) join with their module.
 */
export type StandardFamilyId = "iec-62443-4-2";

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

/**
 * One standard family's data (model coverage plan §2.4, K-2, K-5, K-6):
 * everything the analyst sets for one standard. Removing the family's tag
 * keeps it — the sub-tab and its data return with the tag.
 */
export interface FamilyComplianceData {
  /** Overrides the default component for this family (K-5). */
  componentId?: string;
  /** Target level per group (D-2) — IEC 62443-4-2: SL-T per FR; a group without a target is not set. */
  target?: Partial<Record<string, TargetSecurityLevel>>;
  /** Device categories of the component — IEC 62443-4-2:2019 only (K-C1). */
  deviceCategories?: DeviceCategoryChoice;
  /**
   * Statements per requirement (D-31): keyed by the requirement ids of the
   * row (requirementKey) — a statement describes the product, not the
   * edition, so it holds in every edition of the family wherever the
   * requirement is the same. Never shared across families (K-6).
   */
  statements?: Record<string, ComplianceStatement>;
}

/**
 * The matrix data of the project (schema 13). Schema 12 held one family's
 * fields (target, deviceCategories, statements) at the top level;
 * migrate-12-to-13 moves them 1:1 into families["iec-62443-4-2"].
 */
export interface ComplianceData {
  /** Element id of the component under evaluation, default for every family; absent = the whole model (D-7). */
  componentId?: string;
  families?: Partial<Record<StandardFamilyId, FamilyComplianceData>>;
}

/** The key of a row's statement: its requirement ids, sorted, "+"-joined (D-31). */
export function requirementKey(requirementIds: readonly string[]): string {
  return [...requirementIds].sort().join("+");
}

// ==================== READ ====================

const NO_FAMILY_DATA: FamilyComplianceData = Object.freeze({});

/** A family's data; an empty object when nothing is stored yet. */
export function familyCompliance(data: ComplianceData | undefined, family: StandardFamilyId): FamilyComplianceData {
  return data?.families?.[family] ?? NO_FAMILY_DATA;
}

/** The component a family evaluates: its own, else the default (K-5). */
export function complianceComponentOf(data: ComplianceData | undefined, family: StandardFamilyId): string | undefined {
  return data?.families?.[family]?.componentId ?? data?.componentId;
}

// ==================== HELPERS ====================
// Pure updates for the UI (IEC-8); `undefined` data = nothing stored yet.

function withFamily(
  data: ComplianceData | undefined,
  family: StandardFamilyId,
  update: (current: FamilyComplianceData) => FamilyComplianceData,
): ComplianceData {
  return { ...data, families: { ...data?.families, [family]: update(familyCompliance(data, family)) } };
}

/** `key`: requirementKey of the row the statement is made on. */
export function withComplianceStatement(
  data: ComplianceData | undefined,
  family: StandardFamilyId,
  key: string,
  statement: ComplianceStatement,
): ComplianceData {
  return withFamily(data, family, (f) => ({ ...f, statements: { ...f.statements, [key]: statement } }));
}

export function withoutComplianceStatement(data: ComplianceData | undefined, family: StandardFamilyId, key: string): ComplianceData {
  return withFamily(data, family, (f) => {
    const { [key]: _removed, ...rest } = f.statements ?? {};
    return { ...f, statements: rest };
  });
}

export function withComplianceTarget(
  data: ComplianceData | undefined,
  family: StandardFamilyId,
  group: string,
  level: TargetSecurityLevel | undefined,
): ComplianceData {
  return withFamily(data, family, (f) => {
    const { [group]: _old, ...rest } = f.target ?? {};
    return { ...f, target: level === undefined ? rest : { ...rest, [group]: level } };
  });
}

/**
 * A changed device category never deletes statements: rows that no longer
 * apply show them as superseded (K-C1, evaluator step 2).
 */
export function withDeviceCategories(
  data: ComplianceData | undefined,
  family: StandardFamilyId,
  choice: DeviceCategoryChoice | undefined,
): ComplianceData {
  return withFamily(data, family, (f) => {
    const { deviceCategories: _old, ...rest } = f;
    return choice ? { ...rest, deviceCategories: { categories: [...choice.categories], source: choice.source } } : rest;
  });
}

/** Sets the default component (every family without its own, K-5). */
export function withComplianceComponent(data: ComplianceData | undefined, componentId: string | undefined): ComplianceData {
  const { componentId: _old, ...rest } = data ?? {};
  return componentId ? { ...rest, componentId } : rest;
}
