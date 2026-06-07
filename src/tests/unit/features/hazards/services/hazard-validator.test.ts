// src/tests/unit/features/hazards/services/hazard-validator.test.ts
import { describe, it, expect } from "vitest";
import {
  hazardValidator,
  hazardService,
  hazardRelationService,
  createEmptyHazardData,
} from "features/hazards";
import type { HazardData } from "features/hazards";
import type { AssetReference, HazardItemId } from "shared";

const completeHazard = (): HazardData => {
  let d = createEmptyHazardData();
  const item = hazardService.createHazardItem(d, { label: "Tank rupture" });
  d = hazardService.addHazard(d, item);
  d = hazardRelationService.addContributesTo(d, {
    assetId: "A-01",
    hazardId: item.id,
    relevance: "direct",
    hazardDistance: 1,
  });
  d = hazardRelationService.addEndangers(d, {
    hazardId: item.id,
    targetAssetId: "HUM-1",
    impact: { target: "human", severity: "fatality" },
  });
  return d;
};

describe("hazardValidator", () => {
  it("accepts a complete hazard", () => {
    const v = hazardValidator.validate(completeHazard());
    expect(v.errors).toEqual([]);
    expect(v.isComplete).toBe(true);
  });

  it("errors when contributes_to is missing", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "x" });
    d = hazardService.addHazard(d, item);
    d = hazardRelationService.addEndangers(d, {
      hazardId: item.id,
      targetAssetId: "HUM-1",
      impact: { target: "human", severity: "fatality" },
    });
    const v = hazardValidator.validate(d);
    expect(v.errors.some((e) => e.includes("contributes_to"))).toBe(true);
    expect(v.isComplete).toBe(false);
  });

  it("errors when endangers is missing", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "x" });
    d = hazardService.addHazard(d, item);
    d = hazardRelationService.addContributesTo(d, {
      assetId: "A-01",
      hazardId: item.id,
      relevance: "direct",
      hazardDistance: 1,
    });
    const v = hazardValidator.validate(d);
    expect(v.errors.some((e) => e.includes("protection target"))).toBe(true);
  });

  it("warns (not errors) on combinationType ALL with a single input", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "x", combinationType: "ALL" });
    d = hazardService.addHazard(d, item);
    d = hazardRelationService.addContributesTo(d, {
      assetId: "A-01",
      hazardId: item.id,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.addEndangers(d, {
      hazardId: item.id,
      targetAssetId: "HUM-1",
      impact: { target: "human", severity: "fatality" },
    });
    const v = hazardValidator.validate(d);
    expect(v.warnings.some((w) => w.includes("ALL"))).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it("does not warn for ALL with two inputs (Na + H2O)", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "Na+H2O", combinationType: "ALL" });
    d = hazardService.addHazard(d, item);
    d = hazardRelationService.addContributesTo(d, {
      assetId: "A-01",
      hazardId: item.id,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.addContributesTo(d, {
      assetId: "A-02",
      hazardId: item.id,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.addEndangers(d, {
      hazardId: item.id,
      targetAssetId: "HUM-1",
      impact: { target: "human", severity: "fatality" },
    });
    const v = hazardValidator.validate(d);
    expect(v.warnings.some((w) => w.includes("ALL"))).toBe(false);
  });

  it("flags dangling edges referencing an unknown hazard", () => {
    const d = hazardRelationService.addContributesTo(createEmptyHazardData(), {
      assetId: "A-01",
      hazardId: "H-99" as HazardItemId,
      relevance: "direct",
      hazardDistance: 1,
    });
    const v = hazardValidator.validate(d);
    expect(v.errors.some((e) => e.toLowerCase().includes("dangling"))).toBe(true);
  });

  it("catches a discriminator mismatch when the asset snapshot is provided", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "x" });
    d = hazardService.addHazard(d, item);
    d = hazardRelationService.addContributesTo(d, {
      assetId: "SYS-1",
      hazardId: item.id,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.addEndangers(d, {
      hazardId: item.id,
      targetAssetId: "HUM-1",
      impact: { target: "environment", severity: "high" },
    });
    const assets: AssetReference[] = [
      { id: "SYS-1", name: "PLC", assetGroup: "system", hasSafetyAnnotation: false },
      { id: "HUM-1", name: "Operator", assetGroup: "human", hasSafetyAnnotation: false },
    ];
    const v = hazardValidator.validate(d, assets);
    expect(v.errors.some((e) => e.includes("does not match"))).toBe(true);
  });
});
