// ==================== IEC 62443-4-2 REQUIREMENT MATRIX IN THE REPORT ====================
// The chapter "compliance-matrix" (iec-62443-4-2-cra-coverage.md §5): the
// Statement of Applicability the security evaluation asks for (prAA Annex B,
// EA-2-9 / EA-4), derived from the analysed model by the app layer
// (buildDocCompliance). Format-neutral sections:
//   1 basis        edition, component, device categories
//   2 SL-C per FR  target, achieved and planned, each as SL-C (component)
//                  and with supporting measures and claims (D-2, D-4, D-14)
//   3 SoA          every row: status and where it comes from (§5: a row met
//                  by a measure marked done is never read as model evidence)
//   4 CRA view     Annex I Part I → rows (CRA edition only)
//   5 gaps         rows below the target, with catalog suggestions
// One part per active standard (CM-9): both 62443 tags → the CRA edition and
// the classic edition, each with these sections. EN 50742 A (CM-13) has no
// security levels: basis (whole machine, WoO), SRSL per safety function with
// the interfaces on its path, SoA with the group instead of "SL-C from" and
// the risks per row, and the open requirements.

import type { DocCompliance, DocComplianceRow } from "../models/doc-types";
import type { ReportSection } from "./report-section";

type TranslateFn = (key: string, defaultValue?: string) => string;

const K = "tabs.doc.compliance";

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, n) => String(values[n] ?? ""));

const STATUS_DEFAULTS: Record<string, string> = {
  met: "met",
  claimed: "claimed",
  "n/a": "not applicable",
  unknown: "unknown — properties not set",
  "pending-category": "device category to confirm",
  "needs-statement": "statement needed",
  gap: "gap",
};

const SOURCE_DEFAULTS: Record<string, string> = {
  model: "model",
  mitigation: "mitigation",
  "supporting-measure": "supporting measure",
  statement: "statement",
  claim: "claim",
  edition: "edition",
  "device-category": "device category",
};

const CRA_REQUIREMENTS: { id: string; label: string }[] = [
  { id: "b", label: "(2)(b) secure by default, reset" },
  { id: "c", label: "(2)(c) vulnerabilities addressed through updates" },
  { id: "d", label: "(2)(d) protection from unauthorised access" },
  { id: "e", label: "(2)(e) confidentiality" },
  { id: "f", label: "(2)(f) integrity" },
  { id: "h", label: "(2)(h) availability of essential functions" },
  { id: "i", label: "(2)(i) limited impact on other devices" },
  { id: "j", label: "(2)(j) limited attack surfaces" },
  { id: "k", label: "(2)(k) reduced incident impact" },
  { id: "l", label: "(2)(l) recording and monitoring" },
  { id: "m", label: "(2)(m) secure removal of data" },
];

const GROUP_DEFAULTS: Record<string, string> = {
  "threat-assessment": "Threat assessment",
  "information-collection": "Information collection (7.3)",
  "software-identification": "Software identification (7.5)",
  "protection-measures": "Protection measures (7.4.3)",
  "information-for-use": "Information for use (9)",
};

const WOO_DEFAULTS: Record<string, string> = {
  very_restricted: "very restricted",
  moderately_restricted: "moderately restricted",
  limited: "limited",
  unlimited: "unlimited",
};

/** The chapter intro: IEC 62443-4-2, EN 50742 A, or both kinds of standard. */
export const complianceMatrixIntro = (t: TranslateFn, compliance?: readonly DocCompliance[]): string => {
  const parts = (compliance ?? []).filter((c) => c.rows.length > 0);
  if (parts.length > 0 && parts.every((c) => !c.levels)) {
    return t(
      `${K}.introSrsl`,
      "The requirements of EN 50742 Approach A for the machine, each with whether it applies and how it is met, derived from the analysed model, the risks with their SRSL and the project data. A row is met by the model, by the mandated controls of the risk treatment or by an analyst statement; the source is named for every row.",
    );
  }
  if (parts.some((c) => !c.levels)) {
    return t(
      `${K}.introMixed`,
      "The requirements of each active standard, each with whether it applies and how it is met — derived from the analysed model, the risk treatment and the analyst statements; the source is named for every row. One part per standard.",
    );
  }
  return t(
    `${K}.intro`,
    "The requirements of IEC 62443-4-2 for the component, each with whether it applies and how it is met — the Statement of Applicability, derived from the analysed model. A row is met by the model, by a mitigation of the risk treatment, by a supporting measure outside the component, by an analyst statement or covered by a claim; the source is named for every row.",
  );
};

