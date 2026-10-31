// tests/unit/features/documentation/attack-trees-chapter.test.ts
//
// ISO/SAE 21434 conformance plan F5: the "attack-trees" chapter — one section
// per tree with anchor, structure (from the DSL, not the stored ast) and the
// attack paths; all presets, all formats.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import { attackTreeReportSections } from "features/documentation/utils/attack-tree-report";
import {
  DEFAULT_CHAPTER_CONFIG,
  createDefaultDocData,
} from "features/documentation/models/doc-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const t = ((_k: string, d?: string) => d ?? _k) as never;

const ISO_DSL = [
  "# comment",
  "Compromise Availability;ROOT",
  "\tLocal Attack;OR",
  "\t\tInsider Threat;et=1w,se=proficient,kn=confidential,wo=easy,eq=specialized",
  "\t\tPhysical Access;et=1w,se=proficient,kn=restricted,wo=easy,eq=standard [M-001]",
].join("\n");

const path = (id: string, pathKey: string, chain: string[], ap: number, level: string): Any => ({
  id,
  pathKey,
  path: chain,
  attackPotential: ap,
  feasibilityLevel: level,
});

const isoTree = (): Any => ({
  id: "t1",
  name: "Tree one",
  description: "Lamp request availability",
  anchor: { type: "asset", assetId: "A1", securityGoal: "A" },
  dsl: ISO_DSL,
  configuration: { evaluationMethod: "simple" },
  // stale stored ast: must not be used
  ast: { id: "x", name: "Stale root", type: "ROOT", level: 0, mitigations: [], children: [] },
  pathAnalysis: {
    aggregatedFeasibility: "high",
    // stored in risk order, rendered in path order
    paths: [
      path("path-2", "k2", ["Compromise Availability", "Local Attack", "Physical Access"], 8, "high"),
      path("path-1", "k1", ["Compromise Availability", "Local Attack", "Insider Threat"], 16, "medium"),
    ],
  },
  pathAssessments: [
    { pathKey: "k2", strideCategory: "D", relevance: "relevant" },
    { pathKey: "k1", strideCategory: "T", relevance: "not_relevant" },
    { pathKey: "k1", strideCategory: "D", relevance: "uncertain" },
  ],
});

const legacyTree = (): Any => ({
  id: "t2",
  name: "Legacy",
  customTitle: "Custom title",
  anchor: { type: "threat", threatDisplayId: "P1-T-1", threatTitle: "Spoofed sensor" },
  dsl: "Goal;ROOT\n\tStep A;p=0.7,i=3\n\tStep B;f=0.8,b=0.9,i=4",
  configuration: { evaluationMethod: "simple" },
  pathAnalysis: { paths: [] },
});

const project = (trees: Any[]): Any => ({
  info: { name: "P", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  assets: { assets: [{ id: "A1", displayId: "DA-001", name: "Lamp request" }] },
  risks: null,
  attackTree: { trees, configuration: {} },
  computed: {
    moscowLabels: new Map(),
    impactLabels: new Map(),
  },
});
const cfg = (): Any => ({
  ...createDefaultDocData().configuration,
  language: "en",
  chapters: DEFAULT_CHAPTER_CONFIG,
});
const chapter = (G: Any, p: Any) => new G(p, cfg(), t).generateAttackTrees("Attack Trees");

describe("attack-tree sections", () => {
  const [iso, legacy] = attackTreeReportSections(project([isoTree(), legacyTree()]), t);

  it("title numbered like the attack-path threats; custom title wins", () => {
    expect(iso.title).toBe("AT-1 Tree one");
    expect(legacy.title).toBe("AT-2 Custom title");
  });

  it("facts: description, asset × property anchor, scenario feasibility", () => {
    expect(iso.facts).toEqual([
      ["Description", "Lamp request availability"],
      ["Anchor", "DA-001 Lamp request × A"],
      ["Attack feasibility (scenario)", "High"],
    ]);
    expect(legacy.facts).toEqual([["Anchor", "P1-T-1 Spoofed sensor"]]);
  });

  it("structure from the DSL (not the stored ast), with gates, AP band and controls", () => {
    expect(iso.outline).toEqual([
      { depth: 0, text: "Compromise Availability" },
      { depth: 1, text: "Local Attack (OR)" },
      { depth: 2, text: "Insider Threat — AP 16 (Medium)" },
      { depth: 2, text: "Physical Access — AP 8 (High) [M-001]" },
    ]);
  });

  it("legacy leaf values", () => {
    expect(legacy.outline.map((o) => o.text)).toEqual([
      "Goal",
      expect.stringMatching(/^Step A — p 0\.7 · i 3 \(/),
      "Step B — f 0.8 · b 0.9 · i 4",
    ]);
  });

  it("paths in path order with AT-n.m, potential, feasibility and relevance", () => {
    expect(iso.rows).toEqual([
      ["AT-1.1", "Compromise Availability → Local Attack → Insider Threat", "16", "Medium",
        "not relevant (T), uncertain (D)"],
      ["AT-1.2", "Compromise Availability → Local Attack → Physical Access", "8", "High", "relevant"],
    ]);
  });
});

describe("attack-trees chapter", () => {
  it("markdown", () => {
    const c = chapter(MarkdownGenerator, project([isoTree()]));
    expect(c.hasContent).toBe(true);
    expect(c.content).toMatch(/^## Attack Trees/);
    expect(c.content).toContain("### AT-1 Tree one");
    expect(c.content).toContain("    - Insider Threat — AP 16 (Medium)");
    expect(c.content).toContain("| AT-1.2 | Compromise Availability → Local Attack → Physical Access | 8 | High | relevant |");
    expect(c.content).not.toContain("Stale root");
  });

  it("AsciiDoc, HTML and StrictDoc", () => {
    const adoc = chapter(AsciidocGenerator, project([isoTree()])).content;
    expect(adoc).toContain("*** Insider Threat — AP 16 (Medium)");
    const html = chapter(HtmlGenerator, project([isoTree()])).content;
    expect(html).toContain('<section id="attack-trees">');
    expect(html.match(/<ul>/g)).toHaveLength(html.match(/<\/ul>/g)!.length);
    expect(html.match(/<li>/g)).toHaveLength(html.match(/<\/li>/g)!.length);
    const sdoc = chapter(StrictdocGenerator, project([isoTree()])).content;
    expect(sdoc).toContain("TITLE: AT-1 Tree one");
    expect(sdoc).toContain("    - Insider Threat — AP 16 (Medium)");
  });

  it("no trees: hidden", () => {
    expect(chapter(MarkdownGenerator, project([])).hasContent).toBe(false);
  });

  it("pdfmake renders the chapter with a nested list", () => {
    const def = new PdfMakeConverter(
      project([isoTree()]),
      { ...cfg(), chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "attack-trees") },
      t,
    ).createDocumentDefinition();
    const json = JSON.stringify(def.content);
    expect(json).toContain('"text":"Attack Trees","style":"h1"');
    expect(json).toContain('{"ul":["Compromise Availability",{"ul":["Local Attack (OR)",{"ul":[');
  });
});
