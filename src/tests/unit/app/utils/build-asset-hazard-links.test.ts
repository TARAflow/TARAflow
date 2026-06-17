// tests/unit/app/utils/build-asset-hazard-links.test.ts
//
// Phase 3 coverage for the hazard → asset projection (§6).
// Expected values verified against the SmokeDetector fixture.

import { describe, it, expect } from "vitest";

import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { loadProjectFixture, FIXTURES } from "../../../fixtures/load-fixture";

describe("Phase 3 — buildAssetHazardLinks", () => {
  const project = loadProjectFixture(FIXTURES.smokeDetector);
  const byAsset = buildAssetHazardLinks(project.hazards);

  it("maps endangers edges to endangeredBy with worst severity", () => {
    const hu002 = byAsset["HU-002"];
    expect(hu002.endangeredBy).toHaveLength(45);
    expect(hu002.contributesTo).toHaveLength(0);
    expect(hu002.isHazardTarget).toBe(true);
    expect(hu002.worstSeverity).toBe("fatality");
    // links carry human-readable hazard metadata + role
    expect(hu002.endangeredBy[0].role).toBe("endangered");
    expect(hu002.endangeredBy[0].externalRef).toBeDefined();
    expect(hu002.endangeredBy[0].label).toBeTruthy();
  });

  it("worst severity reflects the single edge on HU-006", () => {
    expect(byAsset["HU-006"].endangeredBy).toHaveLength(1);
    expect(byAsset["HU-006"].worstSeverity).toBe("irreversible_injury");
    // pure protection target → no attack-surface (cause) rating
    expect(byAsset["HU-006"].causeSeverity).toBeUndefined();
  });

  it("maps contributes_to edges to contributesTo (cause role) with bowtie severity", () => {
    const sy001 = byAsset["SY-001"];
    expect(sy001.contributesTo).toHaveLength(1);
    expect(sy001.contributesTo[0].role).toBe("cause");
    // bowtie: SY-001 contributes [indirect] to a hazard that endangers with
    // irreversible_injury → the cause inherits that severity.
    expect(sy001.contributesTo[0].relevance).toBe("indirect");
    expect(sy001.contributesTo[0].severity).toBe("irreversible_injury");
    expect(sy001.worstSeverity).toBe("irreversible_injury");
    // cause-side attack-surface rating
    expect(sy001.causeSeverity).toBe("irreversible_injury");
    expect(sy001.causeDirect).toBe(false); // contributes [indirect]
    expect(sy001.isHazardTarget).toBe(false);
    expect(sy001.endangeredBy).toHaveLength(0);
  });

  it("uninvolved assets have no summary", () => {
    expect(byAsset["DA-001"]).toBeUndefined();
  });

  it("null hazards → empty map", () => {
    expect(buildAssetHazardLinks(null)).toEqual({});
  });
});