// ISO/SAE 21434 conformance plan 3a-2 (decision 20 E3/E4): under iso-21434
// the register's heat map is the 4 × 4 matrix of Annex H.8; risks sit in the
// cell of their isoRisk (before) or residual (after); other methods keep the
// `I × L` matrix.
import React from "react";
import { cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskMatrix } from "features/risks/components/risk-matrix";
import { useRiskColumns } from "features/risks/components/shared/risk-columns";
import { RiskTableView } from "features/risks/components/risk-table-view";
import { IsoReviewBanner } from "features/risks/components/iso-review-banner";
import { RiskConfigDialog } from "features/risks/components/risk-config-dialog";
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
    expect(within(screen.getByTestId("iso-cell-severe-very-low")).getByText("2 Low")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-negligible-high")).getByText("1 Minimal")).toBeTruthy();
    expect(within(screen.getByTestId("iso-cell-severe-high")).getByText("5 Critical")).toBeTruthy();
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
    expect(cell("riskBefore")).toBe("5 · Critical");
    expect(cell("riskAfter")).toBe("3 · Medium");
  });

  it("other methods keep I × L headers", () => {
    expect(cols(undefined).find((x) => x.id === "riskBefore")!.header).toBe("Risk");
  });
});

// ── Scenario view and review banner (3a-3) ────────────────────────────────
describe("attack-tree section under iso-21434", () => {
  const iso = { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" as const };
  const pathRisk = (id: string, tree: string, value: number, residual?: number) => ({
    ...risk(id, {
      impact: "major",
      feasibility: "high",
      value,
      ...(residual ? { residual: { feasibility: "low", value: residual } } : {}),
    }),
    sourceStrideMethod: "attack-path",
    treatment: "reduce",
    threatDescription: "Compromise Integrity",
    attackTreeAssessment: { treeId: tree, pathKey: id },
  });

  it("groups the paths by threat scenario with MAX value and residual", () => {
    render(
      <RiskTableView
        risks={[]}
        threats={[]}
        configuration={iso}
        strideMethod="per-element"
        filters={{ searchText: "", priorityFilter: "", treatmentFilter: "", riskLevelFilter: "", scope: {} } as never}
        onSearchTextChange={vi.fn()}
        onPriorityFilterChange={vi.fn()}
        onRiskLevelFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
        filteredCount={0}
        onEdit={vi.fn()}
        onPriorityChange={vi.fn()}
        onTreatmentChange={vi.fn()}
        attackPathRisks={[pathRisk("AT-2.1", "t2", 3, 2), pathRisk("AT-2.4", "t2", 4)] as never}
      />,
    );
    const header = screen.getByTestId("iso-scenario-AT-2");
    expect(header.textContent).toContain("Risk 4");
    expect(header.textContent).toContain("Residual 2");
    expect(screen.getAllByText("AT-2.1").length).toBeGreaterThan(0);
  });

  it("the filter bar counts every risk the tab shows, attack-path risks included (user 2026-10-30: \"Showing 0 of 0\")", () => {
    render(
      <RiskTableView
        risks={[]}
        threats={[]}
        configuration={iso}
        strideMethod="per-element"
        showFilters
        filters={{ searchText: "", priorityFilter: "", treatmentFilter: "", riskLevelFilter: "", scope: {} } as never}
        onSearchTextChange={vi.fn()}
        onPriorityFilterChange={vi.fn()}
        onRiskLevelFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
        filteredCount={2}
        totalCount={17}
        onEdit={vi.fn()}
        onPriorityChange={vi.fn()}
        onTreatmentChange={vi.fn()}
        attackPathRisks={[pathRisk("AT-2.1", "t2", 3, 2), pathRisk("AT-2.4", "t2", 4)] as never}
      />,
    );
    expect(screen.getByText("Showing 2 of 17")).toBeTruthy();
  });

  it("the review banner lists the decisions and toggles the filter", () => {
    const onToggle = vi.fn();
    const items = [{ risk: { ...risk("AT-9.1"), isoRisk: { value: 5 } }, kind: "retain-high", severity: "warning" }];
    render(<IsoReviewBanner items={items as never} reviewOnly={false} onReviewOnlyChange={onToggle} onOpen={vi.fn()} />);
    expect(screen.getByTestId("iso-review-banner").textContent).toContain("AT-9.1 · 5");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("no banner without decisions to review", () => {
    const { container } = render(
      <IsoReviewBanner items={[]} reviewOnly={false} onReviewOnlyChange={vi.fn()} onOpen={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

// ── No label of the I × L scale under ISO (decision 23) ────────────────────
describe("risk configuration under iso-21434", () => {
  it("locks the rating scale and shows the ISO words, not the RISK_SCALES labels", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: any = {
      open: true,
      onClose: vi.fn(),
      onSave: vi.fn(),
      configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434", scale: "5-level" },
    };
    render(<RiskConfigDialog {...props} />);
    expect(screen.getByTestId("iso-scale-locked")).toBeTruthy();
    expect(document.body.textContent).toContain("5: Critical");
    expect(document.body.textContent).not.toContain("Very High");
  });
});
