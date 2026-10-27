// features/hazards/models/import-profile-types.ts
//
// Fully flexible spreadsheet import. A safety Excel can put the wanted data on
// ANY sheet, header row and columns — even spread severity/probability across
// several "x"-marked columns. An ImportProfile captures all of that so the
// importer knows exactly where to start and how to read each field, and so the
// mapping can be saved and reused for the next identical customer template.

import { SAFETY_IMPACTS } from "shared";
import type { CanonicalField } from "../services/safety-hazard-importer";
export type { CanonicalField } from "../services/safety-hazard-importer";

// ---- raw workbook preview (produced by the tabular adapters) ----------------

export type CellValue = string | number | boolean | null;

export interface SheetGrid {
  name: string;
  /** Array-of-arrays: rows[r][c]. Empty cells are null. Header NOT assumed. */
  rows: CellValue[][];
}

export interface WorkbookPreview {
  format: "spreadsheet" | "csv";
  sheets: SheetGrid[];
}

// ---- profile ----------------------------------------------------------------

/** Single source column -> one field (0-based column index). */
export interface FieldColumnMapping {
  field: CanonicalField;
  column: number;
  /** Optional source-label -> canonical-value dictionary (e.g. "VS 4" -> "irreversible_major"). */
  valueMap?: Record<string, string>;
}

/** One column of a marker group: if its cell is non-empty, the field takes `value`. */
export interface MarkerColumn {
  column: number;
  value: string; // canonical value for this level (e.g. "critical")
}

/** Several columns -> one field; the marked column wins (the "x"-matrix case). */
export interface MarkerGroup {
  field: CanonicalField;
  columns: MarkerColumn[];
}

export interface MetaColumn {
  key: string; // provenance key, e.g. "Schutzziel"
  column: number; // -1 = not yet picked
}

export interface ImportProfile {
  id: string;
  name: string;
  format: "spreadsheet" | "csv";
  /** Sheet to read. Undefined/ignored for single-sheet CSV. */
  sheetName?: string;
  /** 0-based header row (for column hints only; data is read by index). */
  headerRow: number;
  /** 0-based first data row. */
  dataStartRow: number;
  /**
   * Optional regex (as string) applied to the id cell. Rows whose id does not
   * match are skipped — this drops interleaved section/group rows (e.g. "00").
   * Empty/undefined = no filtering.
   */
  idPattern?: string;
  /** Single-column fields. */
  columns: FieldColumnMapping[];
  /** Multi-column (x-matrix) fields: severity, probability, hazardCategory. */
  markerGroups: MarkerGroup[];
  /** Extra columns kept as provenance in importMeta. */
  metaColumns: MetaColumn[];
  /**
   * Affected persons for rows without a value in the person column, or when no
   * column is mapped (HI-2) — a risk assessment often has no such column.
   */
  defaultAffectedPersons?: string[];
  /**
   * Characters that separate several values in one cell (HI-3). Default
   * DEFAULT_LIST_SEPARATOR (",/"); set to "," to keep "Bediener/Einrichter"
   * as one person.
   */
  listSeparator?: string;
}

/** Where a stored profile was last used (HI-9) — the basis of a re-import. */
export interface ImportProfileSource {
  fileName: string;
  sheetName?: string;
  /** Header row as it read at the last import, one entry per column. */
  header: string[];
}

/**
 * A profile stored in the project file (HI-9, `HazardData.importProfiles`).
 * Optional fields under `hazards`: an older TARAflow keeps them on save (all
 * hazard write paths spread the existing object), so no schema fence —
 * guarded by hazard-data-passthrough.test.ts (design D4).
 */
export interface StoredImportProfile extends ImportProfile {
  source?: ImportProfileSource;
  /** ISO timestamp of the last import with this profile. */
  lastUsed?: string;
}

/** Today's behaviour: split lists at "," and "/". */
export const DEFAULT_LIST_SEPARATOR = ",/";

/** Split a cell at any of the separator characters; trimmed, empties dropped. */
export function splitList(value: string, separator: string = DEFAULT_LIST_SEPARATOR): string[] {
  const chars = [...(separator || DEFAULT_LIST_SEPARATOR)];
  const parts = chars.reduce<string[]>((acc, c) => acc.flatMap((p) => p.split(c)), [value]);
  return parts.map((s) => s.trim()).filter(Boolean);
}

// ---- canonical value options (for the dialog dropdowns) ---------------------
// Kept here so the dialog and the validator agree. severity is the canonical
// person-harm scale with "none" = no injury / S0 first (HI-1, HI-1b), probability mirrors the
// SafetyHazard enum; hazardCategory mirrors the ISO 12100 list in shared.
// The legacy severity values stay valid input but are no longer offered.

export const SEVERITY_OPTIONS = SAFETY_IMPACTS;

export const PROBABILITY_OPTIONS = [
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
] as const;

export const HAZARD_CATEGORY_OPTIONS = [
  "mechanical",
  "electrical",
  "thermal",
  "noise",
  "vibration",
  "radiation",
  "material_substance",
  "ergonomic",
  "environment",
  "combined",
  "other",
] as const;

/** ISO 12100 three-step method (HI-5). */
export const PROTECTIVE_MEASURE_TYPE_OPTIONS = ["inherent", "technical", "information", "combined"] as const;
/** EN ISO 13849-1 Annex A risk graph and performance levels (HI-5). */
export const RISK_GRAPH_S_OPTIONS = ["S1", "S2"] as const;
export const RISK_GRAPH_F_OPTIONS = ["F1", "F2"] as const;
export const RISK_GRAPH_P_OPTIONS = ["P1", "P2"] as const;
export const PERFORMANCE_LEVEL_OPTIONS = ["a", "b", "c", "d", "e"] as const;

/** Fields whose values the dialog maps onto canonical options (value map / x-matrix). */
export const VALUE_MAPPED_FIELDS: readonly CanonicalField[] = [
  "severity",
  "probability",
  "hazardCategory",
  "protectiveMeasureType",
  "riskGraphS",
  "riskGraphF",
  "riskGraphP",
  "plRequired",
  "plAchieved",
];

/** Fields that may be expressed as an "x"-matrix marker group. */
export const MARKER_CAPABLE_FIELDS: readonly CanonicalField[] = VALUE_MAPPED_FIELDS;

/** Fields holding several values in one cell, split with the list separator (HI-5). */
export const MULTI_VALUE_FIELDS: readonly CanonicalField[] = ["lifecyclePhase"];

export const PHYSICAL_HAZARD_POTENTIAL_OPTIONS = [
  "low",
  "medium",
  "high",
] as const;

export function markerValueOptions(field: CanonicalField): readonly string[] {
  switch (field) {
    case "severity":
      return SEVERITY_OPTIONS;
    case "probability":
      return PROBABILITY_OPTIONS;
    case "hazardCategory":
      return HAZARD_CATEGORY_OPTIONS;
    case "protectiveMeasureType":
      return PROTECTIVE_MEASURE_TYPE_OPTIONS;
    case "riskGraphS":
      return RISK_GRAPH_S_OPTIONS;
    case "riskGraphF":
      return RISK_GRAPH_F_OPTIONS;
    case "riskGraphP":
      return RISK_GRAPH_P_OPTIONS;
    case "plRequired":
    case "plAchieved":
      return PERFORMANCE_LEVEL_OPTIONS;
    default:
      return [];
  }
}
