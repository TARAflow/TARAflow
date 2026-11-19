// Multi-project TARA phase 6a-3: the list for a component's platform team —
// what this TARA decided differently — and its Markdown for "Copy as text".

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { componentDeviations } from "app/services/component-import/component-deviations";
import { deviationsMarkdown, deviationGroups, deviationText } from "shared/services/component-deviations";
import { instanceAssetId } from "features/dfd";
import { componentThreatGroups } from "app/utils/component-threats";
import { component, machine, tid } from "../../../../fixtures/component-treatment-machine";

const t = (k: string, d?: string) => d ?? k;

/** The fixture machine with one decision of every kind in its instance SD1. */
const decided = (): Project => {
  const m = machine();
  const imported = m.components!.imports[0];
  const snapshotAsset = imported.snapshot.assets[0];
  const own = new Set((snapshotAsset.securityGoals ?? []).filter((g) => g.level && g.level !== "none").map((g) => g.type));
  const added = (["C", "I", "A", "N"] as const).find((g) => !own.has(g))!;
  const asset = {
    ...snapshotAsset,
    id: instanceAssetId("i1", snapshotAsset.id),
    displayId: `SD1:${snapshotAsset.displayId}`,
    securityGoals: [...(snapshotAsset.securityGoals ?? []), { type: added, level: "high", rationale: "The alarm must arrive" }],
  };
  const row = componentThreatGroups(m)[0].rows[0];
  const instance = {
    ...m.components!.instances[0],
    measureOverrides: [{ measureId: "M-C-001", rationale: "Frames are not checked here", date: "2026-11-12" }],
    assumptions: [{ instanceId: "i1", assumptionId: "a1", status: "not_fulfilled" as const, rationale: "The PLC does not check frames", evidence: { note: "Checked with the PLC vendor" } }],
    relevanceOverrides: [{ threatKey: row.threatKey, relevance: "not_relevant" as const, rationale: "Sealed", componentRelevance: row.componentRelevance as never, date: "2026-11-12" }],
    citedClaims: [{ claimId: "c1", requirements: ["iec-62443-4-2:cr-1.1"], date: "2026-11-12" }],
  };
  return {
    ...m,
    components: { ...m.components!, instances: [instance] },
    assets: { assets: [asset], configuration: {} } as never,
    threats: null,
    attackTrees: null,
  } as Project;
};

