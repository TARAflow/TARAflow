// tests/unit/features/documentation/methodology-chapter.test.ts
//
// ISO/SAE 21434 conformance plan 0d: the report's methodology chapter is
// rendered from the derived methodology record (buildMethodologyRecord) — in
// every format that implements it, only for iso-21434 projects.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { transformProjectToDocData } from "app/services/doc-transform";
import { buildMethodologyRecord } from "app/services/methodology-record";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { toDocProjectData } from "../../../../../taraflow-reporter/cli/to-doc-project-data";
import type { Project } from "app/models/project-types";

// English translation from the real locale files (doc, assets, risks,
// common), falling back to the default — the chapter's texts live there.
const EN = ["doc", "assets", "risks", "common"].map((ns) =>
  JSON.parse(readFileSync(join(process.cwd(), "src/i18n/locales/en", `${ns}.json`), "utf-8")),
);
const lookup = (key: string): string | undefined => {
  for (const root of EN) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = key.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), root);
    if (typeof v === "string") return v;
  }
  return undefined;
};
const t = ((k: string, d?: string) => lookup(k) ?? d ?? k) as never;

const project = (regulation: string[], likelihoodMethod?: string): Project =>
  ({
    id: "p",
    info: {
      name: "P",
      version: "1",
      responsible: "",
      created: "",
      lastModified: "",
      team: [],
      tags: { domain: [], platform: [], regulation, custom: [] },
    },
    assets: {
      configuration: {
        ...DEFAULT_ASSET_CONFIGURATION,
        impactCriteria: ["safety", "financial_damage", "operational", "privacy"].map(
          (id) => ({ id, weight: 0.25 }),
        ),
      },
      assets: [],
    },
    risks: {
      configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod, impactAggregation: "max" },
      risks: [],
    },
    attackTrees: null,
  }) as unknown as Project;

const ISO = () => project(["ISO 21434"], "iso-21434");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chapter = (Gen: any, p: Project) =>
  new Gen(transformProjectToDocData(p, "en"), { language: "en" }, t).generateMethodology(
    "Methodology",
  );

describe("methodology chapter — markdown", () => {
  const c = chapter(MarkdownGenerator, ISO());

  it("is rendered for an ISO project", () => {
    expect(c.hasContent).toBe(true);
    expect(c.content).toMatch(/^## Methodology/);
  });

  it("states the configuration it was computed with", () => {
    expect(c.content).toContain("| Impact rating (15.5) | Negligible, Moderate, Major, Severe |");
    expect(c.content).toContain("highest rated category");
    expect(c.content).toContain("attack feasibility (attack potential, Annex G.2");
  });

  it("G.7 bands from the project configuration", () => {
    expect(c.content).toContain("| High | 0–13 |");
    expect(c.content).toContain("| Medium | 14–19 |");
    expect(c.content).toContain("| Low | 20–24 |");
    expect(c.content).toContain("| Very Low | ≥ 25 |");
  });

  it("gate rules and treatment names from the constants", () => {
    expect(c.content).toContain("| Attack potential (effort) | sum | minimum |");
    expect(c.content).toContain("| Retain | accept |");
    expect(c.content).toContain("| Avoid | eliminate |");
  });

  it("explains the seven cybersecurity properties, no mapping onto CIA", () => {
    expect(c.content).toContain("### Cybersecurity properties");
    expect(c.content).toContain(
      "| Authorization (AuthZ) | Only permitted subjects can perform an action or reach a resource. |",
    );
    expect(c.content.match(/^\| [A-Za-z-]+ \((C|I|A|N|AuthN|AuthZ|Acc)\) \|/gm)).toHaveLength(7);
    expect(c.content).not.toContain("C or I");
  });

  it("cites the calculation stamps of the record", () => {
    const stamps = buildMethodologyRecord(ISO()).calcStamps!;
    expect(c.content).toContain(`| ${stamps.risk.calcVersion} | ${stamps.risk.mappingVersion} |`);
    expect(c.content).toContain(`| ${stamps.path.calcVersion} | ${stamps.path.mappingVersion} |`);
  });

  it("names a non-conforming impact scale", () => {
    const p = ISO();
    p.assets!.configuration.impactScale = "5-level";
    expect(chapter(MarkdownGenerator, p).content).toContain("does not conform");
  });
});

describe("methodology chapter — risk value (3a-2)", () => {
  const c = chapter(MarkdownGenerator, ISO());

  it("states the Annex H.8 matrix", () => {
    expect(c.content).toContain("### Risk value (15.8): matrix of Annex H.8");
    expect(c.content).toContain("| Severe | 2 | 3 | 4 | 5 |");
    expect(c.content).toContain("| Negligible | 1 | 1 | 1 | 1 |");
  });

  it("explains that the safety number is the Se factor", () => {
    expect(c.content).toContain("unlike the other categories, 1 is not negligible here");
  });
});

describe("risk tables of an ISO report (3a-2)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withRisk = (p: Project): any => {
    const doc = transformProjectToDocData(p, "en");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc.risks as any).risks = [
      {
        id: "R1",
        threatId: "T1",
        threatDisplayId: "P1-T-1",
        threatDescription: "x",
        sourceStrideMethod: "per-element",
        moscowPriority: "should",
        treatment: "reduce",
        selectedMitigations: [],
        calculatedRiskBeforeMitigation: 12,
        calculatedRiskAfterMitigation: 6,
        isoRisk: { impact: "major", feasibility: "high", value: 4, residual: { feasibility: "low", value: 2 } },
      },
    ];
    return doc;
  };

  it("ISO: risk value with its inputs instead of I × L", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gen = new MarkdownGenerator(withRisk(ISO()), { language: "en" } as any, t) as any;
    const content = gen.generateRisks("Risks", "per-element").content as string;
    expect(content).toContain("4 – High (Impact Major × AF High)");
    expect(content).toContain("2 – Low (Impact Major × AF Low)");
    expect(content).not.toContain("| 12 |");
    // the statistics count the ISO values, no label of the I × L scale
    expect(content).toContain("4 – High");
    expect(content).not.toContain("Very High");
    expect(content).not.toContain("Critical 1");
  });

  it("other methods: unchanged", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gen = new MarkdownGenerator(withRisk(project([], undefined)), { language: "en" } as any, t) as any;
    const content = gen.generateRisks("Risks", "per-element").content as string;
    expect(content).not.toContain("Major ×");
  });
});

describe("methodology chapter — other presets and formats", () => {
  it("is hidden for every other preset (principle 6)", () => {
    for (const [reg, m] of [[[], undefined], [["EN 50742"], "en-50742-a"], [["ETSI TVRA"], "etsi-tvra"]] as const) {
      expect(chapter(MarkdownGenerator, project([...reg], m)).hasContent).toBe(false);
    }
  });

  it("AsciiDoc, HTML and StrictDoc render the chapter", () => {
    const adoc = chapter(AsciidocGenerator, ISO()).content;
    expect(adoc).toMatch(/^== Methodology/);
    expect(adoc).toContain("| Retain | accept");
    const html = chapter(HtmlGenerator, ISO()).content;
    expect(html).toContain('<section id="methodology">');
    expect(html).toContain("<td>Retain</td><td>accept</td>");
    const sdoc = chapter(StrictdocGenerator, ISO()).content;
    expect(sdoc).toContain("TITLE: Methodology");
    expect(sdoc).toContain("   * - Retain\n     - accept");
  });

  it("the CLI mapper carries the same record", () => {
    const doc = toDocProjectData(ISO(), "en");
    expect(doc.computed.methodology).toEqual(buildMethodologyRecord(ISO()));
  });
});
