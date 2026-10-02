// src/tests/component/security-goal-card.test.tsx
//
// Phase 3 of the security-goal rework: the goal cards render what goalState()
// says and route every decision through the explicit actions. Card-level tests
// cover every state; the dialog tests cover the wiring (actions, rationale
// required on save, snapshots on save).

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  // Example 03: with no impact rated, the card points to the rating — not to a
  // rationale or an exclusion.
  it("assessment missing: hint and 'Rate impact' button", () => {
    const onRateImpact = vi.fn();
    renderCard(asset([]), "I", { onRateImpact });
    expect(screen.getByTestId("goal-rate-impact-I")).toHaveTextContent("no rationale is needed");
    fireEvent.click(screen.getByText("Rate impact"));
    expect(onRateImpact).toHaveBeenCalled();
  });

  it("assessed goal: no rating hint", () => {
    renderCard(asset([r("safety", 4), r("operational", 4)]), "I", { onRateImpact: vi.fn() });
    expect(screen.queryByTestId("goal-rate-impact-I")).toBeNull();
  });

  // Phase 6: back-reference "N threats violate this goal".
  it("back-reference: number of violating threats, ids in the tooltip", () => {
    renderCard(asset([r("financial_damage", 3)]), "C", { violatingThreats: ["P1-I-1", "P2-I-1"] });
    expect(screen.getByTestId("goal-threat-count-C")).toHaveTextContent("2 threat(s)");
  });

  it("back-reference: an active goal no threat violates says so", () => {
    renderCard(asset([r("financial_damage", 3)]), "C", { violatingThreats: [] });
    expect(screen.getByTestId("goal-threat-count-C")).toHaveTextContent("no threat");
  });

  it("back-reference: hidden without threat data and for excluded goals", () => {
    renderCard(asset([r("financial_damage", 3)]), "C");
    expect(screen.queryByTestId("goal-threat-count-C")).toBeNull();
    cleanup();
    const a0 = asset([r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "public", S));
    renderCard(a, "C", { violatingThreats: ["P1-I-1"] });
    expect(screen.queryByTestId("goal-threat-count-C")).toBeNull();
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

  it("threat links reach the cards as back-references (Phase 6)", () => {
    const a = asset([r("financial_damage", 3)]);
    render(
      <AssetDialog
        open
        asset={a}
        configuration={config}
        onSave={vi.fn()}
        onClose={noop}
        threatLinks={[
          { id: "t1", displayId: "P1-T-10", strideCategory: "T", linkedAssetIds: [a.id] },
          { id: "t2", displayId: "P1-T-2", strideCategory: "T", linkedAssetIds: [a.id] },
          { id: "t3", displayId: "P9-T-1", strideCategory: "T", linkedAssetIds: ["other"] },
        ]}
      />,
    );
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(screen.getByTestId("goal-threat-count-I")).toHaveTextContent("2 threat(s)");
    expect(screen.getByTestId("goal-threat-count-C")).toHaveTextContent("no threat");
  });

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

  it("picking the suggested level returns to the suggestion — field disappears (critical → high → critical)", () => {
    // C suggested "critical" (financial_damage 4)
    openDialog(asset([r("financial_damage", 4)]));
    const card = () => screen.getByTestId("goal-card-C");
    const field = () => within(card()).queryByLabelText(/Why does the suggested level not fit\?/);
    const level = (name: string) =>
      fireEvent.click(within(card()).getByRole("button", { name: `tabs.assets.cianaaa.level.${name}` }));

    fireEvent.click(card().querySelector("[aria-label='expand']")!);
    level("high");
    expect(field()).toBeTruthy();
    expect(within(card()).getByText("Adjusted")).toBeTruthy();

    level("critical"); // the suggested level
    expect(field()).toBeNull();
    expect(within(card()).getByText("Suggested")).toBeTruthy();
  });

  it("the rationale field is the last field and outlined red while empty", () => {
    openDialog(asset([r("financial_damage", 4)]));
    const card = screen.getByTestId("goal-card-C");
    fireEvent.click(card.querySelector("[aria-label='expand']")!);
    fireEvent.click(within(card).getByRole("button", { name: "tabs.assets.cianaaa.level.low" }));
    const inputs = Array.from(card.querySelectorAll("textarea:not([aria-hidden])")) as HTMLElement[];
    const last = inputs[inputs.length - 1];
    expect(last).toBe(within(card).getByLabelText(/Why does the suggested level not fit\?/));
    expect(last.closest(".MuiTextField-root")!.querySelector(".Mui-error")).toBeTruthy();

    fireEvent.change(last, { target: { value: "reason" } });
    expect(last.closest(".MuiTextField-root")!.querySelector(".Mui-error")).toBeNull();
  });

  it("adding a not-suggested goal creates a manual card", () => {
    openDialog(asset([r("operational", 3)]));
    fireEvent.click(screen.getByTestId("add-goal-A"));
    const card = screen.getByTestId("goal-card-A");
    expect(within(card).getByText("Added")).toBeTruthy();
  });
});

