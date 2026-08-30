// src/tests/unit/shared/asset-identity.characterization.test.ts
//
// Phase 5b (UUID) NET — asset-store SoT. Pins the CURRENT asset identity model
// before it switches to the Threat-style UUID model. Asserts what the code does
// today, NOT what it should do.
//
// Today (shared/services/asset-creation.createAsset):
//   - `id` is a readable, group-prefixed string (DA-001, SY-003), minted by
//     generateAssetId, and
//   - `displayId === id` (there is no separate stable identity), and
//   - element.assetRelations[].assetId therefore reference the readable id.
//
// Phase 5b (UUID) will change this to mirror the Threat model:
//   - `id` = opaque crypto.randomUUID(), stable, never displayed, and
//   - `displayId` = the regenerable group-prefixed label (DA-001 → SY-003),
//   - and the migration rewrites assetRelations[].assetId from the old readable
//     id to the new UUID.
//
// When Phase 5b (UUID) lands, THIS test must be updated consciously — that
// update is the signal the identity model flipped.

import { describe, it, expect } from "vitest";
import { createAsset } from "shared/services/asset-creation";

describe("asset identity — current readable-id model (pre-UUID)", () => {
  it("mints id as a readable, group-prefixed string", () => {
    const a = createAsset([], "Config Data", "data");
    expect(a.id).toMatch(/^DA-\d{3}$/);
  });

  it("sets displayId equal to id (no separate stable identity yet)", () => {
    const a = createAsset([], "Config Data", "data");
    expect(a.displayId).toBe(a.id);
  });

  it("encodes the current group in the id prefix", () => {
    expect(createAsset([], "x", "data").id).toMatch(/^DA-/);
    expect(createAsset([], "y", "system").id).toMatch(/^SY-/);
  });

  it("assigns sequential ids within a group", () => {
    const a = createAsset([], "x", "data");
    const b = createAsset([a.id], "y", "data");
    expect(a.id).toBe("DA-001");
    expect(b.id).toBe("DA-002");
  });

  it("uses the readable id itself as the reference key", () => {
    // The value elements point at via assetRelations[].assetId IS the readable
    // id today — there is no opaque uuid behind it. Phase 5b flips this.
    const a = createAsset([], "x", "data");
    expect(a.id).toBe(a.displayId);
    expect(a.id).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
