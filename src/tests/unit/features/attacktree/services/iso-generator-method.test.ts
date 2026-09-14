import { describe, it, expect } from "vitest";
import { generateFromAsset } from "features/attacktree/services/attacktree-service";
import type { AttackTreeProjectData } from "features/attacktree/models/attacktree-types";

const projectData = (isoMode: boolean): AttackTreeProjectData =>
  ({
    id: "p", name: "p", phaseStatus: {}, isHighImpact: true, isoMode,
    attackTrees: null, threats: [], risks: [], dfdElements: [], mitigations: [],
    assets: [
      { id: "a1", name: "Data communication (lamp request)", displayId: "DA-001",
        overallImpact: 4, securityGoals: [{ type: "I", enabled: true }] },
    ],
  }) as unknown as AttackTreeProjectData;

describe("attack-tree generator — ISO 21434 method", () => {
  it("emits attack-potential (18045) leaves + header in ISO mode", () => {
    const t = generateFromAsset(projectData(true), "a1", "I")!;
    expect(t.dsl).toContain("# Method: Attack Potential (ISO/IEC 18045)");
    expect(t.dsl).toContain("et=1w,se=proficient,kn=restricted,wo=moderate,eq=standard");
    expect(t.dsl).toContain("# Asset DisplayId: DA-001");
    expect(t.dsl).not.toContain("0.5,0.5,3");
  });

  it("keeps the extended (f,b,i) model outside ISO", () => {
    const t = generateFromAsset(projectData(false), "a1", "I")!;
    expect(t.dsl).toContain("# Method: Extended (f,b,i)");
    expect(t.dsl).toContain("0.5,0.5,3");
    expect(t.dsl).not.toContain("et=1w");
  });
});
