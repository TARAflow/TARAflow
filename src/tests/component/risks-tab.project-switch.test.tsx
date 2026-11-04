// src/tests/component/risks-tab.project-switch.test.tsx
//
// Regression: switching projects while the Risk tab is open must never write
// the outgoing project's risks into the incoming project.
//
// Reported (0.17.1): open project A, open the Risk tab, open project B and its
// Risk tab, close B → A suddenly contained all of B's risks. The workspace
// rendered one RisksTab instance for every project, so a project switch was a
// prop-only swap: effects that depend on the incoming project's data (here the
// asset criterion weights, design §5.3) ran against the outgoing project's
// local riskData, marked it dirty, and the debounced auto-save handed it to an
// update handler that resolved its target as "whatever is active now".
//
// RisksTab now keys its view by project id (a switch is an unmount/mount), the
// workspace pins the update handler to that id, and the view flushes a pending
// edit on unmount. The tests render the tab WITHOUT a key on purpose — the
// prop-only swap the workspace used to do — with one handler per project.

import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RisksTab } from "features/risks/components/risks-tab";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData, RiskProjectData, RiskUpdateResult } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
// Leaf UI is irrelevant here; only the tab's state and save logic are under test.
vi.mock("features/risks/components/risk-table-view", () => ({ RiskTableView: () => null }));
vi.mock("features/risks/components/risk-matrix", () => ({ RiskMatrix: () => null }));
vi.mock("features/risks/components/wont-risk-table", () => ({ WontRiskTable: () => null }));
vi.mock("features/risks/components/risk-dialog", () => ({ RiskDialog: () => null }));
vi.mock("features/risks/components/risk-config-dialog", () => ({ RiskConfigDialog: () => null }));
vi.mock("features/risks/components/risk-mitigation-status-dialog", () => ({ RiskMitigationStatusDialog: () => null }));
vi.mock("features/risks/components/goals-claims-dialog", () => ({ GoalsClaimsDialog: () => null }));

const ratings = () => DEFAULT_CONFIGURATION.activeFactors.map((af) => ({ factorId: af.factorId, value: 2, weight: af.weight }));
const risk = (id: string) => ({
  id,
  threatId: `${id}-threat`,
  threatDisplayId: `${id}-T`,
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
  calculatedRiskBeforeMitigation: 0,
  selectedMitigations: [],
  selectedVerifications: [],
  mitigatedFactorRatings: ratings(),
  calculatedRiskAfterMitigation: 0,
  treatment: "reduce",
  treatmentJustification: "",
  moscowPriority: "must",
  wontJustification: "",
  riskBeforeRationale: "",
  riskAfterRationale: "",
  created: "2026-11-01T00:00:00.000Z",
  lastModified: "2026-11-01T00:00:00.000Z",
});

function riskData(ids: string[], weightSource?: "asset" | "risk"): RiskData {
  return {
    configuration: { ...DEFAULT_CONFIGURATION, ...(weightSource ? { impactWeightSource: weightSource } : {}) },
    risks: ids.map(risk),
    lastModified: "2026-11-01T00:00:00.000Z",
  } as unknown as RiskData;
}

function project(id: string, data: RiskData, criterionWeights: Record<string, number>): RiskProjectData {
  return {
    id,
    name: id,
    risks: data,
    phaseStatus: {},
    perElementThreats: [],
    perInteractionThreats: [],
    lastModified: "2026-11-01T00:00:00.000Z",
    assetDataRef: { assets: [], criterionWeights } as unknown as RiskProjectData["assetDataRef"],
  } as unknown as RiskProjectData;
}

const impactFactor = DEFAULT_CONFIGURATION.activeFactors.find((af) => af.factorId === "safety")!.factorId;

// B follows the asset weights; A's asset weights differ — exactly the effect
// that used to re-weigh the OUTGOING project's risks on a prop-only swap.
const A = project("project-a", riskData(["a-1"]), { [impactFactor]: 3 });
const B = project("project-b", riskData(["b-1", "b-2"], "asset"), { [impactFactor]: 1 });

const idsOf = (u: RiskUpdateResult) => u.risks.risks.map((r) => r.id).sort();

describe("RisksTab — project switch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("closing B never writes B's risks into A (and A's never into B)", () => {
    const updates: Record<string, RiskUpdateResult[]> = { "project-a": [], "project-b": [] };
    const handler = (id: string) => (u: RiskUpdateResult) => { updates[id].push(u); };
    const view = (p: RiskProjectData) => <RisksTab project={p} onUpdate={handler(p.id)} />;

    const { rerender } = render(view(A));
    act(() => { vi.advanceTimersByTime(1500); });
    rerender(view(B));
    act(() => { vi.advanceTimersByTime(1500); });
    rerender(view(A));                       // B closed, A active again
    act(() => { vi.advanceTimersByTime(1500); });

    for (const u of updates["project-a"]) expect(idsOf(u)).toEqual(["a-1"]);
    for (const u of updates["project-b"]) expect(idsOf(u)).toEqual(["b-1", "b-2"]);
  });

  it("flushes a pending edit to the outgoing project on unmount", () => {
    const updates: Record<string, RiskUpdateResult[]> = { "project-a": [], "project-b": [] };
    const handler = (id: string) => (u: RiskUpdateResult) => { updates[id].push(u); };
    const view = (p: RiskProjectData) => <RisksTab project={p} onUpdate={handler(p.id)} />;

    // A without weight source and without risks switches to the asset weights
    // on mount (design §5.3) — a pending edit inside the debounce window.
    const empty = project("project-a", riskData([]), { [impactFactor]: 3 });
    const { rerender } = render(view(empty));
    rerender(view(B));                       // switch before the auto-save fired

    expect(updates["project-a"]).toHaveLength(1);
    expect(updates["project-a"][0].risks.configuration.impactWeightSource).toBe("asset");
    for (const u of updates["project-b"]) expect(idsOf(u)).toEqual(["b-1", "b-2"]);
  });
});
