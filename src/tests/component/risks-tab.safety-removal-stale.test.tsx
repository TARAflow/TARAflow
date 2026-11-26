// src/tests/component/risks-tab.safety-removal-stale.test.tsx
//
// "Safety Factor Source Removed" asks only while the project really has no
// safety data (0.20 manual test, 2026-11-23): SmokeDetectorCase carried a
// stored pendingSafetySourceRemoval from a 0.19 test session although all its
// assets were rated for safety — the dialog asked, and "Remove" would have
// cleared every safety rating. A stale flag is dropped silently.

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RisksTab } from "features/risks/components/risks-tab";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData, RiskProjectData } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
vi.mock("features/risks/components/risk-table-view", () => ({ RiskTableView: () => null }));
vi.mock("features/risks/components/risk-matrix", () => ({ RiskMatrix: () => null }));
vi.mock("features/risks/components/wont-risk-table", () => ({ WontRiskTable: () => null }));
vi.mock("features/risks/components/risk-dialog", () => ({ RiskDialog: () => null }));
vi.mock("features/risks/components/risk-config-dialog", () => ({ RiskConfigDialog: () => null }));
vi.mock("features/risks/components/risk-mitigation-status-dialog", () => ({ RiskMitigationStatusDialog: () => null }));
vi.mock("features/risks/components/goals-claims-dialog", () => ({ GoalsClaimsDialog: () => null }));

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const TITLE = "Safety Factor Source Removed";

function riskData(): RiskData {
  return {
    configuration: {
      ...DEFAULT_CONFIGURATION,
      activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) =>
        f.factorId === "safety" ? { ...f, enabled: true, autoEnabled: true } : f,
      ),
      pendingSafetySourceRemoval: true,
      // already on the asset weights, so mounting the tab changes nothing else
      impactWeightSource: "asset",
    },
    risks: [],
    lastModified: "2026-11-20T00:00:00.000Z",
  } as unknown as RiskData;
}

function project(assets: unknown[]): RiskProjectData {
  return {
    id: "case",
    name: "Smoke Detector Case",
    risks: riskData(),
    phaseStatus: {},
    perElementThreats: [],
    perInteractionThreats: [],
    lastModified: "2026-11-20T00:00:00.000Z",
    assetDataRef: { assets, criterionWeights: {} } as unknown as RiskProjectData["assetDataRef"],
  } as unknown as RiskProjectData;
}

const safetyRated = { id: "DA-1", name: "smoke meas data", impactRatings: [{ criterionId: "safety", value: 3 }] };
const notSafety = { id: "DA-2", name: "log", impactRatings: [{ criterionId: "financial_damage", value: 2 }] };

describe("RisksTab — a stored 'safety source removed' flag", () => {
  it("does not ask when the project has safety data, and does not save for it", () => {
    const onUpdate = vi.fn();
    render(<RisksTab project={project([safetyRated])} onUpdate={onUpdate} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("asks when the safety data really is gone", () => {
    render(<RisksTab project={project([notSafety])} onUpdate={() => {}} />);
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByText(TITLE)).toBeTruthy();
  });
});
