// src/tests/component/risk-progress-chip.test.tsx
//
// User 2026-10-30: the "6/17" chip of a risk group needs to say what it counts.
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressChip } from "features/risks/components/shared/progress-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, o?: Record<string, unknown>) =>
      String(o?.defaultValue ?? _k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

describe("risk progress chip", () => {
  it("count and its meaning as tooltip", () => {
    const risks: Any[] = [
      { treatment: "share", moscowPriority: "could", selectedMitigations: [] },
      { treatment: "reduce", moscowPriority: "must", selectedMitigations: [{ id: "M-1", status: "open" }] },
    ];
    render(<ProgressChip risks={risks} />);
    const chip = screen.getByTestId("risk-progress-chip");
    expect(chip.textContent).toBe("1/2");
    expect(chip.getAttribute("aria-label")).toContain("1 of 2 risks done: a treatment without implementation of its own");
  });
});
