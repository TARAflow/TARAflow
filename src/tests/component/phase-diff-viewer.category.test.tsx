// Leveled-DFD §11.3: the audit's change list shows what kind a DFD change is
// (semantic / graphical / structural / identity); other phases show none.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhaseDiffViewer } from "features/audit/components/phase-diff-viewer";
import type { PhaseChanges } from "features/audit/models/audit-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const CHANGES: PhaseChanges[] = [
  {
    phase: "dfd",
    phaseLabel: "DFD",
    changeCount: 2,
    changes: [
      { type: "modified", id: "P1", name: "Sensor", description: "DFD element modified", category: "semantic" },
      { type: "modified", id: "DFD", name: "Data Flow Diagram", description: "Diagram layout modified", category: "graphical" },
    ],
  },
  {
    phase: "assets",
    phaseLabel: "Assets",
    changeCount: 1,
    changes: [{ type: "added", id: "DA-1", name: "Firmware", description: "Asset added" }],
  },
];

describe("PhaseDiffViewer — category of a DFD change", () => {
  it("shows the category next to the change type", () => {
    render(<PhaseDiffViewer changes={CHANGES} />);
    expect(screen.getAllByTestId("change-category-semantic")[0].textContent).toBe("semantic");
    expect(screen.getAllByTestId("change-category-graphical")[0].textContent).toBe("graphical");
    expect(screen.queryAllByTestId(/change-category-/)).toHaveLength(2);
  });
});