const statusText = (row: DocComplianceRow, t: TranslateFn) =>
  t(`${K}.status.${row.status}`, STATUS_DEFAULTS[row.status] ?? row.status);

const sourceText = (row: DocComplianceRow, t: TranslateFn) =>
  row.source ? t(`${K}.source.${row.source}`, SOURCE_DEFAULTS[row.source] ?? row.source) : "";

/** Elements listed per kind in the notes column — the rest is counted. */
const NOTES_MAX_ITEMS = 5;

/** The notes column: elements, measures, reasoning, warnings. */
function rowNotes(row: DocComplianceRow, t: TranslateFn): string {
  const parts: string[] = [];
  const list = (key: string, def: string, items: string[]) => {
    if (items.length === 0) return;
    const shown = items.slice(0, NOTES_MAX_ITEMS).join(", ");
    const more = items.length - NOTES_MAX_ITEMS;
    const rest = more > 0 ? ` ${fill(t(`${K}.more`, "(+{{count}} more)"), { count: more })}` : "";
    parts.push(`${t(`${K}.${key}`, def)}: ${shown}${rest}`);
  };
  list("failing", "not met by", row.failing);
  list("unknownElements", "properties missing on", row.unknown);
  list("supporting", "supporting measure", row.supporting);
  list("mitigations", "mitigations", row.mitigations);
  list("claims", "claims", row.claims);
  list("risks", "risks", row.risks ?? []);
  if (row.reasoning) parts.push(row.reasoning);
  if (row.checklist.length > 0) parts.push(`${t(`${K}.confirm`, "to confirm")}: ${row.checklist.join("; ")}`);
  if (row.contradiction) {
    parts.push(t(`${K}.contradiction`, "mitigation marked done, but the model shows the requirement not met"));
  }
  if (row.statementModelChanged) parts.push(t(`${K}.modelChanged`, "the model changed since the statement — review it"));
  if (row.statementSuperseded) {
    parts.push(t(`${K}.superseded`, "statement kept from another device category — the row no longer applies"));
  }
  return parts.join(" · ");
}

export function hasComplianceContent(compliance: readonly DocCompliance[] | undefined): boolean {
  return !!compliance && compliance.some((c) => c.rows.length > 0);
}

/**
 * The chapter's sections: one part per active standard (CM-9). With several
 * standards each standard is a heading of its own with its sections one
 * level below (user 2026-11-02: many standards can be active); with one the
 * chapter reads as before.
 */
export function complianceMatrixSections(compliance: readonly DocCompliance[] | undefined, t: TranslateFn): ReportSection[] {
  const parts = (compliance ?? []).filter((c) => c.rows.length > 0);
  if (parts.length <= 1) return parts.length === 1 ? standardSections(parts[0], t) : [];
  return parts.map((c) => ({ title: c.standardLabel, paragraphs: [c.editionTitle], facts: [], children: standardSections(c, t) }));
}

