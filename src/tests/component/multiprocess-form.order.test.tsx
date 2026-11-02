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
