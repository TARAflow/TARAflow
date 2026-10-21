// Leveled-DFD Phase 6f: the threat filters also filter by page and
// analysis state; "clear" resets them.
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useThreatFilters } from "features/threats/hooks/shared/use-threat-filters";
import { useRiskFilters } from "features/risks/hooks/shared/use-risk-filters";
import type { DfdScopeIndex, ThreatReference } from "shared";
import type { Threat } from "features/threats/models/threat-types";
import type { Risk } from "features/risks/models/risk-assessment-types";

const INDEX: DfdScopeIndex = {
  pages: [
    { pageId: "top", name: "Top", depth: 0 },
    { pageId: "sen", name: "Sensor", depth: 1 },
  ],
  itemsOnPage: { top: ["ee1", "mp1", "df1"], sen: ["p1"] },
  childPages: { top: ["sen"] },
  parentLevelFlows: ["df1"],
  multiprocesses: [],
};

const threat = (id: string, ref: { elementId?: string; connectionId?: string }) =>
  ({
    id,
    strideCategory: "S",
    relevance: "unrated",
    proposedMitigations: [],
    linkedElement: ref.elementId ? { elementId: ref.elementId, elementName: ref.elementId } : null,
    dataFlow: ref.connectionId
      ? { connectionId: ref.connectionId, sourceName: "", targetName: "", dataFlowName: "" }
      : null,
  }) as unknown as Threat;

const THREATS = [threat("t-ee", { elementId: "ee1" }), threat("t-p1", { elementId: "p1" }), threat("t-df1", { connectionId: "df1" })];

describe("useThreatFilters — page and analysis state", () => {
  it("filters by page, by parent level, and clears", () => {
    const { result } = renderHook(() => useThreatFilters(INDEX));
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => result.current.setScopeFilter({ pageId: "sen", withSubPages: false, parentLevelOnly: false }));
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filterThreats(THREATS).map((t) => t.id)).toEqual(["t-p1"]);

    act(() => result.current.setScopeFilter({ pageId: "", withSubPages: false, parentLevelOnly: true }));
    expect(result.current.filterThreats(THREATS).map((t) => t.id)).toEqual(["t-df1"]);

    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filterThreats(THREATS)).toHaveLength(3);
  });

  it("ignores the scope for a classic DFD (no index)", () => {
    const { result } = renderHook(() => useThreatFilters());
    act(() => result.current.setScopeFilter({ pageId: "sen", withSubPages: false, parentLevelOnly: false }));
    expect(result.current.hasActiveFilters).toBe(false);
  });
});

describe("useRiskFilters — page of the risk's threat", () => {
  it("keeps the risks whose threat is on the page", () => {
    const risks = [
      { id: "r1", threatId: "t-ee" },
      { id: "r2", threatId: "t-p1" },
      { id: "r3", threatId: "gone" },
    ] as unknown as Risk[];
    const { result } = renderHook(() => useRiskFilters(INDEX));
    act(() => result.current.setScopeFilter({ pageId: "top", withSubPages: true, parentLevelOnly: false }));
    const kept = result.current.filterRisks(risks, undefined, THREATS as unknown as ThreatReference[]);
    expect(kept.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});
