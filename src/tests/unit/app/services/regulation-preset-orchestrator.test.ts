import { describe, it, expect } from "vitest";
import { applyRegulationPresetToProject } from "app/services/regulation-preset-orchestrator";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Project } from "app/models/project-types";
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
