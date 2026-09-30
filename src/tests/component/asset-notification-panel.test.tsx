// src/tests/component/asset-notification-panel.test.tsx
//
// Asset findings below the table (like the DFD tab): errors and warnings
// visible, infos behind their chip; a click opens the asset in the dialog tab
// where the finding is fixed.
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetNotificationPanel } from "features/assets/components/asset-notification-panel";
import { AssetDialog } from "features/assets/components/asset-dialog";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { AssetFinding } from "features/assets/services/asset-validator";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) => {
      const base = o?.defaultValue ?? `${key}|${o?.id ?? ""}|${o?.type ?? ""}`;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? ""));
    },
  }),
}));

const findings: AssetFinding[] = [
  { severity: "info", key: "k.desc", assetId: "a1", assetLabel: "DA-001 (X)", goal: "C", dialogTab: 1 },
  { severity: "warning", key: "k.unassessed", assetId: "a2", assetLabel: "DA-010 (Y)", goal: "I", dialogTab: 1 },
  { severity: "error", key: "k.noGoal", assetId: "a3", assetLabel: "DA-002 (Z)", dialogTab: 1 },
  { severity: "warning", key: "k.notLinked", assetId: "a1", assetLabel: "DA-001 (X)", dialogTab: 0 },
];

describe("AssetNotificationPanel", () => {
  it("shows errors and warnings, errors first; infos hidden until toggled", () => {
    render(<AssetNotificationPanel findings={findings} onOpen={() => {}} />);
    let rows = screen.getAllByTestId("asset-notification-row").map((r) => r.textContent);
    expect(rows).toEqual(["k.noGoal|DA-002 (Z)|", "k.notLinked|DA-001 (X)|", "k.unassessed|DA-010 (Y)|I"]);
    fireEvent.click(screen.getByTestId("asset-notification-info-toggle"));
    rows = screen.getAllByTestId("asset-notification-row").map((r) => r.textContent);
    expect(rows).toHaveLength(4);
  });

  it("a click opens the finding's asset", () => {
    const onOpen = vi.fn();
    render(<AssetNotificationPanel findings={findings} onOpen={onOpen} />);
    fireEvent.click(screen.getAllByTestId("asset-notification-row")[2]);
    expect(onOpen).toHaveBeenCalledWith(findings[1]);
  });

  it("renders nothing without findings", () => {
    const { container } = render(<AssetNotificationPanel findings={[]} onOpen={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("AssetDialog opened from a finding", () => {
  it("opens on the Security Goals tab with the goal card expanded", () => {
    const base = {
      id: "a-1", displayId: "DA-001", name: "Config DB", assetGroup: "data", properties: {},
      impactRatings: [{ criterionId: "financial_damage", value: 3 }],
      linkedDFDElements: [{ elementId: "E-1", elementName: "Config push", relationType: "transports" }],
      securityGoals: ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"].map((type) => ({ type, level: "none", formalDescription: "" })),
    } as unknown as Asset;
    const a = { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, "4-level") };
    render(
      <AssetDialog open asset={a} configuration={{ ...DEFAULT_ASSET_CONFIGURATION, impactScale: "4-level" } as any}
        onSave={() => {}} onClose={() => {}} initialTab={1} focusGoal="I" />,
    );
    // on the goals tab right away, card I open, card C closed
    expect(within(screen.getByTestId("goal-card-I")).getByText("Why this goal?")).toBeTruthy();
    expect(within(screen.getByTestId("goal-card-C")).queryByText("Why this goal?")).toBeNull();
  });
});
