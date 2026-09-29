// src/tests/unit/features/hazards/services/hazard-service.test.ts
import { describe, it, expect } from "vitest";
import { hazardService, hazardRelationService, createEmptyHazardData } from "features/hazards";
import type { HazardData } from "features/hazards";

describe("hazardService — createHazardItem / id generation", () => {
  it("creates the first item as H-01 with ANY + manual defaults", () => {
    const d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "Overpressure" });
    expect(item.id).toBe("H-01");
    expect(item.combinationType).toBe("ANY");
    expect(item.source).toBe("manual");
    expect(item.label).toBe("Overpressure");
  });

  it("increments sequentially and preserves padding", () => {
    let d = createEmptyHazardData();
    d = hazardService.addHazard(d, hazardService.createHazardItem(d));
    d = hazardService.addHazard(d, hazardService.createHazardItem(d));
    expect(d.hazards.map((h) => h.id)).toEqual(["H-01", "H-02"]);
    expect(hazardService.createHazardItem(d).id).toBe("H-03");
  });
});

describe("hazardService — CRUD + referential integrity", () => {
  const setup = (): HazardData => {
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

  it("reports referencing relations before deletion", () => {
    const d = setup();
    expect(hazardService.getReferencingRelations(d, d.hazards[0].id)).toHaveLength(2);
  });

  it("cascade-deletes edges together with the hazard", () => {
    const d = setup();
    const after = hazardService.deleteHazard(d, d.hazards[0].id);
    expect(after.hazards).toHaveLength(0);
    expect(after.relations).toHaveLength(0);
  });

  it("updateHazard replaces by id", () => {
    const d = setup();
    const after = hazardService.updateHazard(d, { ...d.hazards[0], label: "Renamed" });
    expect(after.hazards[0].label).toBe("Renamed");
  });

  it("toUpdateResult stamps a fresh lastModified", () => {
    const d = setup();
    const result = hazardService.toUpdateResult(d);
    expect(result.hazards.lastModified).toBe(result.lastModified);
    expect(typeof result.lastModified).toBe("string");
  });
});

describe("hazardService — deriveHazardPhaseStatus", () => {
  it("not-started with no hazards", () => {
    expect(hazardService.deriveHazardPhaseStatus(createEmptyHazardData())).toBe("not-started");
  });

  it("in-progress when a hazard lacks its edges", () => {
    let d = createEmptyHazardData();
    d = hazardService.addHazard(d, hazardService.createHazardItem(d, { label: "x" }));
    expect(hazardService.deriveHazardPhaseStatus(d)).toBe("in-progress");
  });

  it("complete when every hazard has >=1 contributes_to and >=1 endangers", () => {
    let d = createEmptyHazardData();
    const item = hazardService.createHazardItem(d, { label: "x" });
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
    expect(hazardService.deriveHazardPhaseStatus(d)).toBe("complete");
  });
});

describe("hazardService — generateNextHazardIdFromIds", () => {
  it("starts at H-01 for no ids", () => {
    expect(hazardService.generateNextHazardIdFromIds([])).toBe("H-01");
  });

  it("ignores non-H ids such as legacy import UUIDs", () => {
    expect(
      hazardService.generateNextHazardIdFromIds([
        "3f2b8c1e-0000-4000-8000-000000000000",
        "H-03",
      ]),
    ).toBe("H-04");
  });

  it("keeps the padding of the existing scheme", () => {
    expect(hazardService.generateNextHazardIdFromIds(["H-009"])).toBe("H-010");
  });

  it("never repeats when fed its own output (batch import)", () => {
    const minted: string[] = [];
    for (let i = 0; i < 3; i++) {
      minted.push(hazardService.generateNextHazardIdFromIds(["H-01", ...minted]));
    }
    expect(minted).toEqual(["H-02", "H-03", "H-04"]);
  });
});
