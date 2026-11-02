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
// the classic edition, each with these sections.

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

export const complianceMatrixIntro = (t: TranslateFn): string =>
  t(
    `${K}.intro`,
    "The requirements of IEC 62443-4-2 for the component, each with whether it applies and how it is met — the Statement of Applicability, derived from the analysed model. A row is met by the model, by a mitigation of the risk treatment, by a supporting measure outside the component, by an analyst statement or covered by a claim; the source is named for every row.",
  );

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
 * standards each section title names its standard ("EN IEC 62443-4-2 (CRA):
 * Basis"); with one the chapter reads as before.
 */
export function complianceMatrixSections(compliance: readonly DocCompliance[] | undefined, t: TranslateFn): ReportSection[] {
  const parts = (compliance ?? []).filter((c) => c.rows.length > 0);
  if (parts.length <= 1) return parts.length === 1 ? standardSections(parts[0], t) : [];
  return parts.flatMap((c) => standardSections(c, t).map((s) => ({ ...s, title: `${c.standardLabel}: ${s.title}` })));
}

function standardSections(c: DocCompliance, t: TranslateFn): ReportSection[] {
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
