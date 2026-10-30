// src/tests/component/risk-dialog-iso-after.test.tsx
//
// ISO/SAE 21434 "Risk After" tab (user test G, Headlamp AT-1.1): the residual
// feasibility comes from the residual attack-tree level first, then from the
// five attack-potential factors (liveIsoRisk / computeIsoRisks). Both sources
// are shown and the panel names the one in effect; the impact is the damage
// scenario's (15.5) and is shown read-only instead of empty factor selects.

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

const risk = (residualTreeLevel: number): Risk =>
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
      ...[3, 3, 2, 1, 1].map((v, i) => rating(AP[i], v)),
      { ...rating("attack_tree_likelihood", 4), source: "attack-tree" },
    ],
    mitigatedFactorRatings: [
      rating("safety", 0),
      ...AP.map((id) => rating(id, 0)),
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
  it("a residual tree level is the residual feasibility, the panel says so", () => {
    openAfterTab(risk(1));
    expect(screen.getByTestId("residual-feasibility-panel").textContent).toContain(
      "Very low — from the residual attack-tree level",
    );
    expect(screen.getByTestId("iso-risk-panel-after").textContent).toContain("Very low");
  });

  it("no residual level and unrated factors: not rated, the level offers 'not set'", () => {
    openAfterTab(risk(0));
    expect(screen.getByTestId("residual-feasibility-panel").textContent).toContain(
      "Not rated — set the residual attack-tree level or rate all five factors",
    );
    expect(screen.getByText("Not set — from the attack-potential factors")).toBeTruthy();
  });

  it("the impact is the damage scenario's, read-only — no empty impact selects", () => {
    openAfterTab(risk(1));
    const note = screen.getByTestId("iso-impact-after-note");
    expect(note.textContent).toContain("Severe");
    expect(note.textContent).toContain("re-rate the damage scenario");
    expect(screen.queryByText("Impact Factors (After)")).toBeNull();
  });
});
