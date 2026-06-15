// shared/services/safety-hazard-importer.ts
//
// Adapter architecture for importing safety hazards (import spec §4).
// Layer 1: file -> SafetyHazard[]. Each adapter handles exactly one source
// format and is registered once (Open/Closed Principle). Validation,
// de-duplication and normalization are centralized here so every adapter
// behaves identically (spec §5.2).

import {
  type SafetyHazard,
  type HazardSeverity,
  type HazardProbability,
  HAZARD_CATEGORIES,
  HAZARD_SEVERITIES,
  HAZARD_PROBABILITIES,
} from "../models/safety-hazard-types";
import {
  type HazardCategory,
} from "shared"

import type { WorkbookPreview } from "../models/import-profile-types";

// ==================== RESULT TYPES ====================

export interface HazardImportWarning {
  row?: number; // 1-based data row (CSV/spreadsheet) or array index (JSON)
  field?: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface HazardImportResult {
  hazards: SafetyHazard[];
  warnings: HazardImportWarning[];
  adapterUsed: string;
  sourceFile?: string;
}

// ==================== ADAPTER CONTRACT ====================

export interface HazardImportAdapter {
  readonly id: string; // e.g. "taraflow_json", "csv_generic"
  readonly label: string; // display name in the UI
  readonly acceptedExtensions: string[]; // e.g. [".csv"]
  readonly acceptedMimeTypes: string[];

  canHandle(file: File): Promise<boolean>; // fast pre-check before full parse
  parse(file: File): Promise<HazardImportResult>;
}

/**
 * Raw, not-yet-validated row produced by an adapter. The adapter only extracts
 * fields; finalizeImport() does the validation/normalization once for all.
 */
export interface RawHazardRow {
  row: number;
  data: Partial<SafetyHazard>;
}

// ==================== SHARED VALIDATION (spec §5.2) ====================

const MAX_HAZARDS = 500; // performance ceiling

/**
 * Validate, de-duplicate and normalize raw rows into a HazardImportResult.
 * Single source of truth so JSON/CSV/spreadsheet adapters stay consistent.
 *
 * Rules:
 *  - id + description are required (missing -> error, row skipped)
 *  - duplicate id -> error, row skipped
 *  - unknown/missing hazardCategory -> warning, coerced to "other"
 *  - unknown/missing severity -> warning, coerced to "marginal"
 *  - unknown probability -> warning, dropped (field is optional)
 *  - more than MAX_HAZARDS valid rows -> warning, remainder skipped
 */
export function finalizeImport(
  rows: RawHazardRow[],
  adapterId: string,
  sourceFile?: string,
): HazardImportResult {
  const warnings: HazardImportWarning[] = [];
  const hazards: SafetyHazard[] = [];
  const seenIds = new Set<string>();

  for (const { row, data } of rows) {
    if (hazards.length >= MAX_HAZARDS) {
      warnings.push({
        message: `Import capped at ${MAX_HAZARDS} entries; remaining rows skipped`,
        severity: "warning",
      });
      break;
    }

    const id = data.id?.toString().trim();
    const description = data.description?.toString().trim();

    if (!id || !description) {
      warnings.push({
        row,
        message: "Missing required field (id or description)",
        severity: "error",
      });
      continue;
    }

    let finalId = id;
    if (seenIds.has(id)) {
      let n = 2;
      while (seenIds.has(`${id}#${n}`)) n++;
      finalId = `${id}#${n}`;
      warnings.push({
        row,
        field: "id",
        message: `Duplicate id "${id}" — kept as "${finalId}"`,
        severity: "warning",
      });
    }
    seenIds.add(finalId);

    // hazardCategory — coerce unknown to "other"
    let hazardCategory: HazardCategory = "other";
    if (data.hazardCategory && HAZARD_CATEGORIES.has(data.hazardCategory)) {
      hazardCategory = data.hazardCategory;
    } else if (data.hazardCategory) {
      warnings.push({
        row,
        field: "hazardCategory",
        message: `Unknown category "${data.hazardCategory}" — coerced to "other"`,
        severity: "warning",
      });
    }

    // severity — required in the model; coerce unknown to "marginal"
    let severity: HazardSeverity = "marginal";
    if (data.severity && HAZARD_SEVERITIES.has(data.severity)) {
      severity = data.severity;
    } else {
      warnings.push({
        row,
        field: "severity",
        message: data.severity
          ? `Unknown severity "${data.severity}" — coerced to "marginal"`
          : `Missing severity — coerced to "marginal"`,
        severity: "warning",
      });
    }

    // probability — optional; drop if unknown
    let probability: HazardProbability | undefined;
    if (data.probability) {
      if (HAZARD_PROBABILITIES.has(data.probability)) {
        probability = data.probability;
      } else {
        warnings.push({
          row,
          field: "probability",
          message: `Unknown probability "${data.probability}" — dropped`,
          severity: "warning",
        });
      }
    }

    // validate physical hazard potential (optional; drop unknown values)
    const PHP_OK = new Set(["low", "medium", "high"]);
    if (data.physicalHazardPotential !== undefined) {
      const v = String(data.physicalHazardPotential).trim().toLowerCase();
      if (PHP_OK.has(v)) {
        data.physicalHazardPotential = v;
      } else {
        warnings.push({
          row,
          field: "physicalHazardPotential",
          message: `Unknown physical hazard potential "${data.physicalHazardPotential}" — dropped`,
          severity: "warning",
        });
        data.physicalHazardPotential = undefined;
      }
    }

    hazards.push({
      id: finalId,
      description,
      hazardCategory,
      severity,
      probability,
      rpn:
        typeof data.rpn === "number" && !Number.isNaN(data.rpn)
          ? data.rpn
          : undefined,
      sourceNorm: data.sourceNorm?.toString().trim() || undefined,
      affectedElements: data.affectedElements,
      affectedAssets: data.affectedAssets,
      affectedPersons: data.affectedPersons,
      physicalHazardPotential: data.physicalHazardPotential,
      importMeta: data.importMeta,
      notes: data.notes?.toString().trim() || undefined,
      importedFrom: adapterId,
      originalId: data.originalId?.toString().trim() || id,
    });
  }

  return { hazards, warnings, adapterUsed: adapterId, sourceFile };
}

// ==================== REGISTRY ====================

export class HazardImporterRegistry {
  private adapters: Map<string, HazardImportAdapter> = new Map();

