// src/tests/component/security-goal-chips.test.tsx
//
// Phase 5 of the security-goal rework: the security-goal column of the asset
// table shows level and state per goal, taken from goalState() — so 50 assets
// can be reviewed without opening every dialog. Before, the column showed bare
// goal codes: no level, no "assessment required", and excluded goals vanished
// (invariant C).

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SecurityGoalChips,
  goalChipEntries,
} from "features/assets/components/security-goal-chips";
import { AssetTable } from "features/assets/components/asset-table";
import {
  adjustGoal,
  excludeGoal,
  setGoalImpact,
} from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoal, SecurityGoalType } from "features/assets/models/asset-security-goals-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, n: string) =>
        options && n in options ? String(options[n]) : `{{${n}}}`,
      );
    },
    i18n: { language: "en" },
  }),
}));

const S = "4-level" as const;
const TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];
const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({ criterionId, value });
const LVL = "tabs.assets.cianaaa.level";

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
const withGoal = (a: Asset, g: SecurityGoal): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});
const chip = (t: SecurityGoalType) => screen.getByTestId(`goal-chip-${t}`);

describe("SecurityGoalChips", () => {
  it("assessed suggestion: goal with its level, no marker", () => {
    const a = asset([r("safety", 4), r("operational", 4), r("financial_damage", 3)]);
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(chip("I")).toHaveTextContent(`I · ${LVL}.${goal(a, "I").level}`);
    expect(chip("I").dataset.state).toBe("level");
    expect(chip("I").dataset.marker).toBe("none");
  });

  it("assessment missing: '?' instead of the minimum level (invariant D), warning marker", () => {
    const a = asset([]);
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(chip("I")).toHaveTextContent("I · ?");
    expect(chip("I")).not.toHaveTextContent(`${LVL}.low`);
    expect(chip("I").dataset.state).toBe("missing");
    expect(chip("I").dataset.marker).toBe("warning");
  });

  it("excluded goal stays visible with its decision (invariant C)", () => {
    const a0 = asset([r("safety", 4), r("financial_damage", 3)]);
    const a = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "No secrets in the config", S));
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(chip("C").dataset.state).toBe("excluded");
    expect(chip("C")).toHaveTextContent(/^C$/);
    expect(chip("C").querySelector('[data-testid="goal-chip-manual"]')).not.toBeNull();
    expect(chip("C").dataset.marker).toBe("none");
  });

  it("manual decision without rationale: warning marker", () => {
    const a0 = asset([r("safety", 4), r("operational", 4)]);
    const a = withGoal(a0, adjustGoal(a0, goal(a0, "I"), "low", "", S));
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(chip("I")).toHaveTextContent(`I · ${LVL}.low`);
    expect(chip("I").dataset.marker).toBe("warning");
  });

  it("goal impact above the asset value: error marker", () => {
    const a0 = asset([r("safety", 2), r("operational", 2)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 3), rationale: "x" });
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(chip("I").dataset.marker).toBe("error");
  });

  it("neither active nor suggested goals are not shown; canonical order", () => {
    const a = asset([r("safety", 4), r("financial_damage", 3)]);
    const shown = goalChipEntries(a, S).map((e) => e.goal.type);
    expect(shown).not.toContain("Acc");
    expect(shown).toEqual(TYPES.filter((t) => shown.includes(t)));
  });

  it("no goal to show → dash", () => {
    const a = { ...asset([]), securityGoals: [] } as Asset;
    render(<SecurityGoalChips asset={a} impactScale={S} />);
    expect(screen.getByText("–")).toBeTruthy();
  });
});

describe("AssetTable — goal column", () => {
  it("renders the goal chips for each asset row", () => {
    const a = asset([]);
    render(
      <div style={{ width: 1600, height: 600 }}>
        <AssetTable
          assets={[a]}
          configuration={DEFAULT_ASSET_CONFIGURATION}
          onEdit={() => {}}
        />
      </div>,
    );
    expect(screen.getAllByTestId(/^goal-chip-/).length).toBeGreaterThan(0);
  });
});
