// src/tests/unit/features/assets/asset-displayid.characterization.test.ts
//
// Phase 5b-uuid-b1 — asset-store SoT. The feature-store Asset gained a
// displayId field so the asset tab can show a group-prefixed label independent
// of the id (which becomes an opaque UUID in b2). This step is behaviour-
// neutral: displayId equals id today. These tests pin that, so b2 (id → UUID,
// displayId → the label) is a conscious flip.

import { describe, it, expect } from "vitest";
import { createEmptyAsset } from "features/assets/services/asset-factory";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";

describe("feature Asset.displayId — introduced, equals id today (b1)", () => {
  it("createEmptyAsset sets displayId equal to id", () => {
    const a = createEmptyAsset("DA-001", DEFAULT_ASSET_CONFIGURATION, "data");
    expect(a.displayId).toBe("DA-001");
    expect(a.displayId).toBe(a.id);
  });

  it("keeps the readable, group-prefixed shape for now", () => {
    const a = createEmptyAsset("SY-003", DEFAULT_ASSET_CONFIGURATION, "system");
    expect(a.displayId).toMatch(/^SY-\d+$/);
  });
});
