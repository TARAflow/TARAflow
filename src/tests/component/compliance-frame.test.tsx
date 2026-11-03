// src/tests/component/compliance-frame.test.tsx
//
// The Compliance frame (model-coverage-implementation-plan.md §2.2, CM-2):
// one sub-tab per active standard (K-1), only the selected one evaluated,
// the last sub-tab remembered per viewer, no sub-tab bar for one standard.
// EN 50742 A (CM-11): its own sub-tab without SL table, SL-T or component.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeStandards,
  ComplianceFrame,
  evaluateMatrix,
  TAG_EN_50742_A,
  TAG_EN_IEC_62443_CRA,
  TAG_IEC_62443,
  type AnyEdition,
  type En50742View,
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

function renderFrame(standards: readonly StandardModule[], en50742?: En50742View) {
  const evaluate = vi.fn((edition: AnyEdition) => {
    const input = {
      edition,
      view: { elements: [{ id: "p1", type: "Process", properties: {} }], flows: [] },
      scope: new Set(["p1"]),
      ...(en50742 && edition.family === "en-50742" ? { en50742 } : {}),
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

  it("EN 50742 A next to the 62443 editions: a sub-tab of its own, last in registry order", () => {
    renderFrame(activeStandards({ regulation: [TAG_IEC_62443, "EN50742_A"] }));
    const tabs = screen.getAllByRole("tab").map((t) => t.getAttribute("data-testid"));
    expect(tabs).toEqual(["compliance-subtab-iec-62443-4-2-2019", "compliance-subtab-en-50742-a"]);
  });

  it("EN 50742 A: status summary and groups instead of SL table, SL-T and component", () => {
    renderFrame(activeStandards({ regulation: [TAG_EN_50742_A] }));
    expect(screen.getByRole("heading", { name: "prEN 50742:2025 Approach A (draft)" })).toBeTruthy();
    expect(screen.queryByTestId("compliance-vector")).toBeNull();
    expect(screen.queryByTestId("compliance-component")).toBeNull();
    expect(screen.queryByText("SL-C from")).toBeNull();
    expect(screen.getByText("Scope: the whole machine")).toBeTruthy();
    expect(screen.getByTestId("compliance-summary-needs-statement")).toBeTruthy();
    // The to-do list needs no target: open rows are listed right away.
    expect(screen.queryByText("Set the SL-T above — the to-do list shows what is open up to it.")).toBeNull();
    expect(screen.getByText("To do")).toBeTruthy();
    const row = screen.getByTestId("compliance-row-EN-7.3.1/281");
    expect(row.textContent).toContain("information-collection");
  });

  it("EN 50742 A with risks: SRSL per safety function in the header, risks in the notes and the to-do list (CM-12)", () => {
    renderFrame(activeStandards({ regulation: [TAG_EN_50742_A] }), {
      windowOfOpportunity: "limited",
      systemDefinition: { boundary: true, environment: false },
      hazards: { total: 1, unlinked: [] },
      safetyFunctions: [{ id: "sf1", name: "Emergency stop" }, { id: "sf2", name: "Guard door" }],
      interfaces: { exposed: [], unrated: [] },
      risks: [
        {
          id: "r1",
          label: "R-IF-1-S-1",
          anchorId: "if1",
          safetyFunctionIds: ["sf1"],
          srsl: 2,
          exposed: true,
          mandated: ["7.4.3.2.1"],
          anyOfMandated: false,
          controls: [],
          accepted: false,
          excluded: false,
        },
      ],
    });
    expect(screen.getByTestId("compliance-srsl-sf1").textContent).toContain("SRSL2");
    expect(screen.getByTestId("compliance-srsl-sf2").textContent).toContain("not rated");
    expect(screen.getByTestId("compliance-row-EN-7.4.3.2.1/356–360").textContent).toContain("R-IF-1-S-1");
    expect(screen.getByTestId("compliance-todo-risks").textContent).toContain("R-IF-1-S-1");
    // Project data still missing (operational environment) is listed with what is missing.
    expect(screen.getByTestId("compliance-todo-project").textContent).toContain("operational environment");
  });

  it("one standard: no sub-tab bar", () => {
    renderFrame(activeStandards({ regulation: [TAG_IEC_62443] }));
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("heading", { name: "IEC 62443-4-2:2019" })).toBeTruthy();
  });
});
