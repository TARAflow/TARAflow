// Multi-project TARA 6b: the embedded snapshot must still hash to its
// recorded content hash after everything a session does with the machine —
// the AVE checks it in every committed file. Found with the new check: the
// imported DFD records shared their property objects with the snapshot, and
// the graph builder writes derived exposure levels into them in place.

import { describe, expect, it } from "vitest";
import { machine, snapshot as fixtureSnapshot } from "../../../../fixtures/component-treatment-machine";
import { snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { serializeTCS } from "app/services/prepare-for-disk";
import { parseAndRepair } from "app/services/migration-service";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { componentThreatGroups, componentThreatReferences } from "app/utils/component-threats";
import { componentAttackTrees } from "app/utils/component-attack-trees";
import { componentTreatments } from "app/utils/component-treatments";
import type { Project } from "app/models/project-types";
import { applyComponentUpdate } from "app/services/component-import/component-update";

const stable = (p: Project) => {
  for (const i of p.components!.imports) expect(snapshotContentHash(i.snapshot)).toBe(i.contentHash);
};

describe("the embedded snapshot keeps its hash (6b)", () => {
  it("through the import, the graph, the read models and the risk sync", () => {
    const before = JSON.stringify(fixtureSnapshot);
    const m = machine();
    resolveDfdGraph(m.dfd as never);
    componentThreatGroups(m);
    componentThreatReferences({ ...m, risks: m.risks }, "per-interaction");
    componentAttackTrees({ ...m, attackTrees: null });
    componentTreatments(m);
    stable(m);
    // the snapshot the import was given is untouched too
    expect(JSON.stringify(fixtureSnapshot)).toBe(before);
  });

  it("through an update: the old state and the new one keep theirs", () => {
    const m = machine();
    const old = m.components!.imports[0].snapshot;
    const before = snapshotContentHash(old);
    const next = structuredClone(old);
    const r = applyComponentUpdate({
      project: m,
      importId: "imp",
      result: { snapshot: next, contentHash: snapshotContentHash(next), source: { schemaVersion: 14, commitSha: "c2" }, methodology: null },
      pairing: { threats: {}, paths: {}, flows: {} },
      updatedAt: "2026-11-12",
    });
    expect(snapshotContentHash(old)).toBe(before);
    stable(r.project);
  });

  it("through save and load", () => {
    const m = machine() as Project;
    resolveDfdGraph(m.dfd as never);
    const p = { ...m, id: "m", info: { name: "M", tags: { domain: [], platform: [], regulation: [], custom: [] } }, phaseStatus: {}, settings: {}, schemaVersion: 14 } as never;
    const loaded = parseAndRepair(JSON.parse(serializeTCS(p))) as Project;
    stable(loaded);
    stable(parseAndRepair(JSON.parse(serializeTCS(loaded))) as Project);
  });

  it("frozen in tests and development: a write throws at the writing place (review 2026-11-12)", () => {
    const m = machine();
    const snap = m.components!.imports[0].snapshot as unknown as { risks: unknown[]; dfd: { connections: { properties: Record<string, unknown> }[] } };
    expect(Object.isFrozen(snap)).toBe(true);
    expect(() => {
      snap.dfd.connections[0].properties.exposureLevel = "EL3";
    }).toThrow(TypeError);
    expect(() => snap.risks.push({})).toThrow(TypeError);
    // after loading too
    const p = { ...m, id: "m", info: { name: "M", tags: { domain: [], platform: [], regulation: [], custom: [] } }, phaseStatus: {}, settings: {}, schemaVersion: 14 } as never;
    const loaded = parseAndRepair(JSON.parse(serializeTCS(p))) as Project;
    expect(Object.isFrozen(loaded.components!.imports[0].snapshot)).toBe(true);
  });
});

