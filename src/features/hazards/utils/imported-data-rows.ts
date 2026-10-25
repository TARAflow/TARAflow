// features/hazards/utils/imported-data-rows.ts
//
// Hazard import design HI-4 / HI-5 (doc/InProgress/Hazard/hazard-import-
// iso12100-extensions.md): what a Hazard Item carries from its source file —
// the customer's rating (probability, RPN, raw severity / probability) and the
// extra columns — as ordered rows for the hazard dialog. Known keys first, in
// a fixed order and with an i18n label; other keys (the analyst's extra
// columns) after them, labelled by their key.

import type { HazardItem } from "shared";

export interface ImportedDataRow {
  key: string;
  /** i18n key of the label, or undefined for a free key (label = key). */
  labelKey?: string;
  /** English fallback of the label. */
  defaultLabel: string;
  value: string;
}

/** Fixed keys written by the importer, in display order, with their fallback label. */
const KNOWN_LABELS: Readonly<Record<string, string>> = {
  "severity.raw": "Severity (source value)",
  probability: "Probability",
  "probability.raw": "Probability (source value)",
  rpn: "RPN (source)",
  residualRisk: "Residual risk (source)",
  // EN ISO 12100 / 13849-1 columns (HI-5)
  lifecyclePhase: "Lifecycle phase",
  hazardZone: "Hazard zone",
  protectiveMeasures: "Protective measures",
  protectiveMeasureType: "Type of protective measure",
  riskGraphS: "Risk graph S",
  riskGraphF: "Risk graph F",
  riskGraphP: "Risk graph P",
  plRequired: "PL required",
  plAchieved: "PL achieved",
  safetyFunction: "Safety function",
};

/** Keys whose value is a list ("a, b") — shown as separate chips. */
export const MULTI_VALUE_IMPORT_KEYS: readonly string[] = ["lifecyclePhase"];
export const KNOWN_IMPORT_KEYS: readonly string[] = Object.keys(KNOWN_LABELS);

export function importedDataRows(item: Pick<HazardItem, "importMeta">): ImportedDataRow[] {
  const meta = item.importMeta ?? {};
  const known = KNOWN_IMPORT_KEYS.filter((k) => meta[k] !== undefined).map((key) => ({
    key,
    labelKey: `tabs.hazards.imported.key.${key.replace(".", "_")}`,
    defaultLabel: KNOWN_LABELS[key],
    value: meta[key],
  }));
  const free = Object.keys(meta)
    .filter((k) => !KNOWN_IMPORT_KEYS.includes(k))
    .map((key) => ({ key, defaultLabel: key, value: meta[key] }));
  return [...known, ...free];
}
