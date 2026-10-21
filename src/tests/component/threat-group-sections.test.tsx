// src/tests/component/threat-group-sections.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): threat
// tables grouped per top-level decomposed multiprocess, trust-boundary
// tables inside, flows between two groups in both, original table index
// kept for editing.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ThreatGroupSections,
  endpointLabelFor,
} from "features/threats/components/shared/threat-group-sections";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import type { Threat, ThreatTable } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const threat = (
  id: string,
  ref: { elementId?: string; connectionId?: string; victim?: "source" | "target" },
  strideCategory = "S",
) =>
  ({
    id,
    displayId: id,
    strideCategory,
    linkedElement: ref.elementId ? { elementId: ref.elementId } : null,
    // DF-7 runs P-2 (MP-1) → P-5 (MP-2).
    dataFlow: ref.connectionId ? { connectionId: ref.connectionId, sourceId: "p2", targetId: "p5" } : null,
    ...(ref.victim ? { interactionContext: { victimRole: ref.victim } } : {}),
  }) as unknown as Threat;

const table = (name: string, threats: Threat[]): ThreatTable => ({
  trustBoundaryId: name,
  trustBoundaryName: name,
  displayIdentifier: name,
  threats,
});

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1 Sensor" },
    { key: "mp2", label: "MP-2 Controller" },
  ],
  elementGroup: { ee1: TOP_LEVEL_GROUP, p2: "mp1", p5: "mp2" },
  // DF-7 runs P-2 (MP-1) → P-5 (MP-2): between groups → top level (D20).
  flowGroups: { df7: [TOP_LEVEL_GROUP] },
};

const TABLES = [
  table("SB", [
    threat("T-p2", { elementId: "p2" }),
    threat("T-p2b", { elementId: "p2" }, "T"),
    threat("T-df7", { connectionId: "df7" }),
  ]),
  table("CB", [threat("T-p5", { elementId: "p5" }), threat("T-gone", { elementId: "gone" })]),
  table("none", [threat("T-ee1", { elementId: "ee1" })]),
];

const renderTable = (t: ThreatTable, index: number, groupKey: string) => (
  <div key={`${groupKey}-${index}`} data-testid={`table-${groupKey}-${index}`}>
    {t.threats.map((x) => x.id).join(",")}
  </div>
);

describe("ThreatGroupSections", () => {
  it("shows every threat once: flows between groups only on the top level", () => {
    render(<ThreatGroupSections groups={GROUPS} tables={TABLES} renderTable={renderTable} />);
    const top = screen.getByTestId(`threat-group-${TOP_LEVEL_GROUP}`);
    expect(within(top).getByText("Top level")).toBeTruthy();
    expect(within(top).getByTestId(`table-${TOP_LEVEL_GROUP}-0`).textContent).toBe("T-df7");
    expect(within(top).getByTestId(`table-${TOP_LEVEL_GROUP}-2`).textContent).toBe("T-ee1");

    const mp1 = screen.getByTestId("threat-group-mp1");
    expect(within(mp1).getByTestId("table-mp1-0").textContent).toBe("T-p2,T-p2b");
    const mp2 = screen.getByTestId("threat-group-mp2");
    // Table index kept: CB is table 1. DF-7 is not repeated here.
    expect(within(mp2).queryByTestId("table-mp2-0")).toBeNull();
    expect(within(mp2).getByTestId("table-mp2-1").textContent).toBe("T-p5");
  });

  it("summarises each multiprocess on the top level and opens it on Details", () => {
    render(<ThreatGroupSections groups={GROUPS} tables={TABLES} renderTable={renderTable} />);
    const summary = screen.getByTestId("threat-group-summary-mp1");
    expect(summary.textContent).toContain("MP-1 Sensor");
    expect(summary.textContent).toContain("2 threat(s) of its parts — S 1 · T 1 · R 0 · I 0 · D 0 · E 0");

    // Collapse MP-1, then "Details" opens it again.
    const mp1 = screen.getByTestId("threat-group-mp1");
    fireEvent.click(within(mp1).getByText("MP-1 Sensor"));
    expect(mp1.querySelector('[aria-expanded="false"]')).not.toBeNull();
    fireEvent.click(within(summary).getByText("Details"));
    expect(mp1.querySelector('[aria-expanded="true"]')).not.toBeNull();
  });

  it("puts a per-interaction threat of a flow between multiprocesses on the side it attacks", () => {
    const tables = [
      table("CB", [threat("T-in", { connectionId: "df7", victim: "target" })]),
      table("SB", [threat("T-out", { connectionId: "df7", victim: "source" })]),
    ];
    render(<ThreatGroupSections groups={GROUPS} tables={tables} renderTable={renderTable} />);
    // IN at the receiver P-5 (MP-2), OUT at the sender P-2 (MP-1).
    expect(within(screen.getByTestId("threat-group-mp2")).getByTestId("table-mp2-0").textContent).toBe("T-in");
    expect(within(screen.getByTestId("threat-group-mp1")).getByTestId("table-mp1-1").textContent).toBe("T-out");
    expect(screen.queryByTestId(`threat-group-${TOP_LEVEL_GROUP}`)).toBeNull();
  });

  it("labels a flow end that lies in another multiprocess", () => {
    const top = endpointLabelFor(GROUPS, TOP_LEVEL_GROUP)!;
    expect(top("p2", "P-1.1")).toBe("P-1.1 (in MP-1 Sensor)");
    expect(top("ee1", "EE-1")).toBe("EE-1");
    const mp1 = endpointLabelFor(GROUPS, "mp1")!;
    expect(mp1("p5", "P-3.1")).toBe("P-3.1 (in MP-2 Controller)");
    expect(mp1("p2", "P-1.1")).toBe("P-1.1");
    expect(mp1("ee1", "EE-1")).toBe("EE-1");
    expect(endpointLabelFor(undefined, TOP_LEVEL_GROUP)).toBeUndefined();
    expect(endpointLabelFor(GROUPS, "")).toBeUndefined();
  });

  it("collects threats of elements no longer in the DFD", () => {
    render(<ThreatGroupSections groups={GROUPS} tables={TABLES} renderTable={renderTable} />);
    const gone = screen.getByTestId("threat-group-__not_in_dfd__");
    expect(within(gone).getByText("Not in the DFD")).toBeTruthy();
    expect(within(gone).getByTestId("table-__not_in_dfd__-1").textContent).toBe("T-gone");
  });

  it("renders the tables as before without groups", () => {
    render(<ThreatGroupSections tables={TABLES} renderTable={renderTable} />);
    expect(screen.queryByTestId(`threat-group-${TOP_LEVEL_GROUP}`)).toBeNull();
    expect(screen.getByTestId("table--1").textContent).toBe("T-p5,T-gone");
    expect(screen.queryByTestId("threat-group-summaries")).toBeNull();
  });
});
