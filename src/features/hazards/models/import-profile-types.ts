// features/hazards/models/import-profile-types.ts
//
// Fully flexible spreadsheet import. A safety Excel can put the wanted data on
// ANY sheet, header row and columns — even spread severity/probability across
// several "x"-marked columns. An ImportProfile captures all of that so the
// importer knows exactly where to start and how to read each field, and so the
// mapping can be saved and reused for the next identical customer template.

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
  /** Optional source-label -> canonical-value dictionary (e.g. "schwer" -> "catastrophic"). */
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
  // in ImportProfile ergänzen:
  metaColumns: MetaColumn[];
}

// ---- canonical value options (for the dialog dropdowns) ---------------------
// Kept here so the dialog and the validator agree. severity/probability mirror
// the SafetyHazard enums; hazardCategory mirrors the ISO 12100 list in shared.

export const SEVERITY_OPTIONS = [
  "negligible",
  "marginal",
  "critical",
  "catastrophic",
] as const;

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

/** Fields that may be expressed as an "x"-matrix marker group. */
export const MARKER_CAPABLE_FIELDS: readonly CanonicalField[] = [
  "severity",
  "probability",
  "hazardCategory",
];

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
    default:
      return [];
  }
}
