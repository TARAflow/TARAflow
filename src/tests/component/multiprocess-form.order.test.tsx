// src/tests/component/multiprocess-form.order.test.tsx
//
// Field order on the Multiprocess form (TESTPLAN-0.17 F2, sub-tabs since
// CM-5d): the Security section is split into light sub-tabs — login,
// authorization, robustness, sessions, operation, safety last; the update
// mechanism sits in "Operation", the session fields in "Sessions",
// "safety-relevant" in the last tab.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  it("tabs in order; each field in its tab; safety below the tabs, always in view (C3)", () => {
    render(<MultiprocessDescriptionForm element={element} onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid"));
    expect(tabs.filter((id) => id?.startsWith("security-tab-"))).toEqual([
      "security-tab-login",
      "security-tab-authorization",
      "security-tab-communication",
      "security-tab-robustness",
      "security-tab-sessions",
      "security-tab-operation",
    ]);

    fireEvent.click(screen.getByTestId("security-tab-operation"));
    expect(screen.getAllByText("Update Mechanism").length).toBeGreaterThan(0);
    expect(screen.queryByText("Session Lock after Inactivity")).toBeNull();

    fireEvent.click(screen.getByTestId("security-tab-sessions"));
    expect(screen.getAllByText("Session Lock after Inactivity").length).toBeGreaterThan(0);

    // Safety is no tab: below the tabs, visible on any tab.
    expect(screen.queryByTestId("security-tab-safety")).toBeNull();
    expect(within(screen.getByTestId("multiprocess-safety")).getByText("Safety-Relevant System")).toBeTruthy();
    fireEvent.click(screen.getByTestId("security-tab-login"));
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

  it("without child page: the inside fields in the tabs of their topic; 'Data' last, with three open", () => {
    renderIn();
    const tabs = screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid")).filter((id) => id?.startsWith("security-tab-"));
    expect(tabs.slice(-1)).toEqual(["security-tab-data"]);
    expect(screen.queryByTestId("security-tab-inside")).toBeNull();
    expect(screen.getByTestId("security-tab-data").textContent).toBe("Data (3)");
    fireEvent.click(screen.getByTestId("security-tab-robustness"));
    for (const f of ["innerInputValidation", "innerErrorHandling", "innerFailSafeOutputState"]) {
      expect(screen.getByTestId(`model-field-${f}`)).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId("security-tab-operation"));
    expect(screen.getByTestId("model-field-innerDeletionMechanism")).toBeTruthy();
    fireEvent.click(screen.getByTestId("security-tab-data"));
    for (const f of ["innerDataClassification", "innerEncryptionAtRest", "innerIntegrityProtection"]) {
      expect(screen.getByTestId(`model-field-${f}`)).toBeTruthy();
    }
  });

  it("with a child page: no data tab, the inside fields hidden", () => {
    renderIn(new Set(["mp1"]));
    expect(screen.queryByTestId("security-tab-data")).toBeNull();
    fireEvent.click(screen.getByTestId("security-tab-robustness"));
    expect(screen.queryByTestId("model-field-innerInputValidation")).toBeNull();
  });
});
