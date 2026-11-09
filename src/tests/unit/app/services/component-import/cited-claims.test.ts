// Multi-project TARA phase 4c (design §8.1, decided 2026-11-09): the machine
// cites a supporting claim of an imported component for matrix rows —
// stored per instance; whether it counts is derived from the assumptions
// behind the claim in the instance (the I7 rule), and it covers only the
// instance's elements. Diff-detected with the instance, copied with the
// decisions.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { instanceClaims, withCitedClaim } from "app/services/component-import/cited-claims";
import { withAssumptionStatus } from "app/services/component-import/assumption-status";
import { copyInstanceRatings } from "app/services/component-import/copy-ratings";
import { componentOwnership } from "app/services/component-import/component-scope";
import { DiffService } from "features/audit/services/diff-service";
import { machine } from "../../../../fixtures/component-treatment-machine";

const REQ = "iec-62443-4-2:cr-3.5";
/** The machine, its component with a supporting claim relying on ASM-01 (a1). */
const project = (): Project => {
  const m = machine();
  const imp = m.components!.imports[0];
  const concept = {
    ...(imp.snapshot.concept ?? { goals: [], claims: [] }),
    claims: [
      ...(imp.snapshot.concept?.claims ?? []),
      { id: "cs1", displayId: "CLM-03", kind: "supporting", statement: "The cabinet is locked", riskIds: [], assumptionIds: ["a1"], requirements: [REQ], responsibleParty: "Integrator" },
    ],
  };
  return { ...m, components: { ...m.components!, imports: [{ ...imp, snapshot: { ...imp.snapshot, concept } }] } } as Project;
};
const cite = (p: Project, cited: boolean, instanceId = "i1") =>
  ({ ...p, components: withCitedClaim(p.components!, instanceId, "cs1", [REQ], cited, "2026-11-09") }) as Project;
const claim = (p: Project) => instanceClaims(p).find((c) => c.claimId === "cs1")!;

describe("cited component claims (phase 4c)", () => {
  it("only supporting claims, with the prefix; the suggestion from the component's requirements", () => {
    const all = instanceClaims(project());
    expect(all.map((c) => c.displayId)).toEqual(["SD1 CLM-03"]); // the share claim CLM-01 is not citable
    expect(claim(project())).toMatchObject({ componentRequirements: [REQ], citedRequirements: [], responsibleParty: "Integrator" });
  });

  it("cite and withdraw per row's requirements", () => {
    const p = cite(project(), true);
    expect(p.components!.instances[0].citedClaims).toEqual([{ claimId: "cs1", requirements: [REQ], date: "2026-11-09" }]);
    expect(claim(p).citedRequirements).toEqual([REQ]);
    expect(cite(p, false).components!.instances[0].citedClaims).toBeUndefined();
  });

  it("counts by the assumptions behind it (the I7 rule): open → unclear, not fulfilled → not effective, fulfilled → effective", () => {
    let p = cite(project(), true);
    expect(claim(p).state).toBe("unclear");
    p = { ...p, components: withAssumptionStatus(p.components!, "i1", "a1", { status: "not_fulfilled" }) } as Project;
    expect(claim(p).state).toBe("not_effective");
    p = { ...p, components: withAssumptionStatus(p.components!, "i1", "a1", { status: "fulfilled" }) } as Project;
    expect(claim(p).state).toBe("effective");
    // fulfilled by a machine measure not implemented yet → unclear again
    p = { ...p, components: withAssumptionStatus(p.components!, "i1", "a1", { status: "fulfilled", evidence: { mitigationIds: ["M-T-001"] } }) } as Project;
    expect(claim(p).state).toBe("unclear");
  });

  it("covers only the instance's elements", () => {
    const p = project();
    const owned = [...componentOwnership(p).keys()];
    expect(claim(p).concernsElementIds.sort()).toEqual(owned.sort());
    expect(claim(p).concernsElementIds).not.toContain("m_p1");
  });

  it("the audit diff sees a citation (commit gate); copying takes it with the decisions", () => {
    const strip = (x: Project) => ({ ...x, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(cite(project(), true)), strip(project())).find((c) => c.phase === "components")!;
    expect(section.changes[0].details!.map((d) => d.field)).toContain("citedClaims");

    const base = project();
    const second = { ...base.components!.instances[0], id: "i2", prefix: "SD2" };
    const two = cite({ ...base, components: { ...base.components!, instances: [...base.components!.instances, second] } } as Project, true);
    const copied = copyInstanceRatings(two, "i1", "i2", { decisions: true, assetImpact: false, mode: "fill" });
    expect(copied.components.instances.find((i) => i.id === "i2")!.citedClaims).toEqual([{ claimId: "cs1", requirements: [REQ], date: "2026-11-09" }]);
    expect(copied.counts.citedClaims).toBe(1);
  });
});
