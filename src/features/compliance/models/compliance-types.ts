// ==================== COMPLIANCE TYPES ====================
// IEC 62443-4-2 requirement matrices — classic 2019 edition and the CRA
// edition EN IEC 62443-4-2/prAA (iec-62443-4-2-cra-coverage.md §9,
// iec-62443-4-2-2019-coverage.md).
//
// Two kinds of data (D-11):
//   evidence rules  one per stable RequirementId — how the model shows that a
//                   requirement applies and is met; shared by both editions
//   edition rows    per edition — the rows the standard lists, their lowest
//                   SL-C and the requirement ids they consist of; a content
//                   difference between editions is a separate id, never a
//                   silent fallback to the other edition

// ==================== FOUNDATIONAL REQUIREMENTS ====================

export const FOUNDATIONAL_REQUIREMENTS = ["IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"] as const;

/** FR 1 … FR 7 by their SL-C abbreviation. */
export type FoundationalRequirement = (typeof FOUNDATIONAL_REQUIREMENTS)[number];

/** Capability security level; 0 = no level reached. */
export type SecurityLevel = 0 | 1 | 2 | 3 | 4;

/** Value per FR (D-2). */
export type SlVector = Record<FoundationalRequirement, SecurityLevel>;

// ==================== EVIDENCE RULES ====================

/** Element types of the analysis graph; "DataFlow" = a connection. */
export type EvidenceElementType =
  | "Process"
  | "Multiprocess"
  | "DataStore"
  | "DataFlow"
  | "ExternalEntity"
  | "Interface"
  | "TrustBoundary"
  | "ChipBoundary"
  | "PhysicalBoundary";

/**
 * One property check. With `in` the value must be one of them, with `notIn`
 * it must be set and none of them, with neither it must be set. Array values
 * (multi-select properties) match when any entry matches. An unset property
 * makes the check `unknown` (D-12). Paths and values are checked against the
 * element property types by the conformance test in src/tests (D-15, D-18).
 */
export interface PropertyCheck {
  /** Dot path into the element's properties, e.g. "implementedControls.debugProtection". */
  property: string;
  in?: readonly unknown[];
  notIn?: readonly unknown[];
}

/**
 * Elements a rule looks at (D-13). An element of `elementTypes` is applicable
 * when every `appliesIf` check holds (absent = every element of the types) and,
 * for data flows, when the source or the target element passes `endpointIf`.
 * It satisfies the requirement when any `satisfiedIf` check holds.
 */
export interface EvidenceTarget {
  elementTypes: readonly EvidenceElementType[];
  appliesIf?: readonly PropertyCheck[];
  endpointIf?: {
    elementTypes: readonly EvidenceElementType[];
    checks: readonly PropertyCheck[];
  };
  satisfiedIf?: readonly PropertyCheck[];
}

/**
 * A = derivable from properties · B = partly (the property shows the
 * mechanism, the unmodelled criteria are a checklist) · C = analyst statement,
 * mitigation reference or claim needed.
 */
export type EvidenceType = "A" | "B" | "C";

/**
 * "all" (default): every applicable element in scope must satisfy (D-13).
 * "any": a capability of the component as a whole — one element suffices;
 * only these rules get automatic supporting measures (D-20).
 */
export type EvidenceQuantifier = "all" | "any";

export interface EvidenceRule {
  id: RequirementId;
  type: EvidenceType;
  /**
   * Component-level precondition: the row applies only if some element in
   * scope is applicable for one of these targets (e.g. "public-key
   * authentication is used"); none → n/a, only unknowns → unknown. Absent =
   * applicability comes from `targets` alone.
   */
  appliesWhen?: readonly EvidenceTarget[];
  /** Empty = the component as a whole (always applicable). */
  targets: readonly EvidenceTarget[];
  quantifier?: EvidenceQuantifier;
  /** Criteria the model cannot show (type B); paraphrased, i18n in IEC-2b. */
  checklist?: readonly string[];
}

// ==================== REQUIREMENT IDS ====================
// Stable ids of the requirement concepts. An id is never reused: changed
// content gets a new id (e.g. 2019 CR 4.1 = cr-4.1-transit + cr-4.1-rest).