  register(adapter: HazardImportAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAll(): HazardImportAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** Auto-detect the adapter for a file (first match wins). */
  async detect(file: File): Promise<HazardImportAdapter | null> {
    for (const adapter of this.adapters.values()) {
      if (await adapter.canHandle(file)) return adapter;
    }
    return null;
  }

  /** Convenience: detect + parse in one call. Throws if no adapter matches. */
  async import(file: File): Promise<HazardImportResult> {
    const adapter = await this.detect(file);
    if (!adapter) {
      throw new Error(`No import adapter can handle "${file.name}"`);
    }
    return adapter.parse(file);
  }
}

// ==================== TABULAR / PROFILE IMPORT ====================

export type CanonicalField =
  | "id"
  | "description"
  | "hazardCategory"
  | "severity"
  | "probability"
  | "rpn"
  | "sourceNorm"
  | "notes"
  | "affectedPersons"
  | "physicalHazardPotential";

export const CANONICAL_FIELDS: readonly CanonicalField[] = [
  "id",
  "description",
  "hazardCategory",
  "severity",
  "probability",
  "rpn",
  "sourceNorm",
  "notes",
  "affectedPersons",
  "physicalHazardPotential",
];
export const REQUIRED_FIELDS: readonly CanonicalField[] = ["id", "description"];

/** Tabular adapter that exposes raw sheet grids for the mapping dialog. */
export interface ProfileImportAdapter extends HazardImportAdapter {
  readonly kind: "tabular";
  readWorkbook(file: File): Promise<WorkbookPreview>;
}

export function isProfileAdapter(
  adapter: HazardImportAdapter,
): adapter is ProfileImportAdapter {
  return (adapter as ProfileImportAdapter).kind === "tabular";
}

export const hazardImporterRegistry = new HazardImporterRegistry();