// tests/unit/features/audit/services/diff-service.concept.test.ts
//
// ISO/SAE 21434 plan Phase 1 stage A and Phase 4: the Item Definition, goals /
// claims and verification entries are part of the project file, so the audit
// diff shows their changes (and a verification can be committed on its own).

import { describe, it, expect } from "vitest";
import { DiffService } from "features/audit/services/diff-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const svc = new DiffService();
const base = (): Any => ({
  dfd: null,
  assets: null,
  threats: null,
  risks: null,
  attackTrees: null,
  itemDefinition: { sections: { boundary: { text: "Head" } }, functions: [], assumptions: [] },
  cybersecurityConcept: { goals: [{ id: "g1", displayId: "CSG-01", statement: "a", riskIds: [], assetProperties: [] }], claims: [], verifications: [] },
});

describe("audit diff — item definition, goals / claims, verification", () => {
  it("no change, no section", () => {
    expect(svc.detectChanges(base(), base())).toEqual([]);
  });

  it("a section text, a new assumption, a goal statement and a verification entry", () => {
    const cur = base();
    cur.itemDefinition.sections.boundary.text = "Head and loop";
    cur.itemDefinition.assumptions.push({ id: "as1", displayId: "ASM-01", text: "x", status: "open" });
    cur.cybersecurityConcept.goals[0].statement = "b";
    cur.cybersecurityConcept.verifications.push({ id: "v1", date: "2026-10-29", reviewer: "A", scope: [], result: "passed", stateHash: "h" });
    const phases = svc.detectChanges(cur, base());
    expect(phases.map((p) => [p.phaseLabel, p.changes.map((c) => `${c.type}:${c.description}`)])).toEqual([
      ["Item Definition", ["modified:Section modified: 1 field(s) changed", "added:Assumption added"]],
      ["Goals & Claims", ["modified:Goal modified: 1 field(s) changed"]],
      ["Verification", ["added:Verification added"]],
    ]);
  });
});
