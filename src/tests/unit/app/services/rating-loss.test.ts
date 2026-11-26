// Ratings a tag change would delete (user 2026-11-21: warn, keep nothing).
import { describe, it, expect } from "vitest";
import { ratingLossOfTagChange } from "app/services/rating-loss";
import { applyRegulationFromTags } from "app/services/regulation-preset-orchestrator";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks";
import type { Project } from "app/models/project-types";
import { EMPTY_PROJECT_TAGS } from "shared";

const tags = (regulation: string[]) => ({ ...EMPTY_PROJECT_TAGS, regulation });

/** A project as the app holds it after the tags were applied, with one rated risk. */
function project(regulation: string[], ratings: Record<string, number>, mitigated: Record<string, number> = {}): Project {
  const base = {
    id: "p1",
    info: { name: "M", tags: tags(regulation), windowOfOpportunity: "moderately_restricted" },
    settings: { strictMode: false, autoSave: true },
    risks: {
      configuration: { ...DEFAULT_CONFIGURATION, activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) => ({ ...f })) },
      risks: [],
      lastModified: "2026-11-21T00:00:00.000Z",
    } as unknown as RiskData,
  } as unknown as Project;
  const applied = applyRegulationFromTags(base).project;
  const toRatings = (r: Record<string, number>) => Object.entries(r).map(([factorId, value]) => ({ factorId, value, weight: 1 }));
  return {
    ...applied,
    risks: {
      ...applied.risks!,
      risks: [
        { id: "R-1", factorRatings: toRatings(ratings), mitigatedFactorRatings: toRatings(mitigated) },
        { id: "R-2", factorRatings: toRatings({ time: 1 }), mitigatedFactorRatings: [] },
      ],
    } as unknown as RiskData,
  };
}

describe("ratingLossOfTagChange", () => {
  it("EN 50742 A removed from TVRA: EL and attacker capability go — before and after mitigation", () => {
    const p = project(["ETSI TVRA", "EN 50742 A"], { time: 2, exposure_level: 3, attacker_capability: 4 }, { attacker_capability: 2 });
    expect(ratingLossOfTagChange(p, tags(["ETSI TVRA"]))).toEqual({
      factors: [
        { id: "attacker_capability", name: expect.any(String) },
        { id: "exposure_level", name: expect.any(String) },
      ],
      ratings: 3,
      risks: 1,
    });
  });

  it("a tag that switches off no rated factor: nothing to ask", () => {
    const p = project(["ETSI TVRA", "EN 50742 A"], { time: 2, exposure_level: 3 });
    expect(ratingLossOfTagChange(p, tags(["ETSI TVRA", "EN 50742 A", "CRA"]))).toBeUndefined();
    // unrated (0) factors do not count
    const unrated = project(["ETSI TVRA", "EN 50742 A"], { time: 2, exposure_level: 0 });
    expect(ratingLossOfTagChange(unrated, tags(["ETSI TVRA"]))).toBeUndefined();
  });

  it("ETSI TVRA removed: its factors go", () => {
    const p = project(["ETSI TVRA"], { time: 2, expertise: 1 });
    const loss = ratingLossOfTagChange(p, tags([]))!;
    expect(loss.factors.map((f) => f.id)).toEqual(["expertise", "time"]);
    expect(loss.risks).toBe(2);
  });

  it("no risks: nothing to ask", () => {
    const p = project(["ETSI TVRA", "EN 50742 A"], {});
    expect(ratingLossOfTagChange({ ...p, risks: { ...p.risks!, risks: [] } }, tags([]))).toBeUndefined();
  });
});
