// EN 50742 Approach A as an overlay on the base method (0.20, user
// 2026-11-21): R = L × I comes from the base method (standard or ETSI
// TVRA), AP and SRSL come in addition for the safety-relevant risks. The
// preset follows the base method, not the order of the tags.
import { describe, it, expect } from "vitest";
import {
  applyRegulationFromTags,
  applyRegulationPresetToProject,
} from "app/services/regulation-preset-orchestrator";
import { calculateGatedRiskValues } from "features/risks/services/en50742-risk-calculation";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION, type RiskConfiguration } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { RiskData } from "features/risks";
import type { Project } from "app/models/project-types";
import {
  EMPTY_PROJECT_TAGS,
  en50742ApproachFromTags,
  hasEn50742Overlay,
  regulationPresetFromTags,
  type AssetReference,
} from "shared";

const tags = (regulation: string[]) => ({ ...EMPTY_PROJECT_TAGS, regulation });

const project = (regulation: string[], configuration: Partial<RiskConfiguration> = {}): Project =>
  ({
    id: "p1",
    info: { name: "M", tags: tags(regulation) },
    settings: { strictMode: false, autoSave: true, autoSaveInterval: 2 },
    risks: {
      configuration: {
        ...DEFAULT_CONFIGURATION,
        activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) => ({ ...f })),
        ...configuration,
      },
      risks: [],
      lastModified: "2026-11-21T00:00:00.000Z",
    } as unknown as RiskData,
  }) as unknown as Project;

const enabled = (p: Project) =>
  p.risks!.configuration.activeFactors.filter((f) => f.enabled).map((f) => f.factorId).sort();

describe("the preset follows the base method", () => {
  it("one method tag: as before (characterization)", () => {
    expect(regulationPresetFromTags(tags([]))).toBe("standard");
    expect(regulationPresetFromTags(tags(["CRA", "IEC 62443"]))).toBe("standard");
    expect(regulationPresetFromTags(tags(["ISO 21434"]))).toBe("iso-21434");
    expect(regulationPresetFromTags(tags(["ETSI TVRA"]))).toBe("etsi-tvra");
    expect(regulationPresetFromTags(tags(["EN 50742 A", "IEC 62443"]))).toBe("en-50742-a");
    expect(regulationPresetFromTags(tags(["EN 50742 B", "IEC 62443"]))).toBe("en-50742-b");
    expect(regulationPresetFromTags(tags(["EN 50742"]))).toBe("en-50742-a");
  });

  it("ETSI TVRA with EN 50742 A or B: TVRA computes L — in either order", () => {
    for (const r of [["ETSI TVRA", "EN 50742 A"], ["EN 50742 A", "ETSI TVRA"], ["EN 50742 B", "IEC 62443", "ETSI TVRA"]]) {
      expect(regulationPresetFromTags(tags(r))).toBe("etsi-tvra");
    }
    expect(en50742ApproachFromTags(tags(["EN 50742 A", "ETSI TVRA"]))).toBe("A");
    expect(en50742ApproachFromTags(tags(["ETSI TVRA", "EN 50742 B"]))).toBe("B");
    expect(en50742ApproachFromTags(tags(["ETSI TVRA"]))).toBeUndefined();
  });

  it("an excluded combination saved before: ISO 21434 decides, whatever the order", () => {
    expect(regulationPresetFromTags(tags(["EN 50742 A", "ISO 21434"]))).toBe("iso-21434");
    expect(regulationPresetFromTags(tags(["ETSI TVRA", "ISO 21434"]))).toBe("iso-21434");
  });
});

