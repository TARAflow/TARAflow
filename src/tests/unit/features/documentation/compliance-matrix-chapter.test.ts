// tests/unit/features/documentation/compliance-matrix-chapter.test.ts
//
// The chapter "compliance-matrix" (iec-62443-4-2-cra-coverage.md §5): the
// Statement of Applicability with the source of every row, the SL-C values
// per FR, the CRA view (CRA edition only) and the gaps against the target —
// in every format.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { complianceMatrixSections } from "features/documentation/utils/compliance-matrix-report";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData, type DocCompliance, type DocComplianceRow } from "features/documentation/models/doc-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const row = (label: string, extra: Partial<DocComplianceRow> = {}): DocComplianceRow => ({
  label,
  fr: "IAC",
  minSl: 1,
  status: "met",
  source: "model",
  failing: [],
  unknown: [],
  supporting: [],
  mitigations: [],
  claims: [],
  summary: `${label} title — ${label} summary`,
  checklist: [],
  countsForComponent: true,
  suggestions: [],
  ...extra,
});

const compliance = (extra: Partial<DocCompliance> = {}): DocCompliance => ({
  editionTitle: "EN IEC 62443-4-2:2019/prAA:2026 (draft)",
  draft: true,
  cra: true,
  ccsc2Label: "supporting measures",
  component: "MP-2 Smoke Detector Controller",
  vectors: [{ fr: "IAC", target: 2, achievedComponent: 1, achievedWithSupport: 2, plannedComponent: 2, plannedWithSupport: 2 }],
  rows: [
    row("CR 1.1", { cra: ["d"], checklist: ["each interface authenticates"] }),
    row("CR 1.2", {
      cra: ["d", "e"],
      minSl: 2,
      status: "gap",
      source: undefined,
      failing: ["DF-1", "DF-2", "DF-3", "DF-4", "DF-5", "DF-6", "DF-7"],
      countsForComponent: false,
      suggestions: ["M-S-009"],
    }),
    row("CR 1.8", { cra: ["d"], minSl: 2, status: "met", source: "mitigation", mitigations: ["M-S-002"], contradiction: false }),
    row("CR 1.11", { cra: ["d"], status: "claimed", source: "claim", claims: ["CLM-03"], countsForComponent: false }),
  ],
  ...extra,
});

const project = (c?: DocCompliance): Any => ({
  info: { name: "P", description: "d", version: "1", team: [], created: new Date("2026-01-01"), lastModified: new Date("2026-10-01"), tags: { domain: [], platform: [], regulation: [], custom: [] } },
  assets: null,
  risks: null,
  attackTree: null,
  dfd: null,
  computed: { moscowLabels: new Map(), impactLabels: new Map(), ...(c ? { compliance: c } : {}) },
});
const cfg = (): Any => ({
  ...createDefaultDocData().configuration,
  language: "en",
  chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "compliance-matrix"),
});

