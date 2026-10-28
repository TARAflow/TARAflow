// tests/unit/shared/models/cybersecurity-concept.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4 (decision 25): goals and claims are
// shared texts linked per risk.

import { describe, it, expect } from "vitest";
import {
  addClaim,
  addGoal,
  claimsOfRisk,
  emptyCybersecurityConcept,
  goalsOfRisk,
  linkClaim,
  linkGoal,
  newClaim,
  newGoal,
  nextConceptDisplayId,
  unlinkGoal,
  updateGoal,
} from "shared";

describe("cybersecurity concept", () => {
  it("display ids CSG-nn / CLM-nn: one more than the highest", () => {
    expect(nextConceptDisplayId("CSG", [])).toBe("CSG-01");
    expect(nextConceptDisplayId("CLM", [{ displayId: "CLM-03" }, { displayId: "CSG-09" }])).toBe("CLM-04");
  });

  it("a goal is created for one risk, linked to more, unlinked again", () => {
    let c = emptyCybersecurityConcept();
    const g = newGoal(c, "R-1", "  Protect the loop  ", [{ assetId: "a1", property: "I" }]);
    c = addGoal(c, g);
    expect(goalsOfRisk(c, "R-1")[0]).toMatchObject({ displayId: "CSG-01", statement: "Protect the loop", riskIds: ["R-1"] });
    c = linkGoal(c, g.id, "R-2");
    c = linkGoal(c, g.id, "R-2"); // no duplicate
    expect(c.goals[0].riskIds).toEqual(["R-1", "R-2"]);
    c = updateGoal(c, g.id, { statement: "Protect the alarm loop" });
    expect(goalsOfRisk(c, "R-2")[0].statement).toBe("Protect the alarm loop");
    c = unlinkGoal(c, g.id, "R-1");
    expect(goalsOfRisk(c, "R-1")).toEqual([]);
    expect(c.goals).toHaveLength(1); // the goal stays
  });

  it("claims: kind, empty assumptions, linked per risk", () => {
    let c = emptyCybersecurityConcept();
    const k = newClaim(c, "R-3", "retain", "Physical access needs tools");
    c = addClaim(linkClaim(addClaim(c, k), "nope", "R-4"), newClaim(addClaim(c, k), "R-4", "share", "Supplier carries it"));
    expect(claimsOfRisk(c, "R-3")[0]).toMatchObject({ displayId: "CLM-01", kind: "retain", assumptionIds: [] });
    expect(claimsOfRisk(c, "R-4")[0]).toMatchObject({ displayId: "CLM-02", kind: "share" });
  });
});
