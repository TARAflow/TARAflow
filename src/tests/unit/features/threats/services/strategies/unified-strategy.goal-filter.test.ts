// tests/unit/features/threats/services/strategies/unified-strategy.goal-filter.test.ts
//
// Security goals and element properties combine by INTERSECTION:
//   final = (properties applied ? propertyResult : base) ∩ goalCategories
//
// Before: the two were UNITED whenever a property fired, intersected otherwise.
// Consequences guarded against here (both observed on SmokeDetector):
//   - DF with EL0 ("internal, trusted" → no I) got I back from a
//     confidentiality goal — a derived goal silently overrode an analyst
//     assumption.
//   - A process marked functional_block (REDUCES the surface: no S, R) gained
//     E although no authorization goal exists — a reducing property added a
//     threat.

import { describe, it, expect } from "vitest";
import { UnifiedStrategy } from "features/threats/services/strategies/unified-strategy";
import { STRIDE_PER_ELEMENT_TYPE } from "features/threats/models/per-element-types";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";
import type { DFDElementReference, StrideCategory } from "shared";

const ORDER: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];
const sorted = (c: StrideCategory[]) => ORDER.filter((s) => c.includes(s));

const config = { forceClassicMode: false } as unknown as ThreatConfiguration;

function el(
  type: string,
  properties: Record<string, unknown> = {},
): DFDElementReference {
  return { id: "e-1", type, name: "E", displayId: "E-1", properties } as unknown as DFDElementReference;
}

function project(goalTypes: string[] | null): ThreatProjectData {
  return {
    assetDataRef: {
      assets: goalTypes
        ? [
            {
              id: "a-1",
              name: "A",
              linkedElementIds: ["e-1"],
              securityGoals: goalTypes.map((type) => ({ type, level: "high" })),
            },
          ]
        : [],
    },
  } as unknown as ThreatProjectData;
}

function categories(element: DFDElementReference, goals: string[] | null) {
  const base = (STRIDE_PER_ELEMENT_TYPE as Record<string, StrideCategory[]>)[element.type];
  return sorted(
    new UnifiedStrategy().getStrideCategories(element, base, project(goals), config)
      .categories,
  );
}

describe("goal filter × element properties", () => {
  it("no goals, no properties → base", () => {
    expect(categories(el("Process"), null)).toEqual(["S", "T", "R", "I", "D", "E"]);
  });

  it("no goals, properties → property result", () => {
    expect(categories(el("Process", { processSemantic: "functional_block" }), null)).toEqual([
      "T", "I", "D", "E",
    ]);
  });

  it("goals, no properties → base ∩ goals", () => {
    // C→I, I→T, A→D
    expect(categories(el("Process"), ["C", "I", "A"])).toEqual(["T", "I", "D"]);
  });

  it("goals + reducing property → property result ∩ goals (no E from the property)", () => {
    // functional_block: T,I,D,E ; goals C,I,A: I,T,D → T,I,D  (was T,I,D,E)
    expect(
      categories(el("Process", { processSemantic: "functional_block" }), ["C", "I", "A"]),
    ).toEqual(["T", "I", "D"]);
  });

  it("a reducing property never yields MORE categories than the same element without it", () => {
    const goals = ["C", "I", "A"];
    const without = categories(el("Process"), goals);
    const withProp = categories(el("Process", { processSemantic: "functional_block" }), goals);
    expect(withProp.every((c) => without.includes(c))).toBe(true);
  });

  it("analyst assumption wins: functional_block removes R even with a non-repudiation goal", () => {
    // P-1 in SmokeDetector: goals C,I,A,N → I,T,D,R ; functional_block → T,I,D,E
    expect(
      categories(el("Process", { processSemantic: "functional_block" }), ["C", "I", "A", "N"]),
    ).toEqual(["T", "I", "D"]); // was T,R,I,D,E
  });

  it("analyst assumption wins: EL0 removes I even with a confidentiality goal", () => {
    // DF-3/4/23/24 in SmokeDetector: base T,I,D ; EL0 → T,D ; goals C,I,A → T,I,D
    expect(categories(el("DataFlow", { exposureLevel: "EL0" }), ["C", "I", "A"])).toEqual([
      "T", "D",
    ]); // was T,I,D
  });

  it("goals never add outside the base table", () => {
    // DataFlow base T,I,D ; AuthN→S, AuthZ→E are not in it
    expect(categories(el("DataFlow"), ["AuthN", "AuthZ", "I"])).toEqual(["T"]);
  });
});
