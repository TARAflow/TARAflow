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
    expect(enabled(res.project)).not.toContain("skill_level");
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

  it("passes analyst-conflict factors through", () => {
    const p = project();
    const size = p.risks!.configuration.activeFactors.find(
      (f) => f.factorId === "size",
    )!;
    size.enabled = true;
    size.autoEnabled = false;

    const res = applyRegulationPresetToProject(p, "en-50742-a");
    expect(res.conflicts).toContain("size");
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