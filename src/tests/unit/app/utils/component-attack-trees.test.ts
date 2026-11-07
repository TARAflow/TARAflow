// src/tests/unit/app/utils/component-attack-trees.test.ts
//
// Multi-project TARA, patch 17 (design §7.2): an ISO/SAE 21434 machine gets
// the risks of an imported component through its attack paths — trees
// derived per instance with their own ids, the window of opportunity rated
// by the machine per instance and path, CMP_NO_ATTACK_PATHS for a
// component without paths, and the commit gate for the rating.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../fixtures/load-fixture";
import { buildComponentSnapshot, projectMethodologyFingerprint, snapshotContentHash } from "app/services/component-import/snapshot-builder";
import { applyComponentImport } from "app/services/component-import/import-flow";
import { withPathOverlay } from "app/services/component-import/path-overlays";
import { componentFindings } from "app/services/component-import/component-findings";
import {
  componentAttackPathGroups,
  componentAttackPathThreatReferences,
  componentAttackTreeData,
  componentAttackTrees,
} from "app/utils/component-attack-trees";
import { buildAttackTreeLikelihoodReferences } from "app/utils/build-attack-tree-likelihood-references";
import { instanceAssetId, type ComponentInsertContext } from "features/dfd";
import { DiffService } from "features/audit/services/diff-service";
import { flow, mxfile, node, page } from "../../../fixtures/leveled-dfd-xml";

const smoke = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
// The Headlamp fixture (ISO/SAE 21434, ten asset-anchored trees in audit
// mode) has no diagram; it borrows the SmokeDetector's for the insertion.
const headlamp = { ...(parseAndRepair(loadProjectFixture("headlamp-iso21434.tara.json")) as Project), dfd: smoke.dfd } as Project;

const context = (): ComponentInsertContext => ({
  xml: mxfile(page("top", "Vehicle", node("m_ecu", "externalentity", "Body ECU", "EE-1", 10) + node("m_p1", "process", "Gateway", "P-1", 300) + flow("m_df1", "forward", "DF-1", "m_ecu", "m_p1"))),
  pages: [],
  pageId: "top",
  assets: [],
  elements: [
    { id: "m_ecu", displayId: "EE-1", name: "Body ECU", type: "ExternalEntity", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
    { id: "m_p1", displayId: "P-1", name: "Gateway", type: "Process", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} },
  ] as never,
  connections: [{ id: "m_df1", displayId: "DF-1", name: "forward", from: "m_ecu", to: "m_p1", properties: {} }] as never,
});

function machine(component: Project, instances: string[]): Project {
  const snapshot = buildComponentSnapshot(component);
  let components: Project["components"] | undefined;
  let ctx = context();
  instances.forEach((id, n) => {
    const applied = applyComponentImport({
      context: ctx,
      machine: { components },
      result: { snapshot, contentHash: snapshotContentHash(snapshot), methodology: projectMethodologyFingerprint(component), source: { commitSha: "a", schemaVersion: 14 } },
      choice: { prefix: `HL${n + 1}`, name: "Headlamp", eeMapping: {} },
      ids: { importId: "imp", instanceId: id },
      importedAt: "t",
    });
    components = applied.components;
    ctx = { ...ctx, xml: applied.outcome.xml, pages: applied.outcome.pages, elements: applied.outcome.elements, connections: applied.outcome.connections, assets: applied.outcome.assets };
  });
  return { components, risks: { configuration: { ...headlamp.risks!.configuration }, risks: [], lastModified: "" }, dfd: { elements: [], connections: [] } } as unknown as Project;
}

