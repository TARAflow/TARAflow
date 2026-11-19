// src/tests/unit/features/risks/services/factor-scale-definitions.test.ts
//
// Multi-project TARA, phase 0 (design §7.2): every predefined likelihood
// factor is classified, and the factor scales follow the method the
// calculation uses.

import { describe, expect, it } from "vitest";
import {
  ALL_PREDEFINED_FACTORS,
  factorClassOf,
} from "features/risks/models/risk-factor-types";
import {
  factorScaleDefinition,
  intrinsicFactorScales,
  likelihoodMethodOf,
} from "features/risks/services/factor-scale-definitions";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";

const INTRINSIC = [
  "attacker_capability",
  "ease_of_discovery",
  "ease_of_exploit",
  "equipment",
  "expertise",
  "iso_elapsed_time",
  "iso_equipment",
  "iso_expertise",
  "iso_knowledge",
  "knowledge",
  "skill_level",
  "time",
];

describe("factor classes (design §7.2)", () => {
  it("every predefined likelihood factor has a class, no impact factor has one", () => {
    for (const f of ALL_PREDEFINED_FACTORS) {
      if (f.category === "likelihood") expect(f.factorClass, f.id).toBeDefined();
      else expect(f.factorClass, f.id).toBeUndefined();
    }
  });

  it("the intrinsic factors are exactly the table of §7.2", () => {
    const intrinsic = ALL_PREDEFINED_FACTORS.filter((f) => f.factorClass === "intrinsic").map((f) => f.id).sort();
    expect(intrinsic).toEqual(INTRINSIC);
  });

  it("context-dependent: window of opportunity, exposure, motive, attack-tree likelihood …", () => {
    for (const id of ["window_of_opportunity", "iso_window_of_opportunity", "exposure_level", "motive", "opportunity", "etsi_opportunity", "deployment_scope", "attack_tree_likelihood"]) {
      expect(factorClassOf(ALL_PREDEFINED_FACTORS.find((f) => f.id === id)), id).toBe("context");
    }
  });

  it("an unclassified custom likelihood factor counts as context; impact has no class", () => {
    expect(factorClassOf({ category: "likelihood" })).toBe("context");
    expect(factorClassOf({ category: "likelihood", factorClass: "intrinsic" })).toBe("intrinsic");
    expect(factorClassOf({ category: "impact" })).toBeUndefined();
    expect(factorClassOf(undefined)).toBeUndefined();
  });
});

describe("factorScaleDefinition", () => {
  it("weighted mean: the project's likelihood scale", () => {
    expect(factorScaleDefinition("skill_level", { scale: "4-level" }).levels.map((l) => l.value)).toEqual([1, 2, 3, 4]);
    expect(factorScaleDefinition("skill_level", { scale: "5-level" }).levels).toHaveLength(5);
  });

  it("ISO/SAE 21434: Table G levels with points, independent of the risk scale", () => {
    const s3 = factorScaleDefinition("iso_expertise", { scale: "3-level", likelihoodMethod: "iso-21434" });
    const s5 = factorScaleDefinition("iso_expertise", { scale: "5-level", likelihoodMethod: "iso-21434" });
    expect(s3).toEqual(s5);
    expect(s3.levels.map((l) => l.key)).toEqual(["layman", "proficient", "expert", "multiple-experts"]);
    expect(s3.levels.every((l) => typeof l.points === "number")).toBe(true);
  });

  it("EN 50742: attacker capability gets the norm levels only under en-50742-a", () => {
    const en = factorScaleDefinition("attacker_capability", { scale: "4-level", likelihoodMethod: "en-50742-a" });
    expect(en.levels.every((l) => typeof l.points === "number")).toBe(true);
    const generic = factorScaleDefinition("attacker_capability", { scale: "4-level" });
    expect(generic.levels.every((l) => l.points === undefined)).toBe(true);
  });

  it("ETSI TVRA: norm levels with points only under etsi-tvra", () => {
    const tvra = factorScaleDefinition("time", { scale: "4-level", likelihoodMethod: "etsi-tvra" });
    expect(tvra.levels).toHaveLength(5);
    expect(tvra.levels.every((l) => typeof l.points === "number")).toBe(true);
    expect(factorScaleDefinition("time", { scale: "4-level" }).levels.every((l) => l.points === undefined)).toBe(true);
  });
});

describe("intrinsicFactorScales", () => {
  it("the default configuration: the enabled intrinsic factors, sorted", () => {
    expect(intrinsicFactorScales(DEFAULT_CONFIGURATION).map((f) => f.factorId)).toEqual(["ease_of_exploit", "skill_level"]);
  });

  it("disabled factors and context factors are left out; a classified custom factor is in", () => {
    const config: RiskConfiguration = {
      ...DEFAULT_CONFIGURATION,
      activeFactors: [
        { factorId: "skill_level", enabled: false, weight: 1 },
        { factorId: "motive", enabled: true, weight: 1 },
        { factorId: "my_factor", enabled: true, weight: 1 },
      ],
      customFactors: [
        { id: "my_factor", category: "likelihood", name: "Mine", description: "", defaultWeight: 1, source: "custom", factorClass: "intrinsic" },
      ],
    };
    expect(intrinsicFactorScales(config).map((f) => f.factorId)).toEqual(["my_factor"]);
  });

  it("the likelihood method defaults to weighted-mean", () => {
    expect(likelihoodMethodOf({})).toBe("weighted-mean");
    expect(likelihoodMethodOf({ likelihoodMethod: "iso-21434" })).toBe("iso-21434");
  });
});
