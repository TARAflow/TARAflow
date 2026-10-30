// src/tests/component/risk-dialog-iso-after.test.tsx
//
// ISO/SAE 21434 "Risk After" tab (user test G, Headlamp AT-1.1): with the
// tree's ISO factor breakdown the five factors are the input and the residual
// tree level is derived from them — no select that jumps back; a stored level
// with fewer than five rated factors is named as such. Without the breakdown
// the residual level is the input, "not set" selectable. The impact is the
// damage scenario's (15.5), read-only instead of empty factor selects.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const ISO_CONFIG: RiskConfiguration = { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" };

const rating = (factorId: string, value: number) => ({ factorId, value, weight: 1 });
const AP = ["iso_elapsed_time", "iso_expertise", "iso_knowledge", "iso_window_of_opportunity", "iso_equipment"];

const risk = (residualTreeLevel: number, opts: { factors?: boolean; residualAp?: number[] } = {}): Risk =>
  ({
    id: "r1",
    threatDisplayId: "AT-1.1",
    threatDescription: "Spoof the headlamp command",
    strideCategory: "T",
    linkedAssetIds: [],
    treatment: "reduce",
    moscowPriority: "must",
    selectedMitigations: [],
    selectedVerifications: [],
    factorRatings: [
      rating("safety", 4),
      ...(opts.factors === false ? [] : [3, 3, 2, 1, 1].map((v, i) => rating(AP[i], v))),
      { ...rating("attack_tree_likelihood", 4), source: "attack-tree" },
    ],
    mitigatedFactorRatings: [
      rating("safety", 0),
      ...AP.map((id, i) => rating(id, opts.residualAp?.[i] ?? 0)),
      rating("attack_tree_likelihood", residualTreeLevel),
    ],
    attackTreeAssessment: {
      treeId: "t1",
      pathKey: "p1",
      strideCategory: "T",
      likelihoodComponent: 0,
      levelToRiskScale: { high: 4, medium: 3, low: 2, "very-low": 1 },
    },
    isoRisk: { impact: "severe", feasibility: "high", value: 5 },
    calculatedRiskBeforeMitigation: 10,
    calculatedRiskAfterMitigation: 0,
  }) as unknown as Risk;

const openAfterTab = (r: Risk) => {
  render(
    <RiskDialog open risks={[r]} initialIndex={0} configuration={ISO_CONFIG} onSave={() => {}} onClose={() => {}} isoMode />,
  );
  fireEvent.click(screen.getAllByRole("tab", { name: "Risk After" })[0]);
};

// jsdom has no scrollIntoView (the dialog scrolls the active risk into view).
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);

describe("risk dialog — ISO Risk After", () => {
  it("factor breakdown: no residual-level select, a stored level is named", () => {
    openAfterTab(risk(1));
    expect(screen.getByTestId("residual-feasibility-panel").textContent).toContain(
      "Very low (stored residual level) — rate all five factors",
    );
    expect(screen.queryByText("Not set")).toBeNull();
    expect(screen.getByTestId("iso-risk-panel-after").textContent).toContain("Very low");
  });

  it("factor breakdown: five rated factors give the residual", () => {
    openAfterTab(risk(0, { residualAp: [4, 4, 4, 4, 4] }));
    expect(screen.getByTestId("residual-feasibility-panel").textContent).toMatch(/AP \d+ → \S+ → L \d/);
  });

  it("no factor breakdown: the residual level is the input, 'not set' selectable", () => {
    openAfterTab(risk(0, { factors: false }));
    expect(screen.queryByTestId("residual-feasibility-panel")).toBeNull();
    expect(screen.getByText("Not set")).toBeTruthy();
  });

  it("the impact is the damage scenario's, read-only — no empty impact selects", () => {
    openAfterTab(risk(1));
    const note = screen.getByTestId("iso-impact-after-note");
    expect(note.textContent).toContain("Severe");
    expect(note.textContent).toContain("re-rate the damage scenario");
    expect(screen.queryByText("Impact Factors (After)")).toBeNull();
  });
});
