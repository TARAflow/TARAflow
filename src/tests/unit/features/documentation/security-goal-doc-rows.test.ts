// tests/unit/features/documentation/security-goal-doc-rows.test.ts
//
// The report used to list security goals as bare codes ("C, I, A") — no level,
// no source, no basis. An auditor could not tell a derived goal from an
// analyst decision, nor see the rationale IEC 62443-4-1 expects for deviations.
// The goal table carries all of it, with the basis taken from the SAME
// explainLevel() the deriver uses to set the level.
//
// Phase 5: rows come from goalStates(). The "Source" column carries the state
// (design §4.1) and deliberately excluded goals are listed with their
// rationale (invariant C).

import { describe, it, expect } from "vitest";
import { buildSecurityGoalDocRows } from "features/documentation/utils/security-goal-doc-rows";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import {
  adjustGoal,
  excludeGoal,
  setGoalImpact,
} from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";

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

  it("one row per active goal, canonical goal order, inactive goals omitted", () => {
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
    expect(c.source).toBe("Derived (minimum level)");
    expect(c.basis).toContain("not applicable → minimum level");
    expect(c.basis).not.toContain("Safety");
  });

  it("manual goal: rationale as basis; missing rationale is flagged", () => {
    // AuthZ and N are not suggested by a "transports" relation → added goals
    expect(rows.find((r) => r.goal.endsWith("(AuthZ)"))).toMatchObject({
      source: "Added",
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
    expect(de.find((r) => r.goal.endsWith("(AuthZ)"))!.source).toBe("Hinzugefügt");
    expect(i.basis).toContain("Sicherheitsauswirkung = 4");
  });

  it("no active goals → no rows (table omitted)", () => {
    const bare = asset({ securityGoals: [] } as Partial<Asset>);
    expect(buildSecurityGoalDocRows([bare], "4-level", "en")).toEqual([]);
  });
});


// ──────────────────────────────────────────────────────────────────────────
// Phase 5 — state in "Source", excluded goals included
// ──────────────────────────────────────────────────────────────────────────

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });

function derived(ratings: ImpactRating[]): Asset {
  const base = {
    id: "a-1",
    displayId: "DA-001",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings: ratings,
    linkedDFDElements: [{ elementId: "E-1", elementName: "Config push", relationType: "transports" }],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  return { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, S) };
}
const goalOf = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
const withGoal = (a: Asset, g: SecurityGoal): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});
const rowOf = (a: Asset, t: SecurityGoalType, lang: "en" | "de" = "en") =>
  buildSecurityGoalDocRows([a], S, lang).find((x) => x.goal.endsWith(`(${t})`));

