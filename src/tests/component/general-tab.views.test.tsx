// src/tests/component/general-tab.views.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 1 "Overview rework" (A-1, decisions 8,
// 24): the Overview has the sub-tabs Project / Definition / Methodology /
// Sources; the project description is "Purpose and functions" in Definition
// (still info.description); the last sub-tab is remembered per project.
// A-2: the sections with text, source and model links; functions with
// lifecycle phases and a function asset.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeneralTab, type GeneralTabData } from "features/overview";
import { EMPTY_PROJECT_TAGS, PHASES } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const data: GeneralTabData = {
  info: {
    name: "Smoke detector",
    description: "Detects smoke and raises the alarm.",
    version: "1.0",
    responsible: "JM",
    created: "2026-10-27T10:00:00.000Z",
    lastModified: "2026-10-27T10:00:00.000Z",
    tags: { ...EMPTY_PROJECT_TAGS },
    team: [],
    isHighImpact: false,
  },
  settings: {},
  phaseStatus: {},
} as unknown as GeneralTabData;

const MODEL = [
  { id: "ee1", kind: "element" as const, label: "EE-1 Operator", detail: "ExternalEntity" },
  { id: "if1", kind: "element" as const, label: "IF-1 Loop interface", detail: "Interface" },
  { id: "fu1", kind: "asset" as const, label: "FU-001 Detect smoke", detail: "function" },
];

const view = (onUpdate = vi.fn(), projectId = "P1", d: GeneralTabData = data) => {
  render(
    <GeneralTab
      data={d}
      modelItems={MODEL}
      phases={PHASES}
      progressPhaseIds={[0]}
      getStatusIcon={() => ""}
      getStatusColor={() => ""}
      onUpdate={onUpdate}
      projectId={projectId}
    />,
  );
  return onUpdate;
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Overview sub-tabs (A-1)", () => {
  it("four sub-tabs; Project shows the info without the description", () => {
    view();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "project",
      "definition",
      "methodology",
      "sources",
    ]);
    expect(screen.getByTestId("overview-view-project").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Detects smoke and raises the alarm.")).toBeNull();
    expect(screen.queryByTestId("item-definition-view")).toBeNull();
  });

  it("Definition: purpose and functions = the description, edited there", () => {
    const onUpdate = view();
    fireEvent.click(screen.getByTestId("overview-view-definition"));
    const purpose = screen.getByTestId("item-definition-purpose");
    expect(purpose.textContent).toContain("Detects smoke and raises the alarm.");
    fireEvent.click(within(purpose).getByText("Edit"));
    fireEvent.change(within(purpose).getByLabelText("Purpose and functions"), { target: { value: "Detects smoke." } });
    fireEvent.click(within(purpose).getByText("Save"));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ info: expect.objectContaining({ description: "Detects smoke." }) }));
  });

  it("Methodology holds the settings, Sources the source reference", () => {
    view();
    fireEvent.click(screen.getByTestId("overview-view-methodology"));
    expect(screen.getByText("settings.title")).toBeTruthy();
    fireEvent.click(screen.getByTestId("overview-view-sources"));
    expect(screen.getByText("Project Source Reference")).toBeTruthy();
    expect(screen.queryByText("settings.title")).toBeNull();
  });

  it("the last sub-tab is remembered per project", () => {
    view();
    fireEvent.click(screen.getByTestId("overview-view-definition"));
    cleanup();
    view();
    expect(screen.getByTestId("overview-view-definition").getAttribute("aria-selected")).toBe("true");
    cleanup();
    view(vi.fn(), "P2");
    expect(screen.getByTestId("overview-view-project").getAttribute("aria-selected")).toBe("true");
  });

  it("A-2: a section gets its text, source and model links", () => {
    const onUpdate = view();
    fireEvent.click(screen.getByTestId("overview-view-definition"));
    const card = screen.getByTestId("item-definition-boundary");
    fireEvent.click(within(card).getByText("Edit"));
    fireEvent.change(within(card).getByLabelText("Item boundary"), { target: { value: "Detector head and loop" } });
    fireEvent.change(within(card).getByLabelText("Source document (e.g. arc42)"), { target: { value: "arc42" } });
    fireEvent.change(within(card).getByLabelText("Section (e.g. §3 Context)"), { target: { value: "§3" } });
    const refs = within(card).getByTestId("item-definition-boundary-refs");
    fireEvent.mouseDown(refs);
    fireEvent.change(refs, { target: { value: "IF-1" } });
    fireEvent.click(screen.getByText("IF-1 Loop interface (Interface)"));
    fireEvent.click(within(card).getByText("Save"));
    const saved = onUpdate.mock.calls.at(-1)![0] as GeneralTabData;
    expect(saved.itemDefinition?.sections.boundary).toEqual({
      text: "Detector head and loop",
      source: { document: "arc42", section: "§3" },
      modelRefs: ["if1"],
    });
    expect(saved.info.description).toBe(data.info.description);
  });

  it("A-2: shows source and links; a link to a removed item is marked", () => {
    view(vi.fn(), "P1", {
      ...data,
      itemDefinition: {
        sections: { environment: { text: "Office buildings", source: { document: "arc42", section: "§7", version: "2.1" }, modelRefs: ["ee1", "gone"] } },
        functions: [],
        assumptions: [],
      },
    });
    fireEvent.click(screen.getByTestId("overview-view-definition"));
    expect(screen.getByTestId("item-definition-environment-source").textContent).toContain("arc42 · §7 · v2.1");
    const chips = screen.getByTestId("item-definition-environment-refs-view").textContent;
    expect(chips).toContain("EE-1 Operator");
    expect(chips).toContain("removed (gone)");
  });

  it("A-2: functions with lifecycle phases and a function asset", () => {
    const onUpdate = view();
    fireEvent.click(screen.getByTestId("overview-view-definition"));
    const card = screen.getByTestId("item-definition-functions");
    fireEvent.click(within(card).getByText("Edit"));
    fireEvent.click(within(card).getByTestId("item-function-add"));
    const row = within(card).getByTestId("item-function-0");
    fireEvent.change(within(row).getByLabelText("Function"), { target: { value: "Detect smoke" } });
    fireEvent.click(within(row).getByLabelText("maintenance"));
    fireEvent.mouseDown(within(row).getByLabelText("Function asset (optional)"));
    fireEvent.click(screen.getByText("FU-001 Detect smoke"));
    fireEvent.click(within(card).getByText("Save"));
    const saved = onUpdate.mock.calls.at(-1)![0] as GeneralTabData;
    expect(saved.itemDefinition?.functions).toEqual([
      expect.objectContaining({ name: "Detect smoke", lifecyclePhases: ["operation", "maintenance"], functionAssetId: "fu1" }),
    ]);
  });
});
