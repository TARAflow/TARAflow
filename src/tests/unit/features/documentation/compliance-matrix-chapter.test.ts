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
import { complianceMatrixIntro, complianceMatrixSections } from "features/documentation/utils/compliance-matrix-report";
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
  standardLabel: "EN IEC 62443-4-2 (CRA)",
  editionTitle: "EN IEC 62443-4-2:2019/prAA:2026 (draft)",
  draft: true,
  cra: true,
  ccsc2Label: "supporting measures",
  component: "MP-2 Smoke Detector Controller",
  levels: true,
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
      suggestions: [
        { id: "M-S-009", text: "Authenticate the sensor per device" },
        { id: "M-X-001", text: "M-X-001" },
      ],
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
  computed: { moscowLabels: new Map(), impactLabels: new Map(), ...(c ? { compliance: [c] } : {}) },
});
const cfg = (): Any => ({
  ...createDefaultDocData().configuration,
  language: "en",
  chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "compliance-matrix"),
});

describe("compliance matrix sections", () => {
  const sections = complianceMatrixSections([compliance()], t);
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

  it("CRA view: the manufacturer information of Annex II is named as documentation, outside the assessment (F-28 dropped)", () => {
    const view = byTitle("Regulation (EU) 2024/2847 (CRA), Annex I Part I");
    expect(view.paragraphs[1]).toMatch(/^Not part of this assessment: .*Annex II.*support period.*product documentation\.$/);
  });

  it("gaps against the target: rows up to the target that the component does not meet, with the suggestions' texts (FX-23)", () => {
    expect(byTitle("Gaps against the SL-T").table?.rows).toEqual([
      // A text missing in the catalog falls back to the id alone.
      ["CR 1.2", "gap", "M-S-009: Authenticate the sensor per device; M-X-001"],
      ["CR 1.11", "claimed", "—"],
    ]);
  });

  it("supporting claims (IEC-6): a section with the measure, who provides it and the rows, after the SoA", () => {
    const withClaims = complianceMatrixSections(
      [compliance({ claims: [{ id: "CLM-03", statement: "Plant firewall", responsibleParty: "Operator", rows: ["CR 1.11"] }] })],
      t,
    );
    const titles = withClaims.map((s) => s.title);
    expect(titles.indexOf("Claims — measures of the system")).toBe(titles.indexOf("Statement of Applicability") + 1);
    expect(withClaims.find((s) => s.title === "Claims — measures of the system")!.table!.rows).toEqual([["CLM-03", "Plant firewall", "Operator", "—", "CR 1.11"]]);
  });

  it("classic edition: no CRA column or view; no target → no gaps section; nothing → no chapter", () => {
    const classic = complianceMatrixSections([compliance({ cra: false, draft: false, vectors: [{ fr: "IAC", achievedComponent: 1, achievedWithSupport: 1, plannedComponent: 1, plannedWithSupport: 1 }] })], t);
    expect(classic.map((s) => s.title)).toEqual(["Basis", "Security levels per foundational requirement", "Statement of Applicability"]);
    expect(classic[1].table!.rows[1]).toEqual(["SL-C (product)", "1"]); // no SL-T → no mark
    expect(classic[2].table?.headers).not.toContain("CRA");
    expect(complianceMatrixSections(undefined, t)).toEqual([]);
  });

  it("two standards: one part each — the standard is a heading, its sections one level below (CM-9)", () => {
    const classic = compliance({ standardLabel: "IEC 62443-4-2:2019", editionTitle: "IEC 62443-4-2:2019", cra: false, draft: false });
    const parts = complianceMatrixSections([compliance(), classic], t);
    expect(parts.map((p) => p.title)).toEqual(["EN IEC 62443-4-2 (CRA)", "IEC 62443-4-2:2019"]);
    expect(parts[0].paragraphs).toEqual(["EN IEC 62443-4-2:2019/prAA:2026 (draft)"]);
    expect(parts[0].children!.map((c) => c.title)).toContain("Regulation (EU) 2024/2847 (CRA), Annex I Part I");
    expect(parts[1].children!.map((c) => c.title)).toEqual(["Basis", "Security levels per foundational requirement", "Statement of Applicability", "Gaps against the SL-T"]);
  });
});

