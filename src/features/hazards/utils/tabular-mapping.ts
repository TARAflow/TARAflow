// shared/services/adapters/tabular-mapping.ts
//
// Shared column mapping for any row-based source (CSV, XLSX, ODS).
// Keeps the header->field contract in ONE place so a new tabular adapter is
// just "read rows, call mapTabularRecords". Header names are normalized
// case-insensitively and tolerate snake_case / spaces.

import type { RawHazardRow } from "../services/safety-hazard-importer";
import type {
  HazardProbability,
  HazardSeverity,
} from "../models/safety-hazard-types";
import type {
  HazardCategory,
} from "shared"

/** Canonical column key -> accepted header aliases (all lowercased). */
const COLUMN_ALIASES: Record<string, string[]> = {
  id: ["id", "hazard id", "hazard_id"],
  description: ["description", "desc", "hazard", "beschreibung"],
  hazardCategory: ["hazardcategory", "hazard category", "hazard_category", "category", "kategorie"],
  severity: ["severity", "schwere", "schweregrad"],
  probability: ["probability", "prob", "wahrscheinlichkeit"],
  rpn: ["rpn"],
  sourceNorm: ["sourcenorm", "source norm", "source_norm", "norm"],
  notes: ["notes", "note", "bemerkung", "bemerkungen"],
  originalId: ["originalid", "original id", "original_id"],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Build a lookup from a record's normalized headers to canonical field keys. */
function resolveColumns(record: Record<string, unknown>): Record<string, string> {
  const present = Object.keys(record).map((k) => [normalizeKey(k), k] as const);
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const hit = present.find(([norm]) => aliases.includes(norm));
    if (hit) map[canonical] = hit[1]; // canonical -> original header key
  }
  return map;
}

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Map raw record objects (one per data row) to RawHazardRow[]. Validation and
 * coercion of enum values happens later in finalizeImport(); here we only
 * extract and trim.
 */
export function mapTabularRecords(
  records: Record<string, unknown>[],
): RawHazardRow[] {
  return records.map((record, i) => {
    const cols = resolveColumns(record);
    const get = (canonical: string): unknown =>
      cols[canonical] !== undefined ? record[cols[canonical]] : undefined;

    return {
      row: i + 1, // 1-based data row (header excluded)
      data: {
        id: str(get("id")),
        description: str(get("description")),
        hazardCategory: str(get("hazardCategory")) as HazardCategory | undefined,
        severity: str(get("severity")) as HazardSeverity | undefined,
        probability: str(get("probability")) as HazardProbability | undefined,
        rpn: num(get("rpn")),
        sourceNorm: str(get("sourceNorm")),
        notes: str(get("notes")),
        originalId: str(get("originalId")) ?? str(get("id")),
      },
    };
  });
}