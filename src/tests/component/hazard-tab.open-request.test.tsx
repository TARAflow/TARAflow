// src/tests/component/hazard-tab.open-request.test.tsx
//
// Asset graph design G9 (doc/InProgress/DFD/asset-graph-hazards-and-node-
// move.md): "Open in Hazard tab" from the asset graph — the Hazard tab opens
// the dialog of the requested Hazard Item; an unknown id opens nothing.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HazardsTab } from "features/hazards";
import type { HazardItem } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const project = {
  id: "p1",
  name: "Smoke detector",
  hazards: {
    hazards: [
      { id: "H1", label: "Fire not detected", combinationType: "ANY", source: "manual" } as HazardItem,
    ],
    relations: [],
    configuration: { defaultCombinationType: "ANY", maxHops: 1, requireHazardType: false },
    lastModified: "2026-10-25T00:00:00.000Z",
  },
  phaseStatus: {},
  lastModified: "2026-10-25T00:00:00.000Z",
} as unknown as React.ComponentProps<typeof HazardsTab>["project"];

afterEach(cleanup);

describe("HazardsTab — open request from the asset graph (G9)", () => {
  it("opens the dialog of the requested item", () => {
    render(<HazardsTab project={project} onUpdate={() => {}} openRequest={{ hazardId: "H1" }} />);
    expect(screen.getByText("Edit Hazard")).toBeTruthy();
    expect(screen.getByDisplayValue("Fire not detected")).toBeTruthy();
  });

  it("an unknown id opens nothing", () => {
    render(<HazardsTab project={project} onUpdate={() => {}} openRequest={{ hazardId: "gone" }} />);
    expect(screen.queryByText("Edit Hazard")).toBeNull();
  });
});
