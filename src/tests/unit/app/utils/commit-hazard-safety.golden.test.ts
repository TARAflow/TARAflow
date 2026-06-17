// tests/unit/app/utils/commit-hazard-safety.golden.test.ts
//
// Characterisation of the audit-relevant output: which assets the HazardItem
// chain re-rates and to what physicalImpact / aggregatedImpact. SmokeDetector
// has exactly one contributes_to edge (SY-001), so under the cause-only policy
// only SY-001 is re-rated — every endangered (victim) asset stays untouched.
//
// The snapshot is the deliberate golden: regenerate with `vitest -u` only when
// the safety-derivation rules change on purpose.

import { describe, it, expect } from "vitest";

import { loadProjectFixture, FIXTURES } from "../../../fixtures/load-fixture";
import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { commitHazardSafety } from "app/utils/commit-hazard-safety";

describe("commit-hazard-safety — SmokeDetector golden", () => {
  const project = loadProjectFixture(FIXTURES.smokeDetector);
  const before = project.assets!.assets;
  const summaries = buildAssetHazardLinks(project.hazards);
  const after = commitHazardSafety(project.assets, summaries)!.assets;

  // Assets whose stored safety values changed, in stable order.
  const changed = after
    .filter((a, i) => a !== before[i])
    .map((a) => ({
      id: a.id,
      physicalImpact: a.physicalImpact,
      physicalImpactSource: a.physicalImpactSource,
      aggregatedImpact: a.aggregatedImpact,
    }));

  it("re-rates only the single cause asset (SY-001)", () => {
    expect(changed.map((c) => c.id)).toEqual(["SY-001"]);
  });

  it("SY-001 inherits irreversible_injury [indirect] → HIGH+ (no override)", () => {
    const sy = after.find((a) => a.id === "SY-001")!;
    expect(sy.physicalImpact).toBe("irreversible_injury");
    expect(sy.physicalImpactSource).toBe("hazard");
    expect(sy.aggregatedImpact).toBe("HIGH+");
    expect(sy.physicalImpactRationale).toContain("[indirect]");
  });

  it("pure protection targets keep their stored values", () => {
    // No endangered-only asset is turned into a "hazard"-sourced rating.
    const hazardSourced = after.filter(
      (a) => a.physicalImpactSource === "hazard",
    );
    expect(hazardSourced.map((a) => a.id)).toEqual(["SY-001"]);
  });

  it("audit snapshot of hazard-derived asset safety", () => {
    expect(changed).toMatchSnapshot();
  });
});