describe("componentDeviations (6a-3)", () => {
  it("one entry per decision of this TARA, in its instance", () => {
    const list = componentDeviations(decided()).get("imp")!;
    expect(list.map((d) => d.kind).sort()).toEqual(["assumption_not_fulfilled", "claim_cited", "goal_added", "measure_not_effective", "relevance_overridden"]);
    expect(list.every((d) => d.prefix === "SD1")).toBe(true);
    const goal = list.find((d) => d.kind === "goal_added")!;
    expect(goal).toMatchObject({ level: "high", rationale: "The alarm must arrive" });
    const measure = list.find((d) => d.kind === "measure_not_effective")!;
    expect(measure).toMatchObject({ measure: "M-C-001 — Signed sensor frames", rationale: "Frames are not checked here" });
    const aou = list.find((d) => d.kind === "assumption_not_fulfilled")!;
    expect(aou).toMatchObject({ assumption: "ASM-01 Frames are checked by the controller", rationale: "The PLC does not check frames", evidence: { measures: [], elements: [], note: "Checked with the PLC vendor" } });
    expect(list.find((d) => d.kind === "claim_cited")).toMatchObject({ claim: "CLM-01 The integrator isolates the sensor bus", requirements: ["iec-62443-4-2:cr-1.1"] });
    expect(list.find((d) => d.kind === "relevance_overridden")).toMatchObject({ to: "not_relevant", rationale: "Sealed" });
  });

  it("nothing decided → an empty list; no imports → no entry", () => {
    expect(componentDeviations({ ...machine(), threats: null, assets: null, attackTrees: null }).get("imp")).toEqual([]);
    expect(componentDeviations({ components: undefined, risks: null, dfd: null, threats: null, assets: null, attackTrees: null }).size).toBe(0);
  });

  it("Markdown for the platform team: the component and its state, the contact, one group per kind", () => {
    const list = componentDeviations(decided()).get("imp")!;
    const md = deviationsMarkdown({ name: "Smoke Detector", at: "sd/v1", responsible: "Platform team" }, list, t);
    expect(md.startsWith("## Deviations from Smoke Detector @ sd/v1\n\nFor: Platform team\n")).toBe(true);
    // what only the component can fix first
    expect(deviationGroups(list, t).map((g) => g.heading)).toEqual([
      "Goals added by this TARA",
      "Measures not effective here",
      "Assumptions of use not fulfilled",
      "Threat relevances overridden",
    ]);
    // a cited claim is no deviation: listed apart, what this TARA relies on (review 2026-11-12)
    expect(md).toContain("## This TARA relies on — a change affects it\n\n### Claims this TARA cites\n\n- SD1: CLM-01 The integrator isolates the sensor bus — cited for iec-62443-4-2:cr-1.1");
    expect(md).toContain("- SD1: M-C-001 — Signed sensor frames — Frames are not checked here");
    expect(md).toContain("- SD1: ASM-01 Frames are checked by the controller — The PLC does not check frames (evidence: Checked with the PLC vendor)");
    expect(deviationsMarkdown({ name: "X", at: "a" }, [], t)).toContain("No deviations");
  });

  it("an intrinsic factor of the component rated anew by this TARA (review 2026-11-12)", () => {
    const m = machine();
    const risk = m.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;
    const imported = m.components!.imports[0];
    // the component rated skill_level 2 on this risk; the machine says 4, with its reason
    const snapshot = structuredClone(imported.snapshot);
    const componentRisk = snapshot.risks.find((r) => r.threatId === component.reduceThreat)!;
    componentRisk.intrinsicFactors = [{ factorId: "skill_level", value: 2 }];
    risk.factorRatings = [{ factorId: "skill_level", value: 4, weight: 1, source: "manual", overrideRationale: "Only experts reach the bus" }] as never;
    const p = { ...m, components: { ...m.components!, imports: [{ ...imported, snapshot }] }, threats: null, assets: null, attackTrees: null } as Project;
    const f = componentDeviations(p).get("imp")!.find((d) => d.kind === "factor_overridden")!;
    expect(f).toMatchObject({ prefix: "SD1", factor: "skill_level", from: 2, to: 4, rationale: "Only experts reach the bus" });
    expect(deviationText(f, t)).toBe(`${(f as { risk: string }).risk}: skill_level 2 → 4 — Only experts reach the bus`);
  });

  it("an added goal without a component threat asks for a new revision (patch 51)", () => {
    expect(deviationText({ kind: "goal_added", prefix: "SD1", asset: "SD1:DA-001 smoke", goal: "A", level: "high", revision: true }, t)).toBe(
      "A (high) added to SD1:DA-001 smoke — the component has no threat for it: request a new revision",
    );
  });

  it("the revision signal comes from the asset check: an added goal with a component threat without it, one without a threat with it (review 2026-11-12)", () => {
    const m = machine();
    const imported = m.components!.imports[0];
    // P-2 of the component carries threats T, I, D, E in the instance — none of category R
    const p2 = componentThreatGroups(m)[0].rows.find((r) => r.threat.displayId === "SD1:P2-T-1")!.threat.linkedElement!.elementId;
    const plain = imported.snapshot.assets.find((a) => a.displayId === "DA-005")!; // no goal, no link in the component
    const asset = {
      ...plain,
      id: instanceAssetId("i1", plain.id),
      displayId: "SD1:DA-005",
      linkedDFDElements: [{ elementId: p2, elementName: "P-2", elementType: "Process", displayId: "SD1:P-2", relationType: "creates" }],
      securityGoals: [
        { type: "I", level: "high", rationale: "Tampering on P-2" }, // integrity ← T: the component has a threat
        { type: "N", level: "medium", rationale: "Who sent it" }, // non-repudiation ← R: none
      ],
    };
    const p = { ...m, assets: { assets: [asset], configuration: {} } as never, threats: null, attackTrees: null } as Project;
    const goals = componentDeviations(p).get("imp")!.filter((d) => d.kind === "goal_added") as Extract<ReturnType<typeof componentDeviations> extends Map<string, (infer D)[]> ? D : never, { kind: "goal_added" }>[];
    expect(goals.map((g) => [g.goal, g.revision])).toEqual([
      ["I", false],
      ["N", true],
    ]);
  });
});

