// tests/unit/features/dfd/services/validators/asset-relation-canonical.test.ts
//
// The DFD asset-relation validator must check relation targets against the
// CANONICAL asset registry (feature store), not the dfd.assets mirror. The
// mirror is stripped on disk and re-derived asynchronously, so it can lag —
// which produced false "asset not found" errors that only cleared after the
// user visited the Asset tab (which triggers the mirror re-derivation).
// Validating against the canonical list makes those false errors impossible.

import { describe, it, expect } from "vitest";

import { validateAssetRelations } from "features/dfd/services/validators/asset-relation-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const el = (assetId: string, group: string, relationType: string): any => ({
  id: "3",
  type: "Process",
  name: "MyProcess",
  displayId: "P-1",
  assetRelations: [{ assetId, assetGroup: group, relationType }],
});

describe("validateAssetRelations — validates against the canonical registry", () => {
  it("no error when the asset is in the canonical list even if the mirror is empty", () => {
    const errors: unknown[] = [];
    const warnings: unknown[] = [];

    // Canonical registry HAS the asset; the mirror (had it been passed) is empty.
    validateAssetRelations(
      [{ id: "AC", name: "Config Data" }],
      [el("AC", "data", "creates")],
      [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warnings as any,
    );

    expect(errors).toHaveLength(0);
  });

  it("still errors when the asset exists in neither the registry nor the mirror", () => {
    const errors: { key: string }[] = [];
    const warnings: unknown[] = [];

    validateAssetRelations(
      [], // asset genuinely missing
      [el("GHOST", "data", "creates")],
      [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warnings as any,
    );

    expect(
      errors.some(
        (e) => e.key === ValidationMessages.ASSET_RELATION_INCONSISTENT,
      ),
    ).toBe(true);
  });

  it("still flags an invalid relation type even when the asset resolves", () => {
    const errors: { key: string }[] = [];
    const warnings: unknown[] = [];

    // DataFlow → Function allows "invokes", not "is_an".
    validateAssetRelations(
      [{ id: "FN", name: "E-Stop" }],
      [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [
        {
          id: "7",
          name: "push cmd",
          displayId: "DF-3",
          assetRelations: [
            { assetId: "FN", assetGroup: "function", relationType: "is_an" },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warnings as any,
    );

    expect(
      errors.some((e) => e.key === ValidationMessages.ASSET_RELATION_TYPE_INVALID),
    ).toBe(true);
  });
});

describe("validateAssetRelations — data flows follow the element rules (B15)", () => {
  const flow = (assetGroup: string, relationType: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ id: "7", name: "push cmd", displayId: "DF-3", assetRelations: [{ assetId: "A", assetGroup, relationType }] }) as any;
  const run = (assetGroup: string, relationType: string) => {
    const errors: { key: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateAssetRelations([{ id: "A", name: "A" }], [], [flow(assetGroup, relationType)], errors as any, [] as any);
    return errors.filter((e) => e.key === ValidationMessages.ASSET_RELATION_TYPE_INVALID).length;
  };

  it("accepts what the rules allow for a DataFlow", () => {
    expect(run("data", "transports")).toBe(0);
    expect(run("function", "invokes")).toBe(0);
  });

  it("rejects what they do not", () => {
    expect(run("data", "stores")).toBe(1);
    expect(run("function", "executes")).toBe(1);
  });
});

describe("validateAssetRelations — the asset's group decides (B15)", () => {
  const sensor = (assetGroup: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ id: "s", type: "Sensor", name: "Door", displayId: "S-1", assetRelations: [{ assetId: "PH", assetGroup, relationType: "accesses" }] }) as any;
  const invalid = (known: { id: string; name: string; assetGroup?: string }[], relationGroup: string) => {
    const errors: { key: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateAssetRelations(known as any, [sensor(relationGroup)], [], errors as any, [] as any);
    return errors.filter((e) => e.key === ValidationMessages.ASSET_RELATION_TYPE_INVALID).length;
  };

  it("a physical 'accesses' stored with the wrong group copy is not a false positive", () => {
    // Sensor → infrastructure allows only "monitors"; Sensor → physical allows "accesses".
    expect(invalid([{ id: "PH", name: "Door", assetGroup: "physical" }], "infrastructure")).toBe(0);
  });

  it("without a known group the relation's copy is the fallback", () => {
    expect(invalid([{ id: "PH", name: "Door" }], "infrastructure")).toBe(1);
  });
});
