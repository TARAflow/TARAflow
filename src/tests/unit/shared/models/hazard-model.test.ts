// shared/models/hazard-model.test.ts  (vitest)
//
// Phase 1 Definition of Done: a HazardItem plus both edges can be created
// programmatically and round-tripped through JSON. Also asserts that the human
// harm scale reused from safety-types holds at the type level.
//
// Colocated next to the model files; if placed under __tests__/, change the imports
// to "../hazard-types" / "../hazard-impact".

import { describe, it, expect } from "vitest";
import {
  DEFAULT_HAZARD_COMBINATION_TYPE,
  HUMAN_HARM_SEVERITY,
  SEVERITY_SCALE_BY_TARGET,
  isHumanImpact,
  isContributesTo,
  isEndangers,
  type ContributesToRelation,
  type EndangersRelation,
  type HazardItem,
  type HazardItemId,
  type HazardRelation,
} from "shared";

// Helper to mint a branded id in tests without leaking the brand elsewhere.
const hid = (s: string) => s as HazardItemId;

describe("hazard model — Phase 1", () => {
  it("creates a HazardItem with the default combination type", () => {
    const hazard: HazardItem = {
      id: hid("H-01"),
      label: "Quetschen durch Roboterarm",
      hazardType: "mechanical",
      physicalHazardPotential: "high",
      combinationType: DEFAULT_HAZARD_COMBINATION_TYPE,
      source: "manual",
    };
    expect(hazard.combinationType).toBe("ANY");
  });

  it("builds contributes_to and endangers edges and narrows them", () => {
    const contributes: ContributesToRelation = {
      type: "contributes_to",
      from: "asset-robot-arm",
      to: hid("H-01"),
      relevance: "direct",
      hazardDistance: 0,
    };
    const endangers: EndangersRelation = {
      type: "endangers",
      from: hid("H-01"),
      to: "asset-operator",
      impact: { target: "human", severity: "fatality" },
    };

    expect(isContributesTo(contributes)).toBe(true);
    expect(isEndangers(endangers)).toBe(true);
    expect(isHumanImpact(endangers.impact)).toBe(true);
  });

  it("serialises and deserialises a full hazard graph (DoD)", () => {
    const hazard: HazardItem = {
      id: hid("H-02"),
      label: "Exotherme Reaktion (Na + H2O)",
      hazardType: "combined",
      combinationType: "ALL",
      source: "imported",
    };
    const edges: HazardRelation[] = [
      {
        type: "contributes_to",
        from: "asset-na-dosing",
        to: hid("H-02"),
        relevance: "direct",
        hazardDistance: 0,
      },
      {
        type: "contributes_to",
        from: "asset-water-inlet",
        to: hid("H-02"),
        relevance: "direct",
        hazardDistance: 0,
      },
      {
        type: "endangers",
        from: hid("H-02"),
        to: "asset-water-body",
        impact: { target: "environment", severity: "high" },
      },
    ];

    const json = JSON.stringify({ hazard, edges });
    const parsed = JSON.parse(json) as { hazard: HazardItem; edges: HazardRelation[] };

    expect(parsed.hazard.combinationType).toBe("ALL");
    expect(parsed.edges.filter(isContributesTo)).toHaveLength(2);

    const endangers = parsed.edges.find(isEndangers);
    expect(endangers?.impact.target).toBe("environment");
  });

  it("exposes ordered severity scales per target kind", () => {
    expect(HUMAN_HARM_SEVERITY).toEqual([
      "reversible_injury",
      "irreversible_injury",
      "fatality",
    ]);
    expect(SEVERITY_SCALE_BY_TARGET.environment).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });
});
