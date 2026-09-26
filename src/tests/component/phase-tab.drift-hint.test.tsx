// src/tests/component/phase-tab.drift-hint.test.tsx
//
// Threat generation drift surfaces as a warning on the Threats phase tab, with
// a tooltip that says what it is — not a generic "N warnings".
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhaseTab } from "app/components/navigation/phase-tab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      key === "tabs.dfd.validation.warnings" ? "warnings" : options?.defaultValue ?? key,
  }),
}));

describe("PhaseTab warning hints", () => {
  it("shows the count as a warning badge and the hint as tooltip label", () => {
    render(
      <PhaseTab
        phaseId={3}
        label="3 - Threats"
        status="in-progress"
        isActive={false}
        onClick={() => {}}
        warningCount={6}
        warningHints={["6 stored threats would no longer be generated"]}
      />,
    );
    expect(screen.getByText("6")).toBeTruthy();
    expect(
      screen.getByLabelText("6 stored threats would no longer be generated"),
    ).toBeTruthy();
  });

  it("without hints falls back to the generic warning text", () => {
    render(
      <PhaseTab
        phaseId={1}
        label="1 - DFD"
        status="in-progress"
        isActive={false}
        onClick={() => {}}
        warningCount={2}
      />,
    );
    expect(screen.getByLabelText("2 warnings")).toBeTruthy();
  });
});
