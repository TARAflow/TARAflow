// tests/unit/features/risks/models/iso-scenarios.test.ts
//
// ISO/SAE 21434 conformance plan 3a-3 (decision 20 E2/E3/E5): threat
// scenarios derived from the path risks (MAX value and residual, union of the
// options) and the decisions to review (Retain ≥ 4, Reduce = 1 only).

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { groupIsoScenarios, isoReviewItems } from "features/risks/models/iso-scenarios";
import { useRiskFilters } from "features/risks/hooks/shared/use-risk-filters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risk = (id: string, tree: string | undefined, treatment: string, value?: number, residual?: number): any => ({
  id,
  threatId: id,
  threatDisplayId: id,
  threatDescription: `scenario ${tree ?? id}`,
  treatment,
  selectedMitigations: [],
  attackTreeAssessment: tree ? { treeId: tree, pathKey: id } : undefined,
  isoRisk:
    value === undefined
      ? undefined
      : { impact: "major", feasibility: "high", value, ...(residual ? { residual: { feasibility: "low", value: residual } } : {}) },
});

describe("groupIsoScenarios", () => {
  const risks = [
    risk("AT-2.1", "t2", "reduce", 3, 2),
    risk("AT-2.4", "t2", "share", 4),
    risk("AT-3.1", "t3", "reduce"),
    risk("P1-T-1", undefined, "accept", 2),
  ];
  const sc = groupIsoScenarios(risks);

  it("one scenario per tree, a risk without a tree is its own", () => {
    expect(sc.map((s) => [s.displayId, s.risks.length])).toEqual([
      ["AT-2", 2],
      ["AT-3", 1],
      ["P1-T-1", 1],
    ]);
  });

  it("value and residual are the MAX over the paths; options the union", () => {
    expect(sc[0]).toMatchObject({ value: 4, residual: 2, treatments: ["reduce", "share"] });
    expect(sc[1]).toMatchObject({ value: undefined, residual: undefined });
  });
});

describe("isoReviewItems", () => {
  it("only Retain at ≥ 4 (warning) and Reduce at 1 (info); Avoid / Share never", () => {
    const items = isoReviewItems([
      risk("a", "t", "accept", 4),
      risk("b", "t", "accept", 3),
      risk("c", "t", "reduce", 1),
      risk("d", "t", "share", 5),
      risk("e", "t", "eliminate", 5),
      risk("f", "t", "accept"),
    ]);
    expect(items.map((i) => [i.risk.id, i.kind, i.severity])).toEqual([
      ["a", "retain-high", "warning"],
      ["c", "reduce-minimal", "info"],
    ]);
  });

  it("the review filter keeps only these risks", () => {
    const { result } = renderHook(() => useRiskFilters());
    act(() => result.current.setIsoReviewOnly(true));
    const list = [risk("a", "t", "accept", 5), risk("b", "t", "reduce", 3)];
    expect(result.current.filterRisks(list, undefined, undefined, true).map((r) => r.id)).toEqual(["a"]);
  });
});
