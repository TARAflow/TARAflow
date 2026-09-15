// tests/unit/features/documentation/traceability-matrix.test.ts
//
// The ISO/SAE 21434 report gets a dedicated Traceability Matrix chapter
// (design doc §6): one row per risk walking AS → DS → TS → AF → Risk →
// Treatment → residual, with a "resolved"/"missing" coverage status per link.
// It is gated on risks.configuration.likelihoodMethod === "iso-21434" and
// auto-hides otherwise.
//
// These cases also lock the corrected ISO/SAE 21434 Table G.7 feasibility
// bands (High 0–13, Medium 14–19, Low 20–24, Very low ≥25) through the actual
// report path — the previous mapping mis-read the split "High" cell and shifted
// every band by one, which surfaced here as a wrong AF label.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";

// A translation fn that returns the supplied default (or the key) — keeps the
// assertions human-readable ("low", "resolved", "reduce") instead of raw keys.
const t = ((k: string, d?: string) => d ?? k) as never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = { language: "en" };

// The five ISO Annex G.2 factor ids, in the core's canonical order.
const iso = (
  elapsedTime: number,
  expertise: number,
  knowledge: number,
  windowOfOpportunity: number,
  equipment: number,
): { factorId: string; value: number }[] => [
  { factorId: "iso_elapsed_time", value: elapsedTime },
  { factorId: "iso_expertise", value: expertise },
  { factorId: "iso_knowledge", value: knowledge },
  { factorId: "iso_window_of_opportunity", value: windowOfOpportunity },
  { factorId: "iso_equipment", value: equipment },
];

// AP = 1 + 8 + 7 + 0 + 4 = 20 → Low. This is verbatim the standard's own
// worked example (Annex H, Table H.7, row 1). Old (buggy) bands returned
// "very-low" for 20; the corrected bands return "low".
const FACTORS_AP20_LOW = iso(
  2, // elapsed <=1week   → 1
  4, // multiple-experts  → 8
  3, // confidential      → 7
  1, // unlimited         → 0
  2, // specialized       → 4
);

