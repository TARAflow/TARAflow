// src/tests/component/confirm-dialog-scroll.test.tsx
//
// 0.16.1-beta: a dialog with a long text kept growing past the window and
// pushed its buttons off screen. The generic confirm dialog is limited to
// the window height; the message scrolls, header and buttons stay visible.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

afterEach(cleanup);

describe("ConfirmDialog with a long message", () => {
  it("scrolls the message, keeps the buttons outside the scrolling area", () => {
    render(
      <ConfirmDialog title="T" message={"long text ".repeat(500)} confirmLabel="OK" onConfirm={() => {}} onCancel={() => {}} />,
    );
    const content = screen.getByTestId("confirm-dialog-content");
    expect(content.className).toContain("overflow-y-auto");
    expect(content.contains(screen.getByText("OK"))).toBe(false);
    expect(content.parentElement!.className).toContain("max-h-[90vh]");
  });
});