describe("component attack trees per instance", () => {
  const two = machine(headlamp, ["inst-1", "inst-2"]);
  const groups = componentAttackTrees(two);

  it("the trees of each instance with their own ids and remapped anchors", () => {
    expect(groups).toHaveLength(2);
    const [a, b] = groups;
    expect(a.trees).toHaveLength(headlamp.attackTrees!.trees.length);
    const ids = [...a.trees, ...b.trees].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const original = headlamp.attackTrees!.trees[0];
    expect(a.trees[0].anchor.assetId).toBe(instanceAssetId("inst-1", original.anchor.assetId!));
    expect(a.trees[0].name).toBe(`HL1: ${original.name}`);
  });

  it("path threats: distinct ids across instances, prefixed display ids", () => {
    const refs = componentAttackPathThreatReferences(two, false);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs.map((r) => r.id)).size).toBe(refs.length);
    expect(refs.every((r) => /^HL[12]:AT-/.test(r.displayId))).toBe(true);
    expect(refs.filter((r) => r.displayId.startsWith("HL1:")).length).toBe(refs.filter((r) => r.displayId.startsWith("HL2:")).length);
  });

  it("every path threat that makes a risk gets its tree likelihood (same ids)", () => {
    const refs = componentAttackPathThreatReferences(two, false);
    const likelihoods = new Set(buildAttackTreeLikelihoodReferences(componentAttackTreeData(two), "4-level").map((l) => l.riskId));
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(likelihoods.has(r.id), r.displayId).toBe(true);
  });
});

describe("window of opportunity per instance and path", () => {
  const m = machine(headlamp, ["inst-1"]);
  const tree = headlamp.attackTrees!.trees[0];
  const path = tree.pathAnalysis!.paths.find((p) => p.attackPotentialFactors?.windowOfOpportunity === "difficult")!;

  it("the path list shows the component's value and no machine rating yet", () => {
    const row = componentAttackPathGroups(m)[0].paths.find((p) => p.pathKey === path.pathKey && p.treeKey === tree.id)!;
    expect(row).toMatchObject({ componentWindow: "difficult", ratable: true });
    expect(row.machineWindow).toBeUndefined();
  });

  it("the machine's rating recomputes the path's feasibility (here: more feasible)", () => {
    const rated = { ...m, components: withPathOverlay(m.components!, "inst-1", tree.id, path.pathKey, "unlimited", "2026-11-07") } as Project;
    const row = componentAttackPathGroups(rated)[0].paths.find((p) => p.pathKey === path.pathKey && p.treeKey === tree.id)!;
    expect(row.machineWindow).toBe("unlimited");
    const order = ["very-low", "low", "medium", "high"];
    expect(order.indexOf(row.feasibility!)).toBeGreaterThan(order.indexOf(path.feasibilityLevel!));
    // only this instance's path changed
    const derivedPath = componentAttackTrees(rated)[0].trees[0].pathAnalysis!.paths.find((p) => p.pathKey === path.pathKey)!;
    expect(derivedPath.attackPotentialFactors!.windowOfOpportunity).toBe("unlimited");
  });

  it("set and remove", () => {
    const c1 = withPathOverlay(m.components!, "inst-1", "t", "k", "easy", "d");
    expect(c1.instances[0].pathOverlays).toEqual([{ treeKey: "t", pathKey: "k", windowOfOpportunity: "easy", date: "d" }]);
    const c2 = withPathOverlay(c1, "inst-1", "t", "k", null, "d");
    expect("pathOverlays" in c2.instances[0]).toBe(false);
  });

  it("the commit gate opens: the audit diff sees a path rating", () => {
    const rated = { ...m, components: withPathOverlay(m.components!, "inst-1", tree.id, path.pathKey, "easy", "d") };
    const strip = (p: object) => ({ ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(rated), strip(m)).find((c) => c.phase === "components")!;
    expect(section.changes[0].details!.map((d) => d.field)).toContain("pathOverlays");
  });
});

describe("CMP_NO_ATTACK_PATHS", () => {
  it("an ISO machine importing a component without attack paths", () => {
    const m = machine(smoke, ["inst-1"]);
    const iso = { ...m, risks: { ...m.risks!, configuration: { ...m.risks!.configuration, likelihoodMethod: "iso-21434" } } } as Project;
    expect(componentFindings(iso).warnings.map((w) => w.key)).toContain("components.findings.CMP_NO_ATTACK_PATHS");
  });

  it("not for a component with attack paths, not outside ISO", () => {
    expect(componentFindings(machine(headlamp, ["inst-1"])).warnings.map((w) => w.key)).not.toContain("components.findings.CMP_NO_ATTACK_PATHS");
    const m = machine(smoke, ["inst-1"]);
    const nonIso = { ...m, risks: { ...m.risks!, configuration: { ...m.risks!.configuration, likelihoodMethod: "weighted-mean" } } } as Project;
    expect(componentFindings(nonIso).warnings.map((w) => w.key)).not.toContain("components.findings.CMP_NO_ATTACK_PATHS");
  });
});