function standardSections(c: DocCompliance, t: TranslateFn): ReportSection[] {
  if (!c.levels) return srslStandardSections(c, t);
  const sections: ReportSection[] = [];

  // 1 — basis
  const basis: [string, string][] = [
    [t(`${K}.edition`, "Edition"), c.draft ? `${c.editionTitle} — ${t(`${K}.draft`, "draft, may change before it is cited")}` : c.editionTitle],
    [t(`${K}.component`, "Component under evaluation"), c.component ?? t(`${K}.wholeModel`, "the whole model (no component selected)")],
  ];
  if (c.deviceCategories) {
    const categories = c.deviceCategories.categories.join(", ") || "—";
    basis.push([
      t(`${K}.deviceCategories`, "Device categories"),
      c.deviceCategories.confirmed ? categories : `${categories} (${t(`${K}.toConfirm`, "derived, to confirm")})`,
    ]);
  }
  sections.push({
    title: t(`${K}.basisTitle`, "Basis"),
    paragraphs: [
      fill(
        t(
          `${K}.basisText`,
          "Requirements met only with the help of the system around the component are marked as {{ccsc2}} (CCSC 2); they appear in the second value of each foundational requirement.",
        ),
        { ccsc2: c.ccsc2Label },
      ),
    ],
    facts: basis,
  });

  // 2 — SL table (D-26): FRs as columns; SL-T, SL-C (product), SL-C planned,
  // with measures of the system; a value below the SL-T is marked ✗ (not by
  // colour alone — Markdown has none).
  const level = (n: number | undefined) => (n === undefined ? "—" : String(n));
  const compared = (n: number, target: number | undefined) =>
    target === undefined ? String(n) : `${n} ${n >= target ? "✓" : "✗"}`;
  sections.push({
    title: t(`${K}.vectorTitle`, "Security levels per foundational requirement"),
    paragraphs: [
      t(
        `${K}.vectorText`,
        "SL-T: what the operator or the zone requires. SL-C (product): what the product provides according to the model and the mitigations marked done; planned: after the chosen open mitigations. With measures of the system: what the plant can reach if it provides the listed supporting measures and claims — the basis for the SL-A, which only arises in the operated plant. ✗ marks a value below the SL-T.",
      ),
    ],
    facts: [],
    table: {
      headers: ["", ...c.vectors.map((v) => v.fr)],
      rows: [
        [t(`${K}.target`, "SL-T (requirement)"), ...c.vectors.map((v) => level(v.target))],
        [t(`${K}.achievedComponent`, "SL-C (product)"), ...c.vectors.map((v) => compared(v.achievedComponent, v.target))],
        [t(`${K}.plannedComponent`, "SL-C planned"), ...c.vectors.map((v) => compared(v.plannedComponent, v.target))],
        [t(`${K}.achievedWithSupport`, "With measures of the system"), ...c.vectors.map((v) => String(v.achievedWithSupport))],
      ],
    },
  });

  // 3 — Statement of Applicability
  sections.push({
    title: t(`${K}.soaTitle`, "Statement of Applicability"),
    paragraphs: [t(`${K}.summaryDisclaimer`, "The summaries are in our own words — the standard is authoritative.")],
    facts: [],
    table: {
      headers: [
        t(`${K}.requirement`, "Requirement"),
        t(`${K}.summaryColumn`, "Summary"),
        t(`${K}.minSl`, "SL-C from"),
        ...(c.cra ? [t(`${K}.craColumn`, "CRA")] : []),
        t(`${K}.statusColumn`, "Status"),
        t(`${K}.sourceColumn`, "Source"),
        t(`${K}.notes`, "Notes"),
      ],
      rows: c.rows.map((row) => [
        row.label,
        row.summary,
        row.minSl === null ? "—" : String(row.minSl),
        ...(c.cra ? [(row.cra ?? []).join(", ") || "—"] : []),
        statusText(row, t),
        sourceText(row, t),
        rowNotes(row, t),
      ]),
    },
  });

  // 4 — CRA view (CRA edition)
  if (c.cra) {
    sections.push({
      title: t(`${K}.craTitle`, "Regulation (EU) 2024/2847 (CRA), Annex I Part I"),
      paragraphs: [
        t(
          `${K}.craText`,
          "The essential cybersecurity requirements with the rows of the matrix behind them (EN IEC 62443-4-2/prAA, Annex ZZ). Part I (1), (2)(a) and (2)(g) and Part II are met by the development and vulnerability handling process (EN IEC 62443-4-1) — outside this matrix.",
        ),
        // F-28 dropped (user 2026-11-02): manufacturer information is documentation, not TARA content.
        t(
          `${K}.craDocumentation`,
          "Not part of this assessment: the information the CRA requires for the user and in the technical documentation (Annex II), such as the support period, the contact for reporting vulnerabilities and the product identification — it is stated in the product documentation.",
        ),
      ],
      facts: [],
      table: {
        headers: [t(`${K}.craRequirement`, "Essential requirement"), t(`${K}.craRows`, "Rows"), t(`${K}.craOpen`, "Not met (SL-C component)")],
        rows: CRA_REQUIREMENTS.map(({ id, label }) => {
          const rows = c.rows.filter((r) => r.cra?.includes(id));
          const open = rows.filter((r) => !r.countsForComponent).map((r) => r.label);
          return [label, rows.map((r) => r.label).join(", "), open.length > 0 ? open.join(", ") : t(`${K}.craNone`, "none")];
        }),
      },
    });
  }

  // 5 — gaps against the target
  const targetOf = new Map(c.vectors.map((v) => [v.fr, v.target]));
  const gaps = c.rows.filter((r) => {
    const target = targetOf.get(r.fr);
    return target !== undefined && r.minSl !== null && r.minSl <= target && !r.countsForComponent;
  });
  if (gaps.length > 0) {
    sections.push({
      title: t(`${K}.gapsTitle`, "Gaps against the SL-T"),
      paragraphs: [
        t(
          `${K}.gapsText`,
          "Rows needed for the SL-T that the product does not meet itself (SL-C) — each is closed by a change of the product (mitigation), a statement, or a measure the plant provides (supporting measure, claim).",
        ),
      ],
      facts: [],
      table: {
        headers: [t(`${K}.requirement`, "Requirement"), t(`${K}.statusColumn`, "Status"), t(`${K}.suggestions`, "Catalog mitigations")],
        rows: gaps.map((r) => [r.label, statusText(r, t), r.suggestions.join(", ") || "—"]),
      },
    });
  }

  return sections;
}

