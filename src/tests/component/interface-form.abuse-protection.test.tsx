// src/tests/component/interface-form.abuse-protection.test.tsx
//
// Abuse protection on the Interface form (CM-8b, user 2026-11-02): locking
// after failed attempts is offered only where the link authenticates itself
// (Bluetooth, Wi-Fi, NFC) — login lockout belongs to the verifier (Process /
// Multiprocess). A stored lockout stays visible and selectable.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterfaceDescriptionForm } from "features/dfd/components/forms/interface-description-form";
import type { DFDElement } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const iface = (properties: Record<string, unknown>) =>
  ({ id: "if1", type: "Interface", displayId: "IF-1", name: "Port", properties }) as unknown as DFDElement;

function options(properties: Record<string, unknown>): string[] {
  render(<InterfaceDescriptionForm element={iface(properties)} onChange={() => {}} />);
  const label = screen.getAllByText("Abuse Protection")[0];
  const select = label.closest(".MuiFormControl-root")!.querySelector("[role='combobox']")!;
  fireEvent.mouseDown(select);
  return screen.getAllByRole("option").map((o) => o.getAttribute("data-value") ?? "");
}

describe("Interface form — abuse protection values", () => {
  it("Ethernet: no lockout — rate limiting and flood protection", () => {
    expect(options({ type: "ethernet" })).toEqual(["", "none", "rate_limited", "flood_protection"]);
  });

  it("Bluetooth (link authentication): lockout of pairing attempts offered", () => {
    expect(options({ type: "bluetooth" })).toContain("lockout");
  });

  it("a stored lockout on Ethernet stays selectable", () => {
    expect(options({ type: "ethernet", implementedControls: { abuseProtection: "lockout" } })).toContain("lockout");
  });
});
