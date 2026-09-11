import { describe, it, expect } from "vitest";
import { applyRegulationPresetToProject } from "app/services/regulation-preset-orchestrator";
import { threadWindowOfOpportunity } from "app/services/regulation-preset-orchestrator";
import { threadUseAssetImpact } from "app/services/regulation-preset-orchestrator";
import { threadImpactCriteria } from "app/services/regulation-preset-orchestrator";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { AssetData } from "features/assets";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Project } from "app/models/project-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks";

// Minimal Project fixtures — only the fields the orchestrator reads/writes.
// (The rest of Project is irrelevant to preset application.)

const riskData = (): RiskData =>
  ({
    configuration: {
      ...DEFAULT_CONFIGURATION,
      activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) => ({ ...f })),
    },
    risks: [],
    lastModified: new Date().toISOString(),
  }) as unknown as RiskData;

const project = (over: Partial<Project> = {}): Project =>
  ({
    id: "p1",
    settings: { strictMode: false, autoSave: true, autoSaveInterval: 2 },
    risks: riskData(),
    ...over,
  }) as unknown as Project;

const enabled = (p: Project) =>
  (p.risks!.configuration.activeFactors ?? [])
    .filter((f) => f.enabled)
    .map((f) => f.factorId)
    .sort();

describe("applyRegulationPresetToProject", () => {
  it("records the preset on settings and reconciles risk factors", () => {
    const res = applyRegulationPresetToProject(project(), "en-50742-a");

    expect(res.project.settings.regulationPreset).toBe("en-50742-a");
    expect(res.changed).toBe(true);
    expect(enabled(res.project)).toContain("exposure_level");
    // "standard" (OWASP-style) factors are NOT regime-managed — en-50742-a
    // no longer disables them (design simplification: config-dialog only
    // manages the standard method's factors; EN 50742's own factors are
    // independent of it). skill_level was already enabled by
    // DEFAULT_CONFIGURATION and stays that way.
    expect(enabled(res.project)).toContain("skill_level");
  });

  it("does not mutate the input project", () => {
    const p = project();
    const snapshot = JSON.stringify(p);
    applyRegulationPresetToProject(p, "en-50742-a");
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it("records the preset even when there is no risk data yet", () => {
    const res = applyRegulationPresetToProject(project({ risks: null }), "en-50742-a");
    expect(res.project.settings.regulationPreset).toBe("en-50742-a");
    expect(res.changed).toBe(false);
    expect(res.project.risks).toBeNull();
  });

  it("passes analyst-conflict factors through — using a genuinely regime-pooled factor", () => {
    // "size" (source: "standard") is no longer regime-managed at all — it can
    // never conflict with any preset anymore (design simplification, see
    // test above). A genuine conflict now requires a factor from an ACTUAL
    // competing norm regime — e.g. an ISO21434-source factor the analyst
    // enabled by hand before switching to en-50742-a: it's in the regime
    // pool (ISO21434 source) but not an en-50742-a target, so applying the
    // preset would normally switch it off — UNLESS the analyst explicitly
    // enabled it (autoEnabled: false), which is exactly what "conflict"
    // means here.
    const p = project();
    // iso_elapsed_time isn't in DEFAULT_CONFIGURATION.activeFactors at all
    // (only standard/EN50742/impact factors are) — add it as the analyst's
    // explicit choice, same as risk-config-dialog.tsx would when toggling a
    // factor on for the first time.
    p.risks!.configuration.activeFactors.push({
      factorId: "iso_elapsed_time",
      enabled: true,
      weight: 1.0,
      autoEnabled: false,
    });

    const res = applyRegulationPresetToProject(p, "en-50742-a");
    expect(res.conflicts).toContain("iso_elapsed_time");
  });

  it("is a no-op change for a preset that manages no factors (en-50742-b)", () => {
    const res = applyRegulationPresetToProject(project(), "en-50742-b");
    expect(res.project.settings.regulationPreset).toBe("en-50742-b");
    expect(res.changed).toBe(false);
  });
});

describe("applyRegulationPresetToProject — likelihoodMethod", () => {
  it("sets the score-table method on the risk configuration", () => {
    const res = applyRegulationPresetToProject(project(), "etsi-tvra");
    expect(res.project.risks!.configuration.likelihoodMethod).toBe("etsi-tvra");
  });

  it("sets weighted-mean for the standard preset", () => {
    const res = applyRegulationPresetToProject(project(), "standard");
    expect(res.project.risks!.configuration.likelihoodMethod).toBe(
      "weighted-mean",
    );
  });

  it("sets the method even when no factors change (en-50742-b)", () => {
    const res = applyRegulationPresetToProject(project(), "en-50742-b");
    expect(res.changed).toBe(false);
    expect(res.project.risks!.configuration.likelihoodMethod).toBe(
      "weighted-mean",
    );
  });
});

describe("threadWindowOfOpportunity", () => {
  it("sets WoO on the config when a value is provided", () => {
    const out = threadWindowOfOpportunity(project(), "moderately_restricted");
    expect(out.risks!.configuration.windowOfOpportunity).toBe(
      "moderately_restricted",
    );
  });

  it("is idempotent — returns the SAME object when WoO already matches", () => {
    const p = project();
    p.risks!.configuration.windowOfOpportunity = "limited";
    expect(threadWindowOfOpportunity(p, "limited")).toBe(p);
  });

  it("returns the same object when woo is undefined", () => {
    const p = project();
    expect(threadWindowOfOpportunity(p, undefined)).toBe(p);
  });

  it("no-ops when there is no risk data yet (ordering gap)", () => {
    const p = project({ risks: null });
    expect(threadWindowOfOpportunity(p, "unlimited")).toBe(p);
  });

  it("overwrites a previous WoO value", () => {
    const p = project();
    p.risks!.configuration.windowOfOpportunity = "very_restricted";
    const out = threadWindowOfOpportunity(p, "unlimited");
    expect(out.risks!.configuration.windowOfOpportunity).toBe("unlimited");
  });
});
describe("threadUseAssetImpact (design DS-4)", () => {
  const withUseAssetImpact = (v: boolean): Project =>
    project({
      risks: {
        ...riskData(),
        configuration: {
          ...DEFAULT_CONFIGURATION,
          useAssetImpact: v,
          activeFactors: [],
        } as unknown as RiskConfiguration,
      } as unknown as RiskData,
    });

  it("forces useAssetImpact=true for an exclusive preset when it is off", () => {
    const p = withUseAssetImpact(false);
    const out = threadUseAssetImpact(p, "iso-21434");
    expect(out.risks!.configuration.useAssetImpact).toBe(true);
    expect(out).not.toBe(p); // changed → new reference
  });

  it("is idempotent when already true (returns the same reference)", () => {
    const p = withUseAssetImpact(true);
    expect(threadUseAssetImpact(p, "etsi-tvra")).toBe(p);
  });

  it("leaves non-exclusive presets untouched (choice stays free)", () => {
    const p = withUseAssetImpact(false);
    const out = threadUseAssetImpact(p, "standard");
    expect(out).toBe(p);
    expect(out.risks!.configuration.useAssetImpact).toBe(false);
  });

  it("returns the project unchanged when there are no risks yet", () => {
    const p = project({ risks: undefined });
    expect(threadUseAssetImpact(p, "iso-21434")).toBe(p);
  });
});

describe("threadImpactCriteria (SFOP seeding — design DS-1, rule 2)", () => {
  const SFOP = ["safety", "financial_damage", "operational", "privacy"];
  const DEFAULT_CRITERIA = DEFAULT_ASSET_CONFIGURATION.impactCriteria;

  const assetData = (criteria: { id: string; weight: number }[]): AssetData =>
    ({
      assets: [],
      configuration: {
        ...DEFAULT_ASSET_CONFIGURATION,
        impactCriteria: criteria,
      },
      lastModified: "2026-01-01T00:00:00.000Z",
    }) as unknown as AssetData;

  const withCriteria = (criteria: { id: string; weight: number }[]): Project =>
    project({ assets: assetData(criteria) });

  const idsOf = (p: Project) =>
    p.assets!.configuration.impactCriteria.map((c) => c.id).sort();

  it("seeds SFOP when the criteria set is the pristine default", () => {
    const out = threadImpactCriteria(withCriteria(DEFAULT_CRITERIA), "iso-21434");
    expect(idsOf(out)).toEqual([...SFOP].sort());
  });

  it("seeds SFOP when the set is default + the DFD safety criterion", () => {
    const p = withCriteria([...DEFAULT_CRITERIA, { id: "safety", weight: 1 }]);
    expect(idsOf(threadImpactCriteria(p, "iso-21434"))).toEqual([...SFOP].sort());
  });

  it("is idempotent once seeded (SFOP present → untouched, same reference)", () => {
    const p = withCriteria(SFOP.map((id) => ({ id, weight: 0.25 })));
    expect(threadImpactCriteria(p, "iso-21434")).toBe(p);
  });

  it("leaves a config the analyst extended untouched", () => {
    const p = withCriteria([
      ...DEFAULT_CRITERIA,
      { id: "reputation", weight: 0.1 },
    ]);
    expect(threadImpactCriteria(p, "iso-21434")).toBe(p);
  });

  it("leaves a config the analyst trimmed (≠ default set) untouched", () => {
    const p = withCriteria([{ id: "financial_damage", weight: 1 }]);
    expect(threadImpactCriteria(p, "iso-21434")).toBe(p);
  });

  it("does nothing for a preset that declares no impact criteria", () => {
    const p = withCriteria(DEFAULT_CRITERIA);
    expect(threadImpactCriteria(p, "standard")).toBe(p);
  });

  it("does nothing when the project has no assets", () => {
    const p = project({ assets: null });
    expect(threadImpactCriteria(p, "iso-21434")).toBe(p);
  });
});
