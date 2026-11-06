// src/tests/component/security-tabs.scroll.test.tsx
//
// Test plan C2 (user 2026-11-06): "Operation" chosen on P-1, over to MP-1 and
// back — the rebuilt tab bar showed the chosen tab cut off: MUI scrolled it
// into view while the panel was still settling. The bar now brings the chosen
// tab fully into view whenever its width or the chosen tab changes — only the
// bar scrolls, never the form.

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityTabs, type SecurityEntry } from "features/dfd/components/forms/security-tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }),
}));

let resize: (() => void) | undefined;
beforeEach(() => {
  resize = undefined;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(cb: () => void) {
      resize = cb;
    }
    observe() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

const entry = (key: string, group: SecurityEntry["group"]): SecurityEntry => ({ key, group, visible: true, set: false, node: <div key={key}>{key}</div> });
const ENTRIES = [entry("a", "login"), entry("b", "authorization"), entry("c", "robustness"), entry("d", "sessions"), entry("e", "operation")];

/** Fakes the layout jsdom does not have: a 200 px bar, tabs 120 px wide side by side. */
function layout() {
  const scroller = document.querySelector<HTMLElement>(".MuiTabs-scroller")!;
  Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 });
  scroller.scrollLeft = 0;
  ["login", "authorization", "robustness", "sessions", "operation"].forEach((id, i) => {
    const tab = screen.getByTestId(`security-tab-${id}`);
    Object.defineProperty(tab, "offsetLeft", { configurable: true, value: i * 120 });
    Object.defineProperty(tab, "offsetWidth", { configurable: true, value: 120 });
  });
  return scroller;
}

describe("SecurityTabs — the chosen tab stays fully in view", () => {
  it("chosen before (kept per form), the bar settles: the tab is scrolled fully into view", () => {
    const first = render(<SecurityTabs formKey="scroll-test" entries={ENTRIES} />);
    act(() => screen.getByTestId("security-tab-operation").click());
    first.unmount();

    // Back on the element: the form is rebuilt with "operation" chosen.
    render(<SecurityTabs formKey="scroll-test" entries={ENTRIES} />);
    const scroller = layout();
    act(() => resize!());
    // operation spans 480–600: right edge in view at scrollLeft 400.
    expect(scroller.scrollLeft).toBe(400);
  });

  it("a tab left of the visible part is scrolled to its start", () => {
    render(<SecurityTabs formKey="scroll-test-2" entries={ENTRIES} />);
    const scroller = layout();
    scroller.scrollLeft = 300;
    act(() => resize!());
    expect(scroller.scrollLeft).toBe(0); // login at 0
  });
});
