// src/tests/component/hazard-tab.findings-panel.test.tsx
//
// FX-1: the Hazard tab shows its validation as a findings panel below the
// table (the shared panel of the Asset tab): errors first, in the UI
// language; a click opens the hazard's dialog. Without findings no panel.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HazardsTab } from "features/hazards";
import type { HazardItem } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Shows the key's code so the test sees the translation path, not the English fallback.
    t: (k: string, o?: Record<string, unknown>) =>
      k.startsWith("tabs.hazards.findings.")
        ? `${k.split(".").pop()}:${String(o?.hazard ?? o?.id ?? "")}`
        : ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project = (hazards: Record<string, any>[]) =>
  ({
    id: "p1",
    name: "Smoke detector",
    hazards: {
      hazards: hazards.map((h) => ({ combinationType: "ANY", source: "manual", ...h }) as HazardItem),
      relations: [],
      configuration: { defaultCombinationType: "ANY", maxHops: 1, requireHazardType: false },
      lastModified: "2026-10-25T00:00:00.000Z",
    },
    phaseStatus: {},
    lastModified: "2026-10-25T00:00:00.000Z",
  }) as unknown as React.ComponentProps<typeof HazardsTab>["project"];

afterEach(cleanup);

describe("HazardsTab — findings panel (FX-1)", () => {
  it("lists the findings, errors before warnings, translated", () => {
    render(<HazardsTab project={project([{ id: "H1", label: "Fire not detected" }])} onUpdate={() => {}} />);
    expect(screen.getByTestId("hazard-notification-panel")).toBeTruthy();
    const rows = screen.getAllByTestId("hazard-notification-row").map((r) => r.textContent);
    expect(rows).toEqual([
      "noContributor:Fire not detected",
      "endangersNothing:Fire not detected",
      "noHazardType:Fire not detected",
      "noDescription:Fire not detected",
      "noRationale:Fire not detected",
    ]);
  });

  it("a click opens the hazard's dialog", () => {
    render(<HazardsTab project={project([{ id: "H1", label: "Fire not detected" }])} onUpdate={() => {}} />);
    expect(screen.queryByText("Edit Hazard")).toBeNull();
    fireEvent.click(screen.getAllByTestId("hazard-notification-row")[0]);
    expect(screen.getByText("Edit Hazard")).toBeTruthy();
    expect(screen.getByDisplayValue("Fire not detected")).toBeTruthy();
  });

  it("no hazards → no findings, no panel", () => {
    render(<HazardsTab project={project([])} onUpdate={() => {}} />);
    expect(screen.queryByTestId("hazard-notification-panel")).toBeNull();
  });
});
