// src/tests/component/threat-dialog.order.test.tsx
//
// Manual test 2026-11-16 (evaluating the redrawn DF-8 in the component):
// "Confirm →" jumped back instead of following the list, and the list was
// in no order one could follow (impact only, then generation order). The
// dialog now lists the trust-boundary table like the table groups it — per
// element / flow in natural order, a heading each — and a decision goes to
// the next open threat of the same element / flow, then on.
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ThreatEvalDialog,
  dialogThreatOrder,
  nextOpenIndex,
} from "features/threats/components/shared/threat-dialog";
import { createEmptyThreat, type Threat, type StrideCategory } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(options?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
Element.prototype.scrollIntoView = vi.fn();
afterEach(cleanup);

const flowThreat = (flow: string, stride: StrideCategory, relevance: Threat["relevance"] = "unrated"): Threat => ({
  ...createEmptyThreat(`${flow}-${stride}`, stride, null, "Sensor Board", "SB"),
  displayId: `${flow.replace("-", "")}-${stride}-1`,
  threatDescription: `${flow} ${stride}`,
  linkedElement: { elementId: flow.toLowerCase(), displayId: flow, elementName: `flow ${flow}`, elementType: "DataFlow" },
  relevance,
});

// stored in generation order: DF-10, DF-8, DF-2 — mixed STRIDE
const STORED = [
  flowThreat("DF-10", "T"),
  flowThreat("DF-8", "D"),
  flowThreat("DF-8", "T"),
  flowThreat("DF-2", "I", "relevant"),
  flowThreat("DF-8", "I"),
  flowThreat("DF-2", "T"),
];
const ids = (list: readonly Threat[]) => list.map((t) => t.displayId);

describe("order and navigation (pure)", () => {
  it("per element / flow in natural order, inside by STRIDE", () => {
    expect(ids(dialogThreatOrder(STORED))).toEqual(["DF2-T-1", "DF2-I-1", "DF8-T-1", "DF8-I-1", "DF8-D-1", "DF10-T-1"]);
  });

  it("next open: the same flow first (after, then before), then the next flow", () => {
    const list = dialogThreatOrder(STORED);
    const at = (displayId: string) => list.findIndex((t) => t.displayId === displayId);
    // from DF8-I-1: DF8-D-1 (after, same flow)
    expect(list[nextOpenIndex(list, at("DF8-I-1"))].displayId).toBe("DF8-D-1");
    // from DF8-D-1: DF8-T-1 (before, same flow) before DF10
    expect(list[nextOpenIndex(list, at("DF8-D-1"))].displayId).toBe("DF8-T-1");
    // nothing open in DF-8 any more → on to DF-10
    const rated = list.map((t) => (t.displayId.startsWith("DF8") ? { ...t, relevance: "relevant" as const } : t));
    expect(rated[nextOpenIndex(rated, at("DF8-T-1"))].displayId).toBe("DF10-T-1");
    // none open → -1
    expect(nextOpenIndex(list.map((t) => ({ ...t, relevance: "relevant" as const })), 0)).toBe(-1);
  });
});

/** The tab's wiring: a save updates the list (a new array) — the case that sent "Confirm" back. */
const Harness: React.FC<{ opened: string }> = ({ opened }) => {
  const [threats, setThreats] = useState(STORED);
  return (
    <ThreatEvalDialog
      open
      threats={threats}
      initialIndex={threats.findIndex((t) => t.displayId === opened)}
      configuration={{} as never}
      onSave={(id, updates) => setThreats((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))}
      onClose={vi.fn()}
    />
  );
};
const items = () => screen.getAllByTestId("threat-dialog-item");
const current = () => items().find((el) => el.classList.contains("Mui-selected"))!.textContent ?? "";

describe("ThreatEvalDialog — list and Confirm", () => {
  it("the list follows the table: a heading per flow, natural order", () => {
    render(<Harness opened="DF8-T-1" />);
    expect(screen.getAllByTestId("threat-dialog-group").map((h) => h.textContent)).toEqual([
      "DF-2 flow DF-2",
      "DF-8 flow DF-8",
      "DF-10 flow DF-10",
    ]);
    expect(items().map((el) => el.textContent?.match(/DF\d+-[STRIDE]-1/)?.[0])).toEqual([
      "DF2-T-1",
      "DF2-I-1",
      "DF8-T-1",
      "DF8-I-1",
      "DF8-D-1",
      "DF10-T-1",
    ]);
  });

  // the dialog ignores a second decision within 300 ms (double-click guard)
  const confirm = async () => {
    fireEvent.click(screen.getByText("Confirm"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 320));
    });
  };

  it("Confirm goes on through the flow, not back to the opened threat", async () => {
    render(<Harness opened="DF8-T-1" />);
    expect(current()).toContain("DF8-T-1");
    await confirm();
    expect(current()).toContain("DF8-I-1");
    await confirm();
    expect(current()).toContain("DF8-D-1");
    await confirm();
    // DF-8 done → the next open threat after it
    expect(current()).toContain("DF10-T-1");
  });
});
