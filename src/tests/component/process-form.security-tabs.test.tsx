// src/tests/component/process-form.security-tabs.test.tsx
//
// Security sub-tabs on the Process form (user 2026-11-02, CM-5d): the
// session settings appear only where human users reach the process — the
// condition humanUsers that the matrix rules use too; a tab names its open
// fields; the chosen tab stays when the next process is opened.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProcessDescriptionForm } from "features/dfd/components/forms/process-description-form";
import { ModelFieldProvider } from "features/dfd/components/forms/model-field-inputs";
import type { DFDElement } from "features/dfd/models/dfd-types";
import type { VisibilityElement, VisibilityFlowInput } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const process = (id: string, properties: Record<string, unknown>) =>
  ({ id, type: "Process", displayId: id, name: id, properties }) as unknown as DFDElement;
const operator = { id: "op", type: "ExternalEntity", properties: { entityType: "operator" } };
const plc = { id: "plc", type: "ExternalEntity", properties: { entityType: "plc" } };

function renderForm(element: DFDElement, flows: VisibilityFlowInput[]) {
  return render(
    <ModelFieldProvider elements={[element as unknown as VisibilityElement, operator, plc]} connections={flows}>
      <ProcessDescriptionForm element={element} onChange={() => {}} />
    </ModelFieldProvider>,
  );
}

const tabIds = () =>
  screen
    .getAllByRole("tab")
    .map((t) => t.getAttribute("data-testid"))
    .filter((id) => id?.startsWith("security-tab-"));

describe("ProcessDescriptionForm — Security sub-tabs", () => {
  it("with an operator: sessions tab with three open settings", () => {
    renderForm(process("p1", { technology: "ui" }), [{ id: "f", from: "op", to: "p1" }]);
    expect(tabIds()).toContain("security-tab-sessions");
    // nonRepudiation (ui) + the three session settings, all open.
    expect(screen.getByTestId("security-tab-sessions").textContent).toBe("Sessions & traceability (4)");
  });

  it("only machines around: no session settings — the tab stays for non-repudiation only where it applies", () => {
    renderForm(process("p2", { technology: "daemon" }), [{ id: "f", from: "plc", to: "p2" }]);
    expect(tabIds()).not.toContain("security-tab-sessions");
  });

  it("the chosen tab stays when the next process is opened", () => {
    const { unmount } = renderForm(process("p3", { technology: "ui" }), [{ id: "f", from: "op", to: "p3" }]);
    fireEvent.click(screen.getByTestId("security-tab-operation"));
    unmount();
    renderForm(process("p4", { technology: "ui" }), [{ id: "f", from: "op", to: "p4" }]);
    expect(screen.getByTestId("security-tab-operation").getAttribute("aria-selected")).toBe("true");
  });
});
