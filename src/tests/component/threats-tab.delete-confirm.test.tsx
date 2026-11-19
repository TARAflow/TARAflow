// src/tests/component/threats-tab.delete-confirm.test.tsx
//
// Manual test 2026-11-19 (TEST-Komponentenimport 16.7): the trash icon of a
// threat deleted it at once. The Threats tab asks first — with the threat,
// and with what goes with it (its risk; a generated threat comes back).

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      typeof o === "object" && o?.defaultValue !== undefined
        ? String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? ""))
        : k,
    i18n: { language: "en", exists: () => false },
  }),
}));

// the view stands for the threat tables: its trash icon calls onDelete
vi.mock("features/threats/components/per-element/element-threats-view", () => ({
  ElementThreatsView: ({ onDelete }: { onDelete: (tableIndex: number, threatId: string) => void }) => (
    <button onClick={() => onDelete(0, "t1")}>trash</button>
  ),
}));

import { ThreatsTab } from "features/threats/components/threats-tab";

afterEach(cleanup);

const threat = (source: "manual" | "generated") => ({
  id: "t1",
  displayId: "P1-S-1",
  strideCategory: "S",
  threatDescription: "Spoofing the controller",
  relevance: "relevant",
  source,
  linkedElement: { elementId: "p1", displayId: "P-1" },
});

const project = (source: "manual" | "generated", withRisk: boolean) =>
  ({
    id: "p",
    name: "P",
    phaseStatus: {},
    threats: {
      configuration: { activeMethod: "per-element" },
      perElementTables: [{ trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: [threat(source)] }],
      perInteractionTables: [],
    },
    ...(withRisk ? { riskAttachments: { t1: { mitigationCount: 2 } } } : {}),
  }) as never;

const renderTab = (source: "manual" | "generated", withRisk: boolean) => {
  const onUpdate = vi.fn();
  render(<ThreatsTab project={project(source, withRisk)} dfdContext={{ isDummy: () => true } as never} onUpdate={onUpdate} />);
  return onUpdate;
};

describe("ThreatsTab — delete one threat", () => {
  it("asks first; Cancel keeps the threat", () => {
    const onUpdate = renderTab("manual", false);
    fireEvent.click(screen.getByText("trash"));
    expect(screen.getByText("Delete threat P1-S-1?")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Delete threat P1-S-1?")).toBeNull();
    const deleted = onUpdate.mock.calls.some(([u]) => (u.threats?.perElementTables?.[0]?.threats ?? [1]).length === 0);
    expect(deleted).toBe(false);
  });

  it("Delete deletes it", () => {
    const onUpdate = renderTab("manual", false);
    fireEvent.click(screen.getByText("trash"));
    fireEvent.click(screen.getByText("Delete"));
    const deleted = onUpdate.mock.calls.some(([u]) => u.threats?.perElementTables?.[0]?.threats?.length === 0);
    expect(deleted).toBe(true);
  });

  it("says what goes with it: its risk; a generated threat comes back", () => {
    renderTab("generated", true);
    fireEvent.click(screen.getByText("trash"));
    expect(screen.getByText(/Its risk, with the ratings and mitigations chosen there, goes with the next risk sync/)).toBeTruthy();
    expect(screen.getByText(/A generated threat comes back with the next regeneration/)).toBeTruthy();
  });
});
