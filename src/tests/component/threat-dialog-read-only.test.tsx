// src/tests/component/threat-dialog-read-only.test.tsx
//
// Multi-project TARA (design §7.1), manual test 2026-11-07: a threat of an
// imported component opens in the threat dialog read-only — everything is
// shown, nothing can be changed, navigation works, nothing is saved.
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThreatEvalDialog } from "features/threats/components/shared/threat-dialog";
import { createEmptyThreat, type Threat } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(options?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
Element.prototype.scrollIntoView = vi.fn();

const threat = (id: string, displayId: string, over: Partial<Threat> = {}): Threat => ({
  ...createEmptyThreat(id, "T", null, "SD1 · Smoke Detector", "[SD1]"),
  displayId,
  source: "manual",
  threatDescription: `Tamper with ${displayId}`,
  attackDescription: "Change the values on the bus",
  linkedElement: { elementId: "e", elementName: "Sensor Controller", elementType: "Process" },
  proposedMitigations: [{ notes: "Authenticate the bus" }],
  proposedVerifications: [{ notes: "Fuzz the bus" }],
  relevance: "relevant",
  ...over,
});

function renderReadOnly(onSave = vi.fn(), onClose = vi.fn()) {
  render(
    <ThreatEvalDialog
      open
      threats={[threat("a", "SD1:P3-T-1"), threat("b", "SD1:P3-T-2")]}
      initialIndex={0}
      configuration={{ showThreatActor: true } as never}
      onSave={onSave}
      onClose={onClose}
      readOnly
      readOnlyNote="Imported from SD1 · Smoke Detector — read-only."
    />,
  );
  return { onSave, onClose };
}

describe("ThreatEvalDialog — read-only", () => {
  it("shows the threat with the note, without any edit, add or delete control", () => {
    renderReadOnly();
    expect(screen.getByTestId("threat-dialog-read-only").textContent).toContain("Imported from SD1 · Smoke Detector");
    expect(screen.getAllByText("Tamper with SD1:P3-T-1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Add custom verification")).toBeNull();
    expect(screen.queryByText("New project mitigation")).toBeNull();
    for (const b of screen.queryAllByRole("button", { name: /delete/i })) expect(b).not.toBeVisible();
    // footer: no evaluation actions, only navigation and close
    expect(screen.queryByText("Confirm")).toBeNull();
    expect(screen.queryByText("Dismiss")).toBeNull();
    expect(screen.queryByText("Uncertain")).toBeNull();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("every field is disabled", () => {
    renderReadOnly();
    const fields = screen.getAllByRole("textbox") as HTMLTextAreaElement[];
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) expect(f.closest("fieldset")?.disabled ?? f.disabled, f.value).toBe(true);
  });

  it("navigates without saving; close saves nothing", () => {
    const { onSave, onClose } = renderReadOnly();
    fireEvent.click(screen.getByTestId("threat-dialog-next"));
    expect(screen.getAllByText("Tamper with SD1:P3-T-2").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("without readOnly the dialog is editable as before", () => {
    render(
      <ThreatEvalDialog open threats={[threat("a", "P3-T-1")]} initialIndex={0} configuration={{} as never} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId("threat-dialog-read-only")).toBeNull();
    expect(screen.getByText("Confirm")).toBeTruthy();
    expect(screen.getByText("Add custom verification")).toBeTruthy();
  });
});
