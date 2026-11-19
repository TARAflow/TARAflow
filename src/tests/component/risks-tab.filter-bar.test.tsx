// src/tests/component/risks-tab.filter-bar.test.tsx
//
// Manual test 2026-11-15: the filter bar of the Risk tab scrolled away with
// the list. It sits above the scrolling area now, as in the Threats tab;
// the list itself shows no filter bar of its own.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RisksTab } from "features/risks/components/risks-tab";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData, RiskProjectData } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
const tableProps: { showFilters?: boolean }[] = [];
vi.mock("features/risks/components/risk-table-view", () => ({
  RiskTableView: (props: { showFilters?: boolean }) => {
    tableProps.push(props);
    return <div data-testid="risk-table-view" />;
  },
}));
vi.mock("features/risks/components/risk-matrix", () => ({ RiskMatrix: () => null }));
vi.mock("features/risks/components/wont-risk-table", () => ({ WontRiskTable: () => null }));
vi.mock("features/risks/components/risk-dialog", () => ({ RiskDialog: () => null }));
vi.mock("features/risks/components/risk-config-dialog", () => ({ RiskConfigDialog: () => null }));
vi.mock("features/risks/components/risk-mitigation-status-dialog", () => ({ RiskMitigationStatusDialog: () => null }));
vi.mock("features/risks/components/goals-claims-dialog", () => ({ GoalsClaimsDialog: () => null }));

afterEach(() => {
  cleanup();
  tableProps.length = 0;
  localStorage.clear();
});
beforeEach(() => localStorage.setItem("risks-tab-showFilters", "true"));

const ratings = () => DEFAULT_CONFIGURATION.activeFactors.map((af) => ({ factorId: af.factorId, value: 2, weight: af.weight }));
const threat = {
  id: "t-1",
  displayId: "P1-T-1",
  strideCategory: "T",
  threatDescription: "",
  attackDescription: "",
  sourceStrideMethod: "per-element",
  relevance: "relevant",
  proposedMitigations: [],
  proposedVerifications: [],
  trustBoundaryId: null,
  trustBoundaryName: null,
};
const project = {
  id: "p",
  name: "p",
  risks: {
    configuration: DEFAULT_CONFIGURATION,
    risks: [
      {
        id: "r-1",
        threatId: "t-1",
        threatDisplayId: "P1-T-1",
        threatDescription: "",
        attackDescription: "",
        threatRelevance: "relevant",
        proposedMitigations: [],
        proposedVerifications: [],
        strideCategory: "Tampering",
        sourceStrideMethod: "per-element",
        factorRatings: ratings(),
        calculatedImpact: 0,
        calculatedLikelihood: 0,
        calculatedRiskBeforeMitigation: 0,
        selectedMitigations: [],
        selectedVerifications: [],
        mitigatedFactorRatings: ratings(),
        calculatedRiskAfterMitigation: 0,
        treatment: "reduce",
        treatmentJustification: "",
        moscowPriority: "must",
        wontJustification: "",
        riskBeforeRationale: "",
        riskAfterRationale: "",
        created: "2026-11-01T00:00:00.000Z",
        lastModified: "2026-11-01T00:00:00.000Z",
      },
    ],
    lastModified: "2026-11-01T00:00:00.000Z",
  } as unknown as RiskData,
  phaseStatus: {},
  perElementThreats: [threat],
  perInteractionThreats: [],
  lastModified: "2026-11-01T00:00:00.000Z",
  assetDataRef: { assets: [], criterionWeights: {} },
} as unknown as RiskProjectData;

describe("RisksTab — filter bar", () => {
  it("is above the scrolling list, not inside it; the list shows none of its own", () => {
    render(<RisksTab project={project} onUpdate={vi.fn()} />);
    const bar = screen.getByTestId("risk-filter-bar");
    const list = screen.getByTestId("risk-table-view");
    expect(bar.contains(list)).toBe(false);
    // the scrolling container of the list does not contain the bar
    let scroller: HTMLElement | null = list.parentElement;
    while (scroller && getComputedStyle(scroller).overflow !== "auto") scroller = scroller.parentElement;
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(bar)).toBe(false);
    expect(tableProps.at(-1)?.showFilters).toBe(false);
    expect(bar.textContent).toContain("Priority");
  });
});
