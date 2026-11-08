// src/tests/unit/app/utils/component-attack-trees.test.ts
//
// Multi-project TARA, patch 17 (design §7.2): an ISO/SAE 21434 machine gets
// the risks of an imported component through its attack paths — trees
// derived per instance with their own ids, the window of opportunity rated
// by the machine per instance and path, CMP_NO_ATTACK_PATHS for a
// component without paths, and the commit gate for the rating.
// Review 2026-11-07: a path counts only with the machine's rating, with the
// machine's feasibility configuration; unrated and quick-mode paths make no
// risk and get a finding.

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
  componentPathRatingGaps,
  componentAttackPathThreatReferences,
  componentAttackTreeData,
  componentAttackTrees,
} from "app/utils/component-attack-trees";
import { buildAttackTreeLikelihoodReferences } from "app/utils/build-attack-tree-likelihood-references";
import { instanceAssetId, type ComponentInsertContext } from "features/dfd";
import { DiffService } from "features/audit/services/diff-service";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";
import { parseAttackTree } from "features/attacktree/services/attacktree-parser";
import { generateThreatsFromAttackTree } from "features/attacktree";
import { analyzeAttackPaths } from "features/attacktree/services/attacktree-calculator";
import { bandAttackPotential, computeAttackPotential } from "features/attacktree/services/attacktree-feasibility";
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
  return { components, attackTrees: null, risks: { configuration: { ...headlamp.risks!.configuration }, risks: [], lastModified: "" }, dfd: { elements: [], connections: [] } } as unknown as Project;
}

/** Every ratable asset-path of every instance rated by the machine with the component's own value. */
function rated(m: Project, component: Project = headlamp): Project {
  let components = m.components!;
  for (const instance of components.instances) {
    for (const tree of component.attackTrees?.trees ?? []) {
      for (const path of tree.pathAnalysis?.paths ?? []) {
        const window = path.attackPotentialFactors?.windowOfOpportunity;
        if (window) components = withPathOverlay(components, instance.id, tree.id, path.pathKey, window, "2026-11-07");
      }
    }
  }
  return { ...m, components } as Project;
}
const iso = (m: Project) =>
  ({ ...m, risks: { ...m.risks!, configuration: { ...m.risks!.configuration, likelihoodMethod: "iso-21434" } } }) as Project;
const keys = (m: Project) => componentFindings(m).warnings.map((w) => w.key);

