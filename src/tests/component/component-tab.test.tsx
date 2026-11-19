// src/tests/component/component-tab.test.tsx
//
// Multi-project TARA (user + review 2026-11-13): an imported component's
// multiprocess has the tab "Component" before "General" and "Relations" in
// the same bar — a general slot of the element form, filled by the details
// panel. The start tab is fixed (the component tab), never by state; the
// number on the tab signals what is open; a tab the user picks stays picked
// among imported multiprocesses; a finding / "Show in DFD" opens it on purpose.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDDetailsPanel } from "features/dfd/components/dfd-details-panel";
import type { ComponentMultiprocessInfo } from "features/dfd";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({
    t: (k: string, opt?: Record<string, unknown>) =>
      ((opt?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opt?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
afterEach(cleanup);

const mp = (id: string) =>
  ({ id, displayId: `MP-${id}`, name: `Detector ${id}`, type: "Multiprocess", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} }) as never;
const process = { id: "p1", displayId: "P-1", name: "Logic", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} } as never;
const info = (extra: Partial<ComponentMultiprocessInfo> = {}): ComponentMultiprocessInfo => ({ name: "Smoke Detector", source: "commit 01234567", prefix: "SD1", ...extra });

function panel(element: unknown, componentInfo?: ComponentMultiprocessInfo, tabRequest?: { tab: string } | null) {
  return (
    <DFDDetailsPanel
      open
      onToggle={() => {}}
      onClose={() => {}}
      element={element as never}
      onChange={() => {}}
      elements={[element as never]}
      {...(componentInfo ? { componentInfo } : {})}
      {...(tabRequest ? { tabRequest } : {})}
    />
  );
}
// the element form's tabs (the panel's own "Element" / "Assets" left out)
const FORM_TABS = /^(Component\d*|General|Asset)$/;
const formTabs = () => screen.getAllByRole("tab").filter((t) => FORM_TABS.test(t.textContent ?? ""));
const tabs = () => formTabs().map((t) => t.textContent);
const selected = () => formTabs().find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

describe("the tab Component of an imported multiprocess", () => {
  it("Component, General, Relations in one bar; it opens on Component — with or without anything open", () => {
    const { rerender } = render(panel(mp("a"), info()));
    expect(tabs()).toEqual(["Component", "General", "Asset"]);
    expect(selected()).toBe("Component");
    expect(screen.getByTestId("component-section")).toBeTruthy();
    expect(screen.queryByTestId("element-tab-component-badge")).toBeNull();
    // nothing open, another instance: still Component (fixed, not by state)
    rerender(panel(mp("b"), info({ prefix: "SD2" })));
    expect(selected()).toBe("Component");
  });

  it("the number on the tab: assumptions open, reviews, a newer state", () => {
    render(
      panel(
        mp("c"),
        info({
          openAssumptions: 2,
          reviews: [{ key: "r1", text: "Assumption ASM-01", onConfirm: () => {} }],
          drift: { kind: "newer_available", text: "Newer state available" },
        }),
      ),
    );
    expect(within(screen.getByTestId("element-tab-component")).getByText("4")).toBeTruthy();
  });

  it("a tab the user picks stays picked among imported multiprocesses; a request opens Component again", () => {
    const { rerender } = render(panel(mp("d"), info()));
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    expect(selected()).toBe("General");
    expect(screen.queryByTestId("component-section")).toBeNull();
    rerender(panel(mp("e"), info({ prefix: "SD2" })));
    expect(selected()).toBe("General");
    // a finding / "Show in DFD": Component on purpose
    rerender(panel(mp("e"), info({ prefix: "SD2" }), { tab: "component" }));
    expect(selected()).toBe("Component");
    expect(screen.getByTestId("component-section")).toBeTruthy();
  });

  it("other elements: no tab Component, General first as before", () => {
    render(panel(process));
    expect(tabs()).not.toContain("Component");
    expect(selected()).toBe("General");
  });
});
