// src/tests/component/risk-filters.implementation.test.tsx
//
// 0.20.1 (user 2026-11-27): a filter by implementation status in the risks
// tab — the filter bar offers it, the filter hook applies it and clears it.
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskFilters } from "features/risks/components/risk-filters";
import { useRiskFilters } from "features/risks/hooks/shared/use-risk-filters";
import type { Risk } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => String((o?.defaultValue as string | undefined) ?? k),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const risk = (id: string, statuses: string[]) =>
  ({ id, threatDisplayId: id, threatDescription: "", selectedMitigations: statuses.map((status, i) => ({ id: `M-${i}`, status })) }) as unknown as Risk;
const RISKS = [risk("A", ["open", "verified"]), risk("B", []), risk("C", ["verified"])];

describe("useRiskFilters — implementation status", () => {
  it("filters, counts as an active filter, and is cleared with the others", () => {
    const { result } = renderHook(() => useRiskFilters());
    expect(result.current.filterRisks(RISKS).map((r) => r.id)).toEqual(["A", "B", "C"]);
    act(() => result.current.setImplementationFilter("verified"));
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filterRisks(RISKS).map((r) => r.id)).toEqual(["A", "C"]);
    act(() => result.current.setImplementationFilter("none"));
    expect(result.current.filterRisks(RISKS).map((r) => r.id)).toEqual(["B"]);
    act(() => result.current.clearFilters());
    expect(result.current.filters.implementationFilter).toBe("");
    expect(result.current.filterRisks(RISKS)).toHaveLength(3);
  });
});

describe("RiskFilters — the implementation select", () => {
  const base = {
    searchText: "",
    priorityFilter: "" as const,
    riskLevelFilter: "" as const,
    scale: "5-level" as const,
    onSearchTextChange: vi.fn(),
    onPriorityFilterChange: vi.fn(),
    onRiskLevelFilterChange: vi.fn(),
    onClear: vi.fn(),
    show: true,
    filteredCount: 1,
    totalCount: 3,
  };

  it("offers the statuses and the extra values; a choice is passed on", () => {
    const onChange = vi.fn();
    render(<RiskFilters {...base} implementationFilter="" onImplementationFilterChange={onChange} />);
    fireEvent.mouseDown(screen.getByTestId("risk-filter-implementation-select"));
    const list = within(screen.getByRole("listbox"));
    for (const label of ["Open", "In Progress", "In Review", "Implemented", "Verified", "Rejected", "No mitigation selected", "Mitigations not done", "All mitigations done", "Done without evidence"])
      expect(list.getByRole("option", { name: label })).toBeTruthy();
    fireEvent.click(list.getByRole("option", { name: "Done without evidence" }));
    expect(onChange).toHaveBeenCalledWith("done_without_evidence");
  });

  it("not offered without its callback", () => {
    render(<RiskFilters {...base} />);
    expect(screen.queryByTestId("risk-filter-implementation-select")).toBeNull();
  });
});
