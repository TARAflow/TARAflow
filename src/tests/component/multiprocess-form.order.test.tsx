// src/tests/component/multiprocess-form.order.test.tsx
//
// Field order on the Multiprocess form (TESTPLAN-0.17 F2, sub-tabs since
// CM-5d): the Security section is split into light sub-tabs — login,
// authorization, robustness, sessions, operation, safety last; the update
// mechanism sits in "Operation", the session fields in "Sessions",
// "safety-relevant" in the last tab.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiprocessDescriptionForm } from "features/dfd/components/forms/multiprocess-description-form";
import type { DFDElement } from "features/dfd/models/dfd-types";
import { ModelFieldProvider } from "features/dfd/components/forms/model-field-inputs";
import type { VisibilityElement } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const element = {
  id: "mp1",
  type: "Multiprocess",
  displayId: "MP-1",
  name: "Pump Controller",
  properties: { systemClass: "embedded_controller" },
} as unknown as DFDElement;

describe("MultiprocessDescriptionForm — Security sub-tabs", () => {
  it("tabs in order, safety last; each field in its tab", () => {
    render(<MultiprocessDescriptionForm element={element} onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid"));
    expect(tabs.filter((id) => id?.startsWith("security-tab-"))).toEqual([
      "security-tab-login",
      "security-tab-authorization",
      "security-tab-robustness",
      "security-tab-sessions",
      "security-tab-operation",
      "security-tab-safety",
    ]);

    fireEvent.click(screen.getByTestId("security-tab-operation"));
    expect(screen.getAllByText("Update Mechanism").length).toBeGreaterThan(0);
    expect(screen.queryByText("Session Lock after Inactivity")).toBeNull();

    fireEvent.click(screen.getByTestId("security-tab-sessions"));
    expect(screen.getAllByText("Session Lock after Inactivity").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("security-tab-safety"));
    expect(screen.getByText("Safety-Relevant System")).toBeTruthy();
  });
});

describe("MultiprocessDescriptionForm — inside a black box (D-30c)", () => {
  const renderIn = (decomposed?: Set<string>) =>
    render(
      <ModelFieldProvider elements={[element as unknown as VisibilityElement]} connections={[]} decomposed={decomposed}>
        <MultiprocessDescriptionForm element={element} onChange={() => {}} />
      </ModelFieldProvider>,
    );

  it("without child page: the tab 'Inside (black box)' before safety, with the seven fields open", () => {
    renderIn();
    const tabs = screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid")).filter((id) => id?.startsWith("security-tab-"));
    expect(tabs.slice(-2)).toEqual(["security-tab-inside", "security-tab-safety"]);
    expect(screen.getByTestId("security-tab-inside").textContent).toBe("Inside (black box) (7)");
    fireEvent.click(screen.getByTestId("security-tab-inside"));
    expect(screen.getByTestId("model-field-innerInputValidation")).toBeTruthy();
    expect(screen.getByTestId("model-field-innerDeletionMechanism")).toBeTruthy();
  });

  it("with a child page: no inside tab", () => {
    renderIn(new Set(["mp1"]));
    expect(screen.queryByTestId("security-tab-inside")).toBeNull();
  });
});
