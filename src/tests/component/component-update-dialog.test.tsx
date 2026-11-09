// Multi-project TARA phase 5c-2 (reviews 2026-11-10): the update dialog —
// Apply only when every new EE is decided (no silent default); pairings
// offered unchecked; the review count and what is dropped from the app's dry
// run; and in the component section: Update…, Discard update, the reviews
// with Confirm.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentUpdateDialog, TAKE_OVER, type ComponentUpdatePreview } from "features/components";
import { DFDDetailsPanel } from "features/dfd/components/dfd-details-panel";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({
    t: (k: string, opt?: Record<string, unknown>) =>
      ((opt?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opt?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const preview: ComponentUpdatePreview = {
  component: "Smoke Detector",
  from: "commit 01234567",
  to: "commit 89abcdef",
  changes: [{ kind: "threats", added: 1, removed: 1 }],
  newEes: [{ eeId: "EE-NEW", name: "Service laptop", instances: [{ instanceId: "i1", label: "SD1 · Smoke Detector", options: [{ id: "m_plc", label: "EE-1 Controller" }] }] }],
  candidates: [{ key: "threat|t1|t2", kind: "threat", from: "t1", fromLabel: "T · old", toLabel: "T · new", reason: "same_stride_and_target" }],
};

describe("ComponentUpdateDialog", () => {
  it("Apply only when every new EE is decided; pairings unchecked; the numbers from the dry run follow the choice", () => {
    const outcomeOf = vi.fn((choice: { pairs: string[] }) => ({
      review: choice.pairs.length > 0 ? 3 : 1,
      dropped: choice.pairs.length > 0 ? [] : [{ kind: "riskRating", count: 1 }],
      tickets: choice.pairs.length > 0 ? [] : ["ABC-1"],
    }));
    const onApply = vi.fn();
    render(<ComponentUpdateDialog open preview={preview} outcomeOf={outcomeOf} onApply={onApply} onClose={() => {}} />);
    const apply = screen.getByTestId("component-update-apply") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect((screen.getByTestId("component-update-pair-threat|t1|t2").querySelector("input") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId("component-update-review-count").textContent).toBe("Afterwards 1 decision(s) to review");
    expect(screen.getByTestId("component-update-tickets").textContent).toContain("ABC-1");
    // decide the new EE
    fireEvent.change(screen.getByTestId("component-update-ee-i1-EE-NEW"), { target: { value: TAKE_OVER } });
    expect(apply.disabled).toBe(false);
    // tick the pairing
    fireEvent.click(screen.getByTestId("component-update-pair-threat|t1|t2").querySelector("input")!);
    expect(screen.getByTestId("component-update-review-count").textContent).toBe("Afterwards 3 decision(s) to review");
    expect(screen.queryByTestId("component-update-tickets")).toBeNull();
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith({ pairs: ["threat|t1|t2"], ees: { i1: { "EE-NEW": TAKE_OVER } } });
  });
});

describe("component section: update, discard, reviews", () => {
  const mp = { id: "mp1", displayId: "MP-3", name: "Smoke Detector", type: "Multiprocess", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} } as never;
  it("Update… and Discard update run their runner through the DFD tab; a review is confirmed", () => {
    const updateRunner = vi.fn();
    const discardRunner = vi.fn();
    const onConfirm = vi.fn();
    const onRun = vi.fn();
    render(
      <DFDDetailsPanel
        open
        onToggle={() => {}}
        onClose={() => {}}
        element={mp}
        onChange={() => {}}
        elements={[mp]}
        componentInfo={{ name: "Smoke Detector", source: "commit 01234567", prefix: "SD1", updateRunner, discardRunner, reviews: [{ key: "aouStatus|a1", text: "Assumption ASM-01", onConfirm }] }}
        onRunComponent={onRun}
      />,
    );
    fireEvent.click(screen.getByTestId("component-update"));
    expect(onRun).toHaveBeenLastCalledWith(updateRunner);
    fireEvent.click(screen.getByTestId("component-update-discard"));
    expect(onRun).toHaveBeenLastCalledWith(discardRunner);
    const reviews = screen.getByTestId("component-reviews");
    expect(reviews.textContent).toContain("1 decision(s) to review after the update");
    fireEvent.click(within(reviews).getByTestId("component-review-confirm-aouStatus|a1"));
    expect(onConfirm).toHaveBeenCalled();
  });
});
