// src/tests/component/trust-boundary-assumptions.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-3 (decision 12): a trust
// boundary links Item Definition assumptions; "Convert to assumption"
// creates one from the free text (which stays) and links it; an invalid
// assumption flags the boundary.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustBoundaryAssumptions } from "features/dfd/components/forms/trust-boundary-assumptions";
import { AssumptionsProvider } from "features/dfd/contexts/assumptions-context";
import type { Assumption } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const ASSUMPTIONS: Assumption[] = [
  { id: "a1", displayId: "ASM-01", text: "Loop wiring is not accessible", status: "confirmed" },
  { id: "a2", displayId: "ASM-02", text: "Panel is in a locked room", status: "invalid" },
];

afterEach(cleanup);

describe("trust boundary assumptions (A-3)", () => {
  it("convert: creates an assumption from the text and links it", () => {
    const create = vi.fn((text: string): Assumption => ({ id: "a3", displayId: "ASM-03", text, status: "open" }));
    const onChange = vi.fn();
    render(
      <AssumptionsProvider value={{ assumptions: ASSUMPTIONS, create }}>
        <TrustBoundaryAssumptions text="Inside is trusted" assumptionIds={["a1"]} onChange={onChange} />
      </AssumptionsProvider>,
    );
    fireEvent.click(screen.getByTestId("tb-convert-assumption"));
    expect(create).toHaveBeenCalledWith("Inside is trusted");
    expect(onChange).toHaveBeenCalledWith(["a1", "a3"]);
  });

  it("convert needs text", () => {
    render(
      <AssumptionsProvider value={{ assumptions: ASSUMPTIONS, create: vi.fn() }}>
        <TrustBoundaryAssumptions text="  " assumptionIds={[]} onChange={vi.fn()} />
      </AssumptionsProvider>,
    );
    expect((screen.getByTestId("tb-convert-assumption") as HTMLButtonElement).disabled).toBe(true);
  });

  it("a linked invalid assumption flags the boundary", () => {
    render(
      <AssumptionsProvider value={{ assumptions: ASSUMPTIONS, create: vi.fn() }}>
        <TrustBoundaryAssumptions text="" assumptionIds={["a1", "a2"]} onChange={vi.fn()} />
      </AssumptionsProvider>,
    );
    expect(screen.getByTestId("tb-assumption-invalid").textContent).toContain("ASM-02 marked invalid");
    expect(screen.getByText("ASM-01 · confirmed")).toBeTruthy();
  });

  it("without a provider nothing is shown", () => {
    render(<TrustBoundaryAssumptions text="x" assumptionIds={[]} onChange={vi.fn()} />);
    expect(screen.queryByTestId("tb-assumptions")).toBeNull();
  });
});
