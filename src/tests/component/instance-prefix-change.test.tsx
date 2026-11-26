// src/tests/component/instance-prefix-change.test.tsx
//
// 0.20 manual test E3 (2026-11-26, user): a prefix chosen at the import can be
// changed afterwards — "Change prefix…" in the multiprocess's tab "Component"
// (DFD) and at each instance in Overview → Components. The dialog asks for the
// new prefix, shows why one cannot be taken, and hands it on; the app layer
// inserts the instance again (through the DFD tab, like an update).
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDDetailsPanel } from "features/dfd/components/dfd-details-panel";
import { ComponentsView } from "features/overview/components/components-view";
import type { ComponentOverviewItem } from "features/overview";
import { EMPTY_PROJECT_TAGS } from "shared";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({
    t: (k: string, opt?: Record<string, unknown>) =>
      ((opt?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opt?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
afterEach(cleanup);

/** "SDC2" is used inside the component, "SD9" by another instance. */
const check = (prefix: string) => (prefix === "SDC2" ? "used inside" : prefix === "SD9" ? "taken" : prefix.includes(" ") ? "format" : undefined);
const input = () => screen.getByTestId("instance-prefix-input") as HTMLInputElement;
const confirm = () => screen.getByTestId("instance-prefix-confirm") as HTMLButtonElement;

describe("Change prefix… — tab Component (DFD)", () => {
  const mp = { id: "mp1", displayId: "MP-3", name: "Controller", type: "Multiprocess", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} } as never;

  it("checks the prefix as typed and runs the rename through the DFD tab", () => {
    const runner = vi.fn();
    const runnerFor = vi.fn(() => runner);
    const onRun = vi.fn();
    render(
      <DFDDetailsPanel
        open
        onToggle={() => {}}
        onClose={() => {}}
        element={mp}
        onChange={() => {}}
        elements={[mp]}
        componentInfo={{ name: "Controller", source: "commit 01234567", prefix: "SDC1", renamePrefix: { check, runnerFor } }}
        onRunComponent={onRun}
      />,
    );
    fireEvent.click(screen.getByTestId("component-prefix-change"));
    expect(input().value).toBe("SDC1");
    expect(confirm().disabled).toBe(true); // unchanged
    fireEvent.change(input(), { target: { value: "SDC2" } });
    expect(screen.getByTestId("instance-prefix-dialog").textContent).toContain("used inside");
    expect(confirm().disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "C1" } });
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    expect(runnerFor).toHaveBeenCalledWith("C1");
    expect(onRun).toHaveBeenCalledWith(runner);
    expect(screen.queryByTestId("instance-prefix-dialog")).toBeNull();
  });

  it("no button without the action or outside the DFD tab's runner", () => {
    render(<DFDDetailsPanel open onToggle={() => {}} onClose={() => {}} element={mp} onChange={() => {}} elements={[mp]} componentInfo={{ name: "Controller", source: "x", prefix: "SDC1" }} onRunComponent={vi.fn()} />);
    expect(screen.queryByTestId("component-prefix-change")).toBeNull();
  });
});

describe("Change prefix… — Overview → Components", () => {
  const item: ComponentOverviewItem = {
    importId: "a",
    name: "Controller",
    tags: EMPTY_PROJECT_TAGS,
    sections: [],
    functions: [],
    sourceBindings: [],
    origin: { sameRepo: true, path: "c.tara.json", commit: "0123456789abcdef", importedAt: "2026-11-10T10:00:00.000Z" },
    methodologyMatches: true,
    deviations: [],
    instances: [{ id: "i1", prefix: "SDC1", multiprocessTfId: "mp-1", quantity: 1, assumptionsTotal: 0, assumptionsDecided: 0, assumptionsNotFulfilled: 0 }],
  } as unknown as ComponentOverviewItem;

  it("per instance; the confirmed prefix goes to the app layer", () => {
    const onConfirm = vi.fn();
    const renamePrefixOf = vi.fn(() => ({ check, onConfirm }));
    render(<ComponentsView items={[item]} renamePrefixOf={renamePrefixOf} />);
    fireEvent.click(screen.getByTestId("component-overview-prefix-SDC1"));
    fireEvent.change(input(), { target: { value: "SD9" } });
    expect(screen.getByTestId("instance-prefix-dialog").textContent).toContain("taken");
    fireEvent.change(input(), { target: { value: "C1" } });
    fireEvent.click(confirm());
    expect(renamePrefixOf).toHaveBeenCalledWith("i1");
    expect(onConfirm).toHaveBeenCalledWith("C1");
  });

  it("no button when the app does not offer it", () => {
    render(<ComponentsView items={[item]} />);
    expect(screen.queryByTestId("component-overview-prefix-SDC1")).toBeNull();
  });
});
