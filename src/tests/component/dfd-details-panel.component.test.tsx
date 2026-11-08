// src/tests/component/dfd-details-panel.component.test.tsx
// Multi-project TARA (design §6.1): an imported multiprocess shows its
// component (name, prefix, source) and "Open component TARA" when the app
// can open it.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const mp = { id: "mp1", displayId: "MP-3", name: "Smoke Detector", type: "Multiprocess", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} } as never;

function show(componentInfo?: { name: string; source: string; prefix: string; onOpen?: () => void; quantity?: number; onSetQuantity?: (n: number) => void }) {
  render(<DFDDetailsPanel open onToggle={() => {}} onClose={() => {}} element={mp} onChange={() => {}} elements={[mp]} componentInfo={componentInfo} />);
}

describe("DFDDetailsPanel — imported component", () => {
  it("shows the component with its source and opens it", () => {
    const onOpen = vi.fn();
    show({ name: "Smoke Detector", source: "tag sd/v1 · commit 01234567", prefix: "SD1", onOpen });
    const section = screen.getByTestId("component-section");
    expect(section.textContent).toContain("Imported component (SD1) — read-only");
    expect(section.textContent).toContain("tag sd/v1 · commit 01234567");
    fireEvent.click(screen.getByTestId("component-open"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("no open button when the app cannot open it", () => {
    show({ name: "Smoke Detector", source: "unpinned (no_repo)", prefix: "SD1" });
    expect(screen.queryByTestId("component-open")).toBeNull();
  });

  it("quantity of identical units (I5): editable, at least 1", () => {
    const onSetQuantity = vi.fn();
    show({ name: "Smoke Detector", source: "unpinned", prefix: "SD1", quantity: 2, onSetQuantity });
    const input = screen.getByTestId("component-quantity") as HTMLInputElement;
    expect(input.value).toBe("2");
    fireEvent.change(input, { target: { value: "4" } });
    expect(onSetQuantity).toHaveBeenCalledWith(4);
    onSetQuantity.mockClear();
    fireEvent.change(input, { target: { value: "0" } });
    expect(onSetQuantity).not.toHaveBeenCalled();
  });

  it("read-only quantity shows ×n above 1", () => {
    show({ name: "Smoke Detector", source: "unpinned", prefix: "SD1", quantity: 3 });
    expect(screen.getByTestId("component-quantity-label").textContent).toBe("×3");
  });

  it("an ordinary multiprocess shows no component section", () => {
    show(undefined);
    expect(screen.queryByTestId("component-section")).toBeNull();
  });
});