describe("buildSecurityGoalDocRows — goal state (Phase 5)", () => {
  it("excluded goal appears with its rationale (invariant C)", () => {
    const a0 = derived([r("safety", 4), r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goalOf(a0, "C"), "No secrets in the config", S));
    expect(rowOf(a, "C")).toMatchObject({
      level: "-",
      source: "Excluded",
      basis: expect.stringContaining("No secrets in the config"),
      excluded: true,
    });
    expect(rowOf(a, "C")!.basis).toContain("Suggestion: ");
    expect(rowOf(a, "C", "de")!.source).toBe("Ausgeschlossen");
  });

  it("excluded goal without rationale is flagged", () => {
    const a0 = derived([r("safety", 4), r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goalOf(a0, "C"), "", S));
    expect(rowOf(a, "C")!.basis).toContain("(no rationale given)");
  });

  it("an exclusion that is no longer suggested is moot — not reported", () => {
    const a0 = derived([r("safety", 4), r("financial_damage", 3)]);
    const excluded = withGoal(a0, excludeGoal(a0, goalOf(a0, "C"), "n/r", S));
    const unlinked = { ...excluded, linkedDFDElements: [] } as Asset;
    expect(rowOf(unlinked, "C")).toBeUndefined();
  });

  it("assessment missing: never an ordinary 'Low' (invariant D)", () => {
    const row = rowOf(derived([]), "I")!;
    expect(row.level).toBe("Assessment required");
    expect(row.source).toBe("Derived (assessment required)");
  });

  it("provisional level is marked as such", () => {
    expect(rowOf(derived([r("safety", 3)]), "C")!.source).toBe("Derived (provisional)");
  });

  it("changed basis of a manual decision: graded marker with reason", () => {
    const a0 = derived([r("financial_damage", 2)]);
    const decided = withGoal(a0, adjustGoal(a0, goalOf(a0, "C"), "medium", "ok", S));
    const raised = { ...decided, impactRatings: [r("financial_damage", 4)] } as Asset;
    expect(rowOf(raised, "C")!.source).toBe(
      "Adjusted — review: suggested level raised to Critical",
    );
    const lowered = { ...decided, impactRatings: [r("financial_damage", 1)] } as Asset;
    expect(rowOf(lowered, "C")!.source).toBe(
      "Adjusted — suggestion changed: suggested level lowered to Low",
    );
    expect(rowOf(raised, "C", "de")!.source).toBe(
      "Angepasst — prüfen: vorgeschlagene Stufe auf Kritisch gestiegen",
    );
  });

  it("per-goal impact: basis cites the goal's EFFECTIVE value, not the asset's", () => {
    const a0 = derived([r("safety", 4), r("operational", 1)]);
    const a = withGoal(a0, {
      ...setGoalImpact(goalOf(a0, "I"), "safety", 2),
      rationale: "Interlock limits the consequence",
    });
    const row = rowOf(a, "I")!;
    expect(row.source).toBe("Derived, impact adjusted");
    expect(row.basis).toContain("Level from: Safety Impact = 2");
    expect(row.basis).not.toContain("Safety Impact = 4");
    expect(row.basis).toContain("Impact of this goal: Safety Impact = 2 (asset: 4)");
    expect(row.basis).toContain("Rationale: Interlock limits the consequence");
  });

  it("override above the asset value is named (invariant E)", () => {
    const a0 = derived([r("safety", 2)]);
    const a = withGoal(a0, { ...setGoalImpact(goalOf(a0, "I"), "safety", 3), rationale: "x" });
    expect(rowOf(a, "I")!.basis).toContain("Safety Impact = 3 (exceeds asset value 2)");
  });

  it("manual goal on the suggested level deviates from nothing: derivation as basis", () => {
    const a0 = derived([r("safety", 4)]);
    const level = goalOf(a0, "I").level as "critical";
    const a = withGoal(a0, adjustGoal(a0, goalOf(a0, "I"), level, "", S));
    const row = rowOf(a, "I")!;
    expect(row.source).toBe("Adjusted");
    expect(row.basis).toContain("Safety Impact = 4");
    expect(row.basis).not.toContain("(no rationale given)");
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
    // basis = rationale + the suggestion the decision deviates from
    expect(content).toContain("<td>&lt;b&gt;x&lt;/b&gt;; Suggestion: Critical</td>");
  });

  it("strictdoc", () => {
    const { content } = assetsChapter(new StrictdocGenerator(project([asset()]), cfg("en"), t));
    expect(content).toContain("TITLE: Security Goals");
    expect(content).toContain("   * - Config DB\n     - Integrity (I)");
  });

  it("markdown: excluded goal listed with its rationale", () => {
    const a = asset({
      securityGoals: [
        { type: "I", level: "critical", source: "suggested", formalDescription: "" },
        {
          type: "C",
          level: "none",
          source: "manual",
          formalDescription: "",
          rationale: "Public configuration",
          suggestionAtDecision: { suggested: true, level: "low", basis: "not-applicable" },
        },
      ],
    } as Partial<Asset>);
    const { content } = assetsChapter(new MarkdownGenerator(project([a]), cfg("en"), t));
    expect(content).toContain("| Config DB | Confidentiality (C) | - | Excluded | Public configuration");
  });

  it("pdfmake: same rows, excluded rows set apart", () => {
    const a = asset({
      securityGoals: [
        { type: "I", level: "critical", source: "suggested", formalDescription: "" },
        { type: "C", level: "none", source: "manual", formalDescription: "", rationale: "Public" },
      ],
    } as Partial<Asset>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conv = new PdfMakeConverter(project([a]), cfg("en"), t) as any;
    const table = conv.createSecurityGoalTable().find((c: { table?: unknown }) => c.table);
    const body = table.table.body as { text: string; italics?: boolean }[][];
    const c = body.find((row) => row[1].text === "Confidentiality (C)")!;
    expect(c[3].text).toBe("Excluded");
    expect(c[0].italics).toBe(true);
    expect(body.find((row) => row[1].text === "Integrity (I)")![0].italics).toBeUndefined();
  });

  it("omitted when no asset has an active goal", () => {
    const bare = asset({ securityGoals: [] } as Partial<Asset>);
    const { content } = assetsChapter(new MarkdownGenerator(project([bare]), cfg("en"), t));
    expect(content).not.toContain("### Security Goals")
  });
});
