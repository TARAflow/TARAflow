// src/tests/component/risk-safety-marks.test.tsx
//
// EN 50742 in the Risk register (0.20 patch 29): the progress chip keeps a
// risk with open SRSL controls open and says why; the filter bar offers
// "only safety-relevant" in an EN 50742 project.
import React from "react";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressChip } from "features/risks/components/shared/progress-chip";
import { SafetyMarksProvider } from "features/risks/components/safety-marks-context";
import { RiskFilters } from "features/risks/components/risk-filters";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { useRiskColumns } from "features/risks/components/shared/risk-columns";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      String((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const accepted = (id: string) => ({ id, treatment: "accept", moscowPriority: "should", selectedMitigations: [] }) as unknown as Risk;

describe("ProgressChip with open SRSL controls", () => {
  it("an accepted risk with open SRSL controls is not done", () => {
    render(
      <SafetyMarksProvider value={{ srslOpen: new Set(["R-1"]) }}>
        <ProgressChip risks={[accepted("R-1"), accepted("R-2")]} />
      </SafetyMarksProvider>,
    );
    expect(screen.getByTestId("risk-progress-chip").textContent).toBe("1/2");
  });

  it("without the provider: as before", () => {
    render(<ProgressChip risks={[accepted("R-1"), accepted("R-2")]} />);
    expect(screen.getByTestId("risk-progress-chip").textContent).toBe("2/2");
  });
});

describe("RiskFilters — only safety-relevant", () => {
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
    totalCount: 2,
  };

  it("shown in an EN 50742 project; a click switches it", () => {
    const onSafetyOnlyChange = vi.fn();
    render(<RiskFilters {...base} safetyOnly={false} onSafetyOnlyChange={onSafetyOnlyChange} />);
    fireEvent.click(screen.getByLabelText("safety-only"));
    expect(onSafetyOnlyChange).toHaveBeenCalledWith(true);
  });

  it("not offered outside EN 50742", () => {
    render(<RiskFilters {...base} />);
    expect(screen.queryByTestId("risk-filter-safety-only")).toBeNull();
  });
});

describe("useRiskColumns — the column Safety", () => {
  const props = {
    configuration: DEFAULT_CONFIGURATION,
    onEdit: vi.fn(),
    onPriorityChange: vi.fn(),
    onTreatmentChange: vi.fn(),
  };

  it("in an EN 50742 project: a column marking the safety-relevant risks", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SafetyMarksProvider value={{ relevantThreatIds: new Set(["T-1"]) }}>{children}</SafetyMarksProvider>
    );
    const { result } = renderHook(() => useRiskColumns(props), { wrapper });
    const col = result.current.find((c) => c.id === "safetyRelevant")!;
    expect(col).toBeDefined();
    render(<>{col.renderCell({ threatId: "T-1" } as Risk)}</>);
    expect(screen.getByTestId("risk-safety-relevant")).toBeTruthy();
    cleanup();
    render(<>{col.renderCell({ threatId: "T-2" } as Risk)}</>);
    expect(screen.queryByTestId("risk-safety-relevant")).toBeNull();
  });

  it("outside EN 50742: no such column", () => {
    const { result } = renderHook(() => useRiskColumns(props));
    expect(result.current.some((c) => c.id === "safetyRelevant")).toBe(false);
  });
});