export const REQUIREMENT_IDS = [
  // FR 1
  "cr-1.1", "cr-1.1-re1", "cr-1.1-re2",
  "cr-1.2", "cr-1.2-re1",
  "cr-1.3", "cr-1.4",
  "cr-1.5", "cr-1.5-re1",
  "cr-1.6", "cr-1.6-re1",
  "cr-1.7", "cr-1.7-re1-human", "cr-1.7-re2-all-users", "cr-1.7-re2-machines",
  "cr-1.8", "cr-1.9", "cr-1.9-re1",
  "cr-1.10", "cr-1.11", "cr-1.12",
  "cr-1.13", "cr-1.13-re1",
  "cr-1.14", "cr-1.14-re1",
  // FR 2
  "cr-2.1", "cr-2.1-re1", "cr-2.1-re2", "cr-2.1-re3", "cr-2.1-re4",
  "cr-2.2",
  "cr-2.4", "cr-2.4-re1",
  "cr-2.5", "cr-2.6", "cr-2.7",
  "cr-2.8", "cr-2.8-re1",
  "cr-2.9", "cr-2.9-re1",
  "cr-2.10",
  "cr-2.11", "cr-2.11-re1", "cr-2.11-re2",
  "cr-2.12", "cr-2.12-re1",
  "cr-2.13", "cr-2.13-re1",
  // FR 3
  "cr-3.1", "cr-3.1-re1",
  "cr-3.2", "cr-3.2-re1", "sar-3.2-qualify", "edr-3.2-unauthorized-software", "hdr-3.2-re1-report-version",
  "cr-3.3", "cr-3.3-re1",
  "cr-3.4", "cr-3.4-re1", "cr-3.4-re2",
  "cr-3.5", "cr-3.6", "cr-3.7", "cr-3.8",
  "cr-3.9", "cr-3.9-re1",
  "cr-3.10", "cr-3.10-re1", "cr-3.10-re2",
  "cr-3.11", "cr-3.11-re1",
  "cr-3.12", "cr-3.13",
  "cr-3.14", "cr-3.14-re1",
  // FR 4
  "cr-4.1-transit", "cr-4.1-rest",
  "cr-4.2", "cr-4.2-re1", "cr-4.2-re2",
  "cr-4.3",
  // FR 5
  "cr-5.1",
  "cr-5.2", "cr-5.2-re1", "cr-5.2-re2", "cr-5.2-re3",
  "ndr-5.3",
  // FR 6
  "cr-6.1", "cr-6.1-re1", "cr-6.2",
  // FR 7
  "cr-7.1", "cr-7.1-re1",
  "cr-7.2",
  "cr-7.3", "cr-7.3-re1",
  "cr-7.4",
  "cr-7.6", "cr-7.6-re1",
  "cr-7.7", "cr-7.8", "cr-7.9",
] as const;

export type RequirementId = (typeof REQUIREMENT_IDS)[number];

// ==================== EDITIONS ====================

export type EditionId = "iec-62443-4-2-2019" | "en-iec-62443-4-2-praa-2026";

/** 2019 component types (Clauses 12–15); prAA has CRs only. */
export type DeviceCategory = "SAR" | "EDR" | "HDR" | "NDR";

/** CRA Annex I Part I: "1" or a letter of (2). */
export type CraEssentialRequirement =
  | "1" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m";

export interface EditionRow {
  /** Row label as the standard numbers it, e.g. "CR 1.1 RE(1)", "EDR 3.10". */
  label: string;
  fr: FoundationalRequirement;
  /** Lowest SL-C at which the row is selected (x.y.4); null for void rows. */
  minSl: Exclude<SecurityLevel, 0> | null;
  /** Requirement ids the row consists of — all must be met. Empty only for void rows. */
  requirementIds: readonly RequirementId[];
  /** Void / "no component requirement" in this edition, with the reason. */
  void?: string;
  /**
   * The requirement text lets the component meet it directly or by
   * supporting measures (prAA) / integrated into a system (2019) — then a
   * supporting measure counts for SL-C (component) (D-14).
   */
  supportingMeasuresAllowed: boolean;
  /** 2019 device rows: the categories the row applies to; absent = every component. */
  deviceCategories?: readonly DeviceCategory[];
  /** prAA: CRA Annex I Part I requirements (Annex ZZ). */
  cra?: readonly CraEssentialRequirement[];
  /** prAA draft line number of the requirement heading. */
  sourceLine?: number;
}

export interface Edition {
  id: EditionId;
  /** Shown in the report header. */
  title: string;
  /** True while the edition is a draft (prAA enquiry draft). */
  draft: boolean;
  /** Name of CCSC 2 in this edition. */
  ccsc2Label: string;
  rows: readonly EditionRow[];
}
