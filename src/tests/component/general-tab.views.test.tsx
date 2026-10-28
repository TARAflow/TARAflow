// src/tests/component/general-tab.views.test.tsx
//
// ISO/SAE 21434 conformance plan Phase 1 "Overview rework" (A-1, decisions 8,
// 24): the Overview has the sub-tabs Project / Definition / Methodology /
// Sources; the project description is "Purpose and functions" in Definition
// (still info.description); the last sub-tab is remembered per project.

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

const view = (onUpdate = vi.fn(), projectId = "P1") => {
  render(
    <GeneralTab
      data={data}
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
    fireEvent.change(within(purpose).getByRole("textbox"), { target: { value: "Detects smoke." } });
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
});
