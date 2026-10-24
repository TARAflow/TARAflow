// tests/unit/features/documentation/attack-path-risks-chapter.test.ts
//
// ISO/SAE 21434 conformance plan F4: the report's risk register of the
// attack-path risks — one group per threat scenario (attack tree) with the
// scenario value, residual and treatment; only for iso-21434 projects. Also
// the pdfmake fix: each STRIDE risk chapter shows its own risks once.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import {
  DEFAULT_CHAPTER_CONFIG,
  createDefaultDocData,
} from "features/documentation/models/doc-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const t = ((_k: string, d?: string) => d ?? _k) as never;

const risk = (
  id: string,
  treeId: string,
  value: number,
  over: Record<string, unknown> = {},
): Any => ({
  id,
  threatId: id,
  threatDisplayId: id,
  threatDescription: "Compromise Integrity",
  sourceStrideMethod: "attack-path",
  moscowPriority: "should",
  treatment: "reduce",
  strideCategory: "T",
  linkedAssetIds: ["A1"],
  selectedMitigations: [],
  calculatedRiskBeforeMitigation: 0,
  calculatedRiskAfterMitigation: 0,
  attackTreeAssessment: { treeId, pathKey: `${id}-k`, likelihoodComponent: 0, strideCategory: "T" },
  isoRisk: { impact: "major", feasibility: value >= 4 ? "high" : "medium", value },
  ...over,
});

const RISKS = [
  risk("AT-1.1", "t1", 3),
  risk("AT-1.2", "t1", 4, { treatment: "accept" }),
  risk("AT-2.1", "t2", 2),
  risk("AT-3.1", "t3", 5, { moscowPriority: "wont" }),
];

const project = (likelihoodMethod?: string): Any => ({
  info: { name: "P", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  assets: { assets: [{ id: "A1", displayId: "DA-001", name: "Lamp request" }] },
  risks: { configuration: { likelihoodMethod, scale: "4-level" }, risks: RISKS },
  attackTree: {
    trees: [
      {
        id: "t1",
        name: "Tree one",
        pathAnalysis: { paths: [{ pathKey: "AT-1.1-k", path: ["Root", "Leaf A"] }] },
      },
      { id: "t2", name: "", pathAnalysis: { paths: [{ pathKey: "AT-2.1-k", path: ["Root two", "Leaf B"] }] } },
    ],
  },
  computed: {
    riskBeforeLabels: new Map(),
    riskAfterLabels: new Map(),
    moscowLabels: new Map(),
    impactLabels: new Map(),
  },
});
const cfg = (language: "en" | "de" = "en"): Any => ({
  ...createDefaultDocData().configuration,
  language,
  chapters: DEFAULT_CHAPTER_CONFIG,
});

const chapter = (G: Any, p: Any, lang: "en" | "de" = "en") =>
  new G(p, cfg(lang), t).generateAttackPathRisks("Risks (scenarios)");

describe("attack-path risk chapter — ISO", () => {
  const c = chapter(MarkdownGenerator, project("iso-21434"));

  it("is rendered with the ISO header", () => {
    expect(c.hasContent).toBe(true);
    expect(c.content).toMatch(/^## Risk Assessment \(Threat Scenarios\)/);
    expect(c.content).toContain("Annex H.8");
    expect(c.content).not.toContain("{{");
  });

  it("one group per scenario: tree name, else root goal; MAX value, union of treatments", () => {
    expect(c.content).toContain("### AT-1 Tree one");
    expect(c.content).toContain("Risk value 4 – High · Residual – · Treatment: Reduce, Retain");
    expect(c.content).toContain("### AT-2 Root two");
    expect(c.content).toContain("Risk value 2 – Low");
  });

  it("rows show the path chain and the ISO value; won't risks stay out", () => {
    expect(c.content).toContain("| Root → Leaf A | 3 – Medium (Impact Major × AF Medium)");
    expect(c.content).not.toContain("AT-3");
  });

  it("statistics by asset", () => {
    expect(c.content).toContain("| Asset | Risks |");
    expect(c.content).toContain("| DA-001 Lamp request | 3 |");
  });

  it("German", () => {
    const de = chapter(MarkdownGenerator, project("iso-21434"), "de").content;
    expect(de).toMatch(/^## Risikobewertung \(Bedrohungsszenarien\)/);
  });

  it("AsciiDoc, HTML and StrictDoc render it", () => {
    for (const G of [AsciidocGenerator, HtmlGenerator, StrictdocGenerator]) {
      const out = chapter(G, project("iso-21434"));
      expect(out.hasContent, G.name).toBe(true);
      expect(out.content, G.name).toContain("AT-1 Tree one");
      expect(out.content, G.name).not.toContain("{{");
    }
  });
});

describe("attack-path risk chapter — other methods", () => {
  it("hidden outside iso-21434 (principle 6)", () => {
    for (const m of [undefined, "en-50742-a", "etsi-tvra"]) {
      expect(chapter(MarkdownGenerator, project(m)).hasContent).toBe(false);
    }
  });
});

describe("pdfmake", () => {
  /** Texts of all h1 nodes of the document definition, in order. */
  const titles = (p: Any): string[] => {
    const out: string[] = [];
    const walk = (node: Any) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        if (node.style === "h1" && typeof node.text === "string") out.push(node.text);
        Object.values(node).forEach(walk);
      }
    };
    const riskChapters = {
      ...cfg(),
      chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id.startsWith("risks-")),
    };
    walk(new PdfMakeConverter(p, riskChapters, t).createDocumentDefinition().content);
    return out;
  };

  it("ISO: the scenario chapter, no empty STRIDE risk chapter", () => {
    const h1 = titles(project("iso-21434"));
    expect(h1).toContain("Risk Assessment (Threat Scenarios)");
    expect(h1.filter((x: string) => x.startsWith("Risk Assessment (STRIDE"))).toEqual([]);
  });

  it("other methods: no scenario chapter", () => {
    expect(titles(project())).not.toContain("Risk Assessment (Threat Scenarios)");
  });

  it("per-element and per-interaction risks: each chapter once", () => {
    const p = project();
    p.risks.risks = [
      { ...RISKS[0], sourceStrideMethod: "per-element", attackTreeAssessment: undefined },
      { ...RISKS[2], sourceStrideMethod: "per-interaction", attackTreeAssessment: undefined },
    ];
    const h1 = titles(p).filter((x: string) => x.startsWith("Risk Assessment"));
    expect(h1).toEqual([
      "Risk Assessment (STRIDE per Element)",
      "Risk Assessment (STRIDE per Interaction)",
    ]);
  });
});