describe("EN 50742 A part (CM-13)", () => {
  const en = (extra: Partial<DocCompliance> = {}): DocCompliance => ({
    standardLabel: "EN 50742 A",
    editionTitle: "prEN 50742:2025 Approach A (draft)",
    draft: true,
    cra: false,
    ccsc2Label: "measures of the machine's environment",
    levels: false,
    vectors: [],
    srsl: {
      windowOfOpportunity: "limited",
      safetyFunctions: [
        { name: "Emergency stop", srsl: 2, interfaces: ["IF-7 WLAN"] },
        { name: "Guard door", interfaces: [] },
      ],
    },
    rows: [
      row("EN-7.3.2/295–296", { fr: "information-collection", minSl: null, checklist: ["minimum content"] }),
      row("EN-7.4.3.2.1/356–360", { fr: "protection-measures", minSl: null, status: "gap", source: undefined, risks: ["R-IF-7-S-1"], countsForComponent: false }),
    ],
    ...extra,
  });
  const sections = complianceMatrixSections([en()], t);
  const byTitle = (title: string) => sections.find((s) => s.title === title)!;

  it("no SL table, no CRA view, no gaps against an SL-T; basis with the whole machine and the WoO", () => {
    expect(sections.map((s) => s.title)).toEqual(["Basis", "SRSL per safety function", "Statement of Applicability", "Open requirements"]);
    expect(byTitle("Basis").facts).toEqual([
      ["Edition", "prEN 50742:2025 Approach A (draft) — draft, may change before it is cited"],
      ["Scope", "the whole machine"],
      ["Window of opportunity", "limited"],
    ]);
  });

  it("SRSL per safety function with the interfaces on its path; unrated as such", () => {
    expect(byTitle("SRSL per safety function").table!.rows).toEqual([
      ["Emergency stop", "SRSL2", "IF-7 WLAN"],
      ["Guard door", "not rated", "—"],
    ]);
  });

  it("SoA: the group instead of SL-C from, the risks in the notes; open requirements name the risks", () => {
    const soa = byTitle("Statement of Applicability").table!;
    expect(soa.headers).toEqual(["Requirement", "Summary", "Group", "Status", "Source", "Notes"]);
    expect(soa.rows[0].slice(2, 4)).toEqual(["Information collection (7.3)", "met"]);
    expect(soa.rows[1][5]).toBe("risks: R-IF-7-S-1");
    expect(byTitle("Open requirements").table!.rows).toEqual([["EN-7.4.3.2.1/356–360", "gap", "R-IF-7-S-1"]]);
  });

  it("the intro follows the standards: EN only, IEC 62443 only, both", () => {
    expect(complianceMatrixIntro(t, [en()])).toMatch(/^The requirements of EN 50742 Approach A/);
    expect(complianceMatrixIntro(t, [compliance()])).toMatch(/^The requirements of IEC 62443-4-2/);
    expect(complianceMatrixIntro(t, [compliance(), en()])).toMatch(/^The requirements of each active standard/);
  });

  it("with an IEC 62443 edition: one chapter, a part per standard", () => {
    const md = new MarkdownGenerator({ ...project(compliance()), computed: { moscowLabels: new Map(), impactLabels: new Map(), compliance: [compliance(), en()] } }, cfg(), t).generate().content;
    expect(md.match(/## Requirement Matrix/g)).toHaveLength(1);
    expect(md).toContain("### EN 50742 A\n");
    expect(md).toContain("#### SRSL per safety function");
  });
});

describe("compliance matrix in the formats", () => {
  it("markdown, AsciiDoc, HTML, StrictDoc and PDF render the chapter", () => {
    const md = new MarkdownGenerator(project(compliance()), cfg(), t).generate().content;
    expect(md).toContain("## Requirement Matrix");
    expect(md).toContain("| CR 1.2 | CR 1.2 title — CR 1.2 summary | 2 | d, e | gap |  | not met by: DF-1, DF-2, DF-3, DF-4, DF-5 (+2 more) |");
    expect(new AsciidocGenerator(project(compliance()), cfg(), t).generate().content).toContain("Statement of Applicability");
    expect(new HtmlGenerator(project(compliance()), cfg(), t).generate().content).toContain('<section id="compliance-matrix">');
    expect(new StrictdocGenerator(project(compliance()), cfg(), t).generate().content).toContain("TITLE: Statement of Applicability");
    const pdf = JSON.stringify(new PdfMakeConverter(project(compliance()), cfg(), t).createDocumentDefinition().content);
    expect(pdf).toContain('"text":"Requirement Matrix","style":"h1"');
  });

  it("two standards: one chapter, a heading per standard, sections below — in every format (CM-9)", () => {
    const both: Any = { ...project(compliance()), computed: { moscowLabels: new Map(), impactLabels: new Map(), compliance: [compliance(), compliance({ standardLabel: "IEC 62443-4-2:2019", cra: false })] } };
    const md = new MarkdownGenerator(both, cfg(), t).generate().content;
    expect(md.match(/## Requirement Matrix/g)).toHaveLength(1);
    expect(md).toContain("### EN IEC 62443-4-2 (CRA)\n");
    expect(md).toContain("### IEC 62443-4-2:2019\n");
    expect(md).toContain("#### Statement of Applicability");
    expect(new AsciidocGenerator(both, cfg(), t).generate().content).toContain("==== Statement of Applicability");
    expect(new HtmlGenerator(both, cfg(), t).generate().content).toContain("<h4>Statement of Applicability</h4>");
    const sdoc = new StrictdocGenerator(both, cfg(), t).generate().content;
    const part = sdoc.indexOf("TITLE: IEC 62443-4-2:2019");
    expect(sdoc.indexOf("TITLE: Statement of Applicability", part)).toBeGreaterThan(part);
    const pdf = JSON.stringify(new PdfMakeConverter(both, cfg(), t).createDocumentDefinition().content);
    expect(pdf).toContain('"text":"IEC 62443-4-2:2019","style":"h2","tocItem":true');
    expect(pdf).toContain('"text":"Statement of Applicability","style":"h3"');
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
