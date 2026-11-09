// Multi-project TARA phase 4a-2 (user + review 2026-11-09): an asset imported
// from a component — name, description and the component's goals are
// read-only (goals cannot be removed, their requirement text is the
// component's); the machine may add goals; delete only with the instance.
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetDialog } from "features/assets/components/asset-dialog";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { Asset } from "features/assets/models/asset-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
  }),
}));
afterEach(cleanup);

const base = {
  id: "a-1", displayId: "SD1:DA-001", name: "Sensor frames", assetGroup: "data", properties: { description: "Frames" },
  impactRatings: [{ criterionId: "financial_damage", value: 3 }],
  linkedDFDElements: [{ elementId: "E-1", elementName: "Frame push", relationType: "transports" }],
  securityGoals: ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"].map((type) => ({ type, level: "none", formalDescription: "" })),
} as unknown as Asset;
const suggested = { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, "4-level") };
const active = suggested.securityGoals.filter((g) => g.level !== "none").map((g) => g.type);
const config = { ...DEFAULT_ASSET_CONFIGURATION, impactScale: "4-level" } as never;

const open = (asset: Asset, focusGoal?: string, componentGoals?: string[]) =>
  render(
    <AssetDialog open asset={asset} configuration={config} onSave={() => {}} onClose={() => {}}
      initialTab={focusGoal ? 1 : 0} focusGoal={focusGoal as never} componentGoals={componentGoals} />,
  );

describe("imported asset — read-only parts (phase 4a-2)", () => {
  it("name and description are read-only, with the reason; an own asset stays editable", () => {
    open({ ...suggested, importedFrom: "SD1 · Smoke Detector" });
    expect((screen.getByTestId("asset-name") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("asset-description") as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByTestId("asset-imported-from").textContent).toContain("SD1 · Smoke Detector");
    cleanup();
    open(suggested);
    expect((screen.getByTestId("asset-name") as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByTestId("asset-imported-from")).toBeNull();
  });

  it("a component goal: marked, not removable, requirement text read-only; another suggested goal can be excluded", () => {
    expect(active.length).toBeGreaterThanOrEqual(2);
    const [mine, other] = active;
    const imported = { ...suggested, importedFrom: "SD1 · Smoke Detector" };
    open(imported, mine, [mine]);
    const card = within(screen.getByTestId(`goal-card-${mine}`));
    expect(card.getByTestId("goal-from-component").textContent).toBe("from SD1");
    expect(card.queryByText("Not relevant for this asset")).toBeNull();
    expect((card.getByTestId("goal-formal-description") as HTMLTextAreaElement).disabled).toBe(true);
    cleanup();
    open(imported, other, [mine]);
    const free = within(screen.getByTestId(`goal-card-${other}`));
    expect(free.queryByTestId("goal-from-component")).toBeNull();
    expect(free.getByText("Not relevant for this asset")).toBeTruthy();
    expect((free.getByTestId("goal-formal-description") as HTMLTextAreaElement).disabled).toBe(false);
  });
});
