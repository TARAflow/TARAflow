// Design §5.5 / Phase 3: the risk assessment chapter states how the impact of
// the risks was aggregated — in every format.

import { describe, expect, it } from "vitest";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";

const t = ((k: string) => k) as never;
const risk = {
  id: "r1",
  threatDisplayId: "P1-T-1",
  sourceStrideMethod: "per-element",
  moscowPriority: "must",
  strideCategory: "T",
  threatDescription: "x",
  selectedMitigations: [],
  calculatedRiskBeforeMitigation: 8,
  calculatedRiskAfterMitigation: 4,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (impactAggregation?: string): any => ({
  info: { name: "Test" },
  risks: { configuration: { impactAggregation }, risks: [risk] },
  computed: {
    riskBeforeLabels: new Map(),
    riskAfterLabels: new Map(),
    moscowLabels: new Map(),
    impactLabels: new Map(),
  },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (language: "en" | "de"): any => ({ language, chapters: [] });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risks = (gen: any) => gen.generateRisks("Risks", "per-element").content as string;

describe("risk chapter: impact aggregation sentence", () => {
  it("markdown, asciidoc, html, strictdoc carry it; no placeholder left", () => {
    for (const G of [MarkdownGenerator, AsciidocGenerator, HtmlGenerator, StrictdocGenerator]) {
      const c = risks(new G(project("harm-floor"), cfg("en"), t));
      expect(c, G.name).toContain("Impact aggregation: harm floor");
      expect(c, G.name).not.toContain("{{impactAggregation}}");
    }
  });

  it("German; a project without the setting says weighted mean", () => {
    expect(risks(new MarkdownGenerator(project("max"), cfg("de"), t))).toContain(
      "Impact-Aggregation: Maximum",
    );
    expect(risks(new MarkdownGenerator(project(), cfg("en"), t))).toContain(
      "Impact aggregation: weighted mean of all rated impact factors.",
    );
  });

  it("pdfmake", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conv = new PdfMakeConverter(project("max"), cfg("en"), t) as any;
    conv.getRisksPerElement = () => [risk];
    conv.getRisksPerInteraction = () => [];
    const texts = JSON.stringify(conv.createRisks("per-element"));
    expect(texts).toContain("Impact aggregation: maximum");
  });
});

// Phase 5 scope A showed the `I × L` risk per impact category in the ISO
// traceability matrix. Superseded by conformance plan 3a (decision 20 E4):
// the matrix shows the ISO risk value 1–5 with its Annex H.8 inputs instead,
// and no per-category `I × L` split.
describe("ISO traceability: risk value 1–5 instead of I × L per category", () => {
  it("shows value and matrix inputs, no S/F/O/P split", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = project("max");
    p.risks.configuration = {
      scale: "4-level",
      roundingMethod: "round",
      likelihoodMethod: "iso-21434",
      impactAggregation: "max",
      customFactors: [],
      activeFactors: [],
    };
    p.risks.risks = [
      {
        ...risk,
        linkedAssetIds: [],
        treatment: "reduce",
        factorRatings: [{ factorId: "safety", value: 4, weight: 1 }],
        isoRisk: {
          impact: "severe",
          feasibility: "high",
          value: 5,
          residual: { feasibility: "low", value: 3 },
        },
      },
    ];
    p.computed.riskBeforeLabels = new Map([["r1", "High"]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gen = new MarkdownGenerator(p, cfg("en"), t) as any;
    const { content } = gen.generateTraceabilityMatrix("Traceability");
    expect(content).toContain(
      "| 5 – risks.isoRiskValue.5 (tabs.doc.iso.impact risks.iso.impact.severe × tabs.doc.iso.feasibilityShort risks.iso.feasibility.high) |",
    );
    expect(content).toContain("| 3 – risks.isoRiskValue.3 (");
    expect(content).not.toMatch(/\(S [^)]* · F /);
    expect(content).not.toContain("High (");
  });
});
