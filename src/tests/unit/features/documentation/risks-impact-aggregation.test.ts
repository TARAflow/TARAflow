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
    const texts = JSON.stringify(conv.createRisks());
    expect(texts).toContain("Impact aggregation: maximum");
  });
});

// Phase 5 scope A: the ISO traceability matrix shows the risk per impact
// category behind the register value.
describe("ISO traceability: risk per impact category", () => {
  it("register label plus S/F/O/P levels", () => {
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
        factorRatings: [
          { factorId: "safety", value: 4, weight: 1 },
          { factorId: "financial_damage", value: 1, weight: 1 },
          // ISO/IEC 18045 attack potential: all lowest → high feasibility
          { factorId: "iso_elapsed_time", value: 1, weight: 1 },
          { factorId: "iso_expertise", value: 1, weight: 1 },
          { factorId: "iso_knowledge", value: 1, weight: 1 },
          { factorId: "iso_window_of_opportunity", value: 1, weight: 1 },
          { factorId: "iso_equipment", value: 1, weight: 1 },
        ],
      },
    ];
    p.computed.riskBeforeLabels = new Map([["r1", "High"]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gen = new MarkdownGenerator(p, cfg("en"), t) as any;
    const { content } = gen.generateTraceabilityMatrix("Traceability");
    const m = content.match(/High \(S ([^ ·)]+) · F ([^ ·)]+)\)/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toBe("-");
    expect(m![1]).not.toBe(m![2]); // safety 4 vs financial 1
  });
});
