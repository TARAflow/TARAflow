// ISO/SAE 21434 conformance plan 3a-2 (decision 20 E3/E4): under iso-21434
// the register's heat map is the 4 × 4 matrix of Annex H.8; risks sit in the
// cell of their isoRisk (before) or residual (after); other methods keep the
// `I × L` matrix.
import React from "react";
import { cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskMatrix } from "features/risks/components/risk-matrix";
import { useRiskColumns } from "features/risks/components/shared/risk-columns";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risk = (id: string, isoRisk?: any): any => ({
  id,
  threatDisplayId: id,
  threatDescription: `threat ${id}`,
  strideCategory: "T",
  moscowPriority: "should",
  factorRatings: [],
  mitigatedFactorRatings: [],
  selectedMitigations: [],
  calculatedImpact: 0,
  calculatedLikelihood: 0,
  calculatedRiskBeforeMitigation: 0,
  calculatedRiskAfterMitigation: 0,
  isoRisk,
});

const RISKS = [
  risk("AT-1", { impact: "severe", feasibility: "high", value: 5, residual: { feasibility: "low", value: 3 } }),
  risk("AT-2", { impact: "moderate", feasibility: "medium", value: 2 }),
  risk("AT-3"),
];

describe("RiskMatrix under iso-21434", () => {
  const iso = { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" as const };

  it("shows the H.8 matrix with the value of every cell", () => {
    render(<RiskMatrix risks={RISKS} configuration={iso} />);
    expect(screen.getByTestId("iso-risk-matrix")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-severe-very-low")).getByText("2")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-negligible-high")).getByText("1")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-severe-high")).getByText("5")).toBeTruthy();
  });

  it("places risks by isoRisk before and by the residual after mitigation", () => {
    render(<RiskMatrix risks={RISKS} configuration={iso} />);
    expect(within(screen.getByTestId("iso-cell-severe-high")).getByText("AT-1")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-moderate-medium")).getByText("AT-2")).toBeTruthy();
    expect(screen.getByTestId("iso-unrated").textContent).toContain("1");
    fireEvent.click(screen.getByText("After"));
    expect(within(screen.getByTestId("iso-cell-severe-low")).getByText("AT-1")).toBeTruthy();
    expect(screen.getByTestId("iso-unrated").textContent).toContain("2"); // AT-2 has no residual
  });

  it("other methods keep the I × L matrix", () => {
    render(<RiskMatrix risks={RISKS} configuration={DEFAULT_CONFIGURATION} />);
    expect(screen.queryByTestId("iso-risk-matrix")).toBeNull();
  });
});

// ── Register columns ───────────────────────────────────────────────────────

describe("register columns under iso-21434", () => {
  const cols = (likelihoodMethod?: string) =>
    renderHook(() =>
      useRiskColumns({
        configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod } as never,
        onEdit: vi.fn(),
        onPriorityChange: vi.fn(),
        onTreatmentChange: vi.fn(),
      }),
    ).result.current;

  it("impact / feasibility levels and value 1–5 before and after", () => {
    const c = cols("iso-21434");
    const cell = (id: string) => {
      const col = c.find((x) => x.id === id)!;
      return render(<>{col.renderCell(RISKS[0])}</>).container.textContent;
    };
    expect(c.find((x) => x.id === "riskBefore")!.header).toBe("Risk (1–5)");
    expect(cell("impact")).toBe("Severe");
    expect(cell("likelihood")).toBe("High");
    expect(cell("riskBefore")).toBe("5");
    expect(cell("riskAfter")).toBe("3");
  });

  it("other methods keep I × L headers", () => {
    expect(cols(undefined).find((x) => x.id === "riskBefore")!.header).toBe("Risk");
  });
});
