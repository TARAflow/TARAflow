// src/tests/unit/features/hazards/services/hazard-relation-service.test.ts
import { describe, it, expect } from "vitest";
import { hazardRelationService, createEmptyHazardData } from "features/hazards";
import type { HazardData } from "features/hazards";
import type { AssetReference, HazardImpact, HazardItemId } from "shared";
import { isContributesTo, isEndangers } from "shared";

const HID = "H-01" as HazardItemId;
const base = (): HazardData => createEmptyHazardData();
const fatalHuman: HazardImpact = { target: "human", severity: "fatality" };

const assets: AssetReference[] = [
  { id: "HUM-1", name: "Operator", assetGroup: "human", hasSafetyAnnotation: false },
  { id: "SYS-1", name: "PLC", assetGroup: "system", hasSafetyAnnotation: false },
];

describe("hazardRelationService — contributes_to", () => {
  it("adds an edge", () => {
    const d = hazardRelationService.addContributesTo(base(), {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "direct",
      hazardDistance: 1,
    });
    expect(d.relations).toHaveLength(1);
    expect(isContributesTo(d.relations[0])).toBe(true);
  });

  it("is idempotent on (asset, hazard)", () => {
    let d = hazardRelationService.addContributesTo(base(), {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.addContributesTo(d, {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "indirect",
      hazardDistance: 2,
    });
    expect(d.relations).toHaveLength(1);
  });

  it("updates a patch in place", () => {
    let d = hazardRelationService.addContributesTo(base(), {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.updateContributesTo(d, "SYS-1", HID, { hazardDistance: 3 });
    const rel = d.relations[0];
    expect(isContributesTo(rel) && rel.hazardDistance).toBe(3);
  });

  it("removes an edge", () => {
    let d = hazardRelationService.addContributesTo(base(), {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "direct",
      hazardDistance: 1,
    });
    d = hazardRelationService.removeContributesTo(d, "SYS-1", HID);
    expect(d.relations).toHaveLength(0);
  });

  it("rejects a negative hazardDistance", () => {
    const d = hazardRelationService.addContributesTo(base(), {
      assetId: "SYS-1",
      hazardId: HID,
      relevance: "direct",
      hazardDistance: -1,
    });
    const rel = d.relations[0];
    const errs = isContributesTo(rel)
      ? hazardRelationService.validateContributesTo(rel, assets)
      : [];
    expect(errs.some((e) => e.includes("hazardDistance"))).toBe(true);
  });
});

describe("hazardRelationService — endangers + validation", () => {
  it("accepts a consistent endangers edge", () => {
    const d = hazardRelationService.addEndangers(base(), {
      hazardId: HID,
      targetAssetId: "HUM-1",
      impact: fatalHuman,
    });
    const rel = d.relations[0];
    const errs = isEndangers(rel)
      ? hazardRelationService.validateEndangers(rel, assets)
      : ["not endangers"];
    expect(errs).toEqual([]);
  });

  it("flags a discriminator mismatch (target asset human, impact.target environment)", () => {
    const wrong: HazardImpact = { target: "environment", severity: "high" };
    const d = hazardRelationService.addEndangers(base(), {
      hazardId: HID,
      targetAssetId: "HUM-1",
      impact: wrong,
    });
    const rel = d.relations[0];
    const errs = isEndangers(rel)
      ? hazardRelationService.validateEndangers(rel, assets)
      : [];
    expect(errs.some((e) => e.includes("does not match"))).toBe(true);
  });

  it("flags an invalid protection target (system cannot be endangered)", () => {
    const d = hazardRelationService.addEndangers(base(), {
      hazardId: HID,
      targetAssetId: "SYS-1",
      impact: { target: "infrastructure", severity: "high" },
    });
    const rel = d.relations[0];
    const errs = isEndangers(rel)
      ? hazardRelationService.validateEndangers(rel, assets)
      : [];
    expect(errs.some((e) => e.includes("protection target"))).toBe(true);
  });

  it("skips category checks when no asset snapshot is supplied", () => {
    const d = hazardRelationService.addEndangers(base(), {
      hazardId: HID,
      targetAssetId: "HUM-1",
      impact: fatalHuman,
    });
    const rel = d.relations[0];
    const errs = isEndangers(rel) ? hazardRelationService.validateEndangers(rel) : [];
    expect(errs).toEqual([]);
  });
});
