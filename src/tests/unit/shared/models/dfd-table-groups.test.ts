// Leveled DFD (D20, revised 2026-10-21): every threat in exactly one group;
// a per-interaction threat of a flow between two multiprocesses belongs to
// the side it attacks — IN at the receiver, OUT at the sender.
import { describe, it, expect } from "vitest";
import { TOP_LEVEL_GROUP, dfdItemRefOfThreat, groupsOfDfdItem, type DfdTableGroups } from "shared";

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1" },
    { key: "mp3", label: "MP-3" },
  ],
  elementGroup: { ee1: TOP_LEVEL_GROUP, p10: "mp1", p3: "mp3", p11: "mp1" },
  // DF-3 P-10 (MP-1) → P-3 (MP-3), DF-9 EE-1 → P-3, DF-1.1 P-11 → P-10 (inside MP-1).
  flowGroups: { df3: [TOP_LEVEL_GROUP], df9: [TOP_LEVEL_GROUP], df11: ["mp1"] },
};

const flowThreat = (connectionId: string, sourceId: string, targetId: string, victimRole?: string) => ({
  linkedElement: null,
  dataFlow: { connectionId, sourceId, targetId },
  ...(victimRole ? { interactionContext: { victimRole } } : {}),
});

describe("dfdItemRefOfThreat", () => {
  it("takes the attacked end from the interaction context", () => {
    expect(dfdItemRefOfThreat(flowThreat("df3", "p10", "p3", "target"))).toEqual({
      elementId: undefined,
      connectionId: "df3",
      victimElementId: "p3",
    });
    expect(dfdItemRefOfThreat(flowThreat("df3", "p10", "p3", "source")).victimElementId).toBe("p10");
    expect(dfdItemRefOfThreat(flowThreat("df3", "p10", "p3"))).not.toHaveProperty("victimElementId");
    expect(dfdItemRefOfThreat({ linkedElement: { elementId: "p3" } })).toEqual({
      elementId: "p3",
      connectionId: undefined,
    });
  });
});

describe("groupsOfDfdItem", () => {
  const group = (t: Parameters<typeof dfdItemRefOfThreat>[0]) => groupsOfDfdItem(GROUPS, dfdItemRefOfThreat(t));

  it("puts a flow threat between two multiprocesses on the attacked side", () => {
    expect(group(flowThreat("df3", "p10", "p3", "target"))).toEqual(["mp3"]); // CB-DF3-…-IN
    expect(group(flowThreat("df3", "p10", "p3", "source"))).toEqual(["mp1"]); // SB-DF3-…-OUT
  });

  it("keeps the top level for the side of an external entity", () => {
    expect(group(flowThreat("df9", "ee1", "p3", "target"))).toEqual(["mp3"]);
    expect(group(flowThreat("df9", "ee1", "p3", "source"))).toEqual([TOP_LEVEL_GROUP]);
  });

  it("is unchanged inside a multiprocess, without a side, and for elements", () => {
    expect(group(flowThreat("df11", "p11", "p10", "target"))).toEqual(["mp1"]);
    expect(group(flowThreat("df3", "p10", "p3"))).toEqual([TOP_LEVEL_GROUP]); // per element: no side
    expect(group({ linkedElement: { elementId: "p3" } })).toEqual(["mp3"]);
  });

  it("finds nothing for a flow no longer in the DFD", () => {
    expect(group(flowThreat("gone", "p10", "p3", "target"))).toEqual([]);
  });
});