describe("per-goal impact editor (Phase 4)", () => {
  const config = { ...DEFAULT_ASSET_CONFIGURATION, impactScale: S } as any;
  function open(a: Asset) {
    const onSave = vi.fn();
    render(<AssetDialog open asset={a} configuration={config} onSave={onSave} onClose={noop} />);
    fireEvent.click(screen.getAllByRole("tab")[1]);
    return onSave;
  }
  const card = (t: SecurityGoalType) => screen.getByTestId(`goal-card-${t}`);
  const expand = (t: SecurityGoalType) => {
    const b = card(t).querySelector("[aria-label='expand']");
    if (b) fireEvent.click(b);
  };
  const pick = (t: SecurityGoalType, criterion: string, option: string) => {
    fireEvent.mouseDown(within(card(t)).getByLabelText(new RegExp(`${criterion}.* impact$`)));
    fireEvent.click(within(screen.getByRole("listbox")).getByText(option));
  };

  it("options are capped at the asset value; adjusting lowers the goal level and asks why", () => {
    open(asset([r("financial_damage", 3)]));
    expand("C");
    fireEvent.click(within(card("C")).getByTestId("goal-impact-toggle"));
    fireEvent.mouseDown(within(card("C")).getByLabelText(/financial_damage.* impact$/));
    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["inherited (3)", "1", "2", "3", "n/a"]);
    fireEvent.click(within(screen.getByRole("listbox")).getByText("1"));

    const row = within(card("C")).getByTestId("goal-impact-financial_damage");
    expect(within(row).getByText("adjusted")).toBeTruthy();
    // level follows the effective rating (1 → low), rationale asked as "impact"
    expect(within(card("C")).getAllByText("tabs.assets.cianaaa.level.low").some((el) => el.closest(".MuiChip-root"))).toBe(true);
    expect(within(card("C")).getByLabelText(/Why does this goal's impact differ from the asset's\?/)).toBeTruthy();

    pick("C", "financial_damage", "inherited (3)");
    expect(within(within(card("C")).getByTestId("goal-impact-financial_damage")).getByText("inherited")).toBeTruthy();
  });

  it("conflict (override above a lowered asset value): shown with reset / raise; raise resolves it", () => {
    const a0 = asset([r("financial_damage", 2)]);
    const c = { ...goal(a0, "C"), impactRatings: [{ criterionId: "financial_damage", value: 3 }], rationale: "x" };
    open(withGoal(a0, c));
    const row = within(card("C")).getByTestId("goal-impact-financial_damage");
    expect(within(row).getByText("Adjustment 3 exceeds asset value 2")).toBeTruthy();
    fireEvent.click(within(row).getByText("Raise asset value"));
    expect(within(within(card("C")).getByTestId("goal-impact-financial_damage")).queryByText(/exceeds/)).toBeNull();
  });

  it("the impact toggle shows a chevron and reports its state", () => {
    open(asset([r("financial_damage", 3)]));
    expand("C");
    const toggle = within(card("C")).getByTestId("goal-impact-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.querySelector("svg")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("saved goal carries its override", () => {
    const onSave = open(asset([r("financial_damage", 3)]));
    expand("C");
    fireEvent.click(within(card("C")).getByTestId("goal-impact-toggle"));
    pick("C", "financial_damage", "2");
    fireEvent.change(within(card("C")).getByLabelText(/Why does this goal's impact differ/), { target: { value: "internal only" } });
    fireEvent.click(screen.getByText("Save"));
    const saved: Asset = onSave.mock.calls[0][0];
    expect(saved.securityGoals.find((g) => g.type === "C")!.impactRatings).toEqual([{ criterionId: "financial_damage", value: 2 }]);
  });
});
