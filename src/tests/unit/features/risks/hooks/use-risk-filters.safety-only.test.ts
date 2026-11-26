// Filter "only safety-relevant" (0.20 patch 29): the risks whose threat is
// EN 50742 relevant — A and B; no effect outside an EN 50742 project.
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRiskFilters } from "features/risks/hooks/shared/use-risk-filters";
import type { Risk } from "features/risks/models/risk-assessment-types";

const risk = (id: string, threatId: string) =>
  ({ id, threatId, threatDisplayId: threatId, threatDescription: "", selectedMitigations: [], calculatedRiskBeforeMitigation: 0 }) as unknown as Risk;
const RISKS = [risk("R-1", "T-1"), risk("R-2", "T-2")];

describe("useRiskFilters — safetyOnly", () => {
  it("keeps the safety-relevant risks; off: all", () => {
    const { result } = renderHook(() => useRiskFilters(undefined, new Set(["T-2"])));
    expect(result.current.filterRisks(RISKS).map((r) => r.id)).toEqual(["R-1", "R-2"]);
    act(() => result.current.setSafetyOnly(true));
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filterRisks(RISKS).map((r) => r.id)).toEqual(["R-2"]);
    act(() => result.current.clearFilters());
    expect(result.current.filterRisks(RISKS)).toHaveLength(2);
  });

  it("outside an EN 50742 project the switch filters nothing", () => {
    const { result } = renderHook(() => useRiskFilters(undefined, undefined));
    act(() => result.current.setSafetyOnly(true));
    expect(result.current.filterRisks(RISKS)).toHaveLength(2);
  });
});
