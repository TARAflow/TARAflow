// tests/unit/shared/models/hazard-severity-display.test.ts
//
// Asset graph design G8 (doc/InProgress/DFD/asset-graph-hazards-and-node-
// move.md): one source for the rank and colour of a hazard's worst endangers
// severity — the hazard table's "max severity" column and the asset graph's
// hazard nodes.

import { describe, it, expect } from "vitest";
import {
  HAZARD_SEVERITY_RANK_COLOR,
  hazardSeverityRank,
  worstEndangersSeverity,
} from "shared/models/hazard-severity-display";
import type { HazardRelation } from "shared";

const endangers = (from: string, severity: string, target = "human"): HazardRelation =>
  ({ type: "endangers", from, to: "A", impact: { target, severity } }) as HazardRelation;

describe("hazard severity display", () => {
  it("person harm ranks by the safety factor Se1-Se4, other targets by their scale", () => {
    expect(hazardSeverityRank("reversible_minor")).toBe(1);
    expect(hazardSeverityRank("irreversible_minor")).toBe(3);
    expect(hazardSeverityRank("fatal")).toBe(4);
    expect(hazardSeverityRank("medium")).toBe(2);
    expect(hazardSeverityRank("critical")).toBe(4);
    expect(hazardSeverityRank("unknown")).toBe(0);
  });

  it("a colour for every rank", () => {
    for (const r of [0, 1, 2, 3, 4]) expect(HAZARD_SEVERITY_RANK_COLOR[r]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("worst endangers severity of one hazard; none without an edge", () => {
    const relations = [
      endangers("H1", "reversible_major"),
      endangers("H1", "irreversible_major"),
      endangers("H2", "fatal"),
      { type: "contributes_to", from: "A", to: "H1" } as HazardRelation,
    ];
    expect(worstEndangersSeverity("H1", relations)).toEqual({ severity: "irreversible_major", rank: 4 });
    expect(worstEndangersSeverity("H3", relations)).toEqual({ severity: "", rank: 0 });
  });
});
