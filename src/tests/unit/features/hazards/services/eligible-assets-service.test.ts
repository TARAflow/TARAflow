// src/tests/unit/features/hazards/services/eligible-assets-service.test.ts
import { describe, it, expect } from "vitest";
import { eligibleAssets, targetKindForAssetGroup } from "features/hazards";
import type { AssetReference } from "shared";

const ref = (id: string, assetGroup: string): AssetReference => ({
  id,
  name: id,
  assetGroup,
  hasSafetyAnnotation: false,
});

const assets: AssetReference[] = [
  ref("A-01", "system"),
  ref("A-02", "human"),
  ref("A-03", "environment"),
  ref("A-04", "infrastructure"),
  ref("A-05", "service"),
  ref("A-06", "data"),
];

describe("eligibleAssets", () => {
  it("filters contributors to allowed source categories (excludes human, service)", () => {
    expect(eligibleAssets(assets, "contributor").map((a) => a.id)).toEqual([
      "A-01",
      "A-04",
      "A-06",
    ]);
  });

  it("filters targets to protection-target categories", () => {
    expect(eligibleAssets(assets, "target").map((a) => a.id)).toEqual([
      "A-02",
      "A-03",
      "A-04",
    ]);
  });

  it("infrastructure is eligible on both sides", () => {
    expect(
      eligibleAssets(assets, "contributor").some((a) => a.assetGroup === "infrastructure"),
    ).toBe(true);
    expect(
      eligibleAssets(assets, "target").some((a) => a.assetGroup === "infrastructure"),
    ).toBe(true);
  });
});

describe("targetKindForAssetGroup", () => {
  it("maps the three protection-target groups", () => {
    expect(targetKindForAssetGroup("human")).toBe("human");
    expect(targetKindForAssetGroup("environment")).toBe("environment");
    expect(targetKindForAssetGroup("infrastructure")).toBe("infrastructure");
  });

  it("returns undefined for non-target groups", () => {
    expect(targetKindForAssetGroup("system")).toBeUndefined();
    expect(targetKindForAssetGroup("data")).toBeUndefined();
  });
});
