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

describe("asset identity — UUID model (Phase 5b)", () => {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("mints id as an opaque UUID", () => {
    const a = createAsset([], "Config Data", "data");
    expect(a.id).toMatch(UUID_RE);
  });

  it("mints displayId as the readable, group-prefixed label", () => {
    const a = createAsset([], "Config Data", "data");
    expect(a.displayId).toMatch(/^DA-\d{3}$/);
    expect(a.displayId).not.toBe(a.id);
  });

  it("encodes the current group in the displayId prefix", () => {
    expect(createAsset([], "x", "data").displayId).toMatch(/^DA-/);
    expect(createAsset([], "y", "system").displayId).toMatch(/^SY-/);
  });

  it("assigns sequential displayIds within a group (from existing display ids)", () => {
    const a = createAsset([], "x", "data");
    const b = createAsset([a.displayId], "y", "data");
    expect(a.displayId).toBe("DA-001");
    expect(b.displayId).toBe("DA-002");
    // ids are independent opaque uuids
    expect(a.id).not.toBe(b.id);
  });

  it("uses the opaque id as the reference key, displayId only for humans", () => {
    const a = createAsset([], "x", "data");
    expect(a.id).toMatch(UUID_RE);
    expect(a.displayId).not.toMatch(UUID_RE);
  });
});
