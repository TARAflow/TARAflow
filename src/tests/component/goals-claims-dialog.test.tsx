// src/tests/component/goals-claims-dialog.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 4, P4-2 (decision 25): the overall
// "Goals & Claims" view — findings with "Open", proposals for several risks
// at once, goals / claims grouped by scenario, merge, remove unused; and the
// marker in the risk table.

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoalsClaimsDialog } from "features/risks/components/goals-claims-dialog";
import { conceptFindings } from "features/risks/services/concept-findings";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { CybersecurityConcept } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const risk = (id: string, label: string, treatment: string): Risk =>
  ({ id, threatDisplayId: label, treatment, treatmentJustification: "", strideCategory: "T", linkedAssetIds: ["a1"] }) as unknown as Risk;
const RISKS = [risk("R1", "AT-2.1", "reduce"), risk("R2", "AT-2.2", "reduce"), risk("R3", "AT-5.1", "accept")];
const ASSETS = {
  assets: [{ id: "a1", displayId: "DA-001", name: "Alarm", assetGroup: "data", securityGoals: [{ type: "I", level: "high", formalDescription: "Protect the alarm." }] }],
} as never;

const Harness: React.FC<{ initial: CybersecurityConcept; spy: (c: CybersecurityConcept) => void; onOpenRisk?: (id: string) => void }> = ({ initial, spy, onOpenRisk }) => {
  const [concept, setConcept] = useState(initial);
  const findings = conceptFindings({ risks: RISKS, concept, isoMode: true, today: "2026-10-30" });
  return (
    <GoalsClaimsDialog
      open
      onClose={() => {}}
      risks={RISKS}
      concept={concept}
      onConceptChange={(c) => {
        setConcept(c);
        spy(c);
      }}
      findings={findings}
      assetDataRef={ASSETS}
      onOpenRisk={onOpenRisk}
    />
  );
};
const empty: CybersecurityConcept = { goals: [], claims: [], verifications: [] };

afterEach(cleanup);

describe("Goals & Claims dialog", () => {
  it("findings with Open; a proposal creates one goal for both reduce risks", () => {
    const spy = vi.fn();
    const onOpenRisk = vi.fn();
    render(<Harness initial={empty} spy={spy} onOpenRisk={onOpenRisk} />);
    const findings = screen.getByTestId("goals-claims-findings");
    expect([...findings.querySelectorAll("[data-code]")].map((e) => e.getAttribute("data-code"))).toEqual([
      "GOAL_MISSING",
      "GOAL_MISSING",
      "CLAIM_MISSING",
    ]);
    fireEvent.click(within(findings).getAllByText("Open")[2]);
    expect(onOpenRisk).toHaveBeenCalledWith("R3");

    fireEvent.click(screen.getByTestId("accept-proposal-a1-I"));
    const c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.goals).toEqual([
      expect.objectContaining({ displayId: "CSG-01", statement: "Protect the alarm.", riskIds: ["R1", "R2"] }),
    ]);
    // Grouped by scenario; the proposal is gone.
    expect(screen.getByTestId("overview-goal-CSG-01").textContent).toContain("AT-2AT-2.1AT-2.2");
    expect(screen.queryByTestId("goals-claims-proposals")).toBeNull();
  });

  it("merge and remove an unused goal", () => {
    const spy = vi.fn();
    render(
      <Harness
        initial={{
          ...empty,
          goals: [
            { id: "g1", displayId: "CSG-01", statement: "a", riskIds: ["R1"], assetProperties: [] },
            { id: "g2", displayId: "CSG-02", statement: "b", riskIds: ["R2"], assetProperties: [] },
            { id: "g3", displayId: "CSG-03", statement: "c", riskIds: [], assetProperties: [] },
          ],
        }}
        spy={spy}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-CSG-03"));
    expect((spy.mock.calls.at(-1)![0] as CybersecurityConcept).goals.map((g) => g.displayId)).toEqual(["CSG-01", "CSG-02"]);
    const merge = within(screen.getByTestId("overview-goal-CSG-02")).getByRole("combobox");
    fireEvent.mouseDown(merge);
    fireEvent.click(screen.getByRole("option", { name: "CSG-01" }));
    const c = spy.mock.calls.at(-1)![0] as CybersecurityConcept;
    expect(c.goals).toEqual([expect.objectContaining({ displayId: "CSG-01", riskIds: ["R1", "R2"] })]);
  });
});

describe("risk table marker", () => {
  it("a risk with goal / claim warnings gets a marker next to its treatment", async () => {
    const { useRiskColumns } = await import("features/risks/components/shared/risk-columns");
    const { ConceptFindingsProvider } = await import("features/risks/components/concept-findings-context");
    const { DEFAULT_CONFIGURATION } = await import("features/risks/models/risk-config-types");
    const Cell: React.FC<{ r: Risk }> = ({ r }) => {
      const cols = useRiskColumns({
        configuration: DEFAULT_CONFIGURATION,
        onEdit: () => {},
        onPriorityChange: () => {},
        onTreatmentChange: () => {},
      } as never);
      return <>{cols.find((c) => c.id === "treatment")!.renderCell(r)}</>;
    };
    const markers = new Map([["R1", conceptFindings({ risks: [RISKS[0]], concept: empty, isoMode: true, today: "2026-10-30" })]]);
    render(
      <ConceptFindingsProvider value={markers}>
        <Cell r={RISKS[0]} />
        <Cell r={RISKS[1]} />
      </ConceptFindingsProvider>,
    );
    expect(screen.getByTestId("concept-marker-R1")).toBeTruthy();
    expect(screen.queryByTestId("concept-marker-R2")).toBeNull();
  });
});