describe("the overlay in the risk configuration", () => {
  it("hasEn50742Overlay: preset en-50742-a, or the flag", () => {
    expect(hasEn50742Overlay({ likelihoodMethod: "en-50742-a" })).toBe(true);
    expect(hasEn50742Overlay({ likelihoodMethod: "etsi-tvra", en50742Overlay: true })).toBe(true);
    expect(hasEn50742Overlay({ likelihoodMethod: "etsi-tvra" })).toBe(false);
    expect(hasEn50742Overlay(undefined)).toBe(false);
  });

  it("TVRA + A: TVRA method and factors, EL and AC active, the flag set; idempotent", () => {
    const once = applyRegulationFromTags(project(["ETSI TVRA", "EN 50742 A"])).project;
    const cfg = once.risks!.configuration;
    expect(cfg.likelihoodMethod).toBe("etsi-tvra");
    expect(cfg.en50742Overlay).toBe(true);
    expect(enabled(once)).toEqual(expect.arrayContaining(["attacker_capability", "exposure_level", "time", "expertise"]));
    expect(enabled(once)).not.toContain("skill_level"); // TVRA is exclusive
    const twice = applyRegulationFromTags(once);
    expect(twice.changed).toBe(false);
    expect(twice.project.risks).toBe(once.risks);
  });

  it("standard + A keeps its stored form: no flag (the method is the overlay)", () => {
    const res = applyRegulationFromTags(project(["EN 50742 A", "IEC 62443"])).project;
    expect(res.risks!.configuration.likelihoodMethod).toBe("en-50742-a");
    expect(res.risks!.configuration).not.toHaveProperty("en50742Overlay");
    expect(applyRegulationPresetToProject(project([]), "en-50742-a", true).project.risks!.configuration).not.toHaveProperty(
      "en50742Overlay",
    );
  });

  it("the A tag removed from TVRA: the flag goes, EL and AC are switched off", () => {
    const withA = applyRegulationFromTags(project(["ETSI TVRA", "EN 50742 A"])).project;
    const without = applyRegulationFromTags({ ...withA, info: { ...withA.info, tags: tags(["ETSI TVRA"]) } }).project;
    expect(without.risks!.configuration).not.toHaveProperty("en50742Overlay");
    expect(enabled(without)).not.toContain("exposure_level");
    expect(enabled(without)).not.toContain("attacker_capability");
  });

  it("TVRA + B: no overlay", () => {
    const res = applyRegulationFromTags(project(["ETSI TVRA", "EN 50742 B", "IEC 62443"])).project;
    expect(res.risks!.configuration.likelihoodMethod).toBe("etsi-tvra");
    expect(hasEn50742Overlay(res.risks!.configuration)).toBe(false);
  });
});

describe("TVRA + A: two values per safety-relevant risk", () => {
  const cfg = applyRegulationFromTags(
    project(["ETSI TVRA", "EN 50742 A"], { windowOfOpportunity: "moderately_restricted" }),
  ).project.risks!.configuration;
  const ratings: FactorRating[] = [
    { factorId: "time", value: 2, weight: 1 },
    { factorId: "expertise", value: 3, weight: 1 },
    { factorId: "exposure_level", value: 3, weight: 1 },
    { factorId: "attacker_capability", value: 4, weight: 1 },
    { factorId: "financial_damage", value: 3, weight: 1 },
  ];
  const sf: AssetReference[] = [{ id: "sf", name: "sf", assetGroup: "process", overallImpact: 0, physicalImpact: "fatal" } as AssetReference];

  it("R = L × I by TVRA, unchanged by EL / AC; AP and SRSL next to it", () => {
    const gated = calculateGatedRiskValues(ratings, cfg, sf, true);
    const plain = calculateRiskValues(ratings, cfg);
    expect([gated.impact, gated.likelihood, gated.risk]).toEqual([plain.impact, plain.likelihood, plain.risk]);
    expect(gated.srsl).not.toBeNull();
    expect(gated.apScore).toEqual(expect.any(Number));
    const noElAc = calculateRiskValues(ratings.filter((r) => !["exposure_level", "attacker_capability"].includes(r.factorId)), cfg);
    expect(plain.likelihood).toBe(noElAc.likelihood);
  });

  it("not relevant: no SRSL, the L × I values stay", () => {
    const gated = calculateGatedRiskValues(ratings, cfg, sf, false);
    expect(gated.srsl).toBeNull();
    expect(gated.risk).toBe(calculateRiskValues(ratings, cfg).risk);
  });
});
