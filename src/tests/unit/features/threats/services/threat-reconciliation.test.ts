// Leveled DFD Phase 6e (leveled-dfd-multi-diagram-design.md §10): what a
// regeneration would do — new, unchanged, references changed (kept, flagged
// for review), obsolete — and the review flag set by the merge.
import { describe, expect, it } from "vitest";
import { reconcileThreats } from "features/threats/services/threat-reconciliation";
import {
  interactionThreatNaturalKey,
  mergeGeneratedThreat,
  referenceChanges,
} from "features/threats/services/threat-identity";
import type { Threat } from "features/threats/models/threat-types";

const flowThreat = (
  id: string,
  over: { sourceId?: string; targetId?: string; tb?: string | null; template?: string; source?: string } = {},
) =>
  ({
    id,
    displayId: id,
    strideCategory: "T",
    source: over.source ?? "generated:classic",
    relevance: "relevant",
    trustBoundaryId: over.tb === undefined ? "tb1" : over.tb,
    templateId: over.template ?? "T-002",
    dataFlow: {
      connectionId: "df7",
      dataFlowId: "DF-7",
      sourceId: over.sourceId ?? "mp2",
      targetId: over.targetId ?? "p1",
    },
    interactionContext: { direction: "incoming", crossesTrustBoundary: true },
    proposedMitigations: [],
    proposedVerifications: [],
    created: "2026-10-01T00:00:00.000Z",
  }) as unknown as Threat;

const other = (id: string, connectionId: string) =>
  ({ ...flowThreat(id), dataFlow: { ...flowThreat(id).dataFlow, connectionId } }) as Threat;

describe("referenceChanges", () => {
  it("names a moved flow endpoint, another trust boundary, another template", () => {
    const before = flowThreat("a");
    expect(referenceChanges(before, flowThreat("b"))).toEqual([]);
    expect(referenceChanges(before, flowThreat("b", { sourceId: "p5" }))).toEqual(["endpoint"]);
    expect(referenceChanges(before, flowThreat("b", { tb: "tb2" }))).toEqual(["boundary"]);
    expect(referenceChanges(before, flowThreat("b", { template: "T-009" }))).toEqual(["template"]);
  });
});

describe("reconcileThreats", () => {
  it("sorts stored and fresh threats into new, unchanged, changed and obsolete", () => {
    const stored = [
      flowThreat("kept"),
      other("moved", "df8"),
      other("gone", "df9"),
      { ...other("manual", "df10"), source: "manual" } as Threat,
    ];
    const fresh = [
      flowThreat("fresh-kept"),
      { ...other("fresh-moved", "df8"), dataFlow: { ...other("x", "df8").dataFlow, sourceId: "p5" } } as Threat,
      other("fresh-new", "df11"),
    ];
    const r = reconcileThreats(stored, fresh, interactionThreatNaturalKey);
    expect(r.unchanged.map((x) => x.threat.id)).toEqual(["kept"]);
    expect(r.changed.map((x) => [x.threat.id, x.reasons])).toEqual([["moved", ["endpoint"]]]);
    expect(r.added.map((x) => x.threat.id)).toEqual(["fresh-new"]);
    // Manual threats are the analyst's — never obsolete.
    expect(r.obsolete.map((x) => x.threat.id)).toEqual(["gone"]);
  });
});

describe("mergeGeneratedThreat — review flag", () => {
  it("keeps id and rating but flags a threat whose endpoint moved", () => {
    const merged = mergeGeneratedThreat(flowThreat("old"), {
      ...flowThreat("fresh", { sourceId: "p5" }),
      created: "2026-10-20T10:00:00.000Z",
    } as Threat);
    expect(merged.id).toBe("old");
    expect(merged.relevance).toBe("relevant");
    expect(merged.review).toEqual({ reasons: ["endpoint"], since: "2026-10-20T10:00:00.000Z" });
  });

  it("sets no flag when nothing changed, and keeps an open flag until the analyst saves", () => {
    expect(mergeGeneratedThreat(flowThreat("old"), flowThreat("fresh")).review).toBeUndefined();
    const flagged = { ...flowThreat("old"), review: { reasons: ["template"], since: "2026-10-19T00:00:00.000Z" } } as Threat;
    expect(mergeGeneratedThreat(flagged, flowThreat("fresh")).review).toEqual(flagged.review);
    // A further change adds its reason, the first date stays.
    expect(mergeGeneratedThreat(flagged, flowThreat("fresh", { tb: "tb2" })).review).toEqual({
      reasons: ["template", "boundary"],
      since: "2026-10-19T00:00:00.000Z",
    });
  });
});