describe("compliance matrix sections", () => {
  const sections = complianceMatrixSections(compliance(), t);
  const byTitle = (title: string) => sections.find((s) => s.title === title)!;

  it("basis: edition marked as draft, the component", () => {
    expect(byTitle("Basis").facts).toEqual([
      ["Edition", "EN IEC 62443-4-2:2019/prAA:2026 (draft) — draft, may change before it is cited"],
      ["Component under evaluation", "MP-2 Smoke Detector Controller"],
    ]);
  });

  it("SL table (D-26): FRs as columns; SL-T, SL-C (product), SL-C planned, with measures of the system; below the SL-T marked ✗", () => {
    const table = byTitle("Security levels per foundational requirement").table!;
    expect(table.headers).toEqual(["", "IAC"]);
    expect(table.rows).toEqual([
      ["SL-T (requirement)", "2"],
      ["SL-C (product)", "1 ✗"],
      ["SL-C planned", "2 ✓"],
      ["With measures of the system", "2"],
    ]);
  });

  it("SoA: status with its source; long element lists are shortened", () => {
    const rows = byTitle("Statement of Applicability").table!.rows;
    const soa = byTitle("Statement of Applicability");
    expect(soa.table!.headers.slice(0, 3)).toEqual(["Requirement", "Summary", "SL-C from"]);
    expect(soa.paragraphs[0]).toBe("The summaries are in our own words — the standard is authoritative.");
    expect(rows[0]).toEqual(["CR 1.1", "CR 1.1 title — CR 1.1 summary", "1", "d", "met", "model", "to confirm: each interface authenticates"]);
    expect(rows[1][6]).toBe("not met by: DF-1, DF-2, DF-3, DF-4, DF-5 (+2 more)");
    expect(rows[2].slice(4, 7)).toEqual(["met", "mitigation", "mitigations: M-S-002"]);
    expect(rows[3].slice(4, 6)).toEqual(["claimed", "claim"]);
  });

  it("CRA view: every essential requirement with its rows and the ones not met", () => {
    const d = byTitle("Regulation (EU) 2024/2847 (CRA), Annex I Part I").table!.rows.find((r) => r[0].startsWith("(2)(d)"))!;
    expect(d).toEqual(["(2)(d) protection from unauthorised access", "CR 1.1, CR 1.2, CR 1.8, CR 1.11", "CR 1.2, CR 1.11"]);
  });

  it("gaps against the target: rows up to the target that the component does not meet, with suggestions", () => {
    expect(byTitle("Gaps against the SL-T").table?.rows).toEqual([
      ["CR 1.2", "gap", "M-S-009"],
      ["CR 1.11", "claimed", "—"],
    ]);
  });

  it("classic edition: no CRA column or view; no target → no gaps section; nothing → no chapter", () => {
    const classic = complianceMatrixSections(compliance({ cra: false, draft: false, vectors: [{ fr: "IAC", achievedComponent: 1, achievedWithSupport: 1, plannedComponent: 1, plannedWithSupport: 1 }] }), t);
    expect(classic.map((s) => s.title)).toEqual(["Basis", "Security levels per foundational requirement", "Statement of Applicability"]);
    expect(classic[1].table!.rows[1]).toEqual(["SL-C (product)", "1"]); // no SL-T → no mark
    expect(classic[2].table?.headers).not.toContain("CRA");
    expect(complianceMatrixSections(undefined, t)).toEqual([]);
  });
});

describe("compliance matrix in the formats", () => {
  it("markdown, AsciiDoc, HTML, StrictDoc and PDF render the chapter", () => {
    const md = new MarkdownGenerator(project(compliance()), cfg(), t).generate().content;
    expect(md).toContain("## IEC 62443-4-2 Requirement Matrix");
    expect(md).toContain("| CR 1.2 | CR 1.2 title — CR 1.2 summary | 2 | d, e | gap |  | not met by: DF-1, DF-2, DF-3, DF-4, DF-5 (+2 more) |");
    expect(new AsciidocGenerator(project(compliance()), cfg(), t).generate().content).toContain("Statement of Applicability");
    expect(new HtmlGenerator(project(compliance()), cfg(), t).generate().content).toContain('<section id="compliance-matrix">');
    expect(new StrictdocGenerator(project(compliance()), cfg(), t).generate().content).toContain("TITLE: Statement of Applicability");
    const pdf = JSON.stringify(new PdfMakeConverter(project(compliance()), cfg(), t).createDocumentDefinition().content);
    expect(pdf).toContain('"text":"IEC 62443-4-2 Requirement Matrix","style":"h1"');
  });

  it("without matrix data the chapter is left out", () => {
    expect(new MarkdownGenerator(project(), cfg(), t).generate().content).not.toContain("Requirement Matrix");
  });
});

describe("compliance matrix texts in both languages", () => {
  const keysOf = (lang: string) => {
    const doc = JSON.parse(readFileSync(`src/i18n/locales/${lang}/doc.json`, "utf-8")).tabs.doc.compliance;
    const flat = (o: Any, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    return flat(doc).sort();
  };

  it("en and de have the same keys, and every key the chapter uses exists", () => {
    expect(keysOf("de")).toEqual(keysOf("en"));
    const source = readFileSync("src/features/documentation/utils/compliance-matrix-report.ts", "utf-8");
    const used = [...source.matchAll(/`\$\{K\}\.([A-Za-z]+)`/g)].map((m) => m[1]);
    for (const key of used) expect(keysOf("en"), key).toContain(key);
  });
});
