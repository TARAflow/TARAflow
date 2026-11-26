// src/tests/component/threat-dialog.text-edit.test.tsx
//
// 0.20 manual test F2 (2026-11-26): editing a threat's or attack's text, the
// pen stayed a pen and every keystroke was taken over at once — there was no
// way to cancel. Now: the pen starts editing a draft; ✓ takes it over, ✗
// drops it and shows the text as before.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
afterEach(cleanup);

const threat: Threat = {
  ...createEmptyThreat("t1", "T", null, "Zone", "Z"),
  displayId: "P1-T-1",
  threatDescription: "Original threat",
  attackDescription: "Original attack",
  linkedElement: { elementId: "p1", displayId: "P-1", elementName: "MyProcess", elementType: "Process" },
};
const open = (onSave = vi.fn()) =>
  render(<ThreatEvalDialog open threats={[threat]} initialIndex={0} configuration={{} as never} onSave={onSave} onClose={vi.fn()} />);

describe.each([
  ["threat-text", "Original threat"],
  ["attack-text", "Original attack"],
])("threat dialog — %s", (id, original) => {
  it("pen while reading; ✓ and ✗ while editing", () => {
    open();
    expect(screen.getByTestId(`${id}-edit`)).toBeTruthy();
    expect(screen.queryByTestId(`${id}-save`)).toBeNull();
    fireEvent.click(screen.getByTestId(`${id}-edit`));
    expect(screen.queryByTestId(`${id}-edit`)).toBeNull();
    expect(screen.getByTestId(`${id}-save`)).toBeTruthy();
    expect(screen.getByTestId(`${id}-cancel`)).toBeTruthy();
  });

  it("✗ drops the draft", () => {
    open();
    fireEvent.click(screen.getByTestId(`${id}-edit`));
    fireEvent.change(screen.getByTestId(`${id}-input`), { target: { value: "Changed" } });
    fireEvent.click(screen.getByTestId(`${id}-cancel`));
    expect(screen.getByTestId(`${id}-value`).textContent).toBe(original);
    expect(screen.getByTestId(`${id}-edit`)).toBeTruthy();
  });

  it("✓ takes the draft over", () => {
    open();
    fireEvent.click(screen.getByTestId(`${id}-edit`));
    fireEvent.change(screen.getByTestId(`${id}-input`), { target: { value: "Changed" } });
    fireEvent.click(screen.getByTestId(`${id}-save`));
    expect(screen.getByTestId(`${id}-value`).textContent).toBe("Changed");
  });

  // user decision 2026-11-26: while a text is edited, the footer's buttons
  // are disabled until ✓ or ✗ ends the edit
  it("the footer's buttons are disabled while the text is edited", () => {
    open();
    const footer = () => [screen.getByRole("button", { name: /^Confirm/ }), screen.getByRole("button", { name: /^Dismiss/ }), screen.getByRole("button", { name: /^Uncertain/ }), screen.getByTestId("threat-dialog-ok")] as HTMLButtonElement[];
    expect(footer().every((b) => !b.disabled)).toBe(true);
    fireEvent.click(screen.getByTestId(`${id}-edit`));
    expect(footer().every((b) => b.disabled)).toBe(true);
    fireEvent.click(screen.getByTestId(`${id}-cancel`));
    expect(footer().every((b) => !b.disabled)).toBe(true);
    fireEvent.click(screen.getByTestId(`${id}-edit`));
    fireEvent.click(screen.getByTestId(`${id}-save`));
    expect(footer().every((b) => !b.disabled)).toBe(true);
  });
});
