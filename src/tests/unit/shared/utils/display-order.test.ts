// tests/unit/shared/utils/display-order.test.ts
//
// Lists the analyst reads (DFD description view, threat tables, drift review)
// showed elements in drawing / stored order: DF-6, DF-3, DF-10, DF-4 …
// One ordering now: element kind, natural display id, STRIDE S-T-R-I-D-E.

import { describe, it, expect } from "vitest";
import {
  compareByTypeAndDisplayId,
  compareDisplayIds,
  compareStride,
} from "shared";
import {
  compareThreatsByLabel,
  sortThreats,
} from "features/threats/components/shared/threat-table-utils";
import { groupElementsByType, sortConnectionsByDisplayId } from "features/dfd/components/dfd-description-view";
import type { Threat } from "features/threats/models/threat-types";

describe("compareDisplayIds", () => {
  it("natural: DF-2 before DF-10", () => {
    expect(["DF-10", "DF-2", "DF-1", "DF-35", "DF-3"].sort(compareDisplayIds)).toEqual([
      "DF-1", "DF-2", "DF-3", "DF-10", "DF-35",
    ]);
  });
  it("missing ids sort last", () => {
    expect([undefined, "P-2", "P-1"].sort(compareDisplayIds)).toEqual(["P-1", "P-2", undefined]);
  });
});

it("compareStride: S-T-R-I-D-E", () => {
  expect(["E", "I", "S", "D", "T", "R"].sort(compareStride)).toEqual(["S", "T", "R", "I", "D", "E"]);
});

it("compareByTypeAndDisplayId: kind first, then natural id", () => {
  const items = [
    { type: "DataFlow", displayId: "DF-10" },
    { type: "Process", displayId: "P-2" },
    { type: "DataFlow", displayId: "DF-2" },
    { type: "Process", displayId: "P-10" },
  ];
  expect(items.sort(compareByTypeAndDisplayId).map((i) => i.displayId)).toEqual([
    "P-2", "P-10", "DF-2", "DF-10",
  ]);
});

describe("threat order", () => {
  const flowThreat = (df: string, s: string, dir: string) =>
    ({
      displayId: `SB-${df.replace("-", "")}-${s}-${dir}-1`,
      strideCategory: s,
      dataFlow: { dataFlowId: df },
      linkedElement: null,
    }) as unknown as Threat;

  it("per-interaction: by data flow (DF-2 before DF-10), then STRIDE", () => {
    const threats = [
      flowThreat("DF-10", "T", "OUT"),
      flowThreat("DF-2", "I", "OUT"),
      flowThreat("DF-2", "S", "IN"),
      flowThreat("DF-3", "E", "OUT"),
    ];
    expect([...threats].sort(compareThreatsByLabel).map((t) => t.displayId)).toEqual([
      "SB-DF2-S-IN-1", "SB-DF2-I-OUT-1", "SB-DF3-E-OUT-1", "SB-DF10-T-OUT-1",
    ]);
  });

  it("priority ties fall back to reading order, not stored order", () => {
    const threats = [flowThreat("DF-10", "T", "OUT"), flowThreat("DF-2", "T", "OUT")];
    // no assetDataRef → every priority equal
    expect(sortThreats(threats, "priority", "asc").map((t) => t.displayId)).toEqual([
      "SB-DF2-T-OUT-1", "SB-DF10-T-OUT-1",
    ]);
  });
});

describe("DFD description view order", () => {
  it("elements within a type in natural order", () => {
    const g = groupElementsByType([
      { id: "a", type: "Process", displayId: "P-10" },
      { id: "b", type: "Process", displayId: "P-2" },
      { id: "c", type: "Process", displayId: "P-1" },
    ] as never);
    expect(g.Process.map((e: any) => e.displayId)).toEqual(["P-1", "P-2", "P-10"]);
  });
  it("data flows in natural order", () => {
    const c = sortConnectionsByDisplayId([
      { id: "1", displayId: "DF-12" },
      { id: "2", displayId: "DF-3" },
      { id: "3", displayId: "DF-1" },
    ]);
    expect(c.map((x) => x.displayId)).toEqual(["DF-1", "DF-3", "DF-12"]);
  });
});
