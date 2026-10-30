// src/tests/component/risk-toolbar.method-badge.test.tsx
//
// User 2026-10-30 (Smoke Detector, test plan G1b): with per-interaction
// active, the per-element button showed 231 — the THREATS of the method,
// dismissed ones included — next to "Showing 119 of 119" risks. The badge
// shows the risks of the method; the tooltip says where they come from.
import React from "react";
import { render, screen } from "@testing-library/react";
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

describe("risk toolbar — method buttons", () => {
  it("the badge counts the risks of the method; the tooltip names threats and dismissed ones", () => {
    const props: Any = {
      isDirty: false, isSyncing: false, riskMethod: "complex", activeStrideMethod: "per-interaction",
      riskCount: 83, assessedRiskCount: 83, completedRiskCount: 10, wontCount: 0,
      perElementCount: 231, perInteractionCount: 214,
      perElementRiskCount: 119, perInteractionRiskCount: 83, perElementDismissedCount: 112, perInteractionDismissedCount: 131,
      canSwitchStrideMethod: true, hasRisks: true, hasThreatsForMethod: true, hasAnyThreats: true, needsSync: false,
      showDfdPreview: false, mainView: "table", showWontTable: false, showFilters: false,
      onToggleDfdPreview: noop, onMainViewChange: noop, onStrideMethodChange: noop, onSync: noop, onOpenConfig: noop,
      onExport: noop, onImport: noop, onToggleWontTable: noop, onToggleFilters: noop,
    };
    render(<RiskToolbar {...props} />);
    expect(screen.getByTestId("method-badge-per-element").textContent).toContain("119");
    expect(screen.queryByText("231")).toBeNull();
    expect(screen.getByLabelText("Per-Element: 119 risks from 231 threats (112 rated not relevant)")).toBeTruthy();
  });
});
