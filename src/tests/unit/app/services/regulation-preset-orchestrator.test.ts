import { describe, it, expect } from "vitest";
import { applyRegulationPresetToProject } from "app/services/regulation-preset-orchestrator";
import { threadWindowOfOpportunity } from "app/services/regulation-preset-orchestrator";
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