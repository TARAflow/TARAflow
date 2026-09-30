// src/tests/component/security-goal-card.test.tsx
//
// Phase 3 of the security-goal rework: the goal cards render what goalState()
// says and route every decision through the explicit actions. Card-level tests
// cover every state; the dialog tests cover the wiring (actions, rationale
// required on save, snapshots on save).

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecurityGoalCard, rationalePrompt } from "features/assets/components/security-goal-card";
import AssetDialogDefault, * as AssetDialogModule from "features/assets/components/asset-dialog";
import { adjustGoal, excludeGoal, goalState } from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, n: string) => (options && n in options ? String(options[n]) : `{{${n}}}`));
    },
  }),
}));

const AssetDialog: React.FC<any> =
  (AssetDialogModule as any).AssetDialog ?? (AssetDialogDefault as any);

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });

function asset(ratings: ImpactRating[]): Asset {
  const base = {
    id: "a-1",
    displayId: "DA-001",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings: ratings,
    linkedDFDElements: [{ elementId: "E-1", elementName: "Config push", relationType: "transports" }],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  return { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, S) };
}
const goal = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
const withGoal = (a: Asset, g: SecurityGoal): Asset => ({ ...a, securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)) });

const noop = () => {};
function renderCard(a: Asset, type: SecurityGoalType, overrides: Record<string, unknown> = {}) {
  const handlers = {
    onLevel: vi.fn(), onExclude: vi.fn(), onKeep: vi.fn(), onReset: vi.fn(),
    onRationale: vi.fn(), onDescription: noop, onConsequence: noop, onUseTemplate: noop,
  };
  render(
    <SecurityGoalCard
      goal={goal(a, type)}
      state={goalState(a, goal(a, type), S)}
      impactRatings={a.impactRatings}
      criterionName={(id) => id}
      assetDisplayName="Config DB [DA-001]"
      defaultExpanded
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

// ──────────────────────────────────────────────────────────────────────────

describe("SecurityGoalCard — states", () => {
  it("suggested, assessed: level, source and the driver", () => {
    renderCard(asset([r("financial_damage", 3)]), "C");
    const card = screen.getByTestId("goal-card-C");
    expect(within(card).getAllByText("tabs.assets.securityGoals.C.name (C)").length).toBeGreaterThan(0);
    expect(within(card).getByText("Suggested")).toBeTruthy();
    expect(within(card).getAllByText("Driver: financial_damage = 3").length).toBeGreaterThan(0);
    expect(within(card).getByText("Config push → transports")).toBeTruthy();
  });

  it("assessment missing: 'Assessment required' instead of a level (invariant D)", () => {
    renderCard(asset([]), "C");
    const card = screen.getByTestId("goal-card-C");
    expect(within(card).getByText("Assessment required")).toBeTruthy();
    // no level CHIP in the header (the level selector below may still offer "low")
    const levelChips = within(card)
      .queryAllByText("tabs.assets.cianaaa.level.low")
      .filter((el) => el.closest(".MuiChip-root"));
    expect(levelChips).toEqual([]);
  });

  it("provisional and minimum level are marked", () => {
    renderCard(asset([r("safety", 3)]), "C");
    expect(within(screen.getByTestId("goal-card-C")).getByText("provisional")).toBeTruthy();
  });

  it("manual adjustment asks why the suggestion does not fit; missing rationale is flagged", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "low", "", S));
    renderCard(a, "C");
    const card = screen.getByTestId("goal-card-C");
    expect(within(card).getByText("Adjusted")).toBeTruthy();
    expect(within(card).getByText("Rationale missing")).toBeTruthy();
    expect(within(card).getByLabelText(/Why does the suggested level not fit\?/)).toBeTruthy();
  });

  it("exclusion asks why the goal is not relevant; reactivate resets", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "public data", S));
    const h = renderCard(a, "C");
    const card = screen.getByTestId("goal-card-C");
    expect(within(card).getByText("Excluded")).toBeTruthy();
    expect(within(card).getByLabelText(/Why is this security goal not relevant/)).toBeTruthy();
    fireEvent.click(within(card).getByText("Reactivate (suggestion)"));
    expect(h.onReset).toHaveBeenCalled();
  });

  it("changed suggestion: Review badge, message, Keep and Adopt", () => {
    const a0 = asset([r("financial_damage", 2)]);
    const a1 = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "ok", S));
    const a = { ...a1, impactRatings: [r("financial_damage", 4)] } as Asset;
    const h = renderCard(a, "C");
    const card = screen.getByTestId("goal-card-C");
    expect(within(card).getByText("Review")).toBeTruthy();
    fireEvent.click(within(card).getByText("Keep decision"));
    expect(h.onKeep).toHaveBeenCalled();
    fireEvent.click(within(card).getByText("Adopt suggestion"));
    expect(h.onReset).toHaveBeenCalled();
  });

  it("picking another level routes to onLevel; exclude routes to onExclude", () => {
    const h = renderCard(asset([r("financial_damage", 3)]), "C");
    const card = screen.getByTestId("goal-card-C");
    fireEvent.click(within(card).getByRole("button", { name: "tabs.assets.cianaaa.level.low" }));
    expect(h.onLevel).toHaveBeenCalledWith("low");
    fireEvent.click(within(card).getByText("Not relevant for this asset"));
    expect(h.onExclude).toHaveBeenCalled();
  });

  it("layout: 'Why this goal?' and 'Why this level?' share one two-column block", () => {
    renderCard(asset([r("financial_damage", 3)]), "C");
    const block = within(screen.getByTestId("goal-card-C")).getByTestId("goal-card-reasons");
    expect(within(block).getByText("Why this goal?")).toBeTruthy();
    expect(within(block).getByText("Why this level?")).toBeTruthy();
    expect(block.children.length).toBe(2);
  });

  it("layout: rationale, requirement and consequence rows all reserve the same trailing slot", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "low", "x", S));
    renderCard(a, "C");
    const card = screen.getByTestId("goal-card-C");
    const rows = [
      within(card).getByLabelText(/Why does the suggested level not fit\?/),
      within(card).getByLabelText(/Formal Security Requirement/),
      within(card).getByLabelText(/Consequence/),
    ].map((input) => input.closest(".MuiTextField-root")!.parentElement!.parentElement!);
    for (const row of rows) expect(row.children.length).toBe(2); // field + trailing slot
  });

  it("a collapsed card opens when it starts needing attention", () => {
    const a0 = asset([r("financial_damage", 3)]);
    const props = {
      goal: goal(a0, "C"), state: goalState(a0, goal(a0, "C"), S), impactRatings: a0.impactRatings,
      criterionName: (id: string) => id, assetDisplayName: "x",
      onLevel: noop, onExclude: noop, onKeep: noop, onReset: noop, onRationale: noop,
      onDescription: noop, onConsequence: noop, onUseTemplate: noop,
    };
    const { rerender } = render(<SecurityGoalCard {...(props as any)} />);
    expect(within(screen.getByTestId("goal-card-C")).queryByText("Why this goal?")).toBeNull();
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "low", "", S));
    rerender(<SecurityGoalCard {...(props as any)} goal={goal(a, "C")} state={goalState(a, goal(a, "C"), S)} />);
    expect(within(screen.getByTestId("goal-card-C")).getByText("Why this goal?")).toBeTruthy();
  });

  it("rationalePrompt is derived from the state", () => {
    const a0 = asset([r("operational", 3)]);
    const added = withGoal(a0, adjustGoal(a0, goal(a0, "A"), "high", "", S));
    expect(rationalePrompt(goalState(added, goal(added, "A"), S))).toBe("added");
    expect(rationalePrompt(goalState(a0, goal(a0, "C"), S))).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────

describe("AssetDialog — goal cards wiring", () => {
  const config = { ...DEFAULT_ASSET_CONFIGURATION, impactScale: S } as any;

  function openDialog(a: Asset) {
    const onSave = vi.fn();
    render(<AssetDialog open asset={a} configuration={config} onSave={onSave} onClose={noop} />);
    // switch to the security goals tab
    fireEvent.click(screen.getAllByRole("tab")[1]);
    return onSave;
  }

  it("renders a card per suggested goal and offers the others to add", () => {
    openDialog(asset([r("financial_damage", 3)]));
    expect(screen.getByTestId("goal-card-C")).toBeTruthy();
    expect(screen.getByTestId("goal-card-I")).toBeTruthy();
    expect(screen.getByTestId("add-goal-A")).toBeTruthy();
  });

  it("a manual decision without rationale blocks save; with rationale it saves with a snapshot", () => {
    const onSave = openDialog(asset([r("financial_damage", 3)]));
    const card = screen.getByTestId("goal-card-C");
    fireEvent.click(card.querySelector("[aria-label='expand']")!);
    fireEvent.click(within(card).getByRole("button", { name: "tabs.assets.cianaaa.level.low" }));
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Manual decisions need a rationale: C")).toBeTruthy();

    fireEvent.change(within(screen.getByTestId("goal-card-C")).getByLabelText(/Why does the suggested level not fit\?/), {
      target: { value: "only internal use" },
    });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: Asset = onSave.mock.calls[0][0];
    const c = saved.securityGoals.find((g) => g.type === "C")!;
    expect(c).toMatchObject({ level: "low", source: "manual", rationale: "only internal use" });
    expect(c.suggestionAtDecision).toMatchObject({ suggested: true, level: "high" });
  });

  it("adding a not-suggested goal creates a manual card", () => {
    openDialog(asset([r("operational", 3)]));
    fireEvent.click(screen.getByTestId("add-goal-A"));
    const card = screen.getByTestId("goal-card-A");
    expect(within(card).getByText("Added")).toBeTruthy();
  });
});
