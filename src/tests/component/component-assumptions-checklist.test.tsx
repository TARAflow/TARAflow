// src/tests/component/component-assumptions-checklist.test.tsx
// Multi-project TARA, phase 3b (design §7.6): the AoU checklist of one
// instance — status, the component's own status beside it, evidence, and the
// mandatory rationale for "not applicable" before it is saved.
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentAssumptionsChecklist } from "features/components";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const assumptions = [
  { assumptionId: "a1", displayId: "ASM-01", text: "The sensor bus runs inside the cabinet", componentStatus: "confirmed", status: "open" as const },
  { assumptionId: "a2", displayId: "ASM-02", text: "Calibration commands are authenticated", componentStatus: "open", status: "fulfilled" as const, evidence: { mitigationIds: ["M-C-001"] } },
];
const measures = [{ id: "M-C-001", label: "M-C-001 Locked cabinet" }, { id: "M-T-001", label: "M-T-001 Integrity check" }];

function open() {
  const onChange = vi.fn();
  render(<ComponentAssumptionsChecklist prefix="SD1" assumptions={assumptions} measures={measures} onChange={onChange} />);
  fireEvent.click(screen.getByText(/Assumptions of use/));
  return onChange;
}
const pickStatus = async (displayId: string, label: string) => {
  const select = screen.getByTestId(`component-assumption-status-${displayId}`).parentElement!.querySelector('[role="combobox"]')!;
  await act(async () => { fireEvent.mouseDown(select); });
  await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText(label)); });
};

describe("ComponentAssumptionsChecklist", () => {
  it("lists the assumptions with the count of open ones and the component's status", () => {
    open();
    expect(screen.getByTestId("component-assumptions").textContent).toContain("Assumptions of use (2) — open: 1");
    expect(screen.getByTestId("component-assumption-ASM-01").textContent).toContain("component: confirmed");
  });

  it("a status change is passed on", async () => {
    const onChange = open();
    await pickStatus("ASM-01", "not fulfilled");
    expect(onChange).toHaveBeenCalledWith("a1", { status: "not_fulfilled", evidence: undefined });
  });

  it("not applicable asks for the rationale first, then saves", async () => {
    const onChange = open();
    await pickStatus("ASM-01", "not applicable");
    expect(onChange).not.toHaveBeenCalled();
    const save = screen.getByTestId("component-assumption-rationale-save-ASM-01") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("component-assumption-rationale-ASM-01"), { target: { value: "No bus in this machine" } });
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith("a1", { status: "not_applicable", evidence: undefined, rationale: "No bus in this machine" });
  });

  it("evidence: this machine's measures and a note", async () => {
    const onChange = open();
    const select = screen.getByTestId("component-assumption-measures-ASM-02").parentElement!.querySelector('[role="combobox"]')!;
    await act(async () => { fireEvent.mouseDown(select); });
    await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText("M-T-001 Integrity check")); });
    expect(onChange).toHaveBeenCalledWith("a2", { status: "fulfilled", evidence: { mitigationIds: ["M-C-001", "M-T-001"] } });
    const note = screen.getByTestId("component-assumption-note-ASM-02");
    fireEvent.change(note, { target: { value: "Cabinet key with maintenance" } });
    fireEvent.blur(note);
    expect(onChange).toHaveBeenLastCalledWith("a2", { status: "fulfilled", evidence: { mitigationIds: ["M-C-001"], note: "Cabinet key with maintenance" } });
  });
});
