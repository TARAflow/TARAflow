// src/tests/component/project-progress.tooltip.test.tsx
//
// User 2026-10-30: the Overview's phase cards say in a tooltip what is behind
// a phase's status (counts and the findings), and a click opens the phase's
// tab.
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectProgress } from "features/overview/components/project-progress";
import { PHASES } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      ({ "status.incomplete": "Incomplete", "status.complete": "Complete", "tabs.dfd.validation.errors": "errors" })[key] ??
      options?.defaultValue ??
      key,
  }),
}));

const phases = PHASES.filter((p) => p.id <= 3);
const data = {
  phaseStatus: { 0: "complete", 1: "complete", 2: "incomplete", 3: "not-started" } as never,
  validationInfo: { 2: { errors: 1, warnings: 0 } },
  details: { 2: ["DF-10: TLS without a terminating element"] },
};

describe("phase progress cards", () => {
  it("the tooltip names status, counts and findings; only the DFD card shows the error", async () => {
    render(<ProjectProgress data={data} phases={phases} getStatusIcon={() => "•"} getStatusColor={() => "#000"} onOpenPhase={vi.fn()} />);
    expect(screen.getByTestId("phase-card-2").textContent).toContain("1 errors");
    expect(screen.getByTestId("phase-card-1").textContent).not.toContain("errors");
    fireEvent.mouseOver(screen.getByTestId("phase-card-2"));
    const tip = await screen.findByTestId("phase-card-tooltip-2");
    expect(tip.textContent).toContain("DFD: Incomplete");
    expect(tip.textContent).toContain("DF-10: TLS without a terminating element");
    expect(tip.textContent).toContain("Click to open the tab");
  });

  it("a click opens the phase's tab", () => {
    const onOpenPhase = vi.fn();
    render(<ProjectProgress data={data} phases={phases} getStatusIcon={() => "•"} getStatusColor={() => "#000"} onOpenPhase={onOpenPhase} />);
    fireEvent.click(screen.getByTestId("phase-card-2"));
    expect(onOpenPhase).toHaveBeenCalledWith(2);
  });
});
