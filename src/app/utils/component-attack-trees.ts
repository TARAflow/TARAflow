// ==================== COMPONENT ATTACK TREES (read model) ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §7.2,
// patch 17): in an ISO/SAE 21434 machine only attack-path threats make
// risks, so the component's attack trees are derived per instance too —
// never stored, like its threats (patch 14).
//
//   - tree ids hashed per instance BEFORE deriving: the attack-path threat
//     id is buildThreatId(tree.id, pathKey, stride) and would collide for
//     two instances of one component
//   - anchor asset / threat / risk → the instance's ids; display ids of
//     the path threats with the instance prefix
//   - the window of opportunity is a path rating and context-dependent
//     (§7.2): the machine rates it per instance and pathKey
//     (ComponentInstance.pathOverlays); the path's attack potential and
//     feasibility are recomputed with it (audit-mode paths that carry the
//     factor breakdown)
//   - a renamed node changes the pathKey: the overlay entry is orphaned —
//     listed by the update preview (phase 5)

import type { ProjectTags, ThreatReference } from "shared";
import type { AttackTree, AttackTreeData } from "features/attacktree";
import {
  bandAttackPotential,
  computeAttackPotential,
} from "features/attacktree/services/attacktree-feasibility";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";
import type { WindowOfOpportunity } from "features/attacktree/models/attacktree-feasibility-types";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import type { Project } from "../models/project-types";
import { buildAttackPathThreatReferences } from "./build-attack-path-threat-references";

type Components = NonNullable<Project["components"]>;
type Instance = Components["instances"][number];
type Import = Components["imports"][number];

export interface ComponentAttackTrees {
  instance: Instance;
  imported: Import;
  trees: AttackTree[];
}

/** The component's trees of one instance: ids remapped, overlays applied. */
function instanceTrees(instance: Instance, imported: Import): AttackTree[] {
  const data = imported.snapshot.attackTrees;
  const trees = data?.trees ?? [];
  if (trees.length === 0) return [];
  const config = data?.configuration?.feasibilityConfiguration ?? DEFAULT_FEASIBILITY_CONFIGURATION;
  const overlays = new Map((instance.pathOverlays ?? []).map((o) => [`${o.treeKey}|${o.pathKey}`, o]));
  const threatId = (id: string) => componentInstanceTfId(instance.id, `threat|${id}`);
  return trees.map((tree) => {
    const anchor = tree.anchor;
    return {
      ...tree,
      id: componentInstanceTfId(instance.id, `tree|${tree.id}`),
      name: `${instance.prefix}: ${tree.name}`,
      anchor: {
        ...anchor,
        ...(anchor.assetId ? { assetId: instanceAssetId(instance.id, anchor.assetId) } : {}),
        ...(anchor.assetDisplayId ? { assetDisplayId: `${instance.prefix}:${anchor.assetDisplayId}` } : {}),
        ...(anchor.threatId ? { threatId: threatId(anchor.threatId) } : {}),
        ...(anchor.riskId ? { riskId: `R-${threatId(anchor.riskId.replace(/^R-/, ""))}` } : {}),
      },
      ...(tree.pathAnalysis
        ? {
            pathAnalysis: {
              ...tree.pathAnalysis,
              paths: tree.pathAnalysis.paths.map((path) => {
                const overlay = overlays.get(`${tree.id}|${path.pathKey}`);
                if (!overlay || !path.attackPotentialFactors) return path;
                const factors = { ...path.attackPotentialFactors, windowOfOpportunity: overlay.windowOfOpportunity };
                const attackPotential = computeAttackPotential(factors, config);
                const level = bandAttackPotential(attackPotential, config);
                return { ...path, attackPotentialFactors: factors, attackPotential, feasibilityLevel: level, likelihoodLevel: level };
              }),
            },
          }
        : {}),
    } as AttackTree;
  });
}

/** Per instance: the component's attack trees as the machine uses them. */
export function componentAttackTrees(project: Pick<Project, "components">): ComponentAttackTrees[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const trees = instanceTrees(instance, imported);
    return trees.length > 0 ? [{ instance, imported, trees }] : [];
  });
}

/** All instances' trees as one AttackTreeData — for the likelihood references. */
export function componentAttackTreeData(project: Pick<Project, "components">): AttackTreeData | null {
  const groups = componentAttackTrees(project);
  if (groups.length === 0) return null;
  return {
    trees: groups.flatMap((g) => g.trees),
    configuration: groups[0].imported.snapshot.attackTrees?.configuration,
    lastModified: "",
  } as unknown as AttackTreeData;
}

/** The attack-path threats of the instances, display ids with the prefix. */
export function componentAttackPathThreatReferences(
  project: Pick<Project, "components">,
  requireMitigation: boolean,
  tags?: ProjectTags,
): ThreatReference[] {
  return componentAttackTrees(project).flatMap(({ instance, imported, trees }) =>
    buildAttackPathThreatReferences(
      { ...(imported.snapshot.attackTrees as AttackTreeData), trees },
      requireMitigation,
      tags,
    ).map((ref) => ({ ...ref, displayId: `${instance.prefix}:${ref.displayId}` })),
  );
}

/** One path of a component tree, for the window-of-opportunity rating. */
export interface ComponentAttackPathRow {
  treeKey: string;
  treeName: string;
  pathKey: string;
  /** Node names root → leaf. */
  path: string[];
  /** The component's window of opportunity on this path. */
  componentWindow?: WindowOfOpportunity;
  /** The machine's rating (overlay), if any. */
  machineWindow?: WindowOfOpportunity;
  /** Feasibility with the machine's rating. */
  feasibility?: string;
  /** No factor breakdown (quick mode): the window cannot be rated per path. */
  ratable: boolean;
}

export interface ComponentAttackPathGroup {
  key: string;
  label: string;
  paths: ComponentAttackPathRow[];
}

/** The paths per instance, for the rating section (Attack Tree tab). */
export function componentAttackPathGroups(project: Pick<Project, "components">): ComponentAttackPathGroup[] {
  return componentAttackTrees(project).map(({ instance, imported }) => {
    const overlays = new Map((instance.pathOverlays ?? []).map((o) => [`${o.treeKey}|${o.pathKey}`, o]));
    const derived = new Map(instanceTrees(instance, imported).map((t, i) => [imported.snapshot.attackTrees!.trees[i].id, t]));
    const paths: ComponentAttackPathRow[] = [];
    for (const tree of imported.snapshot.attackTrees?.trees ?? []) {
      const mine = derived.get(tree.id);
      for (const path of tree.pathAnalysis?.paths ?? []) {
        const overlay = overlays.get(`${tree.id}|${path.pathKey}`);
        const now = mine?.pathAnalysis?.paths.find((p) => p.pathKey === path.pathKey);
        paths.push({
          treeKey: tree.id,
          treeName: tree.name,
          pathKey: path.pathKey,
          path: path.path,
          ...(path.attackPotentialFactors ? { componentWindow: path.attackPotentialFactors.windowOfOpportunity } : {}),
          ...(overlay ? { machineWindow: overlay.windowOfOpportunity } : {}),
          ...(now?.feasibilityLevel ? { feasibility: now.feasibilityLevel } : {}),
          ratable: !!path.attackPotentialFactors,
        });
      }
    }
    return { key: instance.id, label: `${instance.prefix} · ${imported.name}`, paths };
  });
}
