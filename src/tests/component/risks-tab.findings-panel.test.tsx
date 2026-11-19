// src/tests/component/risks-tab.findings-panel.test.tsx
//
// Manual test 2026-11-15: "Component SDC1 …: 1 risk(s) override a factor
// value … without a rationale" was shown in the DFD tab. The Risks tab has a
// findings panel like the DFD, Asset and Hazard tabs now: its own findings
// and those about its risks from imported components; a click opens the
// risks concerned in the risk dialog, browsing only them.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RisksTab } from "features/risks/components/risks-tab";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData, RiskProjectData } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, n) => String(options?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
const dialogProps: { risks?: { id: string }[]; initialIndex?: number }[] = [];
vi.mock("features/risks/components/risk-dialog", () => ({
  RiskDialog: (props: { risks: { id: string }[]; initialIndex: number }) => {
    dialogProps.push(props);
    return <div data-testid="risk-dialog" />;
  },
}));
vi.mock("features/risks/components/risk-table-view", () => ({ RiskTableView: () => null }));
vi.mock("features/risks/components/risk-matrix", () => ({ RiskMatrix: () => null }));
vi.mock("features/risks/components/wont-risk-table", () => ({ WontRiskTable: () => null }));
vi.mock("features/risks/components/risk-config-dialog", () => ({ RiskConfigDialog: () => null }));
vi.mock("features/risks/components/risk-mitigation-status-dialog", () => ({ RiskMitigationStatusDialog: () => null }));
vi.mock("features/risks/components/goals-claims-dialog", () => ({ GoalsClaimsDialog: () => null }));

afterEach(() => {
  cleanup();
  dialogProps.length = 0;
});

const ratings = () => DEFAULT_CONFIGURATION.activeFactors.map((af) => ({ factorId: af.factorId, value: 2, weight: af.weight }));
const risk = (id: string, threatDisplayId: string, before: number) => ({
  id,
  threatId: `${id}-threat`,
  threatDisplayId,
  threatDescription: "",
  attackDescription: "",
  threatRelevance: "relevant",
  proposedMitigations: [],
  proposedVerifications: [],
  strideCategory: "Tampering",
  sourceStrideMethod: "per-element",
  factorRatings: ratings(),
  calculatedImpact: 0,
  calculatedLikelihood: 0,
  calculatedRiskBeforeMitigation: before,
  selectedMitigations: [],
  selectedVerifications: [],
  mitigatedFactorRatings: ratings(),
  calculatedRiskAfterMitigation: 0,
  treatment: "accept",
  treatmentJustification: "ok",
  moscowPriority: "must",
  wontJustification: "",
  riskBeforeRationale: "",
  riskAfterRationale: "",
  created: "2026-11-01T00:00:00.000Z",
  lastModified: "2026-11-01T00:00:00.000Z",
});
const threat = (id: string, displayId: string) => ({
  id,
  displayId,
  strideCategory: "T",
  threatDescription: "",
  attackDescription: "",
  sourceStrideMethod: "per-element",
  relevance: "relevant",
  proposedMitigations: [],
  proposedVerifications: [],
  trustBoundaryId: null,
  trustBoundaryName: null,
});

// r-b (SDC1:DF8) and r-a (SDC1:DF7) are unrated; r-c is rated
const project = {
  id: "p",
  name: "p",
  risks: {
    configuration: DEFAULT_CONFIGURATION,
    risks: [risk("r-b", "SDC1:DF8-T-1", 0), risk("r-c", "P-1-T-1", 3), risk("r-a", "SDC1:DF7-T-1", 0)],
    lastModified: "2026-11-01T00:00:00.000Z",
  } as unknown as RiskData,
  phaseStatus: {},
  perElementThreats: [threat("r-a-threat", "SDC1:DF7-T-1"), threat("r-b-threat", "SDC1:DF8-T-1"), threat("r-c-threat", "P-1-T-1")],
  perInteractionThreats: [],
  lastModified: "2026-11-01T00:00:00.000Z",
  assetDataRef: { assets: [], criterionWeights: {} },
  externalFindings: [
    {
      id: "component-0",
      severity: "warning",
      text: "Component SDC1 (Smoke Detector Case): 1 risk(s) override a factor value taken over from the component without a rationale.",
      threatIds: ["r-b-threat"],
    },
  ],
} as unknown as RiskProjectData;

const rows = () => screen.getAllByTestId("risk-notification-row");
const row = (text: string) => rows().find((r) => r.textContent?.includes(text))!;

describe("RisksTab — findings panel", () => {
  it("lists the tab's own findings and those from imported components", () => {
    render(<RisksTab project={project} onUpdate={vi.fn()} />);
    expect(screen.getByTestId("risk-notification-panel")).toBeTruthy();
    expect(row("have not been rated")).toBeTruthy();
    expect(row("override a factor value")).toBeTruthy();
  });

  it("a component finding opens its risk in the dialog", () => {
    render(<RisksTab project={project} onUpdate={vi.fn()} />);
    fireEvent.click(row("override a factor value"));
    expect(screen.getByTestId("risk-dialog")).toBeTruthy();
    const last = dialogProps.at(-1)!;
    expect(last.risks!.map((r) => r.id)).toEqual(["r-b"]);
    expect(last.initialIndex).toBe(0);
  });

  it("an own finding opens the risks concerned, by threat id, browsing only them", () => {
    render(<RisksTab project={project} onUpdate={vi.fn()} />);
    fireEvent.click(row("have not been rated"));
    expect(dialogProps.at(-1)!.risks!.map((r) => r.id)).toEqual(["r-a", "r-b"]);
  });

  it("nothing to report: no rows", () => {
    const quiet = {
      ...project,
      externalFindings: [],
      risks: { ...project.risks!, risks: [risk("r-c", "P-1-T-1", 3)] },
      perElementThreats: [threat("r-c-threat", "P-1-T-1")],
    } as unknown as RiskProjectData;
    render(<RisksTab project={quiet} onUpdate={vi.fn()} />);
    expect(screen.queryAllByTestId("risk-notification-row")).toHaveLength(0);
  });
});
