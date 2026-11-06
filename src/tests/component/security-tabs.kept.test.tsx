// src/tests/component/security-tabs.kept.test.tsx
//
// Test plan C2 (user 2026-11-06): the chosen security tab is kept per element
// type — "Operation" on processes, "Data" on multiprocesses — across a switch
// P-1 → MP-1 → P-1, and the bar never scrolls: in a narrow panel the tabs wrap,
// so the chosen tab is always in view at the same place.

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecurityTabs, type SecurityEntry } from "features/dfd/components/forms/security-tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }),
}));

afterEach(cleanup);

const entry = (key: string, group: SecurityEntry["group"]): SecurityEntry => ({ key, group, visible: true, set: false, node: <div key={key}>{key}</div> });
const PROCESS = [entry("a", "login"), entry("b", "robustness"), entry("c", "operation")];
const MULTI = [entry("a", "login"), entry("b", "robustness"), entry("c", "operation"), entry("d", "data")];
const selected = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.getAttribute("data-testid");

describe("SecurityTabs — kept per element type, never scrolling", () => {
  it("P: Operation, MP: Data — kept across P → MP → P → MP", () => {
    let view = render(<SecurityTabs formKey="kept-process" entries={PROCESS} />);
    act(() => screen.getByTestId("security-tab-operation").click());
    view.unmount();

    view = render(<SecurityTabs formKey="kept-multiprocess" entries={MULTI} />);
    act(() => screen.getByTestId("security-tab-data").click());
    view.unmount();

    view = render(<SecurityTabs formKey="kept-process" entries={PROCESS} />);
    expect(selected()).toBe("security-tab-operation");
    view.unmount();

    render(<SecurityTabs formKey="kept-multiprocess" entries={MULTI} />);
    expect(selected()).toBe("security-tab-data");
  });

  it("the bar does not scroll: no scroll buttons, the tabs wrap", () => {
    render(<SecurityTabs formKey="kept-wrap" entries={MULTI} />);
    const bar = screen.getByTestId("security-tabs");
    expect(bar.querySelector(".MuiTabs-scrollButtons")).toBeNull();
    expect(bar.querySelector(".MuiTabs-scrollableX")).toBeNull();
  });
});
