// Multi-project TARA phase 4c: a row's claims show the supporting claims of
// imported components that name its requirements, with their state in the
// instance, citable / withdrawable by the machine.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RowClaims, type ComponentClaimChoice } from "features/compliance/components/matrix-claims";
import { emptyCybersecurityConcept } from "shared";

afterEach(cleanup);
const t = (_k: string, d: string) => d;
const choice = (over: Partial<ComponentClaimChoice> = {}): ComponentClaimChoice => ({
  key: "i1|cs1",
  displayId: "SD1 CLM-03",
  statement: "The cabinet is locked",
  responsibleParty: "Integrator",
  source: "SD1 · Smoke Detector",
  state: "unclear",
  cited: false,
  ...over,
});

describe("RowClaims — claims of imported components (phase 4c)", () => {
  it("lists them with their state; Cite / Withdraw call back", () => {
    const onCite = vi.fn();
    render(
      <RowClaims concept={emptyCybersecurityConcept()} requirements={["iec-62443-4-2:cr-3.5"]} onConceptChange={() => {}} t={t}
        componentClaims={[choice()]} onCiteComponentClaim={onCite} />,
    );
    const row = within(screen.getByTestId("compliance-component-claim-i1|cs1"));
    expect(row.getByText("unclear — an assumption of use lacks evidence")).toBeTruthy();
    fireEvent.click(screen.getByTestId("compliance-cite-i1|cs1"));
    expect(onCite).toHaveBeenCalledWith("i1|cs1", true);
    cleanup();
    render(
      <RowClaims concept={emptyCybersecurityConcept()} requirements={["iec-62443-4-2:cr-3.5"]} onConceptChange={() => {}} t={t}
        componentClaims={[choice({ cited: true, state: "effective" })]} onCiteComponentClaim={onCite} />,
    );
    expect(screen.getByTestId("compliance-cite-i1|cs1").textContent).toBe("Withdraw");
    fireEvent.click(screen.getByTestId("compliance-cite-i1|cs1"));
    expect(onCite).toHaveBeenLastCalledWith("i1|cs1", false);
  });

  it("no section without component claims", () => {
    render(<RowClaims concept={emptyCybersecurityConcept()} requirements={["x"]} onConceptChange={() => {}} t={t} />);
    expect(screen.queryByTestId("compliance-component-claims")).toBeNull();
  });
});
