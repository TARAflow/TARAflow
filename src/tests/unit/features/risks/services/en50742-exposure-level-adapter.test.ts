import { describe, it, expect } from "vitest";
import { applyExposureLevelToFactorRatings } from "features/risks/services/en50742-risk-calculation";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { DFDReference } from "shared";

// Minimal DFDReference fixtures — only elements/connections + properties, per
// the verified shape in src/shared/models/dfd-reference-types.ts (matching
// field is `id`, not `elementId`/`connectionId`).
const dfdWithInterfaceEL2: DFDReference = {
  elements: [
    { id: "e1", properties: { exposureLevel: "EL2" } },
    { id: "e2", properties: {} }, // no EL — internal element (§3.2, EL0 default case)
  ],
  connections: [],
};

const dfdWithDataFlowEL4: DFDReference = {
  elements: [],
  connections: [{ id: "c1", properties: { exposureLevel: "EL4" } }],
};

const unratedExposureLevel: FactorRating = {
  factorId: "exposure_level",
  value: 0,
  weight: 1,
};

describe("applyExposureLevelToFactorRatings (§11.2 — reads and stays in sync with the DFD)", () => {
  it("per-element threat: reads EL from the linked Interface's properties", () => {
    const ratings = [unratedExposureLevel];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    // EL2 → 1-based index 3 in ["EL0","EL1","EL2","EL3","EL4"]
    expect(result[0]).toEqual({
      factorId: "exposure_level",
      value: 3,
      derivedValue: 3,
      weight: 1,
      source: "derived",
    });
  });

  it("per-interaction threat: reads EL from the crossing DataFlow's properties", () => {
    const ratings = [unratedExposureLevel];
    const threat = { linkedElement: null, dataFlow: { connectionId: "c1" } };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithDataFlowEL4,
    );

    expect(result[0].value).toBe(5); // EL4 → index 5
    expect(result[0].source).toBe("derived");
  });

  it("is non-destructive: never overwrites a manual override with a nonzero value", () => {
    const ratings: FactorRating[] = [
      { factorId: "exposure_level", value: 2, weight: 1, source: "manual" },
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result).toEqual(ratings); // untouched, even though DFD says EL2 (index 3)
  });

  it("self-heals a manual value of exactly 0 (leftover corruption pre-dating the updateFactor fix — 'manual zero' can no longer be freshly created and asserting EL is zero forever is meaningless anyway)", () => {
    const ratings: FactorRating[] = [
      { factorId: "exposure_level", value: 0, weight: 1, source: "manual" },
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result[0]).toEqual({
      factorId: "exposure_level",
      value: 3, // EL2 → index 3, picked back up from the DFD
      derivedValue: 3,
      weight: 1,
      source: "derived",
    });
  });

  it("stays in sync when the DFD's EL changes (e.g. EL1 → EL3 after a later DFD save)", () => {
    const ratings: FactorRating[] = [
      {
        factorId: "exposure_level",
        value: 2,
        derivedValue: 2,
        weight: 1,
        source: "derived",
      }, // was EL1
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };
    const dfdNowEL4: DFDReference = {
      elements: [{ id: "e1", properties: { exposureLevel: "EL4" } }], // DFD moved to EL4
      connections: [],
    };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdNowEL4,
    );

    expect(result[0].value).toBe(5); // EL4 → index 5, no longer frozen at the old value
    expect(result[0].source).toBe("derived");
  });

  it("resets to unrated when the DFD no longer provides a valid EL for the anchor", () => {
    const ratings: FactorRating[] = [
      {
        factorId: "exposure_level",
        value: 3,
        derivedValue: 3,
        weight: 1,
        source: "derived",
      },
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };
    const dfdElementRemoved: DFDReference = { elements: [], connections: [] }; // e1 no longer exists

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdElementRemoved,
    );

    expect(result[0]).toEqual({
      factorId: "exposure_level",
      value: 0,
      derivedValue: undefined,
      weight: 1,
      source: undefined,
    });
  });

  it("is a true no-op (same values) when the DFD's EL hasn't changed since the last derivation", () => {
    const ratings: FactorRating[] = [
      {
        factorId: "exposure_level",
        value: 3,
        derivedValue: 3,
        weight: 1,
        source: "derived",
      }, // already EL2
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result).toEqual(ratings);
  });

  it("leaves the rating unrated when the anchor element has no exposureLevel (internal element, §3.2)", () => {
    const ratings = [unratedExposureLevel];
    const threat = { linkedElement: { elementId: "e2" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result).toEqual(ratings);
  });

  it("leaves the rating unrated when the anchor element cannot be found in the DFD", () => {
    const ratings = [unratedExposureLevel];
    const threat = {
      linkedElement: { elementId: "does-not-exist" },
      dataFlow: null,
    };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result).toEqual(ratings);
  });

  it("leaves the rating unrated when the threat has neither linkedElement nor a dataFlow.connectionId", () => {
    const ratings = [unratedExposureLevel];
    const threat = {
      linkedElement: null,
      dataFlow: { connectionId: undefined },
    };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithDataFlowEL4,
    );

    expect(result).toEqual(ratings);
  });

  it("does not fabricate an exposure_level entry when none exists in ratings", () => {
    const ratings: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 },
    ];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      dfdWithInterfaceEL2,
    );

    expect(result).toEqual(ratings);
  });

  it("treats a garbage properties.exposureLevel value as absent (defensive against the untyped properties bag)", () => {
    const dfd: DFDReference = {
      elements: [{ id: "e1", properties: { exposureLevel: "not-a-level" } }],
      connections: [],
    };
    const ratings = [unratedExposureLevel];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(ratings, threat, dfd);

    expect(result).toEqual(ratings);
  });

  it("handles a missing/undefined dfd gracefully (no throw)", () => {
    const ratings = [unratedExposureLevel];
    const threat = { linkedElement: { elementId: "e1" }, dataFlow: null };

    const result = applyExposureLevelToFactorRatings(
      ratings,
      threat,
      undefined,
    );

    expect(result).toEqual(ratings);
  });
});