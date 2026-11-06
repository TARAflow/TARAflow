// src/tests/component/project-mitigation-requirements.test.tsx
//
// IEC-8b: a project mitigation M-C-nnn names the IEC 62443-4-2 requirements
// it implements — offered only while a 62443 edition is active (the app
// provides the list); the requirements its DFD effects meet already are
// listed, not stored; without the field the stored references stay.
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectMitigationForm } from "features/threats/components/shared/project-mitigation-form";
import { MatrixRequirementsContext, type MatrixRequirements } from "shared/hooks/matrix-requirements";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

Element.prototype.scrollIntoView = vi.fn();

const MATRIX: MatrixRequirements = {
  options: [
    { id: "cr-7.8", label: "CR 7.8 — Control system component inventory" },
    { id: "cr-3.5", label: "CR 3.5 — Input validation" },
  ],
  derivedFrom: (effects) => (effects.some((e) => e.property === "inputValidation") ? ["cr-3.5"] : []),
};

function renderForm(matrix: MatrixRequirements | undefined, initial = {}) {
  const onSave = vi.fn();
  render(
    <MatrixRequirementsContext.Provider value={matrix}>
      <ProjectMitigationForm open initial={{ text: "Asset register", strideCategory: "I", ...initial }} onSave={onSave} onClose={vi.fn()} />
    </MatrixRequirementsContext.Provider>,
  );
  return onSave;
}

describe("project mitigation form — IEC 62443 references (IEC-8b)", () => {
  it("with a 62443 edition: choose requirements; they are saved with the mitigation", () => {
    const onSave = renderForm(MATRIX);
    const input = screen.getByTestId("pm-requirements-input");
    fireEvent.change(input, { target: { value: "inventory" } });
    fireEvent.click(screen.getByRole("option", { name: "CR 7.8 — Control system component inventory" }));
    fireEvent.click(screen.getByTestId("pm-save"));
    expect(onSave.mock.lastCall![0]).toMatchObject({ text: "Asset register", iec62443: ["cr-7.8"] });
  });

  it("edit: the stored references are shown and an emptied list is saved as empty", () => {
    const onSave = renderForm(MATRIX, { iec62443: ["cr-7.8"] });
    const field = screen.getByTestId("pm-requirements");
    expect(within(field).getByText("CR 7.8 — Control system component inventory")).toBeTruthy();
    fireEvent.click(within(field).getByTestId("CancelIcon"));
    fireEvent.click(screen.getByTestId("pm-save"));
    expect(onSave.mock.lastCall![0].iec62443).toEqual([]);
  });

  it("requirements the effects meet already are listed, not stored", () => {
    const onSave = renderForm(MATRIX, {
      affectsProperties: [{ targetType: "Process", property: "inputValidation", expectedValue: "strict", confidence: "heuristic" }],
    });
    expect(screen.getByTestId("pm-requirements-derived").textContent).toContain("CR 3.5 — Input validation");
    fireEvent.click(screen.getByTestId("pm-save"));
    expect(onSave.mock.lastCall![0].iec62443).toEqual([]);
  });

  it("without a 62443 edition: no field, and the stored references are not touched", () => {
    const onSave = renderForm(undefined, { iec62443: ["cr-7.8"] });
    expect(screen.queryByTestId("pm-requirements")).toBeNull();
    fireEvent.click(screen.getByTestId("pm-save"));
    expect("iec62443" in onSave.mock.lastCall![0]).toBe(false);
  });
});
