// tests/unit/app/utils/build-asset-hazard-links.s0.test.ts
//
// ISO/SAE 21434 conformance plan 1H-S (decision 13 C, 24): a person edge rated
// "none" (no injury, S0) is a rating, not harm. The link shows it; it enters
// no aggregation, does not make the person a hazard target and gives its
// causes no severity — so no asset turns safety-relevant and the hazard
// safety commit writes nothing.

import { describe, it, expect } from "vitest";

import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { commitHazardSafety } from "app/utils/commit-hazard-safety";
import type { HazardData } from "features/hazards";
import type { Asset } from "features/assets";

const data = (personSeverity: string, extra: object[] = []): HazardData =>
  ({
    hazards: [{ id: "H1", label: "Pinch", combinationType: "ANY", source: "manual" }],
    relations: [
      { type: "contributes_to", from: "SY-1", to: "H1", relevance: "direct", hazardDistance: 0 },
      { type: "endangers", from: "H1", to: "HU-1", impact: { target: "human", severity: personSeverity } },
      ...extra,
    ],
    configuration: { defaultCombinationType: "ANY", maxHops: 1, requireHazardType: false },
  }) as unknown as HazardData;

describe("1H-S — a person edge rated 'none' (S0)", () => {
  it("the link shows S0, but the person is no hazard target and has no worst severity", () => {
    const hu = buildAssetHazardLinks(data("none"))["HU-1"];
    expect(hu.endangeredBy.map((l) => l.severity)).toEqual(["none"]);
    expect(hu.isHazardTarget).toBe(false);
    expect(hu.worstSeverity).toBeUndefined();
  });

  it("its causes inherit no severity", () => {
    const sy = buildAssetHazardLinks(data("none"))["SY-1"];
    expect(sy.contributesTo[0].severity).toBeUndefined();
    expect(sy.causeSeverity).toBeUndefined();
    expect(sy.causeDirect).toBe(false);
  });

  it("a real harm next to it still counts", () => {
    const links = buildAssetHazardLinks(
      data("none", [{ type: "endangers", from: "H1", to: "HU-2", impact: { target: "human", severity: "fatal" } }]),
    );
    expect(links["HU-1"].isHazardTarget).toBe(false);
    expect(links["HU-2"].isHazardTarget).toBe(true);
    expect(links["SY-1"].causeSeverity).toBe("fatal");
  });

  it("environment and infrastructure edges keep making a hazard target", () => {
    const links = buildAssetHazardLinks(
      data("none", [{ type: "endangers", from: "H1", to: "IF-1", impact: { target: "infrastructure", severity: "low" } }]),
    );
    expect(links["IF-1"].isHazardTarget).toBe(true);
  });

  it("the hazard safety commit writes nothing for the cause (no physicalImpact from the hazard)", () => {
    const asset = {
      id: "SY-1",
      numericId: 1,
      name: "Press",
      assetGroup: "system",
      impactRatings: [],
      overallImpact: 1,
      securityGoals: [],
      linkedDFDElements: [],
      source: "dfd",
      syncedWithDFD: true,
      created: "t0",
      lastModified: "t0",
    } as unknown as Asset;
    const assets = { assets: [asset], relations: [] } as never;
    const after = (severity: string) => {
      const out = commitHazardSafety(assets, buildAssetHazardLinks(data(severity)));
      return ((out ?? assets) as { assets: Asset[] }).assets[0];
    };
    expect(after("none").physicalImpact).toBeUndefined();
    expect(after("none").physicalImpactSource).toBeUndefined();
    // Control: a harm does write it.
    expect(after("fatal").physicalImpact).toBe("fatal");
    expect(after("fatal").physicalImpactSource).toBe("hazard");
  });
});
