// src/tests/component/goals-claims-dialog.relink.test.tsx
//
// FX-5: in "Goals & Claims" a goal / claim linked to a removed risk (its
// attack-tree node was renamed) offers "Re-link to …" with the paths of the
// same tree and STRIDE category, and "Remove link".

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoalsClaimsDialog } from "features/risks/components/goals-claims-dialog";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { CybersecurityConcept } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const renamed = {
  id: "R-AT-t1-a1b2c3d4e5f6-T",
  threatDisplayId: "AT-1.2",
  threatDescription: "Flash tampered firmware",
  treatment: "reduce",
  strideCategory: "T",
  selectedMitigations: [{ id: "M-T-001", status: "open" }],
  attackTreeAssessment: { treeId: "t1", pathKey: "a1b2c3d4e5f6", likelihoodComponent: 0, strideCategory: "T" },
} as unknown as Risk;
const DEAD = "R-AT-t1-ffffffffffff-T";

const initial: CybersecurityConcept = {
  goals: [{ id: "g1", displayId: "CSG-01", statement: "Keep the firmware genuine", riskIds: [DEAD], assetProperties: [] }],
  claims: [],
  verifications: [],
} as unknown as CybersecurityConcept;

const Harness: React.FC<{ spy: (c: CybersecurityConcept) => void }> = ({ spy }) => {
  const [concept, setConcept] = useState(initial);
  return (
    <GoalsClaimsDialog
      open
      onClose={() => {}}
      risks={[renamed]}
      concept={concept}
      onConceptChange={(c) => {
        setConcept(c);
        spy(c);
      }}
      findings={[]}
    />
  );
};

describe("GoalsClaimsDialog — re-link a removed risk (FX-5)", () => {
  it("re-links the dead link to the renamed path", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.getByTestId("dead-link-CSG-01")).toHaveTextContent(`removed (${DEAD})`);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Re-link to …" }));
    fireEvent.click(screen.getByRole("option", { name: "AT-1.2 — Flash tampered firmware" }));
    expect(spy.mock.calls.at(-1)![0].goals[0].riskIds).toEqual([renamed.id]);
    expect(screen.queryByTestId("dead-link-CSG-01")).toBeNull();
    expect(screen.getByText("AT-1.2")).toBeTruthy();
  });

  it("removes the dead link", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.click(screen.getByTestId("drop-link-CSG-01"));
    expect(spy.mock.calls.at(-1)![0].goals[0].riskIds).toEqual([]);
    expect(screen.queryByTestId("dead-link-CSG-01")).toBeNull();
  });
});
