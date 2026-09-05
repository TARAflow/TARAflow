// tests/unit/features/documentation/srsl-assessment.test.ts
//
// The EN 50742 Approach A report gets a dedicated SRSL Assessment chapter:
// one row per risk with an exposure anchor (EL > 0), showing the linked
// safety-function asset + severity and the attack-potential inputs
// EL / WoO / AC → AP → SRSL. It is separate from the R = L × I risk register
// and auto-hides for non-en-50742-a projects.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";

const t = ((k: string) => k) as never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (likelihoodMethod: string): any => ({
  info: { name: "Test" },
  assets: {
    assets: [
      {
        id: "AC",
        name: "Config Data",
        physicalImpact: "reversible_injury",
      },
    ],
  },
  risks: {
    configuration: {
      likelihoodMethod,
      windowOfOpportunity: "moderately_restricted",
    },
    risks: [
      {
        id: "R-DF3-T-1",
        threatDisplayId: "DF-3-T-1",
        moscowPriority: "should",
        linkedAssetIds: ["AC"],
        factorRatings: [
          { factorId: "exposure_level", value: 4 }, // EL3
          { factorId: "attacker_capability", value: 4 }, // basic
        ],
        calculatedApScore: 16.8,
        calculatedApBand: "AP3",
        calculatedSrsl: "SRSL3",
      },
      {
        id: "R-P1-S-1", // internal element, no exposure anchor → excluded
        threatDisplayId: "P-1-S-1",
        moscowPriority: "should",
        linkedAssetIds: [],
        factorRatings: [{ factorId: "exposure_level", value: 0 }],
        calculatedApScore: null,
        calculatedApBand: null,
        calculatedSrsl: null,
      },
    ],
  },
  computed: {},
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = { language: "en" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const srsl = (gen: any) => gen.generateSRSLAssessment("SRSL Assessment");

describe("SRSL Assessment chapter (EN 50742 Approach A)", () => {
  it("markdown: renders the SRSL table only for the EL-anchored risk", () => {
    const gen = new MarkdownGenerator(project("en-50742-a"), config, t);
    const chapter = srsl(gen as never);

    expect(chapter.hasContent).toBe(true);
    // header + separation note
    expect(chapter.content).toContain("SRSL Assessment (EN 50742 Approach A)");
    expect(chapter.content).toContain("separate");
    // the anchored risk's row: asset, severity, levels, AP, SRSL
    expect(chapter.content).toContain("DF-3-T-1");
    expect(chapter.content).toContain("Config Data");
    expect(chapter.content).toContain("reversible_injury");
    expect(chapter.content).toContain("EL3");
    expect(chapter.content).toContain("moderately_restricted");
    expect(chapter.content).toContain("16.8 (AP3)");
    expect(chapter.content).toContain("SRSL3");
    // the internal (EL 0) risk is NOT in the SRSL table
    expect(chapter.content).not.toContain("P-1-S-1");
  });

  it("asciidoc: renders the SRSL table for en-50742-a", () => {
    const gen = new AsciidocGenerator(project("en-50742-a"), config, t);
    const chapter = srsl(gen as never);

    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("SRSL Assessment (EN 50742 Approach A)");
    expect(chapter.content).toContain("SRSL3");
    expect(chapter.content).toContain("|===");
  });

  it("auto-hides for a non-en-50742-a project", () => {
    const gen = new MarkdownGenerator(project("standard"), config, t);
    const chapter = srsl(gen as never);

    expect(chapter.hasContent).toBe(false);
    expect(chapter.content).toBe("");
  });
});

import { formatConnectionAssetRelations } from "features/documentation/utils/generators/property-doc-mappers";
import { withDefaultChapters } from "features/documentation/models/doc-types";

describe("doc asset relations — resolve UUID to asset name", () => {
  it("shows the asset name, not the raw id", () => {
    const conn = {
      assetRelations: [{ assetId: "ac70a321", relationType: "transports" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const out = formatConnectionAssetRelations(
      conn,
      "en",
      (id) => (id === "ac70a321" ? "Config Data" : id),
    );
    expect(out).toContain("Config Data (transports)");
    expect(out).not.toContain("ac70a321");
  });
});

describe("withDefaultChapters — existing projects pick up new chapters", () => {
  it("inserts the SRSL chapter missing from a persisted config", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persisted: any = [
      { id: "risks-per-element", enabled: true, autoHideIfEmpty: true },
    ];
    const merged = withDefaultChapters(persisted);
    expect(merged.some((c) => c.id === "srsl-assessment")).toBe(true);
    // preserves the persisted chapter's state
    expect(merged.find((c) => c.id === "risks-per-element")?.enabled).toBe(true);
  });
});

import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";

describe("SRSL Assessment chapter — html + strictdoc", () => {
  it("html: renders the SRSL table for en-50742-a", () => {
    const gen = new HtmlGenerator(project("en-50742-a"), config, t);
    const chapter = srsl(gen as never);
    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("SRSL Assessment (EN 50742 Approach A)");
    expect(chapter.content).toContain("<td>Config Data</td>");
    expect(chapter.content).toContain("SRSL3");
  });

  it("strictdoc: renders the SRSL requirements for en-50742-a", () => {
    const gen = new StrictdocGenerator(project("en-50742-a"), config, t);
    const chapter = srsl(gen as never);
    expect(chapter.hasContent).toBe(true);
    expect(chapter.content).toContain("UID: SRSL-DF-3-T-1");
    expect(chapter.content).toContain("SRSL: SRSL3");
  });

  it("html: auto-hides for a non-en-50742-a project", () => {
    const gen = new HtmlGenerator(project("standard"), config, t);
    expect(srsl(gen as never).hasContent).toBe(false);
  });
});
