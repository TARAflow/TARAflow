// src/tests/component/threat-catalog-entries.test.tsx
//
// Custom mitigation catalog design CM-1: an analyst-authored threat keeps the
// catalog ids of the entries picked for it (the closed loop keys on them) —
// in "Create threat" and in the threat dialog — and a free-text entry equal
// to a catalog text is offered for linking.
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "i18n/services/i18n";
import { CreateThreatDialog } from "features/threats/components/shared/create-threat-dialog";
import { ThreatEvalDialog as ThreatDialog } from "features/threats/components/shared/threat-dialog";
import {
  getAllMitigations,
  getLocalizedMitigation,
} from "features/threats/services/threat-catalog-service";
import { createEmptyThreat, type Threat } from "features/threats/models/threat-types";

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

// jsdom has no scrollIntoView (the dialog scrolls its threat list)
Element.prototype.scrollIntoView = vi.fn();

const table = { trustBoundaryId: null, trustBoundaryName: "No Trust Boundary", displayIdentifier: "[UB]", threats: [] } as any;
const sMitigation = getAllMitigations().find((m) => m.strideCategory === "S" && (m.verifications ?? []).length > 0)!;
// a second one for the dialog (M-S-001 is linked there first)
const sOther = getAllMitigations().find(
  (m) => m.strideCategory === "S" && m.id !== "M-S-001" && (m.verifications ?? []).length > 0,
)!;

describe("Create threat: catalog picks keep their id", () => {
  it("stores the picked mitigation and its verifications by id; no free-text mitigation field (user 2026-10-30)", () => {
    const onAdd = vi.fn();
    render(
      <CreateThreatDialog
        open
        table={table}
        existingThreats={[]}
        elementId="p1"
        elementName="Controller"
        elementType="Process"
        elementDisplayId="P1"
        onClose={() => {}}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "S" }));
    fireEvent.change(screen.getByLabelText(/Threat Description/), { target: { value: "Spoofed operator" } });
    fireEvent.click(screen.getAllByRole("tab")[1]);
    fireEvent.change(screen.getByLabelText(/Attack Scenario/), { target: { value: "Replay of a session" } });
    fireEvent.click(screen.getAllByRole("tab")[2]);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "No authentication" } });
    fireEvent.click(screen.getAllByRole("tab")[3]);
    fireEvent.click(screen.getByText(getLocalizedMitigation(sMitigation.id)));
    expect(screen.queryByLabelText(/Add mitigation/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Create Threat/ }));

    const threat: Threat = onAdd.mock.calls[0][0];
    expect(threat.source).toBe("manual");
    expect(threat.proposedMitigations).toEqual([{ id: sMitigation.id }]);
    expect(threat.proposedVerifications).toEqual(sMitigation.verifications!.map((id) => ({ id })));
  });
});

describe("Threat dialog: catalog entries on a manual threat", () => {
  const manual = (over: Partial<Threat> = {}): Threat => ({
    ...createEmptyThreat("t-1", "S", null, "No Trust Boundary", "UB"),
    displayId: "P1-S-9",
    source: "manual",
    threatDescription: "Spoofed operator",
    linkedElement: { elementId: "p1", elementName: "Controller", elementType: "Process" },
    proposedMitigations: [{ notes: getLocalizedMitigation("M-S-001") }],
    proposedVerifications: [],
    ...over,
  });
  const renderDialog = (threat: Threat, onSave = vi.fn()) => {
    render(
      <ThreatDialog
        open
        threats={[threat]}
        initialIndex={0}
        configuration={{} as any}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    return onSave;
  };

  it("offers 'Link to' for free text equal to a catalog text and adds from the catalog", () => {
    renderDialog(manual());
    fireEvent.click(screen.getByTestId("link-catalog-M-S-001"));
    expect(screen.queryByTestId("link-catalog-M-S-001")).toBeNull();
    expect(screen.getByTestId("remove-catalog-M-S-001")).toBeTruthy();
    // add another S mitigation from the catalog: stored by id, removable
    const picker = screen.getByTestId("catalog-picker-mitigation");
    fireEvent.change(picker, { target: { value: sOther.id } });
    fireEvent.keyDown(picker, { key: "ArrowDown" });
    fireEvent.keyDown(picker, { key: "Enter" });
    expect(screen.getByTestId(`remove-catalog-${sOther.id}`)).toBeTruthy();
    for (const v of sOther.verifications!) expect(screen.getByTestId(`remove-catalog-${v}`)).toBeTruthy();
  });

  it("no catalog picker on a generated threat", () => {
    renderDialog(manual({ source: "generated:full" as any }));
    expect(screen.queryByTestId("catalog-picker-mitigation")).toBeNull();
    expect(within(document.body).queryByTestId("link-catalog-M-S-001")).toBeTruthy();
  });
});
