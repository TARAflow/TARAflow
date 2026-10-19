// src/tests/component/risk-group-sections.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6b, D20): risks
// grouped like their threats — one accordion per top-level decomposed
// multiprocess plus "Top level", summary rows per multiprocess on the top
// level, risks without a threat in the DFD under "Not in the DFD".
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskGroupSections } from "features/risks/components/risk-group-sections";
import { RISK_NOT_IN_DFD, riskGroupSections } from "features/risks/utils/risk-groups";
import { TOP_LEVEL_GROUP, type DfdTableGroups, type ThreatReference } from "shared";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1 Sensor" },
    { key: "mp2", label: "MP-2 Controller" },
  ],
  elementGroup: { ee1: TOP_LEVEL_GROUP, p2: "mp1", p5: "mp2" },
  // DF-7 runs P-2 (MP-1) → P-5 (MP-2): between groups → top level.
  flowGroups: { df7: [TOP_LEVEL_GROUP], df9: ["mp1"] },
};

const threat = (id: string, ref: { elementId?: string; connectionId?: string }) =>
  ({
    id,
    linkedElement: ref.elementId ? { elementId: ref.elementId } : null,
    dataFlow: ref.connectionId ? { connectionId: ref.connectionId } : null,
  }) as unknown as ThreatReference;

const THREATS = [
  threat("t-p2", { elementId: "p2" }),
  threat("t-df9", { connectionId: "df9" }),
  threat("t-df7", { connectionId: "df7" }),
  threat("t-p5", { elementId: "p5" }),
  threat("t-ee1", { elementId: "ee1" }),
  threat("t-gone", { elementId: "gone" }),
  // Per element: a data-flow threat refers to its flow as linkedElement.
  threat("t-df7-el", { elementId: "df7" }),
];

const risk = (id: string, threatId: string, before = 0) =>
  ({ id, threatId, calculatedRiskBeforeMitigation: before, selectedMitigations: [] }) as unknown as Risk;

const RISKS = [
  risk("r-p2", "t-p2", 4),
  risk("r-df9", "t-df9", 2),
  risk("r-df7", "t-df7"),
  risk("r-p5", "t-p5"),
  risk("r-ee1", "t-ee1"),
  risk("r-gone", "t-gone"),
  risk("r-df7-el", "t-df7-el"),
  // Its threat was deleted.
  risk("r-orphan", "t-deleted"),
];

const CONFIG = { scale: "4-level", roundingMethod: "round" } as unknown as RiskConfiguration;

const ids = (risks: Risk[]) => risks.map((r) => r.id);

describe("riskGroupSections", () => {
  it("puts every risk into its threat's group, top level first", () => {
    const sections = riskGroupSections(GROUPS, RISKS, THREATS);
    expect(sections.map((s) => [s.key, ids(s.risks)])).toEqual([
      [TOP_LEVEL_GROUP, ["r-df7", "r-ee1", "r-df7-el"]],
      ["mp1", ["r-p2", "r-df9"]],
      ["mp2", ["r-p5"]],
      [RISK_NOT_IN_DFD, ["r-gone", "r-orphan"]],
    ]);
  });

  it("leaves out groups without risks", () => {
    const sections = riskGroupSections(GROUPS, [risk("r-p5", "t-p5")], THREATS);
    expect(sections.map((s) => s.key)).toEqual(["mp2"]);
  });
});

const renderView = (risks: Risk[], groupKey: string) => (
  <div data-testid={`view-${groupKey}`}>{ids(risks).join(",")}</div>
);

describe("RiskGroupSections", () => {
  it("renders the view once per group with the group's risks", () => {
    render(
      <RiskGroupSections groups={GROUPS} risks={RISKS} threats={THREATS} configuration={CONFIG} renderView={renderView} />,
    );
    expect(screen.getByTestId(`view-${TOP_LEVEL_GROUP}`).textContent).toBe("r-df7,r-ee1,r-df7-el");
    expect(screen.getByTestId("view-mp1").textContent).toBe("r-p2,r-df9");
    expect(screen.getByTestId("view-mp2").textContent).toBe("r-p5");
    expect(screen.getByTestId(`view-${RISK_NOT_IN_DFD}`).textContent).toBe("r-gone,r-orphan");
    expect(within(screen.getByTestId(`risk-group-${RISK_NOT_IN_DFD}`)).getByText("Not in the DFD")).toBeTruthy();
  });

  it("shows a summary row per multiprocess on the top level; Details opens the group", () => {
    render(
      <RiskGroupSections groups={GROUPS} risks={RISKS} threats={THREATS} configuration={CONFIG} renderView={renderView} />,
    );
    const top = screen.getByTestId(`risk-group-${TOP_LEVEL_GROUP}`);
    const row = within(top).getByTestId("risk-group-summary-mp1");
    expect(row.textContent).toContain("MP-1 Sensor");
    expect(row.textContent).toContain("2 risk(s) of its parts");
    // Risk levels before mitigation: one at level 4, one at level 2.
    expect(row.textContent).toContain("×1");
    expect(within(top).queryByTestId(`risk-group-summary-${RISK_NOT_IN_DFD}`)).toBeNull();

    // Collapse MP-1, then "Details" opens it again.
    const mp1 = screen.getByTestId("risk-group-mp1");
    fireEvent.click(within(mp1).getByText("MP-1 Sensor"));
    expect(screen.queryByTestId("view-mp1")).toBeNull();
    fireEvent.click(within(row).getByText("Details"));
    expect(screen.getByTestId("view-mp1").textContent).toBe("r-p2,r-df9");
  });

  it("renders the view unchanged without groups", () => {
    render(
      <RiskGroupSections risks={RISKS} threats={THREATS} configuration={CONFIG} renderView={renderView} />,
    );
    expect(screen.getByTestId("view-").textContent).toBe(ids(RISKS).join(","));
    expect(screen.queryByTestId(`risk-group-${TOP_LEVEL_GROUP}`)).toBeNull();
  });
});
