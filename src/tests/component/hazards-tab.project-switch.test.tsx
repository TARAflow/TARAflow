// src/tests/component/hazards-tab.project-switch.test.tsx
//
// Regression: switching projects while the Hazard tab is open must never write
// one project's hazards into another.
//
// The workspace rendered one HazardsTab instance for every project (a
// prop-only swap on a switch). The tab's re-sync from the project skipped a
// project without hazards (project.hazards === null), so the outgoing
// project's hazards stayed in the tab, and the next save handed them to an
// update handler that resolved its target as "whatever is active now".
//
// HazardsTab now keys its view by project id, the workspace pins the update
// handler to that id, and the view flushes a pending edit on unmount. The
// tests render the tab WITHOUT a key on purpose, with one handler per project.

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HazardsTab } from "features/hazards/components/hazard-tab";
import { createEmptyHazardData, type HazardData } from "features/hazards/models/hazard-data-types";
import { hazardService } from "features/hazards/services/hazard-service";
import type { HazardProjectData, HazardUpdateResult } from "features/hazards/models/hazard-tab-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
// Leaf UI is irrelevant; the table stand-in shows what the tab holds and
// offers the quick add the real table has.
vi.mock("features/hazards/components/hazard-table", () => ({
  HazardTable: (p: { data: HazardData; onQuickAdd: (label: string) => void }) => (
    <div>
      <span data-testid="labels">{p.data.hazards.map((h) => h.label).join(",")}</span>
      <button onClick={() => p.onQuickAdd("new")}>quick add</button>
    </div>
  ),
}));
vi.mock("features/hazards/components/hazard-toolbar", () => ({ HazardToolbar: () => null }));
vi.mock("features/hazards/components/hazard-dialog", () => ({ HazardDialog: () => null }));
vi.mock("features/hazards/components/hazard-config-dialog", () => ({ HazardConfigDialog: () => null }));
vi.mock("features/hazards/components/hazard-reimport-dialog", () => ({ HazardReimportDialog: () => null }));
vi.mock("features/hazards/components/hazard-import-profile-dialog", () => ({ HazardImportProfileDialog: () => null }));

function hazards(labels: string[]): HazardData {
  let data = createEmptyHazardData();
  for (const label of labels) data = hazardService.addHazard(data, hazardService.createHazardItem(data, { label }));
  return data;
}

const project = (id: string, data: HazardData | null): HazardProjectData =>
  ({ id, name: id, hazards: data, phaseStatus: {}, lastModified: "2026-11-01T00:00:00.000Z" }) as unknown as HazardProjectData;

const A = project("project-a", hazards(["a-1", "a-2"]));
const B = project("project-b", null);                 // a project without hazards yet

const labelsOf = (u: HazardUpdateResult) => u.hazards.hazards.map((h) => h.label).sort();

function setup() {
  const updates: Record<string, HazardUpdateResult[]> = { "project-a": [], "project-b": [] };
  const view = (p: HazardProjectData) => (
    <HazardsTab project={p} onUpdate={(u) => { updates[p.id].push(u); }} />
  );
  return { updates, view };
}

describe("HazardsTab — project switch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a project without hazards shows and saves only its own hazards", () => {
    const { updates, view } = setup();
    const { rerender } = render(view(A));
    rerender(view(B));

    expect(screen.getByTestId("labels").textContent).toBe("");
    fireEvent.click(screen.getByText("quick add"));
    act(() => { vi.advanceTimersByTime(1500); });

    expect(updates["project-a"]).toHaveLength(0);
    expect(updates["project-b"].map(labelsOf)).toEqual([["new"]]);
  });

  it("flushes a pending edit to the outgoing project on unmount", () => {
    const { updates, view } = setup();
    const { rerender } = render(view(A));
    fireEvent.click(screen.getByText("quick add"));
    rerender(view(B));                                 // switch before the auto-save fired

    expect(updates["project-a"].map(labelsOf)).toEqual([["a-1", "a-2", "new"]]);
    expect(updates["project-b"]).toHaveLength(0);
  });
});