describe("component attack trees per instance", () => {
  const two = rated(machine(headlamp, ["inst-1", "inst-2"]));
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
    const withRating = { ...m, components: withPathOverlay(m.components!, "inst-1", tree.id, path.pathKey, "unlimited", "2026-11-07") } as Project;
    const row = componentAttackPathGroups(withRating)[0].paths.find((p) => p.pathKey === path.pathKey && p.treeKey === tree.id)!;
    expect(row.machineWindow).toBe("unlimited");
    const order = ["very-low", "low", "medium", "high"];
    expect(order.indexOf(row.feasibility!)).toBeGreaterThan(order.indexOf(path.feasibilityLevel!));
    // only this instance's path changed
    const derivedPath = componentAttackTrees(withRating)[0].trees[0].pathAnalysis!.paths.find((p) => p.pathKey === path.pathKey)!;
    expect(derivedPath.attackPotentialFactors!.windowOfOpportunity).toBe("unlimited");
  });

  it("set and remove", () => {
    const c1 = withPathOverlay(m.components!, "inst-1", "t", "k", "easy", "d");
    expect(c1.instances[0].pathOverlays).toEqual([{ treeKey: "t", pathKey: "k", windowOfOpportunity: "easy", date: "d" }]);
    const c2 = withPathOverlay(c1, "inst-1", "t", "k", null, "d");
    expect("pathOverlays" in c2.instances[0]).toBe(false);
  });

  it("the commit gate opens: the audit diff sees a path rating", () => {
    const withRating = { ...m, components: withPathOverlay(m.components!, "inst-1", tree.id, path.pathKey, "easy", "d") };
    const strip = (p: object) => ({ ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(withRating), strip(m)).find((c) => c.phase === "components")!;
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

describe("only the machine's rating counts (review 2026-11-07)", () => {
  const m = machine(headlamp, ["inst-1"]);
  const assetPaths = headlamp.attackTrees!.trees
    .filter((t) => t.anchor.type === "asset")
    .flatMap((t) => t.pathAnalysis?.paths ?? []);
  const ratable = assetPaths.filter((p) => p.attackPotentialFactors).length;

  it("without the machine's rating a path is unrated: no feasibility, no path threat, no likelihood", () => {
    expect(ratable).toBeGreaterThan(0);
    const paths = componentAttackTrees(m)[0].trees.flatMap((t) => t.pathAnalysis?.paths ?? []);
    expect(paths.every((p) => p.feasibilityLevel === undefined && p.likelihoodLevel === undefined && p.attackPotential === undefined)).toBe(true);
    expect(componentAttackTrees(m)[0].trees.every((t) => !t.pathAnalysis || t.pathAnalysis.aggregatedFeasibility === undefined)).toBe(true);
    expect(componentAttackPathThreatReferences(m, false)).toEqual([]);
    expect(buildAttackTreeLikelihoodReferences(componentAttackTreeData(m), "4-level")).toEqual([]);
    // the component's value is still offered as a suggestion
    expect(componentAttackPathGroups(m)[0].paths.some((p) => p.componentWindow && !p.machineWindow && !p.feasibility)).toBe(true);
  });

  it("CMP_PATH_WINDOW_UNRATED counts the unrated asset paths, gone once all are rated; ISO only", () => {
    expect(componentPathRatingGaps(m)[0]).toMatchObject({ unrated: ratable, notRatable: 0 });
    const w = componentFindings(iso(m)).warnings.find((x) => x.key === "components.findings.CMP_PATH_WINDOW_UNRATED");
    expect(w?.params).toMatchObject({ prefix: "HL1", count: ratable });
    expect(keys(iso(rated(m)))).not.toContain("components.findings.CMP_PATH_WINDOW_UNRATED");
    const nonIso = { ...m, risks: { ...m.risks!, configuration: { ...m.risks!.configuration, likelihoodMethod: "weighted-mean" } } } as Project;
    expect(keys(nonIso)).not.toContain("components.findings.CMP_PATH_WINDOW_UNRATED");
  });

  it("the machine's rating is computed with the MACHINE's feasibility configuration, not the component's", () => {
    const r = rated(m);
    const componentLevels = new Set(assetPaths.map((p) => p.feasibilityLevel).filter(Boolean));
    expect(componentLevels.size).toBeGreaterThan(0);
    // a machine whose bands put every attack potential to "very-low"
    const config = headlamp.attackTrees!.configuration;
    const flat = { ...config, feasibilityConfiguration: { ...(config.feasibilityConfiguration ?? DEFAULT_FEASIBILITY_CONFIGURATION), bands: [{ level: "very-low", minPotential: 0 }] } };
    const machineWithBands = { ...r, attackTrees: { trees: [], configuration: flat, lastModified: "" } } as unknown as Project;
    const levels = componentAttackTrees(machineWithBands)[0].trees.flatMap((t) => t.pathAnalysis?.paths ?? []).map((p) => p.feasibilityLevel).filter(Boolean);
    expect(levels.length).toBe(ratable);
    expect(new Set(levels)).toEqual(new Set(["very-low"]));
    // the tree data handed to the risk side carries the machine's configuration
    expect(componentAttackTreeData(machineWithBands)!.configuration).toBe(flat);
    // with the default (no machine attack trees; the Headlamp uses the default too) the component's values come back
    const same = componentAttackTrees(r)[0].trees;
    headlamp.attackTrees!.trees.forEach((tree, i) => {
      for (const p of (tree.pathAnalysis?.paths ?? []).filter((x) => x.attackPotentialFactors)) {
        const mine = same[i].pathAnalysis!.paths.find((x) => x.pathKey === p.pathKey);
        expect(mine?.feasibilityLevel, p.pathKey).toBe(p.feasibilityLevel);
      }
    });
  });

  it("the tree's aggregate follows the machine's path ratings", () => {
    const tree = headlamp.attackTrees!.trees.find((t) => t.anchor.type === "asset" && (t.pathAnalysis?.paths.length ?? 0) > 0)!;
    const p0 = tree.pathAnalysis!.paths.find((p) => p.attackPotentialFactors)!;
    const one = { ...m, components: withPathOverlay(m.components!, "inst-1", tree.id, p0.pathKey, "unlimited", "d") } as Project;
    const derived = componentAttackTrees(one)[0].trees[headlamp.attackTrees!.trees.indexOf(tree)];
    const ratedPath = derived.pathAnalysis!.paths.find((p) => p.pathKey === p0.pathKey)!;
    expect(derived.pathAnalysis!.aggregatedFeasibility).toBe(ratedPath.feasibilityLevel);
    expect(derived.pathAnalysis!.cheapestPath?.pathKey).toBe(p0.pathKey);
  });

  it("ties at the most feasible level go to the lowest attack potential the machine computed", () => {
    // flat bands: every rated path lands on the same level
    const config = headlamp.attackTrees!.configuration;
    const flat = { ...config, feasibilityConfiguration: { ...(config.feasibilityConfiguration ?? DEFAULT_FEASIBILITY_CONFIGURATION), bands: [{ level: "very-low", minPotential: 0 }] } };
    const r = { ...rated(m), attackTrees: { trees: [], configuration: flat, lastModified: "" } } as unknown as Project;
    let checked = 0;
    for (const tree of componentAttackTrees(r)[0].trees) {
      const paths = (tree.pathAnalysis?.paths ?? []).filter((p) => p.feasibilityLevel);
      if (paths.length < 2 || new Set(paths.map((p) => p.attackPotential)).size < 2) continue;
      const lowest = Math.min(...paths.map((p) => p.attackPotential!));
      expect(tree.pathAnalysis!.cheapestPath!.attackPotential, tree.name).toBe(lowest);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("quick-mode paths (no factor breakdown) stay unrated even with a rating; CMP_PATH_NOT_RATABLE", () => {
    const quick = {
      ...headlamp,
      attackTrees: {
        ...headlamp.attackTrees!,
        trees: headlamp.attackTrees!.trees.map((t) =>
          t.pathAnalysis
            ? { ...t, pathAnalysis: { ...t.pathAnalysis, paths: t.pathAnalysis.paths.map((p) => ({ ...p, attackPotentialFactors: undefined })) } }
            : t,
        ),
      },
    } as Project;
    const q = machine(quick, ["inst-1"]);
    const tree = headlamp.attackTrees!.trees[0];
    const withRating = { ...q, components: withPathOverlay(q.components!, "inst-1", tree.id, tree.pathAnalysis!.paths[0].pathKey, "easy", "d") } as Project;
    expect(componentAttackTrees(withRating)[0].trees.flatMap((t) => t.pathAnalysis?.paths ?? []).every((p) => !p.feasibilityLevel)).toBe(true);
    expect(componentAttackPathThreatReferences(withRating, false)).toEqual([]);
    expect(componentPathRatingGaps(q)[0]).toMatchObject({ unrated: 0, notRatable: assetPaths.length });
    expect(keys(iso(q))).toContain("components.findings.CMP_PATH_NOT_RATABLE");
  });
});

// Review 2026-11-08: an AND combination (FX-6) has no factor breakdown of its
// own — it stayed unrated forever. Its potential is the sum over its leaves:
// the machine's window is applied to every leaf and the sum recomputed.
describe("AND combinations are rated with the machine's window", () => {
  const original = headlamp.attackTrees!.trees[0];
  const dsl = original.dsl.replace("Remote Attack;OR", "Remote Attack;AND");
  const method = original.configuration.evaluationMethod;
  const ast = parseAttackTree(dsl, method).ast!;
  const andTree = { ...original, dsl, pathAnalysis: analyzeAttackPaths(ast, method, DEFAULT_FEASIBILITY_CONFIGURATION) };
  const component = { ...headlamp, attackTrees: { ...headlamp.attackTrees!, trees: [andTree] } } as Project;
  const m = machine(component, ["inst-1"]);
  const combo = andTree.pathAnalysis!.paths.find((p) => p.combination)!;
  const derived = () => componentAttackTrees(m)[0].trees[0].pathAnalysis!.paths.find((p) => p.pathKey === combo.pathKey)!;

  it("setup: the tree has an AND combination without a factor breakdown", () => {
    expect(combo).toBeDefined();
    expect(combo.attackPotentialFactors).toBeUndefined();
    expect(combo.feasibilityLevel).toBeDefined();
  });

  it("without the machine's window it is unrated — counted as to rate, not as quick mode", () => {
    expect(derived().feasibilityLevel).toBeUndefined();
    expect(componentPathRatingGaps(m)[0]).toMatchObject({ notRatable: 0 });
    expect(componentPathRatingGaps(m)[0].unrated).toBeGreaterThan(0);
    const row = componentAttackPathGroups(m)[0].paths.find((p) => p.pathKey === combo.pathKey)!;
    expect(row.ratable).toBe(true);
    // its steps disagree (difficult / moderate): no single component value to offer
    expect(row.componentWindow).toBeUndefined();
  });

  it("with the machine's window: the sum over the leaves with that window, banded with the machine's configuration", () => {
    const rated = { ...m, components: withPathOverlay(m.components!, "inst-1", andTree.id, combo.pathKey, "unlimited", "d") } as Project;
    const path = componentAttackTrees(rated)[0].trees[0].pathAnalysis!.paths.find((p) => p.pathKey === combo.pathKey)!;
    const leaves = ast.children.find((c) => c.name === "Remote Attack")!.children;
    const expected = leaves.reduce(
      (sum, l) => sum + computeAttackPotential({ ...l.evaluation!.attackPotential!, windowOfOpportunity: "unlimited" }, DEFAULT_FEASIBILITY_CONFIGURATION),
      0,
    );
    expect(path.attackPotential).toBe(expected);
    expect(path.feasibilityLevel).toBe(bandAttackPotential(expected, DEFAULT_FEASIBILITY_CONFIGURATION));
    // more feasible than the component's own rating (its steps had difficult / moderate)
    expect(path.attackPotential!).toBeLessThan(combo.attackPotential!);
    // and the generator emits it now (relevance is decided on the path, not here)
    const tree = componentAttackTrees(rated)[0].trees[0];
    const emitted = generateThreatsFromAttackTree(tree, undefined, 1).threats.map((t) => t.id);
    expect(emitted.some((id) => id.includes(combo.pathKey))).toBe(true);
    const unratedTree = componentAttackTrees(m)[0].trees[0];
    expect(generateThreatsFromAttackTree(unratedTree, undefined, 1).threats.map((t) => t.id).some((id) => id.includes(combo.pathKey))).toBe(false);
  });
});
