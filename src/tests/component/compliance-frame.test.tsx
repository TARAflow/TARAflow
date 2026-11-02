// src/tests/component/compliance-frame.test.tsx
//
// The Compliance frame (model-coverage-implementation-plan.md §2.2, CM-2):
// one sub-tab per active standard (K-1), only the selected one evaluated,
// the last sub-tab remembered per viewer, no sub-tab bar for one standard.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeStandards,
  ComplianceFrame,
  evaluateMatrix,
  TAG_EN_IEC_62443_CRA,
  TAG_IEC_62443,
  type Edition,
  type StandardModule,
} from "features/compliance";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const BOTH = activeStandards({ regulation: [TAG_IEC_62443, TAG_EN_IEC_62443_CRA] });

function renderFrame(standards: readonly StandardModule[]) {
  const evaluate = vi.fn((edition: Edition) => {
    const input = {
      edition,
      view: { elements: [{ id: "p1", type: "Process", properties: {} }], flows: [] },
      scope: new Set(["p1"]),
    };
    return { achieved: evaluateMatrix({ ...input, run: "achieved" }), planned: evaluateMatrix({ ...input, run: "planned" }) };
  });
  render(
    <ComplianceFrame
      standards={standards}
      evaluate={evaluate}
      data={undefined}
      componentOptions={[{ id: "p1", label: "P-1 Controller" }]}
      nameOf={(id) => id}
      today="2026-11-02"
      onChange={vi.fn()}
    />,
  );
  return evaluate;
}

const evaluated = (evaluate: ReturnType<typeof renderFrame>) => evaluate.mock.calls.map(([e]) => e.id);

describe("Compliance frame", () => {
  it("both 62443 tags: one sub-tab each, the CRA edition first and the only one evaluated", () => {
    const evaluate = renderFrame(BOTH);
    expect(screen.getByTestId("compliance-subtab-en-iec-62443-4-2-praa-2026").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("compliance-subtab-iec-62443-4-2-2019").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("heading", { name: "EN IEC 62443-4-2:2019/prAA:2026 (draft)" })).toBeTruthy();
    expect(new Set(evaluated(evaluate))).toEqual(new Set(["en-iec-62443-4-2-praa-2026"]));
  });

  it("switching shows the other edition and is remembered for the next time", () => {
    const evaluate = renderFrame(BOTH);
    fireEvent.click(screen.getByTestId("compliance-subtab-iec-62443-4-2-2019"));
    expect(screen.getByRole("heading", { name: "IEC 62443-4-2:2019" })).toBeTruthy();
    expect(evaluated(evaluate)).toContain("iec-62443-4-2-2019");
    cleanup();

    renderFrame(BOTH);
    expect(screen.getByTestId("compliance-subtab-iec-62443-4-2-2019").getAttribute("aria-selected")).toBe("true");
  });

  it("a remembered sub-tab whose tag was removed falls back to the first standard", () => {
    localStorage.setItem("taraflow.compliance.subTab", "iec-62443-4-2-2019");
    const evaluate = renderFrame(activeStandards({ regulation: [TAG_EN_IEC_62443_CRA] }));
    expect(screen.getByRole("heading", { name: "EN IEC 62443-4-2:2019/prAA:2026 (draft)" })).toBeTruthy();
    expect(new Set(evaluated(evaluate))).toEqual(new Set(["en-iec-62443-4-2-praa-2026"]));
  });

  it("one standard: no sub-tab bar", () => {
    renderFrame(activeStandards({ regulation: [TAG_IEC_62443] }));
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("heading", { name: "IEC 62443-4-2:2019" })).toBeTruthy();
  });
});
