// src/tests/component/project-mitigations-ui.test.tsx
//
// Custom mitigation catalog design CM-3: project mitigations M-C-nnn are
// written in the threat dialog (new, convert free text, edit), chosen on
// generated threats too, and managed in the configuration list (delete only
// unused, merge).
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "i18n/services/i18n";
import { ThreatEvalDialog } from "features/threats/components/shared/threat-dialog";
import { ProjectMitigationsProvider, type ProjectMitigationsApi } from "features/threats/components/shared/project-mitigations-context";
import { ProjectMitigationList } from "features/threats/components/shared/project-mitigation-list";
import { createEmptyThreat, type ProjectMitigation, type Threat } from "features/threats/models/threat-types";
import { setProjectMitigations } from "features/threats/services/threat-catalog-service";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
        options && name in options ? String(options[name]) : `{{${name}}}`,
      );
    },
    i18n: { language: "en" },
  }),
}));

Element.prototype.scrollIntoView = vi.fn();
afterEach(() => setProjectMitigations(undefined));

const entry = (over: Partial<ProjectMitigation> = {}): ProjectMitigation => ({
  id: "M-C-001",
  text: "Badge check at the panel",
  strideCategory: "S",
  context: {},
  isCustom: true,
  affectsProperties: [],
  ...over,
});

/** A provider whose add() registers like the Threats tab does. */
const api = (entries: ProjectMitigation[] = []): ProjectMitigationsApi & { added: unknown[] } => {
  const list = [...entries];
  const added: unknown[] = [];
  return {
    added,
    entries: list,
    add: vi.fn((input) => {
      const id = `M-C-00${list.length + 1}`;
      list.push(entry({ id, text: input.text.trim(), strideCategory: input.strideCategory, affectsProperties: input.affectsProperties ?? [] }));
      setProjectMitigations([...list]);
      added.push(input);
      return id;
    }),
    update: vi.fn(),
  };
};

const threat = (over: Partial<Threat> = {}): Threat => ({
  ...createEmptyThreat("t-1", "S", null, "No Trust Boundary", "UB"),
  displayId: "P1-S-1",
  source: "manual",
  threatDescription: "Spoofed operator",
  linkedElement: { elementId: "p1", elementName: "Controller", elementType: "Process" },
  proposedMitigations: [{ notes: "Check the operator badge" }],
  proposedVerifications: [],
  ...over,
});

const renderDialog = (t: Threat, pm: ProjectMitigationsApi | null) =>
  render(
    <ProjectMitigationsProvider value={pm}>
      <ThreatEvalDialog open threats={[t]} initialIndex={0} configuration={{} as never} onSave={vi.fn()} onClose={() => {}} />
    </ProjectMitigationsProvider>,
  );

const select = (testId: string, optionText: string | RegExp) => {
  fireEvent.mouseDown(within(screen.getByTestId(testId).parentElement!).getByRole("combobox"));
  fireEvent.click(within(screen.getByRole("listbox")).getByText(optionText));
};

// Many MUI select interactions: generous timeout under full-suite load.
describe("threat dialog", { timeout: 20000 }, () => {
  it("New project mitigation with a DFD effect: added to the project and to the threat by id", () => {
    const pm = api();
    renderDialog(threat(), pm);
    fireEvent.click(screen.getByTestId("new-project-mitigation"));
    fireEvent.change(screen.getByTestId("pm-text"), { target: { value: "Rate-limit the login" } });
    select("pm-target", "Process");
    select("pm-property", "inputValidation");
    select("pm-value", "strict");
    fireEvent.click(screen.getByTestId("pm-add-effect"));
    expect(screen.getAllByTestId("pm-effect")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("pm-save"));
    expect(pm.added).toEqual([
      {
        text: "Rate-limit the login",
        strideCategory: "S",
        affectsProperties: [{ targetType: "Process", property: "inputValidation", expectedValue: "strict", confidence: "heuristic" }],
      },
    ]);
    expect(screen.getByTestId("edit-project-mitigation-M-C-001")).toBeTruthy();
    // resolved text (the closing form may still hold the input during its transition)
    expect(screen.getAllByText("Rate-limit the login").length).toBeGreaterThan(0);
  });

  it("Convert free text: prefilled, the free-text entry becomes the new id", () => {
    const pm = api();
    renderDialog(threat(), pm);
    fireEvent.click(screen.getByTestId("convert-mitigation-0"));
    expect((screen.getByTestId("pm-text") as HTMLTextAreaElement).value).toBe("Check the operator badge");
    fireEvent.click(screen.getByTestId("pm-save"));
    expect(screen.queryByTestId("convert-mitigation-0")).toBeNull();
    expect(screen.getByTestId("remove-catalog-M-C-001")).toBeTruthy();
  });

  it("a generated threat offers project mitigations only; no provider, no buttons", () => {
    setProjectMitigations([entry()]);
    const { unmount } = renderDialog(threat({ source: "generated:full" as never, proposedMitigations: [] }), api([entry()]));
    const picker = screen.getByTestId("catalog-picker-mitigation");
    fireEvent.mouseDown(picker);
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["M-C-001 — Badge check at the panel"]);
    unmount();
    renderDialog(threat(), null);
    expect(screen.queryByTestId("new-project-mitigation")).toBeNull();
    expect(screen.queryByTestId("convert-mitigation-0")).toBeNull();
  });
});

describe("configuration list", () => {
  it("delete only when unused; merge into another entry", () => {
    const merge = vi.fn();
    const remove = vi.fn();
    render(
      <ProjectMitigationList
        api={api([entry(), entry({ id: "M-C-002", text: "Other" })])}
        refs={{
          usage: (id) => (id === "M-C-001" ? { threats: ["P1-S-1"], risks: [], attackTrees: [] } : { threats: [], risks: [], attackTrees: [] }),
          mergeConflicts: () => [],
          merge,
          remove,
        }}
      />,
    );
    expect((screen.getByTestId("pm-delete-M-C-001") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Used by: P1-S-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("pm-delete-M-C-002"));
    expect(remove).toHaveBeenCalledWith("M-C-002");
    select("pm-merge-M-C-001", "M-C-002");
    expect(merge).toHaveBeenCalledWith("M-C-001", "M-C-002");
  });

  it("a merge with conflicting data is refused and names the risks", () => {
    const merge = vi.fn();
    render(
      <ProjectMitigationList
        api={api([entry(), entry({ id: "M-C-002", text: "Other" })])}
        refs={{
          usage: () => ({ threats: [], risks: [], attackTrees: [] }),
          mergeConflicts: () => ["P1-S-2"],
          merge,
          remove: vi.fn(),
        }}
      />,
    );
    select("pm-merge-M-C-001", "M-C-002");
    expect(merge).not.toHaveBeenCalled();
    expect(screen.getByTestId("pm-merge-blocked").textContent).toContain("risk P1-S-2");
  });
});
