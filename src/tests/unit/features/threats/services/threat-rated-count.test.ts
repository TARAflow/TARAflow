// src/tests/unit/features/threats/services/threat-rated-count.test.ts
//
// Manual test 2026-11-19 (Pump Station): the Threats tab said "0 / 87
// rated" while its phase was complete — the counter read workflowStatus,
// which only the threat dialog sets; relevances set elsewhere (e.g. in the
// file) did not count. One rule now: rated = relevance decided (relevant or not relevant; "uncertain" is a
// parking state, not a decision — manual test 2026-11-19).

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { isThreatRated, threatPhaseStatus } from "features/threats/services/threat-phase-status";
import { useThreatValidation } from "features/threats/hooks/shared/use-threat-validation";
import type { ThreatTable } from "features/threats/models/threat-types";

const threat = (relevance: string | undefined, workflowStatus = "open") => ({ id: Math.random().toString(), relevance, workflowStatus });
const tables = [
  { threats: [threat("relevant"), threat("not_relevant"), threat("uncertain")] },
  { threats: [threat("unrated"), threat(undefined), threat("unrated", "reviewed")] },
] as unknown as ThreatTable[];

describe("rated threats — one rule", () => {
  it("rated = relevance decided, whatever the workflow status", () => {
    expect(tables.flatMap((t) => t.threats).map(isThreatRated)).toEqual([true, true, false, false, false, false]);
  });

  it("the tab's counter counts the same as the phase status", () => {
    const { result } = renderHook(() => useThreatValidation(tables));
    expect(result.current.stats).toEqual({ total: 6, reviewed: 2 });
    const allRated = [{ threats: [threat("relevant"), threat("not_relevant")] }] as unknown as ThreatTable[];
    expect(renderHook(() => useThreatValidation(allRated)).result.current.stats).toEqual({ total: 2, reviewed: 2 });
    expect(threatPhaseStatus({ perElementTables: allRated, perInteractionTables: [] } as never)).toBe("complete");
  });

  it("one threat set to uncertain: the counter drops and the phase is in progress again", () => {
    const withUncertain = [{ threats: [threat("relevant"), threat("uncertain", "reviewed")] }] as unknown as ThreatTable[];
    expect(renderHook(() => useThreatValidation(withUncertain)).result.current.stats).toEqual({ total: 2, reviewed: 1 });
    expect(threatPhaseStatus({ perElementTables: withUncertain, perInteractionTables: [] } as never)).toBe("in-progress");
  });
});
