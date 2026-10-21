// Leveled-DFD Phase 6f (design §10): risk-matrix roll-up per decomposed
// multiprocess — per level of its subtree, each threat counted once.
import { describe, it, expect } from "vitest";
import type { DfdScopeMultiprocess, ThreatReference } from "shared";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { riskRollupRows } from "features/risks/utils/risk-rollup";

const MPS: DfdScopeMultiprocess[] = [
  { tfId: "mp1", label: "MP-1 Sensor", depth: 0, items: ["p1", "mp11", "p11", "df1"] },
  { tfId: "mp11", label: "MP-1.1 Optics", depth: 1, items: ["p11"] },
];

const threat = (id: string, ref: { elementId?: string; connectionId?: string }) =>
  ({
    id,
    linkedElement: ref.elementId ? { elementId: ref.elementId } : null,
    dataFlow: ref.connectionId ? { connectionId: ref.connectionId } : null,
  }) as unknown as ThreatReference;

const THREATS = [
  threat("t-p1", { elementId: "p1" }),
  threat("t-p11", { elementId: "p11" }),
  threat("t-df1", { elementId: "p1", connectionId: "df1" }),
  threat("t-ee", { elementId: "ee1" }),
];

const risk = (threatId: string, before: number, after = 0) =>
  ({ id: `r-${threatId}-${before}`, threatId, calculatedRiskBeforeMitigation: before, calculatedRiskAfterMitigation: after }) as unknown as Risk;

const CONFIG = { scale: "5-level", roundingMethod: "round" } as const;

describe("riskRollupRows", () => {
  it("counts per level over the whole subtree, nested multiprocesses included", () => {
    const rows = riskRollupRows(
      MPS,
      [risk("t-p1", 2), risk("t-p11", 5), risk("t-df1", 3), risk("t-ee", 5)],
      THREATS,
      CONFIG,
      "before",
    );
    expect(rows[0]).toMatchObject({ tfId: "mp1", depth: 0, counts: [0, 1, 1, 0, 1], max: 4, threats: 3 });
    expect(rows[1]).toMatchObject({ tfId: "mp11", depth: 1, counts: [0, 0, 0, 0, 1], max: 4, threats: 1 });
  });

  it("counts a threat with several risks once, with its highest risk", () => {
    const rows = riskRollupRows(MPS, [risk("t-p11", 2), risk("t-p11", 4)], THREATS, CONFIG, "before");
    expect(rows[1]).toMatchObject({ counts: [0, 0, 0, 1, 0], threats: 1 });
  });

  it("uses the risk after mitigation where rated, else before", () => {
    const rows = riskRollupRows(MPS, [risk("t-p1", 5, 2), risk("t-p11", 4)], THREATS, CONFIG, "after");
    expect(rows[0].counts).toEqual([0, 1, 0, 1, 0]);
  });

  it("keeps an unrated threat in the count but in no level", () => {
    const rows = riskRollupRows(MPS, [risk("t-p11", 0)], THREATS, CONFIG, "before");
    expect(rows[1]).toMatchObject({ counts: [0, 0, 0, 0, 0], max: undefined, threats: 1 });
  });
});