// AP = 4 + 6 + 3 + 0 + 0 = 13 → High (top of the merged High cell). Old bands
// returned "medium" for 13; the corrected bands return "high". Boundary guard.
const FACTORS_AP13_HIGH = iso(
  3, // elapsed <=1month  → 4
  3, // expert           → 6
  2, // restricted       → 3
  1, // unlimited        → 0
  1, // standard         → 0
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseProject = (likelihoodMethod: string, risks: any[]): any => ({
  info: { name: "Test" },
  assets: {
    assets: [
      {
        id: "AS-CFG",
        displayId: "AS-1",
        name: "Config Data",
        // Rated safety impact → the DS link resolves to the "safety" category.
        impactRatings: [{ criterionId: "safety", value: 3 }],
      },
      {
        id: "AS-BARE",
        displayId: "AS-2",
        name: "Unrated Asset",
        impactRatings: [], // nothing rated → DS status "missing"
      },
    ],
  },
  threats: { perElementTables: [], perInteractionTables: [] },
  risks: { configuration: { likelihoodMethod }, risks },
  computed: {
    riskBeforeLabels: new Map<string, string>(),
    riskAfterLabels: new Map<string, string>(),
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const matrix = (gen: any) => gen.generateTraceabilityMatrix("Traceability Matrix");

describe("Traceability Matrix chapter (ISO/SAE 21434)", () => {
  it("auto-hides for a non-iso-21434 project", () => {
    const gen = new MarkdownGenerator(
      baseProject("standard", [
        {
          id: "R-1",
          threatDisplayId: "TS-x",
          threatDescription: "irrelevant",
          treatment: "reduce",
          linkedAssetIds: ["AS-CFG"],
          factorRatings: FACTORS_AP20_LOW,
          calculatedRiskBeforeMitigation: 4,
          calculatedRiskAfterMitigation: 2,
        },
      ]),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(false);
    expect(chapter.content).toBe("");
  });

  it("hasContent:false when there are no risks", () => {
    const gen = new MarkdownGenerator(baseProject("iso-21434", []), config, t);
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(false);
    expect(chapter.content).toBe("");
  });

  it("markdown: a fully-rated ISO risk renders a resolved row with the correct AP/feasibility (AP 20 → Low)", () => {
    const gen = new MarkdownGenerator(
      baseProject("iso-21434", [
        {
          id: "R-AP",
          // An attack-path-sourced display id — note the anchor TARGET is this
          // raw id (see the attack-path dead-link ticket); the label is TS-1.
          threatDisplayId: "AT-at-123-su3-T",
          threatDescription: "Malicious control signals via cellular ECU",
          treatment: "reduce",
          linkedAssetIds: ["AS-CFG"],
          factorRatings: FACTORS_AP20_LOW,
          calculatedRiskBeforeMitigation: 4,
          calculatedRiskAfterMitigation: 2,
        },
      ]),
      config,
      t,
    );
    const chapter = matrix(gen as never);

    expect(chapter.hasContent).toBe(true);
    // AS + DS link resolves to the rated safety category
    expect(chapter.content).toContain("AS-1 Config Data");
    expect(chapter.content).toContain("resolved: safety");
    // TS label is sequential; the anchor still targets the raw display id
    expect(chapter.content).toContain("[TS-1](#threat-AT-at-123-su3-T)");
    // AF: 20 → Low (the corrected band; old code produced "very-low")
    expect(chapter.content).toContain("resolved: 20 (low)");
    expect(chapter.content).not.toContain("very-low");
    // Treatment label resolves through i18n (default returns "reduce" here)
    expect(chapter.content).toContain("reduce");
  });

  it("markdown: AP 13 lands in High (boundary guard for the corrected Table G.7)", () => {
    const gen = new MarkdownGenerator(
      baseProject("iso-21434", [
        {
          id: "R-13",
          threatDisplayId: "DF-3-T-1",
          threatDescription: "Boundary case",
          treatment: "accept",
          linkedAssetIds: ["AS-CFG"],
          factorRatings: FACTORS_AP13_HIGH,
          calculatedRiskBeforeMitigation: 3,
          calculatedRiskAfterMitigation: 3,
        },
      ]),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("resolved: 13 (high)");
    expect(chapter.content).not.toContain("medium");
  });

  it("markdown: an unrated factor makes AF 'missing'; an unrated asset makes DS 'missing'", () => {
    const gen = new MarkdownGenerator(
      baseProject("iso-21434", [
        {
          id: "R-MISS",
          threatDisplayId: "DF-9-S-1",
          threatDescription: "Incomplete rating",
          treatment: "reduce",
          linkedAssetIds: ["AS-BARE"], // no rated impact → DS missing
          // equipment factor omitted → AF missing
          factorRatings: iso(2, 4, 3, 1, 0),
          calculatedRiskBeforeMitigation: 0,
          calculatedRiskAfterMitigation: 0,
        },
      ]),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("missing"); // at least one coverage gap
    // AF label collapses to "-" when a factor is unrated
    expect(chapter.content).toContain("missing: -");
  });

  it("asciidoc: renders the matrix for an iso-21434 project", () => {
    const gen = new AsciidocGenerator(
      baseProject("iso-21434", [
        {
          id: "R-AP",
          threatDisplayId: "AT-at-123-su3-T",
          threatDescription: "Malicious control signals",
          treatment: "reduce",
          linkedAssetIds: ["AS-CFG"],
          factorRatings: FACTORS_AP20_LOW,
          calculatedRiskBeforeMitigation: 4,
          calculatedRiskAfterMitigation: 2,
        },
      ]),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("20 (low)");
    expect(chapter.content).toContain("|===");
  });
});
