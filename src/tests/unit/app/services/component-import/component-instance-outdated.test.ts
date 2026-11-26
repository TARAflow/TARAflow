// src/tests/unit/app/services/component-import/component-instance-outdated.test.ts
//
// 0.20 manual test E1 / E2 (2026-11-26): an instance a 0.19 TARAflow inserted
// keeps its boundaries without the instance prefix ("[CASE]"), and the ids of
// a nested import in the wrong order. The upgrade note promised the prefix
// "with the next component update" — but an unchanged component offers no
// update. Such an instance is now recognised, the check names it, and
// "Refresh stored state…" (the update onto the imported commit) inserts it
// again.

import { describe, expect, it } from "vitest";
import type { ComponentImport } from "shared";
import { componentInstanceTfId } from "features/dfd";
import { componentDriftFindings, outdatedInstanceIds, updateTargetOf } from "app/services/component-import/component-drift";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { canonicalStringify } from "shared/utils/tcs-canonical";

const snapshot = {
  dfd: {
    elements: [
      { id: "ee", type: "ExternalEntity", displayId: "EE-1" },
      { id: "case", type: "PhysicalBoundary", displayId: "CASE" },
      { id: "p1", type: "Process", displayId: "P-1" },
      { id: "ds1", type: "DataStore", displayId: "DS-1" },
    ],
    connections: [
      { id: "f-in", from: "ee", to: "p1", displayId: "DF-1" }, // a boundary flow: the machine numbers it
      { id: "f2", from: "p1", to: "ds1", displayId: "DF-2" },
    ],
  },
};
const imported = {
  id: "imp",
  name: "Smoke Detector Case",
  componentId: "c",
  importedAt: "t",
  // the stored snapshot intact (not the "damaged" case)
  contentHash: fnv1aHex12(canonicalStringify(snapshot)),
  source: { schemaVersion: 14, commitSha: "abc123" },
  snapshot,
} as unknown as ComponentImport;
const instance = { id: "inst-1", importId: "imp", prefix: "SD1", multiprocessTfId: "mp1" };
const tf = (componentId: string) => componentInstanceTfId("inst-1", componentId);

/** The machine as an insert of a given version left it. */
const machine = (ids: { case: string; p1: string; f2: string }) => ({
  components: { imports: [imported], instances: [instance] },
  dfd: {
    elements: [
      { id: "mp1", displayId: "MP-1" },
      { id: tf("case"), displayId: ids.case },
      { id: tf("p1"), displayId: ids.p1 },
      { id: tf("ds1"), displayId: "SD1:DS-1" },
    ],
    connections: [
      { id: tf("f-in"), displayId: "DF-7" },
      { id: tf("f2"), displayId: ids.f2 },
    ],
  },
});
const CURRENT = machine({ case: "SD1:CASE", p1: "SD1:P-1", f2: "SD1:DF-2" });
const FROM_0_19 = machine({ case: "CASE", p1: "SD1:P-1", f2: "SD1:DF-2" });

describe("instances an older TARAflow inserted", () => {
  it("the current insert is not outdated; a boundary without the prefix is", () => {
    expect(outdatedInstanceIds(CURRENT, "imp")).toEqual([]);
    expect(outdatedInstanceIds(FROM_0_19, "imp")).toEqual(["inst-1"]);
  });

  it("a nested import's ids in the wrong order (0.19) count too; renumbered boundary flows and EEs do not", () => {
    expect(outdatedInstanceIds(machine({ case: "SD1:CASE", p1: "C1:SD1:P-1", f2: "SD1:DF-2" }), "imp")).toEqual(["inst-1"]);
    // DF-7 for the boundary flow (the machine's number) is no deviation
    expect(outdatedInstanceIds(CURRENT, "imp")).toEqual([]);
  });

  it("an up-to-date component offers 'Refresh stored state…' for it — and only then", () => {
    const upToDate = { kind: "up_to_date" } as const;
    expect(updateTargetOf(imported, upToDate)).toBeUndefined();
    expect(updateTargetOf(imported, upToDate, true)).toMatchObject({ refresh: true, status: { commitSha: "abc123" } });
  });

  it("the check names the instance", () => {
    const drift = new Map([["imp", { kind: "up_to_date" } as const]]);
    expect(componentDriftFindings(CURRENT, drift)).toEqual([]);
    expect(componentDriftFindings(FROM_0_19, drift)).toEqual([
      {
        key: "components.findings.CMP_INSTANCE_OUTDATED",
        elementId: "mp1",
        displayId: "MP-1",
        params: { component: "Smoke Detector Case", prefix: "SD1" },
      },
    ]);
  });
});
