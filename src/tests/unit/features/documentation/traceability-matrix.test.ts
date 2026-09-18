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
const baseProject = (
  likelihoodMethod: string,
  risks: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  attackTree?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): any => ({
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
  attackTree,
  risks: { configuration: { likelihoodMethod }, risks },
  computed: {
    riskBeforeLabels: new Map<string, string>(),
    riskAfterLabels: new Map<string, string>(),
  },
});

// A tree whose one path (keyed "pk-hi") is High at attack potential 11 — the
// shape a real ISO project produces (factors on the tree, not the risk). The
// Headlamp example is exactly this: AP 11 → "high".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const treeWith = (
  paths: { pathKey: string; feasibilityLevel?: string; attackPotential?: number }[],
  cheapest?: { pathKey: string; feasibilityLevel?: string; attackPotential?: number },
  aggregatedFeasibility?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => ({
  trees: [
    {
      id: "at-1",
      pathAnalysis: { paths, cheapestPath: cheapest, aggregatedFeasibility },
    },
  ],
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
          // Attack-path display id (AT-<tree>.<path> in real data). It doubles
          // as the anchor target, so label and #threat-<id> link stay in sync.
          threatDisplayId: "AT-1.1",
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
    // The threat display id is both the visible label and the anchor target
    expect(chapter.content).toContain("[AT-1.1](#threat-AT-1.1)");
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

describe("Traceability Matrix — attack-tree-derived feasibility (ISO source of truth)", () => {
  // An attack-path/ISO risk carries NO iso_* factors on the risk; feasibility
  // lives on its attack tree. The AF column must resolve from the tree.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isoRisk = (overrides: any = {}) => ({
    id: "R-TREE",
    threatDisplayId: "AT-at-1-66817c284a7a-T",
    threatDescription: "Attack-path threat, factors on the tree",
    treatment: "reduce",
    sourceStrideMethod: "attack-path",
    linkedAssetIds: ["AS-CFG"],
    // Only impact-derivation factors here — NOT the ISO Annex G.2 factors.
    factorRatings: [{ factorId: "safety", value: 4, source: "derived" }],
    attackTreeAssessment: {
      treeId: "at-1",
      pathKey: "pk-hi",
      likelihoodComponent: 0,
      strideCategory: "T",
    },
    calculatedRiskBeforeMitigation: 15,
    calculatedRiskAfterMitigation: 0,
    ...overrides,
  });

  it("resolves AF from the risk's own path (AP 11 → high) — the Headlamp case", () => {
    const gen = new MarkdownGenerator(
      baseProject(
        "iso-21434",
        [isoRisk()],
        treeWith([
          { pathKey: "pk-hi", feasibilityLevel: "high", attackPotential: 11 },
        ]),
      ),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.hasContent).toBe(true);
    // AF resolved from the tree, not "missing"
    expect(chapter.content).toContain("resolved: 11 (high)");
    // DS still resolves from the asset impact
    expect(chapter.content).toContain("resolved: safety");
  });

  it("falls back to the scenario cheapest path when the risk's pathKey isn't found", () => {
    const gen = new MarkdownGenerator(
      baseProject(
        "iso-21434",
        [isoRisk({ attackTreeAssessment: { treeId: "at-1", pathKey: "gone" } })],
        treeWith(
          [{ pathKey: "other", feasibilityLevel: "low", attackPotential: 20 }],
          { pathKey: "other", feasibilityLevel: "low", attackPotential: 20 },
        ),
      ),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.content).toContain("resolved: 20 (low)");
  });

  it("quick-mode path (band without a numeric attack potential) shows the band only", () => {
    const gen = new MarkdownGenerator(
      baseProject(
        "iso-21434",
        [isoRisk()],
        treeWith([{ pathKey: "pk-hi", feasibilityLevel: "medium" }]),
      ),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.content).toContain("resolved: medium");
    // no numeric potential → no "N (…)" wrapping
    expect(chapter.content).not.toContain("(medium)");
  });

  it("AF is 'missing' when the tree has no evaluation and the risk has no ISO factors", () => {
    const gen = new MarkdownGenerator(
      baseProject(
        "iso-21434",
        [isoRisk()],
        treeWith([{ pathKey: "pk-hi" }]), // path present but unrated
      ),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.content).toContain("missing: -");
  });

  it("prefers the tree over stray iso_* factors on the risk (single source of truth)", () => {
    const gen = new MarkdownGenerator(
      baseProject(
        "iso-21434",
        [
          isoRisk({
            // Even if someone mirrored ISO factors onto the risk, the tree wins.
            factorRatings: [
              { factorId: "iso_elapsed_time", value: 5 },
              { factorId: "iso_expertise", value: 4 },
              { factorId: "iso_knowledge", value: 4 },
              { factorId: "iso_window_of_opportunity", value: 4 },
              { factorId: "iso_equipment", value: 4 },
            ],
          }),
        ],
        treeWith([
          { pathKey: "pk-hi", feasibilityLevel: "high", attackPotential: 11 },
        ]),
      ),
      config,
      t,
    );
    const chapter = matrix(gen as never);
    expect(chapter.content).toContain("resolved: 11 (high)");
    expect(chapter.content).not.toContain("very-low");
  });
});
