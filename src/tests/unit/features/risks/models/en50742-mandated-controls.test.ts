// tests/unit/features/risks/models/en50742-mandated-controls.test.ts
//
// EN 50742 Approach A §11.4: which 7.4.3 protection requirements a threat
// mandates depends on its anchor type (Interface vs DataFlow) and STRIDE
// category, at the risk's computed SRSL tier. R/I/D mandate nothing
// ("Option B" — standard method only).

import { describe, it, expect } from "vitest";

import {
  mandatedRequirementsForThreat,
  EN50742_MANDATED_CLAUSES,
} from "features/risks/models/en50742-approach-a-core";

describe("mandatedRequirementsForThreat (§11.4 STRIDE → mandated 7.4.3 control)", () => {
  it("Interface × S → Authentication (unique)", () => {
    const reqs = mandatedRequirementsForThreat("Interface", "S", "SRSL3");
    expect(reqs.map((r) => r.clause)).toEqual(["7.4.3.2.1"]);
    expect(reqs[0].category).toBe("Authentication");
    expect(reqs[0].requirement).toContain("uniquely authenticated");
  });

  it("Interface × E → Authorization enforcement", () => {
    const reqs = mandatedRequirementsForThreat("Interface", "E", "SRSL2");
    expect(reqs.map((r) => r.clause)).toEqual(["7.4.3.3.1"]);
  });

  it("Interface × T → several Integrity clauses (user picks ≥1)", () => {
    const reqs = mandatedRequirementsForThreat("Interface", "T", "SRSL3");
    expect(reqs.length).toBeGreaterThan(1);
    expect(reqs.every((r) => r.clause.startsWith("7.4.3.4"))).toBe(true);
  });

  it("DataFlow × T → information exchange integrity (unique)", () => {
    const reqs = mandatedRequirementsForThreat("DataFlow", "T", "SRSL2");
    expect(reqs.map((r) => r.clause)).toEqual(["7.4.3.4.3"]);
  });

  it("R/I/D mandate nothing (Option B)", () => {
    for (const stride of ["R", "I", "D"] as const) {
      expect(
        mandatedRequirementsForThreat("Interface", stride, "SRSL3"),
      ).toEqual([]);
    }
    for (const stride of ["I", "D"] as const) {
      expect(
        mandatedRequirementsForThreat("DataFlow", stride, "SRSL3"),
      ).toEqual([]);
    }
  });

  it("DataFlow × S/R/E belong to the endpoint interface → nothing here", () => {
    for (const stride of ["S", "R", "E"] as const) {
      expect(
        mandatedRequirementsForThreat("DataFlow", stride, "SRSL3"),
      ).toEqual([]);
    }
  });

  it("SRSL0 tier yields no mandated requirement (all 'None')", () => {
    // At SRSL0 the mapped clauses are 'None' → filtered out.
    expect(
      mandatedRequirementsForThreat("Interface", "S", "SRSL0"),
    ).toEqual([]);
  });

  it("the clause map only covers combinations that can occur", () => {
    // Interface has S,T,E mandated; DataFlow only T.
    expect(Object.keys(EN50742_MANDATED_CLAUSES.Interface).sort()).toEqual([
      "E",
      "S",
      "T",
    ]);
    expect(Object.keys(EN50742_MANDATED_CLAUSES.DataFlow)).toEqual(["T"]);
  });
});
