// Multi-project TARA phase 5c (design §9.2; decided 2026-11-09: per import,
// one change): the project before → after an update. The same instance ids
// keep what the new state still has; decisions are taken over, put to
// review or dropped; a pairing moves them (to review, under the new key with
// the old basis); risks of removed threats go, of paired threats move.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import { applyComponentUpdate } from "app/services/component-import/component-update";
import { snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { withRelevanceOverride } from "app/services/component-import/relevance-overrides";
import { openReviews, reviewKey, DECISION_KINDS } from "app/services/component-import/update-inventory";
import { componentInstanceTfId } from "features/dfd";
import { generateRiskId } from "features/risks";
import { component, machine, tid } from "../../../../fixtures/component-treatment-machine";

/** The machine with a rated, ticketed risk on the reduce threat and a relevance override on it. */
const decided = (): Project => {
  let m = machine();
  m = { ...m, components: withRelevanceOverride(m.components!, "i1", component.reduceThreat, { relevance: "relevant", rationale: "own", componentRelevance: "relevant" }, "d") } as Project;
  const risks = m.risks!.risks.map((r) =>
    r.threatId === tid(component.reduceThreat)
      ? { ...r, factorRatings: r.factorRatings.map((f, i) => (i === 0 ? { ...f, value: 3 } : f)), selectedMitigations: [{ id: "M-T-001", status: "in_progress", ticketId: "ABC-123" }] }
      : r,
  );
  const reduceRiskId = risks.find((r) => r.threatId === tid(component.reduceThreat))!.id;
  return {
    ...m,
    risks: { ...m.risks!, risks },
    cybersecurityConcept: { goals: [{ id: "g1", displayId: "CSG-01", riskIds: [reduceRiskId] }], claims: [] },
  } as unknown as Project;
};
const snap = (p: Project) => p.components!.imports[0].snapshot as ComponentSnapshot;
const edit = (s: ComponentSnapshot, f: (x: ComponentSnapshot) => void) => {
  const c = structuredClone(s);
  f(c);
  return c;
};
const update = (p: Project, next: ComponentSnapshot, pairing = {}) =>
  applyComponentUpdate({
    project: p,
    importId: p.components!.imports[0].id,
    result: { snapshot: next, contentHash: snapshotContentHash(next), source: { schemaVersion: 14, commitSha: "c2" }, methodology: null },
    pairing,
    updatedAt: "2026-11-10",
  });
const riskOf = (p: Project, threatId: string) => p.risks!.risks.find((r) => r.threatId === threatId);

describe("applyComponentUpdate (phase 5c)", () => {
  it("the same state: nothing dropped, nothing to review; ids, risks and the DFD stay; the import records the new hash", () => {
    const p = decided();
    const r = update(p, structuredClone(snap(p)));
    expect(r.commitLines).toEqual([]);
    expect(r.project.components!.instances[0].reviewBasis).toBeUndefined();
    expect(r.project.risks!.risks.map((x) => x.id).sort()).toEqual(p.risks!.risks.map((x) => x.id).sort());
    expect(r.project.dfd!.elements!.map((e) => e.id).sort()).toEqual(p.dfd!.elements!.map((e) => e.id).sort());
    expect(r.project.components!.imports[0]).toMatchObject({ contentHash: snapshotContentHash(snap(p)), importedAt: "2026-11-10", source: { commitSha: "c2" } });
  });

  it("a changed threat text: its rating and override stay, to review (reviewBasis with the old basis)", () => {
    const p = decided();
    const next = edit(snap(p), (s) => {
      for (const t of s.threats!.perElementTables) for (const x of t.threats) if (x.id === component.reduceThreat) x.threatDescription = "changed";
    });
    const r = update(p, next);
    const inst = r.project.components!.instances[0];
    expect(riskOf(r.project, tid(component.reduceThreat))).toBeDefined();
    expect(inst.relevanceOverrides?.[0].threatKey).toBe(component.reduceThreat);
    // the treatment rests on the component's treatment, not the text: taken over
    expect(openReviews(inst, next).map((x) => x.kind).sort()).toEqual(["relevanceOverride", "riskRating"]);
    expect(inst.reviewBasis?.[reviewKey("riskRating", `threat|${component.reduceThreat}`)]).toBe(DECISION_KINDS.riskRating.basis(snap(p), `threat|${component.reduceThreat}`));
  });

  it("a removed threat: its risk goes, the concept's reference with it; the commit lines name the dropped decisions and the ticket", () => {
    const p = decided();
    const next = edit(snap(p), (s) => {
      for (const t of s.threats!.perElementTables) t.threats = t.threats.filter((x) => x.id !== component.reduceThreat);
      s.risks = s.risks.filter((x) => x.threatId !== component.reduceThreat);
    });
    const r = update(p, next);
    expect(riskOf(r.project, tid(component.reduceThreat))).toBeUndefined();
    expect(r.project.cybersecurityConcept!.goals[0].riskIds).toEqual([]);
    expect(r.project.components!.instances[0].relevanceOverrides).toBeUndefined();
    expect(r.commitLines.join("\n")).toContain("ticket ABC-123 loses its risk");
    expect(r.commitLines.some((l) => l.includes("relevanceOverride"))).toBe(true);
  });

  it("a pairing (obsolete → new threat): the decisions move to the new key, to review under the NEW key with the OLD basis", () => {
    const p = decided();
    const newId = "t-renamed";
    const next = edit(snap(p), (s) => {
      for (const t of s.threats!.perElementTables) for (const x of t.threats) if (x.id === component.reduceThreat) x.id = newId;
      for (const r of s.risks) if (r.threatId === component.reduceThreat) r.threatId = newId;
    });
    const r = update(p, next, { threats: { [component.reduceThreat]: newId } });
    const moved = riskOf(r.project, componentInstanceTfId("i1", `threat|${newId}`))!;
    expect(moved).toBeDefined();
    expect(moved.id).toBe(generateRiskId(moved.threatId));
    expect(moved.selectedMitigations).toEqual([{ id: "M-T-001", status: "in_progress", ticketId: "ABC-123" }]);
    expect(riskOf(r.project, tid(component.reduceThreat))).toBeUndefined();
    expect(r.project.cybersecurityConcept!.goals[0].riskIds).toEqual([moved.id]);
    const inst = r.project.components!.instances[0];
    expect(inst.relevanceOverrides?.[0].threatKey).toBe(newId);
    expect(inst.reviewBasis?.[reviewKey("riskRating", `threat|${newId}`)]).toBe(`paired:${DECISION_KINDS.riskRating.basis(snap(p), `threat|${component.reduceThreat}`)}`);
    // the goal follows the moved risk too
    expect(r.instances[0].paired.map((x) => x.kind).sort()).toEqual(["conceptRiskRef", "relevanceOverride", "riskRating", "riskTreatment"]);
    // a pure rename (same content): still to review — it rests on another threat now
    expect(openReviews(inst, next).map((x) => x.kind).sort()).toEqual(["conceptRiskRef", "relevanceOverride", "riskRating", "riskTreatment"]);
    expect(r.commitLines.some((l) => l.includes("→") && l.includes("to review"))).toBe(true);
  });

  it("an EE new in this state: mapped as chosen, else taken over as a new machine EE — recorded in the mapping either way", () => {
    const p = decided();
    const ee = snap(p).dfd!.elements.find((e) => e.type === "ExternalEntity")!;
    const next = edit(snap(p), (s) => {
      s.dfd!.elements.push({ ...ee, id: "EE-NEW", displayId: "EE-9", name: "Service laptop" });
    });
    const taken = update(p, next);
    expect(taken.delta.newEes).toEqual(["EE-NEW"]);
    const mapping = taken.project.components!.instances[0].eeMapping.find((e) => e.componentEeId === "EE-NEW");
    expect(mapping?.machineTfId).toBeTruthy();
    const mapped = applyComponentUpdate({
      project: p,
      importId: p.components!.imports[0].id,
      result: { snapshot: next, contentHash: snapshotContentHash(next), source: { schemaVersion: 14 }, methodology: null },
      newEeMappings: { i1: { "EE-NEW": "m_plc" } },
      updatedAt: "t",
    });
    expect(mapped.project.components!.instances[0].eeMapping).toContainEqual({ componentEeId: "EE-NEW", machineTfId: "m_plc" });
  });
});
