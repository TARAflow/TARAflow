// src/tests/component/risk-dialog-iso-after.test.tsx
//
// ISO/SAE 21434 risk dialog, Before / After (user test G, Headlamp AT-1.1):
// the panels read Feasibility | Impact | Risk, each with where the value comes
// from — the attack tree path (before), the five factors, a stored residual
// level or the residual tree level (after), the damage scenario (impact,
// 15.5). No read-only tree row before, no residual box under the factors;
// with the factor breakdown no residual-level select (it is derived from the
// factors). Without the breakdown the residual level is the input, "not set"
// selectable.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    sourceStrideMethod: "attack-path",
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

const openDialog = (r: Risk) =>
  render(
    <RiskDialog open risks={[r]} initialIndex={0} configuration={ISO_CONFIG} onSave={() => {}} onClose={() => {}} isoMode />,
  );
const openAfterTab = (r: Risk) => {
  openDialog(r);
  fireEvent.click(screen.getAllByRole("tab", { name: "Risk After" })[0]);
};
const note = (id: string) => screen.getByTestId(id).textContent;

// jsdom has no scrollIntoView (the dialog scrolls the active risk into view).
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);

describe("risk dialog — ISO Risk Before / After", () => {
  it("before: Feasibility | Impact | Risk, the tree path in the panel, no tree row", () => {
    openDialog(risk(1));
    const panel = screen.getByTestId("iso-risk-panel-before");
    const text = panel.textContent ?? "";
    expect(text.indexOf("Feasibility")).toBeLessThan(text.indexOf("Impact"));
    expect(note("iso-risk-panel-before-feasibility-note")).toMatch(/^Attack tree path AT-1\.1 · AP \d+$/);
    expect(screen.queryByText(/read-only, edit at source/)).toBeNull();
  });

  it("after, factor breakdown: no residual-level select, a stored level is named", () => {
    openAfterTab(risk(1));
    expect(note("iso-risk-panel-after-feasibility-note")).toBe("Stored residual level — rate all five factors");
    expect(screen.getByTestId("iso-risk-panel-after").textContent).toContain("Very low");
    expect(screen.queryByText("Not set")).toBeNull();
    expect(screen.queryByTestId("residual-feasibility-panel")).toBeNull();
  });

  it("after, factor breakdown: five rated factors give the residual", () => {
    openAfterTab(risk(0, { residualAp: [4, 4, 4, 4, 4] }));
    expect(note("iso-risk-panel-after-feasibility-note")).toMatch(/^Five factors · AP \d+$/);
  });

  it("after, no factor breakdown: the residual level is the input, 'not set' selectable", () => {
    openAfterTab(risk(0, { factors: false }));
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(note("iso-risk-panel-after-feasibility-note")).toBe("Set the residual attack-tree level below");
  });

  it("after: the impact is the damage scenario's, read-only — no empty impact selects", () => {
    openAfterTab(risk(1));
    expect(note("iso-risk-panel-after-impact-note")).toBe("Unchanged (damage scenario)");
    expect(screen.getByTestId("iso-risk-panel-after").textContent).toContain("Severe");
    expect(note("iso-impact-after-note")).toContain("re-rate the damage scenario");
    expect(screen.queryByText("Impact Factors (After)")).toBeNull();
  });

  it("the side list is in ascending display-id order, not by score", () => {
    const at = (id: string, score: number) =>
      ({ ...risk(1), id, threatDisplayId: id, calculatedRiskBeforeMitigation: score }) as Risk;
    render(
      <RiskDialog
        open
        risks={[at("AT-2.1", 5), at("AT-10.2", 9), at("AT-1.1", 1)]}
        initialIndex={0}
        configuration={ISO_CONFIG}
        onSave={() => {}}
        onClose={() => {}}
        isoMode
      />,
    );
    // The side list is the dialog's MUI List (<ul>); the header names the open risk.
    const list = document.querySelector("ul")!;
    const ids = within(list as HTMLElement).getAllByText(/^AT-\d+\.\d+$/).map((e) => e.textContent);
    expect(ids).toEqual(["AT-1.1", "AT-2.1", "AT-10.2"]);
  });

  it("residual factor levels read like every likelihood factor: least likely first (user 2026-10-31)", async () => {
    openAfterTab(risk(1));
    // The first select of the After tab is the elapsed time.
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toEqual(["Not rated", ">6months", "<=6months", "<=1month", "<=1week", "<=1day"]);
  });

  it("the residual tree level: Very low first, High last", async () => {
    openAfterTab(risk(0, { factors: false }));
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toEqual(["Not set", "Very low (1)", "Low (2)", "Medium (3)", "High (4)"]);
  });
});
