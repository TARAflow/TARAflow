// src/tests/unit/app/services/migrate_8_to_9.safety-severity.test.ts
//
// Schema v9 (safety part): canonical 5-level person-harm severity. Old values map
// conservatively to the upper sub-level.

import { describe, it, expect } from "vitest";
import { migrate_8_to_9 } from "app/services/versions/migrate-8-to-9";

function v8(overrides: Record<string, unknown> = {}): any {
  return {
    schemaVersion: 8,
    assets: { assets: [], configuration: {} },
    dfd: { elements: [], connections: [] },
    hazards: { hazards: [], relations: [] },
    ...overrides,
  };
}

describe("migrate_8_to_9 — safety severity", () => {
  it("bumps the version", () => {
    expect(migrate_8_to_9(v8()).schemaVersion).toBe(9);
  });

  it("maps SafetyAnnotation.impact on element asset relations", () => {
    const out = migrate_8_to_9(
      v8({
        dfd: {
          elements: [
            {
              id: "e1",
              assetRelations: [
                { assetId: "a", safety: { relevance: "direct", impact: "fatality" } },
                { assetId: "b", safety: { relevance: "indirect", impact: "irreversible_injury" } },
                { assetId: "c", safety: { relevance: "indirect", impact: "reversible_injury" } },
                { assetId: "d", safety: { relevance: "none", impact: "none" } },
              ],
            },
          ],
          connections: [],
        },
      }),
    );
    const impacts = out.dfd.elements[0].assetRelations.map((r: any) => r.safety.impact);
    expect(impacts).toEqual(["fatal", "irreversible_major", "reversible_major", "none"]);
  });

  it("maps human endangers edges and leaves other targets alone", () => {
    const out = migrate_8_to_9(
      v8({
        hazards: {
          hazards: [],
          relations: [
            { type: "endangers", from: "h", to: "p", impact: { target: "human", severity: "fatality" } },
            { type: "endangers", from: "h", to: "e", impact: { target: "environment", severity: "high" } },
          ],
        },
      }),
    );
    expect(out.hazards.relations[0].impact.severity).toBe("fatal");
    expect(out.hazards.relations[1].impact.severity).toBe("high");
  });

  it("maps physicalImpact / safetyImpact and the asset-dialog scale value", () => {
    const out = migrate_8_to_9(
      v8({
        assets: {
          configuration: {},
          assets: [
            {
              id: "a",
              physicalImpact: "irreversible_injury",
              properties: { safetyImpact: "reversible_moderate" },
              impactRatings: [
                { criterionId: "safety", value: 3 },
                { criterionId: "financial_damage", value: 3 },
              ],
            },
          ],
        },
      }),
    );
    const a = out.assets.assets[0];
    expect(a.physicalImpact).toBe("irreversible_major");
    expect(a.properties.safetyImpact).toBe("reversible_major");
    expect(a.impactRatings).toEqual([
      { criterionId: "safety", value: 4 },
      { criterionId: "financial_damage", value: 3 },
    ]);
  });

  it("is idempotent on canonical values", () => {
    const once = migrate_8_to_9(
      v8({
        assets: {
          configuration: {},
          assets: [{ id: "a", physicalImpact: "irreversible_minor" }],
        },
      }),
    );
    const twice = migrate_8_to_9({ ...once, schemaVersion: 8 });
    expect(twice).toEqual(once);
  });
});
