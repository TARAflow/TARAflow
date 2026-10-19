// src/tests/component/threat-group-sections.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): threat
// tables grouped per top-level decomposed multiprocess, trust-boundary
// tables inside, flows between two groups in both, original table index
// kept for editing.
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreatGroupSections } from "features/threats/components/shared/threat-group-sections";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import type { Threat, ThreatTable } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const threat = (id: string, ref: { elementId?: string; connectionId?: string }) =>
  ({
    id,
    displayId: id,
    linkedElement: ref.elementId ? { elementId: ref.elementId } : null,
    dataFlow: ref.connectionId ? { connectionId: ref.connectionId } : null,
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
  flowGroups: { df7: ["mp1", "mp2"] },
};

const TABLES = [
  table("SB", [threat("T-p2", { elementId: "p2" }), threat("T-df7", { connectionId: "df7" })]),
  table("CB", [threat("T-p5", { elementId: "p5" }), threat("T-gone", { elementId: "gone" })]),
  table("none", [threat("T-ee1", { elementId: "ee1" })]),
];

const renderTable = (t: ThreatTable, index: number, groupKey: string) => (
  <div key={`${groupKey}-${index}`} data-testid={`table-${groupKey}-${index}`}>
    {t.threats.map((x) => x.id).join(",")}
  </div>
);

describe("ThreatGroupSections", () => {
  it("groups per multiprocess, keeps the table index, flows in both groups", () => {
    render(<ThreatGroupSections groups={GROUPS} tables={TABLES} renderTable={renderTable} />);
    const top = screen.getByTestId(`threat-group-${TOP_LEVEL_GROUP}`);
    expect(within(top).getByText("Top level")).toBeTruthy();
    expect(within(top).getByTestId(`table-${TOP_LEVEL_GROUP}-2`).textContent).toBe("T-ee1");

    const mp1 = screen.getByTestId("threat-group-mp1");
    expect(within(mp1).getByTestId("table-mp1-0").textContent).toBe("T-p2,T-df7");
    const mp2 = screen.getByTestId("threat-group-mp2");
    // Table 0 (SB) carries DF-7 for MP-2 too; index 1 = CB.
    expect(within(mp2).getByTestId("table-mp2-0").textContent).toBe("T-df7");
    expect(within(mp2).getByTestId("table-mp2-1").textContent).toBe("T-p5");
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
  });
});
