// src/tests/component/component-import-dialog.test.tsx
//
// Multi-project TARA, phase 1 (design §5): the import dialog — choose a file,
// see its source, confirm an unpinned state, name and prefix, map the EEs,
// the hints for an existing import and for flows that will not resolve, and
// the refusals. Manual test 2026-11-08 (I5): an existing import asks first in
// a dialog of its own — a further instance or a higher quantity; the
// quantity of a new instance.

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentImportDialog, type ComponentImportCandidate, type ComponentPickResult } from "features/components";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const candidate = (patch: Partial<ComponentImportCandidate> = {}): ComponentImportCandidate => ({
  name: "Smoke Detector",
  source: { commitSha: "0123456789ab", schemaVersion: 14, tag: "sd/v1", branch: "main", path: "components/sd.tara.json", repoUrl: "https://git.example.com/sd.git" },
  externalEntities: [
    { id: "ee1", label: "EE-1 Alarm panel" },
    { id: "ee2", label: "EE-2 Technician" },
  ],
  unresolvableFlows: [],
  defaultPrefix: "SD1",
  usedPrefixes: [],
  ...patch,
});

function open(result: ComponentPickResult, machineElements = [{ id: "m_plc", label: "EE-1 Fire Panel Controller" }]) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const onIncreaseQuantity = vi.fn();
  const onPickFile = vi.fn(async () => result);
  render(
    <ComponentImportDialog
      open
      machineElements={machineElements}
      onPickFile={onPickFile}
      onConfirm={onConfirm}
      onIncreaseQuantity={onIncreaseQuantity}
      onClose={onClose}
    />,
  );
  return { onConfirm, onClose, onPickFile, onIncreaseQuantity };
}
const pick = () => act(async () => { fireEvent.click(screen.getByTestId("component-import-pick")); });
const confirmButton = () => screen.getByTestId("component-import-confirm") as HTMLButtonElement;

