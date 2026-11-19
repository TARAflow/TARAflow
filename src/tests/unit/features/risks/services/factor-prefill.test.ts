// src/tests/unit/features/risks/services/factor-prefill.test.ts
// Multi-project TARA, patch 16 (design §7.2): values taken over from an
// imported component are derived values — an override wins and keeps its
// value; the risk sync prefills new and existing risks.
import { describe, expect, it } from "vitest";
import { applyFactorPrefill } from "features/risks/services/risk-calculation-service";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

const r = (factorId: string, value: number, extra: Record<string, unknown> = {}) => ({ factorId, value, weight: 1, ...extra });

describe("applyFactorPrefill", () => {
  it("fills enabled factors as derived from the component", () => {
    const out = applyFactorPrefill([r("skill_level", 0), r("motive", 0)], [{ factorId: "skill_level", value: 3 }, { factorId: "not_enabled", value: 2 }]);
    expect(out).toEqual([r("skill_level", 3, { derivedValue: 3, source: "derived", derivedFrom: "component" }), r("motive", 0)]);
  });

  it("an override keeps its value, only the derived value follows", () => {
    const out = applyFactorPrefill([r("skill_level", 1, { source: "manual", derivedValue: 3, derivedFrom: "component", overrideRationale: "x" })], [{ factorId: "skill_level", value: 4 }]);
    expect(out[0]).toMatchObject({ value: 1, derivedValue: 4, source: "manual", overrideRationale: "x" });
  });

  it("attack-tree ratings are untouched; no prefill, no change", () => {
    const tree = [r("skill_level", 2, { source: "attack-tree" })];
    expect(applyFactorPrefill(tree, [{ factorId: "skill_level", value: 4 }])).toEqual(tree);
    const plain = [r("skill_level", 2)];
    expect(applyFactorPrefill(plain, undefined)).toBe(plain);
  });
});

describe("risk sync with factorPrefill", () => {
  const threat = (prefill?: { factorId: string; value: number }[]) =>
    ({ id: "t1", displayId: "SD1:P3-T-1", strideCategory: "T", threatDescription: "x", attackDescription: "", relevance: "relevant", sourceStrideMethod: "per-element", linkedAssetIds: [], proposedMitigations: [], proposedVerifications: [], ...(prefill ? { factorPrefill: prefill } : {}) }) as never;

  it("a new risk gets the component's values", () => {
    const out = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, [threat([{ factorId: "skill_level", value: 3 }])]);
    const skill = out.riskData.risks[0].factorRatings.find((f) => f.factorId === "skill_level")!;
    expect(skill).toMatchObject({ value: 3, source: "derived", derivedFrom: "component" });
  });

  it("an existing risk: derived values follow, an override stays", () => {
    const first = syncRisksFromThreats({ configuration: DEFAULT_CONFIGURATION, risks: [], lastModified: "" } as never, [threat([{ factorId: "skill_level", value: 3 }, { factorId: "ease_of_exploit", value: 2 }])]);
    const risk = first.riskData.risks[0];
    const edited = { ...risk, factorRatings: risk.factorRatings.map((f) => (f.factorId === "ease_of_exploit" ? { ...f, value: 4, source: "manual" as const, overrideRationale: "network" } : f)) };
    const second = syncRisksFromThreats({ ...first.riskData, risks: [edited] }, [threat([{ factorId: "skill_level", value: 1 }, { factorId: "ease_of_exploit", value: 1 }])]);
    const ratings = second.riskData.risks[0].factorRatings;
    expect(ratings.find((f) => f.factorId === "skill_level")).toMatchObject({ value: 1, source: "derived" });
    expect(ratings.find((f) => f.factorId === "ease_of_exploit")).toMatchObject({ value: 4, source: "manual", derivedValue: 1, overrideRationale: "network" });
  });
});
