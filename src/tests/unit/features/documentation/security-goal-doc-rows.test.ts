// tests/unit/features/documentation/security-goal-doc-rows.test.ts
//
// The report used to list security goals as bare codes ("C, I, A") — no level,
// no source, no basis. An auditor could not tell a derived goal from an
// analyst decision, nor see the rationale IEC 62443-4-1 expects for deviations.
// The goal table carries all of it, with the basis taken from the SAME
// explainLevel() the deriver uses to set the level.

import { describe, it, expect } from "vitest";
import { buildSecurityGoalDocRows } from "features/documentation/utils/security-goal-doc-rows";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import type { Asset } from "features/assets/models/asset-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "A-001",
    name: "Config DB",
    assetGroup: "data",
    overallImpact: 4,
    properties: { description: "Device configuration" },
    impactRatings: [
      { criterionId: "safety", value: 4 },
      { criterionId: "regulatory_compliance", value: "na" },
      { criterionId: "financial_damage", value: "na" },
      { criterionId: "reputation", value: "na" },
    ],
    linkedDFDElements: [
      { elementId: "DF-1", elementName: "Config push", relationType: "transports" },
    ],
    securityGoals: [
      { type: "C", level: "low", source: "suggested", formalDescription: "" },
      {
        type: "I",
        level: "critical",
        source: "suggested",
        formalDescription: "",
        consequence: "Manipulated setpoint injures operator",
      },
      { type: "A", level: "none", formalDescription: "" },
      {
        type: "AuthZ",
        level: "high",
        source: "manual",
        formalDescription: "",
        rationale: "Write access | service port only",
      },
      { type: "N", level: "medium", source: "manual", formalDescription: "" },
    ],
    ...overrides,
  } as unknown as Asset;
}

// ──────────────────────────────────────────────────────────────────────────

describe("buildSecurityGoalDocRows", () => {
  const rows = buildSecurityGoalDocRows([asset()], "4-level", "en");

  it("one row per active goal, canonical goal order, 'none' omitted", () => {
    expect(rows.map((r) => r.goal)).toEqual([
      "Confidentiality (C)",
      "Integrity (I)",
      "Non-repudiation (N)",
      "Authorization (AuthZ)",
    ]);
  });

  it("derived goal: relations + the criterion that drives the level", () => {
    const i = rows.find((r) => r.goal.endsWith("(I)"))!;
    expect(i).toMatchObject({ level: "Critical", source: "Derived" });
    expect(i.basis).toContain("Config push → transports");
    expect(i.basis).toContain("Safety Impact = 4");
    expect(i.consequence).toBe("Manipulated setpoint injures operator");
  });

  it("derived goal with all relevant criteria n/a: says so, does not cite the unrelated MAX", () => {
    const c = rows.find((r) => r.goal.endsWith("(C)"))!;
    expect(c.basis).toContain("not applicable → minimum level");
    expect(c.basis).not.toContain("Safety");
  });

  it("manual goal: rationale as basis; missing rationale is flagged", () => {
    expect(rows.find((r) => r.goal.endsWith("(AuthZ)"))).toMatchObject({
      source: "Manual",
      basis: "Write access | service port only",
    });
    expect(rows.find((r) => r.goal.endsWith("(N)"))!.basis).toBe(
      "(no rationale given)",
    );
  });

  it("German labels", () => {
    const de = buildSecurityGoalDocRows([asset()], "4-level", "de");
    const i = de.find((r) => r.goal.endsWith("(I)"))!;
    expect(i).toMatchObject({ goal: "Integrität (I)", level: "Kritisch", source: "Abgeleitet" });
    expect(i.basis).toContain("Sicherheitsauswirkung = 4");
  });

  it("no active goals → no rows (table omitted)", () => {
    const bare = asset({ securityGoals: [] } as Partial<Asset>);
    expect(buildSecurityGoalDocRows([bare], "4-level", "en")).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────

const t = ((k: string) => k) as never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (assets: Asset[]): any => ({
  info: { name: "Test" },
  assets: { configuration: { impactScale: "4-level" }, assets },
  computed: { impactLabels: new Map() },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (language: "en" | "de"): any => ({ language });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assetsChapter = (gen: any) => gen.generateAssets("Assets");

describe("assets chapter renders the goal table in every text format", () => {
  it("markdown: table present, pipes in the rationale escaped", () => {
    const { content } = assetsChapter(new MarkdownGenerator(project([asset()]), cfg("en"), t));
    expect(content).toContain("### Security Goals");
    expect(content).toContain("| Config DB | Integrity (I) | Critical | Derived |");
    expect(content).toContain("Write access \\| service port only");
  });

  it("markdown (de)", () => {
    const { content } = assetsChapter(new MarkdownGenerator(project([asset()]), cfg("de"), t));
    expect(content).toContain("### Schutzziele");
    expect(content).toContain("Integrität (I)");
  });

  it("asciidoc", () => {
    const { content } = assetsChapter(new AsciidocGenerator(project([asset()]), cfg("en"), t));
    expect(content).toContain("=== Security Goals");
    expect(content).toContain("| Config DB | Integrity (I) | Critical | Derived");
  });

  it("html: escaped cells", () => {
    const withTag = asset({
      securityGoals: [
        { type: "I", level: "high", source: "manual", formalDescription: "", rationale: "<b>x</b>" },
      ],
    } as Partial<Asset>);
    const { content } = assetsChapter(new HtmlGenerator(project([withTag]), cfg("en"), t));
    expect(content).toContain("<h3>Security Goals</h3>");
    expect(content).toContain("<td>&lt;b&gt;x&lt;/b&gt;</td>");
  });

  it("strictdoc", () => {
    const { content } = assetsChapter(new StrictdocGenerator(project([asset()]), cfg("en"), t));
    expect(content).toContain("TITLE: Security Goals");
    expect(content).toContain("   * - Config DB\n     - Integrity (I)");
  });

  it("omitted when no asset has an active goal", () => {
    const bare = asset({ securityGoals: [] } as Partial<Asset>);
    const { content } = assetsChapter(new MarkdownGenerator(project([bare]), cfg("en"), t));
    expect(content).not.toContain("### Security Goals")
  });
});
