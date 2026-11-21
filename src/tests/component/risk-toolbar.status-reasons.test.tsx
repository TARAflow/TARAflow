// src/tests/component/risk-toolbar.status-reasons.test.tsx
//
// 0.20 item 14 (user 2026-11-20, self-analysis): the toolbar chip said
// "In Progress" with no reason once the findings were empty. Its tooltip now
// names why the risks not done are open.
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RisksToolbar as RiskToolbar } from "features/risks/components/risk-toolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) =>
      String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const noop = () => {};
const props = (extra: Record<string, unknown>): Any => ({
  isDirty: false, isSyncing: false, riskMethod: "complex", activeStrideMethod: "per-element",
  riskCount: 106, assessedRiskCount: 106, completedRiskCount: 73, wontCount: 0,
  perElementCount: 120, perInteractionCount: 0,
  canSwitchStrideMethod: true, hasRisks: true, hasThreatsForMethod: true, hasAnyThreats: true, needsSync: false,
  showDfdPreview: false, mainView: "table", showWontTable: false, showFilters: false,
  onToggleDfdPreview: noop, onMainViewChange: noop, onStrideMethodChange: noop, onSync: noop, onOpenConfig: noop,
  onExport: noop, onImport: noop, onToggleWontTable: noop, onToggleFilters: noop,
  ...extra,
});

describe("risk toolbar — status chip reasons", () => {
  it("In Progress: the tooltip names the reasons", async () => {
    render(<RiskToolbar {...props({ openReasonLines: ["mitigations not implemented yet (33): P9-T-1, P9-T-2 …"] })} />);
    fireEvent.mouseOver(screen.getByTestId("risk-status-chip"));
    const tip = await screen.findByTestId("risk-status-reasons");
    expect(tip.textContent).toContain("73 of 106 risks done. Open:");
    expect(tip.textContent).toContain("mitigations not implemented yet (33): P9-T-1");
  });

  it("Complete: no tooltip", async () => {
    render(<RiskToolbar {...props({ completedRiskCount: 106, openReasonLines: [] })} />);
    fireEvent.mouseOver(screen.getByTestId("risk-status-chip"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("risk-status-reasons")).toBeNull();
  });
});
