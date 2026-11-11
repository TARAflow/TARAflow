// Multi-project TARA phase 5c-2: the update dialog's preview, its choice as
// the update's input, and the numbers it shows — from a dry run of the very
// update "Apply" runs.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import { applyComponentUpdate } from "app/services/component-import/component-update";
import { reviewItemLabel, updateInputOf, updateOutcomeOf, updatePreview } from "app/services/component-import/update-preview";
import { snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { TAKE_OVER } from "features/components";
import { component, machine, tid } from "../../../../fixtures/component-treatment-machine";

const rated = (): Project => {
  const m = machine();
  const risks = m.risks!.risks.map((r) =>
    r.threatId === tid(component.reduceThreat)
      ? { ...r, factorRatings: r.factorRatings.map((f, i) => (i === 0 ? { ...f, value: 3 } : f)), selectedMitigations: [{ id: "M-T-1", status: "planned", ticketId: "ABC-1" }] }
      : r,
  );
  return { ...m, risks: { ...m.risks!, risks } } as Project;
};
const snap = (p: Project) => p.components!.imports[0].snapshot as ComponentSnapshot;
const nextState = (s: ComponentSnapshot) => ({ snapshot: s, contentHash: snapshotContentHash(s), source: { schemaVersion: 14, commitSha: "c2c2c2c2c2" }, methodology: null });

describe("update preview (phase 5c-2)", () => {
  const p = rated();
  const ee = snap(p).dfd!.elements.find((e) => e.type === "ExternalEntity")!;
  const changed = structuredClone(snap(p));
  changed.dfd!.elements.push({ ...ee, id: "EE-NEW", name: "Service laptop" });
  for (const t of changed.threats!.perElementTables) for (const x of t.threats) if (x.id === component.reduceThreat) x.id = "t-renamed";
  for (const r of changed.risks) if (r.threatId === component.reduceThreat) r.threatId = "t-renamed";
  const next = nextState(changed);
  const preview = updatePreview(p, "imp", next);

  it("what changed, the new EE per instance with the machine's elements to map to, the pairing offered", () => {
    expect(preview.changes.find((c) => c.kind === "threats")).toEqual({ kind: "threats", added: 1, removed: 1 });
    expect(preview.newEes).toHaveLength(1);
    expect(preview.newEes[0]).toMatchObject({ eeId: "EE-NEW", name: "Service laptop" });
    expect(preview.newEes[0].instances[0].options.map((o) => o.id)).toContain("m_plc");
    expect(preview.candidates).toContainEqual(expect.objectContaining({ kind: "threat", from: component.reduceThreat, key: `threat|${component.reduceThreat}|t-renamed` }));
    expect(preview.to).toContain("c2c2c2c2");
  });

  it("a changed overview (description …) is named; an unchanged one is not", () => {
    expect(preview.aboutChanged).toBeUndefined();
    const described = structuredClone(snap(p));
    described.about = { ...(described.about ?? {}), description: "Rev. B" };
    expect(updatePreview(p, "imp", nextState(described)).aboutChanged).toBe(true);
  });

  it("the numbers follow the choice: unpaired the rating and ticket go; paired they go to review", () => {
    const dry = (pairs: string[]) =>
      updateOutcomeOf(applyComponentUpdate(updateInputOf(p, "imp", next, { pairs, ees: { i1: { "EE-NEW": TAKE_OVER } } }, "preview")));
    const unpaired = dry([]);
    expect(unpaired.tickets).toEqual(["ABC-1"]);
    expect(unpaired.dropped.map((d) => d.kind)).toEqual(expect.arrayContaining(["riskRating", "riskTreatment"]));
    const paired = dry([`threat|${component.reduceThreat}|t-renamed`]);
    expect(paired.tickets).toEqual([]);
    expect(paired.review).toBeGreaterThanOrEqual(2);
  });

  it("the choice as input: pairings (paths with their '|'), EE decisions, the tag pattern", () => {
    const input = updateInputOf(
      p,
      "imp",
      next,
      { pairs: ["path|t1|pk1|t1|pk2", "flow|f1|f2", `threat|a|b`], ees: { i1: { "EE-NEW": TAKE_OVER, "EE-X": "m_plc" } }, tagPattern: "cam/v*" },
      "now",
    );
    expect(input.pairing).toEqual({ threats: { a: "b" }, paths: { "t1|pk1": "t1|pk2" }, flows: { f1: "f2" } });
    expect(input.newEeMappings).toEqual({ i1: { "EE-NEW": undefined, "EE-X": "m_plc" } });
    expect(input.result.source.tagPattern).toBe("cam/v*");
  });

  it("review items in the component's words", () => {
    expect(reviewItemLabel(snap(p), "riskRating", `threat|${component.reduceThreat}`)).toMatch(/^[STRIDE] · /);
    expect(reviewItemLabel(snap(p), "aouStatus", "a1")).toBe("ASM-01");
  });
});
