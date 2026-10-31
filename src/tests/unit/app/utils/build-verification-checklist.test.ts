// tests/unit/app/utils/build-verification-checklist.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-3: open findings per point of
// RQ-09-07 — the checklist of a new verification entry.

import { describe, it, expect } from "vitest";
import { buildVerificationChecklist } from "app/utils/build-verification-checklist";

describe("verification checklist", () => {
  it("ISO: item definition gaps (a), avoid unjustified / reduce without control (b), missing goal / claim (c), invalid assumption (d)", () => {
    const project = {
      info: { description: "Detects smoke", tags: { domain: [], platform: [], regulation: ["ISO/SAE 21434"], custom: [] } },
      itemDefinition: { sections: {}, functions: [], assumptions: [{ id: "as1", displayId: "ASM-01", text: "x", status: "invalid" }] },
      dfd: { elements: [{ id: "tb1", displayId: "TB-1", name: "Device", type: "TrustBoundary", properties: { assumptionIds: ["as1"] } }] },
      risks: {
        risks: [
          { id: "R-1", threatDisplayId: "AT-1.1", treatment: "reduce", treatmentJustification: "" },
          { id: "R-2", threatDisplayId: "AT-1.2", treatment: "eliminate", treatmentJustification: "" },
          { id: "R-3", threatDisplayId: "AT-1.3", treatment: "accept", treatmentJustification: "" },
        ],
      },
      cybersecurityConcept: {
        goals: [],
        claims: [{ id: "c1", displayId: "CLM-01", statement: "x", kind: "retain", riskIds: ["R-3"], assumptionIds: ["as1"] }],
        verifications: [],
      },
    } as never;
    expect(buildVerificationChecklist(project, "2026-10-29")).toEqual([
      { scope: "tara", open: 3 }, // boundary, architecture, environment
      { scope: "treatment", open: 2 }, // R-2 avoid without justification, R-1 reduce without a mitigation
      { scope: "goals-claims", open: 1 }, // R-1 without goal
      { scope: "consistency", open: 2 }, // CLM-01 invalid assumption, ASM-01 invalid but used by TB-1
    ]);
  });
});
