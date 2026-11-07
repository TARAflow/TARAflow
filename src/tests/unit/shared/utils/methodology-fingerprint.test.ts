// src/tests/unit/shared/utils/methodology-fingerprint.test.ts
//
// Multi-project TARA, phase 0 (design §7.2): scaleHash, fingerprint and the
// comparison that decides which imported factor values are prefilled.

import { describe, expect, it } from "vitest";
import {
  buildMethodologyFingerprint,
  compareFingerprints,
  scaleHash,
} from "shared/utils/methodology-fingerprint";
import type { FactorScaleDefinition } from "shared";

const scale = (...values: number[]): FactorScaleDefinition => ({
  levels: values.map((v) => ({ key: String(v), value: v })),
});
const fourLevel = scale(1, 2, 3, 4);
const fiveLevel = scale(1, 2, 3, 4, 5);

describe("scaleHash", () => {
  it("is 12 hex chars and stable", () => {
    expect(scaleHash(fourLevel)).toMatch(/^[0-9a-f]{12}$/);
    expect(scaleHash(fourLevel)).toBe(scaleHash(scale(1, 2, 3, 4)));
  });

  it("changes with a level, a value or points", () => {
    const base = scaleHash(fourLevel);
    expect(scaleHash(fiveLevel)).not.toBe(base);
    expect(scaleHash({ levels: [{ key: "a", value: 1, points: 0 }] })).not.toBe(
      scaleHash({ levels: [{ key: "a", value: 1, points: 1 }] }),
    );
  });

  it("does not depend on key order inside a level", () => {
    expect(scaleHash({ levels: [{ key: "a", value: 1, points: 2 }] })).toBe(
      scaleHash({ levels: [{ points: 2, value: 1, key: "a" } as never] }),
    );
  });
});

describe("buildMethodologyFingerprint", () => {
  it("sorts the factors and does not depend on their input order", () => {
    const a = buildMethodologyFingerprint("weighted-mean", [
      { factorId: "skill_level", scale: fourLevel },
      { factorId: "ease_of_exploit", scale: fourLevel },
    ]);
    const b = buildMethodologyFingerprint("weighted-mean", [
      { factorId: "ease_of_exploit", scale: fourLevel },
      { factorId: "skill_level", scale: fourLevel },
    ]);
    expect(a.factors.map((f) => f.factorId)).toEqual(["ease_of_exploit", "skill_level"]);
    expect(a.hash).toBe(b.hash);
  });

  it("differs with the method, a factor or a scale", () => {
    const base = buildMethodologyFingerprint("weighted-mean", [{ factorId: "skill_level", scale: fourLevel }]);
    expect(buildMethodologyFingerprint("en-50742-a", [{ factorId: "skill_level", scale: fourLevel }]).hash).not.toBe(base.hash);
    expect(buildMethodologyFingerprint("weighted-mean", [{ factorId: "skill_level", scale: fiveLevel }]).hash).not.toBe(base.hash);
    expect(
      buildMethodologyFingerprint("weighted-mean", [
        { factorId: "skill_level", scale: fourLevel },
        { factorId: "ease_of_exploit", scale: fourLevel },
      ]).hash,
    ).not.toBe(base.hash);
  });
});

describe("compareFingerprints", () => {
  const fp = (method: string, factors: [string, FactorScaleDefinition][]) =>
    buildMethodologyFingerprint(method, factors.map(([factorId, s]) => ({ factorId, scale: s })));

  it("identical: every intrinsic factor is prefilled", () => {
    const c = fp("weighted-mean", [["skill_level", fourLevel], ["ease_of_exploit", fourLevel]]);
    const m = fp("weighted-mean", [["ease_of_exploit", fourLevel], ["skill_level", fourLevel]]);
    expect(compareFingerprints(c, m)).toEqual({ identical: true, prefillFactorIds: ["ease_of_exploit", "skill_level"] });
  });

  it("different scale: only factors with the same id and scale are prefilled", () => {
    const c = fp("weighted-mean", [["skill_level", fourLevel], ["custom_x", scale(1, 2)]]);
    const m = fp("weighted-mean", [["skill_level", fiveLevel], ["custom_x", scale(1, 2)]]);
    expect(compareFingerprints(c, m)).toEqual({ identical: false, prefillFactorIds: ["custom_x"] });
  });

  it("different method, no shared factor: nothing is prefilled", () => {
    const c = fp("iso-21434", [["iso_expertise", fourLevel]]);
    const m = fp("weighted-mean", [["skill_level", fourLevel]]);
    expect(compareFingerprints(c, m)).toEqual({ identical: false, prefillFactorIds: [] });
  });

  it("a factor the machine does not use is not prefilled", () => {
    const c = fp("weighted-mean", [["skill_level", fourLevel], ["ease_of_discovery", fourLevel]]);
    const m = fp("weighted-mean", [["skill_level", fourLevel]]);
    expect(compareFingerprints(c, m)).toEqual({ identical: false, prefillFactorIds: ["skill_level"] });
  });
});
