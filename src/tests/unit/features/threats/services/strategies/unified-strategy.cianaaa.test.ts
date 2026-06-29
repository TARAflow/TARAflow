// ==================== RC-1 — Module 2 (CIANAAA → STRIDE) via UnifiedStrategy ====================
// Phase: per-element generation fix, Step 1.
//
// Goal: getActiveSecurityGoals (inside UnifiedStrategy) must read element links
// from the asset's `linkedDFDElements` (with `linkedElementIds` fallback). Once it
// does, the three EdGe2 golden anchors reproduce:
//
//   EE-2 (id 189): base [S,R] ∩ CIANAAA {T,E} = []   → 0 categories  (control case)
//   SE-1 (id 206): base [T,D] ∩ CIANAAA {T,E} = [T]
//   EE-1 (id 174): base [S,R] ∩ CIANAAA {T,R,D,E} = [R]
//
// RED before fix:  with assets that carry ONLY linkedDFDElements, CIANAAA does not
//                  apply (links read from the empty linkedElementIds), so each
//                  element falls back to its full base table — anchors fail.
// GREEN after fix: anchors pass.

import { describe, it, expect } from "vitest";
import { UnifiedStrategy } from "../../../../../../features/threats/services/strategies/unified-strategy";
import { STRIDE_PER_ELEMENT_TYPE } from "../../../../../../features/threats/models/per-element-types";
import type {
  ThreatProjectData,
  ThreatConfiguration,
} from "features/threats";
import type { DFDElementReference, StrideCategory } from "shared";

import anchors from "../../../../../fixtures/edge2-cianaaa-anchors.fixture.json";

const STRIDE_ORDER: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];
const sortStride = (c: StrideCategory[]): StrideCategory[] =>
  STRIDE_ORDER.filter((s) => c.includes(s));

function defaultConfig(): ThreatConfiguration {
  return {
    activeMethod: "per-element",
    zeroTrustMode: false,
    showThreatActor: false,
    forceClassicMode: false,
    customElementTemplates: [],
    customInteractionTemplates: [],
    customMitigations: [],
    customVerifications: [],
  } as unknown as ThreatConfiguration;
}

/** Minimal project stub — getStrideCategories only needs assetDataRef. */
function projectStub(): ThreatProjectData {
  return {
    assetDataRef: { assets: anchors.assets },
  } as unknown as ThreatProjectData;
}

function categoriesFor(elementKey: "EE-1" | "EE-2" | "SE-1"): StrideCategory[] {
  const el = anchors.elements[elementKey] as unknown as DFDElementReference;
  const base = STRIDE_PER_ELEMENT_TYPE[el.type] ?? [];
  const { categories } = new UnifiedStrategy().getStrideCategories(
    el,
    base,
    projectStub(),
    defaultConfig(),
  );
  return sortStride(categories);
}

describe("UnifiedStrategy Module 2 — EdGe2 CIANAAA anchors (RC-1)", () => {
  it("EE-2 (Operator): base[S,R] ∩ {T,E} = [] → no categories (control case)", () => {
    expect(categoriesFor("EE-2")).toEqual([]);
  });

  it("SE-1 (Photometer): base[T,D] ∩ {T,E} = [T]", () => {
    expect(categoriesFor("SE-1")).toEqual(["T"]);
  });

  it("EE-1 (Mobile/Browser): base[S,R] ∩ {T,R,D,E} = [R]", () => {
    expect(categoriesFor("EE-1")).toEqual(["R"]);
  });

  it("CIANAAA never adds a category outside the element's base table", () => {
    for (const key of ["EE-1", "EE-2", "SE-1"] as const) {
      const el = anchors.elements[key] as unknown as DFDElementReference;
      const base = STRIDE_PER_ELEMENT_TYPE[el.type] ?? [];
      for (const c of categoriesFor(key)) expect(base).toContain(c);
    }
  });

  it("getInitialImpact reflects the driving goal level (SE-1 T ← Integrity high)", () => {
    const el = anchors.elements["SE-1"] as unknown as DFDElementReference;
    const impact = new UnifiedStrategy().getInitialImpact(el, "T", projectStub());
    expect(impact).toBe("high");
  });
});
