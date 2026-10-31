// src/tests/component/risk-goal-claim-tab.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 4 (decision 25): the risk dialog's
// "Goal / Claim" tab shows only what is linked to this risk, by treatment;
// goals from the asset's formal description; one-click reuse with a text
// preview, same scenario first; claims for retain (assumptions) and share
// (party); avoid needs nothing but the justification.

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskGoalClaimTab } from "features/risks/components/risk-goal-claim-tab";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { RiskTreatment } from "features/risks/models/risk-scale-types";
import { emptyCybersecurityConcept, type CybersecurityConcept } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const risk = (id: string, label: string, treeId?: string): Risk =>
  ({
    id,
    threatDisplayId: label,
    strideCategory: "T",
    linkedAssetIds: ["a1"],
    ...(treeId ? { attackTreeAssessment: { treeId, pathKey: id } } : {}),
  }) as unknown as Risk;

const R1 = risk("R-1", "AT-2.1", "t2");
const R2 = risk("R-2", "AT-2.2", "t2");
const R3 = risk("R-3", "AT-5.1", "t5");
const ASSETS = {
  assets: [
    {
      id: "a1",
      displayId: "DA-001",
      name: "Alarm message",
      assetGroup: "data",
      securityGoals: [{ type: "I", level: "high", formalDescription: "The alarm message shall be protected against tampering." }],
    },
  ],
} as never;

/** Feeds the concept back like the app layer does. */
const Harness: React.FC<{ r: Risk; treatment: RiskTreatment; initial?: CybersecurityConcept; spy?: (c: CybersecurityConcept) => void; justification?: string }> = ({
  r,
  treatment,
  initial,
  spy,
  justification = "",
}) => {
  const [concept, setConcept] = useState<CybersecurityConcept>(initial ?? emptyCybersecurityConcept());
  return (
    <RiskGoalClaimTab
      risk={r}
      treatment={treatment}
      allRisks={[R1, R2, R3]}
      concept={concept}
      onConceptChange={(c) => {
        setConcept(c);
        spy?.(c);
      }}
      assetDataRef={ASSETS}
      assumptions={[{ id: "as1", displayId: "ASM-01", text: "Loop wiring not accessible", status: "open" }]}
      treatmentJustification={justification}
      isoMode
    />
  );
};

afterEach(cleanup);

describe("Goal / Claim tab", () => {
  it("reduce: no goal yet warns; a goal from the asset's formal description", () => {
    const spy = vi.fn();
    render(<Harness r={R1} treatment="reduce" spy={spy} />);
    expect(screen.getByTestId("concept-goal-missing")).toBeTruthy();
    fireEvent.click(screen.getByTestId("goal-propose-I"));
    const c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.goals[0]).toMatchObject({
      displayId: "CSG-01",
      statement: "The alarm message shall be protected against tampering.",
      riskIds: ["R-1"],
      assetProperties: [{ assetId: "a1", property: "I" }],
    });
    expect(screen.getByTestId("goal-CSG-01")).toBeTruthy();
    expect(screen.queryByTestId("concept-goal-missing")).toBeNull();
  });

  it("reuse: same scenario first, full text as preview, one click links", () => {
    const initial: CybersecurityConcept = {
      ...emptyCybersecurityConcept(),
      goals: [
        { id: "g5", displayId: "CSG-01", statement: "Other scenario goal", riskIds: ["R-3"], assetProperties: [] },
        { id: "g2", displayId: "CSG-02", statement: "Protect the alarm loop against tampering.", riskIds: ["R-1"], assetProperties: [] },
      ],
    };
    const spy = vi.fn();
    render(<Harness r={R2} treatment="reduce" initial={initial} spy={spy} />);
    const cards = screen.getAllByTestId(/^reuse-CSG-/).map((e) => e.getAttribute("data-testid"));
    expect(cards).toEqual(["reuse-CSG-02", "reuse-CSG-01"]);
    const preview = screen.getByTestId("reuse-CSG-02");
    expect(preview.textContent).toContain("Protect the alarm loop against tampering.");
    expect(preview.textContent).toContain("used on AT-2.1");
    fireEvent.click(within(preview).getByTestId("reuse-link-CSG-02"));
    expect((spy.mock.calls.at(-1)![0] as CybersecurityConcept).goals.find((g) => g.id === "g2")!.riskIds).toEqual(["R-1", "R-2"]);
    // Now linked: shown as this risk's goal, with "also on".
    expect(screen.getByTestId("goal-CSG-02").textContent).toContain("also on AT-2.1");
  });

  it("an unrated sibling shows nothing of the scenario's goal", () => {
    const initial: CybersecurityConcept = {
      ...emptyCybersecurityConcept(),
      goals: [{ id: "g2", displayId: "CSG-02", statement: "x", riskIds: ["R-1"], assetProperties: [] }],
    };
    render(<Harness r={R2} treatment="reduce" initial={initial} />);
    expect(screen.queryByTestId("goal-CSG-02")).toBeNull();
  });

  it("an edit and a click right after it both land", () => {
    const spy = vi.fn();
    const initial: CybersecurityConcept = {
      ...emptyCybersecurityConcept(),
      goals: [{ id: "g1", displayId: "CSG-01", statement: "old", riskIds: ["R-1"], assetProperties: [] }],
    };
    render(<Harness r={R1} treatment="reduce" initial={initial} spy={spy} />);
    const field = screen.getByTestId("goal-statement-CSG-01");
    fireEvent.change(field, { target: { value: "new" } });
    fireEvent.blur(field);
    fireEvent.click(screen.getByTestId("goal-new-empty"));
    const c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.goals.map((g) => [g.displayId, g.statement])).toEqual([
      ["CSG-01", "new"],
      ["CSG-02", ""],
    ]);
  });

  it("retain: a claim from the justification, relying on an assumption", () => {
    const spy = vi.fn();
    render(<Harness r={R1} treatment="accept" spy={spy} justification="Physical access needs special tools." />);
    expect(screen.getByTestId("concept-claim-missing")).toBeTruthy();
    fireEvent.click(screen.getByTestId("claim-from-justification"));
    let c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.claims[0]).toMatchObject({ displayId: "CLM-01", kind: "retain", statement: "Physical access needs special tools." });
    const input = screen.getByTestId("claim-assumptions-CLM-01");
    fireEvent.mouseDown(input);
    fireEvent.click(screen.getByText("ASM-01 Loop wiring not accessible"));
    c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.claims[0].assumptionIds).toEqual(["as1"]);
  });

  it("share: a claim with the responsible party; avoid: only the hint", () => {
    const spy = vi.fn();
    render(<Harness r={R1} treatment="share" spy={spy} />);
    fireEvent.click(screen.getByTestId("claim-new-empty"));
    const party = screen.getByTestId("claim-party-CLM-01");
    fireEvent.change(party, { target: { value: "Installer" } });
    fireEvent.blur(party);
    expect((spy.mock.calls.at(-1)![0] as CybersecurityConcept).claims[0]).toMatchObject({ kind: "share", responsibleParty: "Installer" });
    cleanup();
    render(<Harness r={R1} treatment="eliminate" />);
    expect(screen.getByTestId("concept-avoid")).toBeTruthy();
  });
});