// ==================== STANDARDS WITHOUT LEVELS (EN 50742 A) ====================

const OPEN_STATUSES = ["gap", "unknown", "needs-statement", "pending-category"];

function srslStandardSections(c: DocCompliance, t: TranslateFn): ReportSection[] {
  const sections: ReportSection[] = [];
  const groupText = (id: string) => t(`${K}.group.${id}`, GROUP_DEFAULTS[id] ?? id);
  const woo = c.srsl?.windowOfOpportunity;

  // 1 — basis: the whole machine, the WoO the SRSL rests on
  sections.push({
    title: t(`${K}.basisTitle`, "Basis"),
    paragraphs: [],
    facts: [
      [t(`${K}.edition`, "Edition"), c.draft ? `${c.editionTitle} — ${t(`${K}.draft`, "draft, may change before it is cited")}` : c.editionTitle],
      [t(`${K}.scope`, "Scope"), t(`${K}.wholeMachine`, "the whole machine")],
      [t(`${K}.woo`, "Window of opportunity"), woo ? t(`${K}.wooLevel.${woo}`, WOO_DEFAULTS[woo] ?? woo) : t(`${K}.notSet`, "not set")],
    ],
  });

  // 2 — SRSL per safety function (coverage §9.3)
  if (c.srsl) {
    sections.push({
      title: t(`${K}.srslTitle`, "SRSL per safety function"),
      paragraphs: [
        t(
          `${K}.srslText`,
          "The highest SRSL the rated risks give for each safety function (an asset with a physical impact), and the interfaces on a path to it — found backwards along the data flows from the safety function's elements. The SRSL is derived in the risk assessment; it is not entered here.",
        ),
      ],
      facts: [],
      table: {
        headers: [t(`${K}.safetyFunction`, "Safety function"), t(`${K}.highestSrsl`, "Highest SRSL"), t(`${K}.pathInterfaces`, "Interfaces on the path")],
        rows: c.srsl.safetyFunctions.map((sf) => [
          sf.name,
          sf.srsl === undefined ? t(`${K}.notRated`, "not rated") : `SRSL${sf.srsl}`,
          sf.interfaces.join(", ") || "—",
        ]),
      },
    });
  }

  // 3 — Statement of Applicability, grouped as the standard
  sections.push({
    title: t(`${K}.soaTitle`, "Statement of Applicability"),
    paragraphs: [t(`${K}.summaryDisclaimer`, "The summaries are in our own words — the standard is authoritative.")],
    facts: [],
    table: {
      headers: [
        t(`${K}.requirement`, "Requirement"),
        t(`${K}.summaryColumn`, "Summary"),
        t(`${K}.groupColumn`, "Group"),
        t(`${K}.statusColumn`, "Status"),
        t(`${K}.sourceColumn`, "Source"),
        t(`${K}.notes`, "Notes"),
      ],
      rows: c.rows.map((row) => [row.label, row.summary, groupText(row.fr), statusText(row, t), sourceText(row, t), rowNotes(row, t)]),
    },
  });

  // 4 — open requirements: what the conformity claim still needs
  const open = c.rows.filter((r) => OPEN_STATUSES.includes(r.status));
  if (open.length > 0) {
    sections.push({
      title: t(`${K}.openTitle`, "Open requirements"),
      paragraphs: [
        t(
          `${K}.openText`,
          "Rows not yet met — each is closed by rating the risk, choosing and implementing the mandated control, completing the project data, or a statement with its evidence.",
        ),
      ],
      facts: [],
      table: {
        headers: [t(`${K}.requirement`, "Requirement"), t(`${K}.statusColumn`, "Status"), t(`${K}.risksColumn`, "Risks")],
        rows: open.map((r) => [r.label, statusText(r, t), (r.risks ?? []).join(", ") || "—"]),
      },
    });
  }
  return sections;
}
