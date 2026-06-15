// features/hazards/services/apply-import-profile.ts
//
// Format-independent: turns raw sheet grids + an ImportProfile into a
// HazardImportResult, reusing the shared finalizeImport() validation. Also
// provides suggestProfile() to seed the dialog with a best guess so the user
// only corrects rather than maps from scratch.

import {
  finalizeImport,
  type HazardImportResult,
  type RawHazardRow,
  type CanonicalField,
  CANONICAL_FIELDS,
} from "./safety-hazard-importer";
import type { SafetyHazard } from "../models/safety-hazard-types";
import type {
  CellValue,
  ImportProfile,
  SheetGrid,
  WorkbookPreview,
} from "../models/import-profile-types";

// ---- cell helpers -----------------------------------------------------------

export function cellStr(v: CellValue): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function assignField(
  data: Partial<SafetyHazard>,
  field: CanonicalField,
  value: string | undefined,
): void {
  if (value === undefined) return;
  if (field === "rpn") {
    const n = Number(value);
    if (!Number.isNaN(n)) data.rpn = n;
    return;
  }
  if (field === "id") {
    data.id = value;
    if (data.originalId === undefined) data.originalId = value;
    return;
  }
  if (field === "affectedPersons") {
    const roles = value
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (roles.length) data.affectedPersons = roles;
    return;
  }
  // description | hazardCategory | severity | probability | sourceNorm | notes
  (data as Record<string, unknown>)[field] = value;
}

// ---- profile application ----------------------------------------------------

export function applyImportProfile(
  sheets: SheetGrid[],
  profile: ImportProfile,
  sourceFile?: string,
): HazardImportResult {
  const sheet = profile.sheetName
    ? sheets.find((s) => s.name === profile.sheetName)
    : sheets[0];

  if (!sheet) {
    return {
      hazards: [],
      warnings: [
        {
          message: `Sheet "${profile.sheetName}" not found in the workbook`,
          severity: "error",
        },
      ],
      adapterUsed: profile.id,
      sourceFile,
    };
  }

  const idRe = profile.idPattern ? safeRegExp(profile.idPattern) : null;
  const idCol = profile.columns.find((c) => c.field === "id")?.column;

  const rows: RawHazardRow[] = [];
  for (let r = profile.dataStartRow; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    if (!row) continue;

    // Row filter: drop section/group rows whose id cell does not match.
    if (idRe && idCol !== undefined) {
      const idVal = cellStr(row[idCol]);
      if (!idVal || !idRe.test(idVal)) continue;
    }

    const data: Partial<SafetyHazard> = {};

    // Single-column fields
    for (const fc of profile.columns) {
      const raw = cellStr(row[fc.column]);
      const mapped =
        raw !== undefined && fc.valueMap?.[raw] !== undefined
          ? fc.valueMap[raw]
          : raw;
      assignField(data, fc.field, mapped);
    }

    // Marker groups (x-matrix): the first non-empty column wins.
    for (const mg of profile.markerGroups) {
      const hit = mg.columns.find(
        (mc) => cellStr(row[mc.column]) !== undefined,
      );
      if (hit) assignField(data, mg.field, hit.value);
    }

    // provenance: extra columns kept as-is
    const importMeta: Record<string, string> = {};
    for (const mc of profile.metaColumns ?? []) {
      if (mc.column < 0 || !mc.key.trim()) continue;
      const v = cellStr(row[mc.column]);
      if (v !== undefined) importMeta[mc.key.trim()] = v;
    }
    if (Object.keys(importMeta).length) data.importMeta = importMeta;

    rows.push({ row: r + 1, data });
  }

  return finalizeImport(rows, profile.id, sourceFile);
}

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

// ---- auto-suggestion (seed for the dialog) ---------------------------------

import i18n from "i18next"; // configured singleton; use your app i18n module if custom

// Languages whose header words we try to match (independent of the active UI language).
const ALIAS_LANGS = ["en", "de"] as const;

function langAliases(lng: string, field: CanonicalField): string[] {
  const tl = i18n.getFixedT(lng); // default namespace
  const v = tl(`tabs.hazards.import.aliases.${field}`, {
    returnObjects: true,
    defaultValue: [],
  });
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** All header aliases for a field, merged across languages + the field token itself. */
function aliasesFor(field: CanonicalField): string[] {
  const set = new Set<string>([field.toLowerCase()]);
  for (const lng of ALIAS_LANGS)
    for (const a of langAliases(lng, field)) set.add(a.toLowerCase());
  return [...set];
}

function norm(s: CellValue): string {
  return cellStr(s)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}

/**
 * Best-effort seed: pick the first sheet, guess the header row (first row with
 * >= 3 non-empty text cells), and suggest single-column mappings by matching
 * the header labels against the alias table. The user refines in the dialog.
 */
export function suggestProfile(workbook: WorkbookPreview): ImportProfile {
  const sheet = workbook.sheets[0];
  const rows = sheet?.rows ?? [];

  let headerRow = 0;
  let best = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const textCells = (rows[r] ?? []).filter(
      (c) => typeof c === "string" && c.trim().length > 0,
    ).length;
    if (textCells > best) {
      best = textCells;
      headerRow = r;
    }
  }

  const header = rows[headerRow] ?? [];
  const columns: ImportProfile["columns"] = [];
  for (const field of CANONICAL_FIELDS) {
    const aliases = aliasesFor(field);
    const col = header.findIndex((cell) => {
      const n = norm(cell);
      return n.length > 0 && aliases.some((a) => n === a || n.includes(a));
    });
    if (col >= 0) columns.push({ field, column: col });
  }

  return {
    id: `profile_${Date.now()}`,
    name: sheet ? `${sheet.name} mapping` : "New profile",
    format: workbook.format,
    sheetName: workbook.format === "spreadsheet" ? sheet?.name : undefined,
    headerRow,
    dataStartRow: headerRow + 1,
    idPattern: undefined,
    columns,
    markerGroups: [],
    metaColumns: [],
  };
}
