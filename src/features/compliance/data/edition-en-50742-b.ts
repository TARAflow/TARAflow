// ==================== EDITION: EN 50742 APPROACH B ====================
// Rows of the Compliance sub-tab `en-50742-b` — prEN 50742:2025 (enquiry
// draft), Approach B, component role (en-50742-rq-coverage.md §6.2,
// decisions O13 – O16). Approach B replaces the risk-derived Approach A by a
// fixed subset of IEC 62443-4-2:2019 (Table 4):
//
//   FR1 IAC SL 2  CR 1.1, CR 1.2           FR5 RDF SL 1  CR 5.1
//   FR2 UC  SL 2  CR 2.1, 2.6, 2.8, 2.9,   FR6 TRE SL 1  CR 6.1
//                 2.12, EDR 2.13           FR7 RA  SL 2  CR 7.1, CR 7.2
//   FR3 SI  SL 2  CR 3.1, 3.4, 3.5, 3.6,   FR4 DC        none
//                 EDR 3.2, EDR 3.11, EDR 3.14
//
// Per listed requirement the rows its SL selects (NOTE 1: the REs with
// lowest SL-C ≤ the SL of the FR) — derived here from the 2019 edition, not
// copied, so the rules, texts and device categories are the 2019 ones. They
// share their statements with the family `iec-62443-4-2` (K-6). The HDR /
// NDR / SAR variants of the EDR-only rows are shown as recommended, outside
// the status (O14). The EN rows of Clauses 4, 6, 8 and 9 belong to the
// family `en-50742` and share their statements with Approach A where the
// clause is common (8.4 = 7.5, O9). The SL-T is fixed (B-F5).

import type {
  Edition,
  EditionRow,
  En50742RequirementId,
  FoundationalRequirement,
  RequirementId,
  SecurityLevel,
} from "../models/compliance-types";
import { EDITION_2019 } from "./edition-iec-62443-4-2-2019";

/** Table 4: the SL and the listed requirements per foundational requirement. */
export const EN50742_B_TABLE_4: Readonly<Record<FoundationalRequirement, { sl: SecurityLevel; requirements: readonly string[] }>> = {
  IAC: { sl: 2, requirements: ["CR 1.1", "CR 1.2"] },
  UC: { sl: 2, requirements: ["CR 2.1", "CR 2.6", "CR 2.8", "CR 2.9", "CR 2.12", "EDR 2.13"] },
  SI: { sl: 2, requirements: ["CR 3.1", "EDR 3.2", "CR 3.4", "CR 3.5", "CR 3.6", "EDR 3.11", "EDR 3.14"] },
  DC: { sl: 0, requirements: [] },
  RDF: { sl: 1, requirements: ["CR 5.1"] },
  TRE: { sl: 1, requirements: ["CR 6.1"] },
  RA: { sl: 2, requirements: ["CR 7.1", "CR 7.2"] },
};

/** The groups of the sub-tab, in display order. */
export const EN50742_B_GROUPS = [
  "common",
  "process",
  "IAC",
  "UC",
  "SI",
  "DC",
  "RDF",
  "TRE",
  "RA",
  "ccsc",
  "identification",
  "persistency",
  "system",
] as const;

export type En50742BGroup = (typeof EN50742_B_GROUPS)[number];

/** "CR 1.1 RE(1)" → "CR 1.1"; "HDR 3.14" → "HDR 3.14". */
const baseLabel = (label: string) => label.replace(/ RE\(\d+\)$/, "");
/** "HDR 3.14" → ["HDR", "3.14"]. */
const prefixAndNumber = (label: string) => baseLabel(label).split(" ") as [string, string];

const RECOMMENDED =
  "recommended by analogy — Table 4 names the embedded-device variant only (O14); not counted";

type BRow = EditionRow<En50742BGroup, RequirementId | En50742RequirementId>;

/** The 2019 rows of Table 4 (counted) and the variants of its EDR-only rows (recommended), in 2019 order. */
function table4Rows(): BRow[] {
  const out: BRow[] = [];
  for (const row of EDITION_2019.rows) {
    const fr = row.group as FoundationalRequirement;
    const spec = EN50742_B_TABLE_4[fr];
    if (!spec || row.minSl === null || row.minSl > spec.sl) continue;
    const base = baseLabel(row.label);
    const [prefix, number] = prefixAndNumber(row.label);
    const counted = spec.requirements.includes(base);
    const variant = prefix !== "EDR" && prefix !== "CR" && spec.requirements.includes(`EDR ${number}`);
    if (!counted && !variant) continue;
    out.push({
      ...row,
      group: fr,
      family: "iec-62443-4-2",
      ...(counted ? {} : { recommended: RECOMMENDED }),
    });
  }
  return out;
}

const en = (label: string, group: En50742BGroup, id: En50742RequirementId): BRow => ({
  label,
  group,
  minSl: null,
  requirementIds: [id],
  supportingMeasuresAllowed: false,
});

const ROWS: readonly BRow[] = [
  // ── Common clauses 4 and 9 (shared with Approach A) ───────────────────
  en("EN-4.3/217", "common", "en-4.3-217"),
  en("EN-4.3/220", "common", "en-4.3-220"),
  en("EN-4.3/238", "common", "en-4.3-238"),
  en("EN-4.3/229", "common", "en-4.3-229"),
  en("EN-9/491–496", "common", "en-9-491"),
  // ── Development process (6) ────────────────────────────────────────────
  en("EN-6/257", "process", "en-6-257"),
  // ── Table 4 (8.3) ──────────────────────────────────────────────────────
  ...table4Rows(),
  // ── CCSC (8.3) ─────────────────────────────────────────────────────────
  en("EN-8.3/471–472", "ccsc", "en-8.3-471"),
  en("EN-8.3/473–478", "ccsc", "en-8.3-473"),
  en("EN-8.3/479–480", "ccsc", "en-8.3-479"),
  // ── Identification (8.4 = 7.5, O9) ─────────────────────────────────────
  en("EN-8.4/482–484", "identification", "en-7.5-444"),
  // ── Persistency of audit records (8.5) ─────────────────────────────────
  en("EN-8.5/487–488", "persistency", "en-8.5-487"),
  // ── System role (8.2, statement, O13) ──────────────────────────────────
  en("EN-8.2/458–459", "system", "en-8.2-458"),
];

export const EDITION_EN50742_B: Edition<En50742BGroup, RequirementId | En50742RequirementId> = {
  id: "en-50742-b",
  family: "en-50742",
  title: "prEN 50742:2025 Approach B (draft)",
  draft: true,
  ccsc2Label: "countermeasures of the machinery system",
  groups: EN50742_B_GROUPS,
  rows: ROWS,
  fixedSlTarget: {
    IAC: EN50742_B_TABLE_4.IAC.sl,
    UC: EN50742_B_TABLE_4.UC.sl,
    SI: EN50742_B_TABLE_4.SI.sl,
    DC: EN50742_B_TABLE_4.DC.sl,
    RDF: EN50742_B_TABLE_4.RDF.sl,
    TRE: EN50742_B_TABLE_4.TRE.sl,
    RA: EN50742_B_TABLE_4.RA.sl,
  },
};
