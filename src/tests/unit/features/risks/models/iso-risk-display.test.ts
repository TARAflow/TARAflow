// tests/unit/features/risks/models/iso-risk-display.test.ts
//
// ISO/SAE 21434 conformance plan 3a-2: live value in the risk dialog and the
// register filter on the ISO risk value 1–5.

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { liveIsoRisk, isIsoRiskMode, isoRiskValueColor } from "features/risks/models/iso-risk-display";
import { useRiskFilters } from "features/risks/hooks/shared/use-risk-filters";

const STORED = { impact: "major" as const, feasibility: "medium" as const, value: 3 };
const f = (id: string, value: number) => ({ factorId: id, value, weight: 1 });

describe("liveIsoRisk", () => {
  it("tree-driven: feasibility stays the stored one, the residual follows the dialog", () => {
    const live = liveIsoRisk(STORED, [], [f("attack_tree_likelihood", 2)], { scale: "4-level" }, true);
    expect(live).toEqual({ ...STORED, residual: { feasibility: "low", value: 2 } });
  });

  it("iso_* fallback: an edited factor set changes the value at once", () => {
    const h7 = [
      f("iso_elapsed_time", 2),
      f("iso_expertise", 4),
      f("iso_knowledge", 3),
      f("iso_window_of_opportunity", 1),
      f("iso_equipment", 2),
    ];
    const live = liveIsoRisk(STORED, h7, [], { scale: "4-level" }, false);
    expect(live).toEqual({ impact: "major", feasibility: "low", value: 2 });
  });

  it("without a stored value (impact not rated) there is none", () => {
    expect(liveIsoRisk(undefined, [], [], { scale: "4-level" }, true)).toBeUndefined();
  });
});

describe("helpers", () => {
  it("ISO mode only for the iso-21434 method; colours of the 5-level scale", () => {
    expect(isIsoRiskMode({ likelihoodMethod: "iso-21434" })).toBe(true);
    expect(isIsoRiskMode({ likelihoodMethod: "en-50742-a" })).toBe(false);
    expect(isoRiskValueColor(1)).not.toBe(isoRiskValueColor(5));
  });
});

describe("register filter", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const risks: any[] = [
    { id: "a", threatId: "a", threatDisplayId: "a", threatDescription: "", selectedMitigations: [], calculatedRiskBeforeMitigation: 16, isoRisk: { value: 4 } },
    { id: "b", threatId: "b", threatDisplayId: "b", threatDescription: "", selectedMitigations: [], calculatedRiskBeforeMitigation: 16, isoRisk: { value: 2 } },
  ];

  it("filters on the ISO value under iso-21434, on the I × L level otherwise", () => {
    const { result } = renderHook(() => useRiskFilters());
    act(() => result.current.setRiskLevelFilter(4));
    const iso = { scale: "4-level" as const, roundingMethod: "round" as const, likelihoodMethod: "iso-21434" };
    expect(result.current.filterRisks(risks, iso).map((r) => r.id)).toEqual(["a"]);
    const plain = { scale: "4-level" as const, roundingMethod: "round" as const };
    expect(result.current.filterRisks(risks, plain).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
