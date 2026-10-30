// src/tests/component/phase-tab-bar.hazard-badge.test.tsx
//
// User 2026-10-30: the Hazard warnings (patch 228) showed in the Overview and
// the Hazard toolbar, but not on the Hazard tab of the phase bar — only DFD
// and Threats had a badge there.
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhaseTabs } from "app/components/navigation/phase-tab-bar";
import { PhaseId } from "app/models/phase-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", changeLanguage: () => Promise.resolve() },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

describe("phase bar badges", () => {
  it("the Hazard tab shows the hazard warnings as a badge, with their text as tooltip", () => {
    const project: Any = { id: "p", info: { safetyRelevant: true }, phaseStatus: { [PhaseId.Hazard]: "complete" } };
    const indicators: Any = {
      status: project.phaseStatus,
      counts: { [PhaseId.Hazard]: { errors: 0, warnings: 1 } },
      details: { [PhaseId.Hazard]: ['Hazard "False alarm" has no ISO 12100 hazard type.'] },
    };
    render(<PhaseTabs project={project} activePhase={0} onPhaseChange={() => {}} indicators={indicators} />);
    const hazardTab = screen.getByRole("button", { name: /Hazard/ });
    expect(hazardTab.textContent).toContain("1");
    expect(screen.getByLabelText('Hazard "False alarm" has no ISO 12100 hazard type.')).toBeTruthy();
  });

  it("the Audit entry shows its hints as a chip with the lines as tooltip; none, no chip (user 2026-10-30)", () => {
    const project: Any = { id: "p", info: {}, phaseStatus: {} };
    const hints = ["No audit repository for this project file — set it up in the Audit tab.", "1 TARA verification not committed — commit it in the Audit tab."];
    const { unmount } = render(<PhaseTabs project={project} activePhase={0} onPhaseChange={() => {}} auditHints={hints} />);
    expect(screen.getByTestId("audit-hints").textContent).toBe("2");
    expect(screen.getByTestId("audit-hints").getAttribute("aria-label")).toBe(hints.join("\n"));
    unmount();
    render(<PhaseTabs project={project} activePhase={0} onPhaseChange={() => {}} />);
    expect(screen.queryByTestId("audit-hints")).toBeNull();
  });
});