describe("ComponentImportDialog", () => {
  it("nothing to import before a file is chosen", () => {
    open(null);
    expect(confirmButton().disabled).toBe(true);
  });

  it("a pinned component: source summary, defaults, every EE as a new element", async () => {
    const { onConfirm } = open({ ok: true, candidate: candidate() });
    await pick();
    const summary = screen.getByTestId("component-import-summary").textContent ?? "";
    expect(summary).toContain("Smoke Detector");
    expect(summary).toContain("commit 01234567");
    expect(summary).toContain("tag sd/v1");
    expect(summary).toContain("components/sd.tara.json");
    expect((screen.getByTestId("component-import-prefix") as HTMLInputElement).value).toBe("SD1");
    expect(screen.queryByTestId("component-import-unpinned")).toBeNull();
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ prefix: "SD1", name: "Smoke Detector", eeMapping: { ee1: undefined, ee2: undefined }, quantity: 1 });
  });

  it("an EE mapped to a machine element", async () => {
    const { onConfirm } = open({ ok: true, candidate: candidate() });
    await pick();
    const select = screen.getByTestId("component-import-map-ee1").parentElement!.querySelector('[role="combobox"]')!;
    await act(async () => { fireEvent.mouseDown(select); });
    await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText("EE-1 Fire Panel Controller")); });
    fireEvent.click(confirmButton());
    expect(onConfirm.mock.calls[0][0].eeMapping).toEqual({ ee1: "m_plc", ee2: undefined });
  });

  it("an unpinned component needs the confirmation", async () => {
    const { onConfirm } = open({ ok: true, candidate: candidate({ source: { schemaVersion: 14, unpinned: "no_repo" } }) });
    await pick();
    expect(screen.getByTestId("component-import-unpinned").textContent).toContain("not in a git repository");
    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(screen.getByTestId("component-import-unpinned-confirm"));
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalled();
  });

  it("the prefix must be valid and unused", async () => {
    open({ ok: true, candidate: candidate({ usedPrefixes: ["SD2"] }) });
    await pick();
    const prefix = screen.getByTestId("component-import-prefix");
    fireEvent.change(prefix, { target: { value: "sd2" } });
    expect(screen.getByText("Already used by another instance")).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(prefix, { target: { value: "S D" } });
    expect(screen.getByText("1–12 letters, digits, - or _")).toBeTruthy();
    fireEvent.change(prefix, { target: { value: "SD3" } });
    expect(confirmButton().disabled).toBe(false);
  });

  it("an empty name blocks the import", async () => {
    open({ ok: true, candidate: candidate() });
    await pick();
    fireEvent.change(screen.getByTestId("component-import-name"), { target: { value: "  " } });
    expect(confirmButton().disabled).toBe(true);
  });

  it("flows that will not resolve are listed; the import still runs", async () => {
    open({ ok: true, candidate: candidate({ unresolvableFlows: ["DF-8 pull debug commands"] }) });
    await pick();
    expect(screen.getByTestId("component-import-unresolvable").textContent).toContain("DF-8 pull debug commands");
    expect(confirmButton().disabled).toBe(false);
  });

  const existing = (sameState: boolean) => ({
    sameState,
    label: "sd/v0",
    instances: [
      { id: "i1", label: "SD1 · Smoke Detector", quantity: 1 },
      { id: "i2", label: "SD2 · Smoke Detector ×3", quantity: 3 },
    ],
  });

  it("imported already: a dialog of its own asks first; the form waits", async () => {
    open({ ok: true, candidate: candidate({ existing: existing(true) }) });
    await pick();
    const ask = screen.getByTestId("component-import-existing");
    expect(ask.textContent).toContain("Smoke Detector is imported already");
    expect(ask.textContent).toContain("SD1 · Smoke Detector, SD2 · Smoke Detector ×3");
    expect(ask.textContent).toContain("same installation context");
    expect(screen.queryByTestId("component-import-existing-other")).toBeNull();
    expect(screen.queryByTestId("component-import-prefix")).toBeNull();
    expect(confirmButton().disabled).toBe(true);
  });

  it("another state is explained in the question", async () => {
    open({ ok: true, candidate: candidate({ existing: existing(false) }) });
    await pick();
    expect(screen.getByTestId("component-import-existing-other").textContent).toContain("another state (sd/v0)");
  });

  it("a further instance: the form follows", async () => {
    const { onConfirm } = open({ ok: true, candidate: candidate({ existing: existing(true) }) });
    await pick();
    fireEvent.click(screen.getByTestId("component-import-existing-another"));
    expect(screen.queryByTestId("component-import-existing")).toBeNull();
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalled();
  });

  it("raise the quantity of an existing instance: no import, the dialog closes", async () => {
    const { onConfirm, onClose, onIncreaseQuantity } = open({ ok: true, candidate: candidate({ existing: existing(true) }) });
    await pick();
    expect(screen.getByTestId("component-import-existing-increase").textContent).toContain("SD1: 1 → 2");
    const select = screen.getByTestId("component-import-existing-instance").parentElement!.querySelector('[role="combobox"]')!;
    await act(async () => { fireEvent.mouseDown(select); });
    await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText("SD2 · Smoke Detector ×3")); });
    expect(screen.getByTestId("component-import-existing-increase").textContent).toContain("SD2: 3 → 4");
    fireEvent.click(screen.getByTestId("component-import-existing-increase"));
    expect(onIncreaseQuantity).toHaveBeenCalledWith("i2");
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancel in the question closes the import", async () => {
    const { onClose } = open({ ok: true, candidate: candidate({ existing: existing(true) }) });
    await pick();
    fireEvent.click(screen.getByTestId("component-import-existing-cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("the quantity of a new instance: identical units, at least 1", async () => {
    const { onConfirm } = open({ ok: true, candidate: candidate() });
    await pick();
    const quantity = screen.getByTestId("component-import-quantity");
    fireEvent.change(quantity, { target: { value: "0" } });
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(quantity, { target: { value: "4" } });
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm.mock.calls[0][0].quantity).toBe(4);
  });

  it("a refused file shows the reason and offers no import", async () => {
    open({ ok: false, error: "not_deterministic" });
    await pick();
    expect(screen.getByTestId("component-import-error").textContent).toContain("Open and save it in TARAflow 0.19");
    expect(confirmButton().disabled).toBe(true);
  });

  it("cancel closes", () => {
    const { onClose } = open(null);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
