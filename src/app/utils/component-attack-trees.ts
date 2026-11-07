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
//     (ComponentInstance.pathOverlays). A path is rated only with the
//     machine's rating: its attack potential and feasibility are computed
//     with the machine's feasibility configuration (weights, bands — the
//     machine's methodology, never the component's). Without a rating the
//     path stays unrated — no feasibility, no threat, no likelihood — and
//     CMP_PATH_WINDOW_UNRATED says so; the component's value is only offered
//     as a suggestion (review 2026-11-07: before, the component's value
//     counted silently).
//   - quick-mode paths (no factor breakdown) cannot be rated per path: they
//     stay unrated, CMP_PATH_NOT_RATABLE asks the component for audit mode
//   - the tree's aggregates (most feasible path, ISO 15.8 NOTE 2) follow
//     the machine's path ratings
//   - a renamed node changes the pathKey: the overlay entry is orphaned —
//     listed by the update preview (phase 5)

import type { ProjectTags, ThreatReference } from "shared";
import { createDefaultAttackTreeData, type AttackTree, type AttackTreeData } from "features/attacktree";
import {
  aggregateFeasibility,
  bandAttackPotential,
  computeAttackPotential,
  computeLikelihood,
} from "features/attacktree/services/attacktree-feasibility";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";
import type {
  FeasibilityConfiguration,
  FeasibilityLevel,
  WindowOfOpportunity,
} from "features/attacktree/models/attacktree-feasibility-types";
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

type MachineTrees = Pick<Project, "components"> & Partial<Pick<Project, "attackTrees">>;

/** The machine's project-wide attack-tree configuration (its methodology). */
function machineConfiguration(project: MachineTrees): AttackTreeData["configuration"] {
  return project.attackTrees?.configuration ?? createDefaultAttackTreeData().configuration;
}

function machineFeasibility(project: MachineTrees): FeasibilityConfiguration {
  return machineConfiguration(project).feasibilityConfiguration ?? DEFAULT_FEASIBILITY_CONFIGURATION;
}

type Path = NonNullable<AttackTree["pathAnalysis"]>["paths"][number];

/** A path as the machine rates it: with its window of opportunity, or unrated. */
function machinePath(path: Path, window: WindowOfOpportunity | undefined, config: FeasibilityConfiguration): Path {
  if (!window || !path.attackPotentialFactors) {
    return { ...path, attackPotential: undefined, feasibilityLevel: undefined, likelihoodLevel: undefined };
  }
  const factors = { ...path.attackPotentialFactors, windowOfOpportunity: window };
  const attackPotential = computeAttackPotential(factors, config);
  const level = bandAttackPotential(attackPotential, config);
  return {
    ...path,
    attackPotentialFactors: factors,
    attackPotential,
    feasibilityLevel: level,
    likelihoodLevel: computeLikelihood(level, path.benefit, config),
  };
}

/** The component's trees of one instance: ids remapped, rated by the machine. */
function instanceTrees(instance: Instance, imported: Import, config: FeasibilityConfiguration): AttackTree[] {
  const trees = imported.snapshot.attackTrees?.trees ?? [];
  if (trees.length === 0) return [];
  const overlays = new Map((instance.pathOverlays ?? []).map((o) => [`${o.treeKey}|${o.pathKey}`, o]));
  const threatId = (id: string) => componentInstanceTfId(instance.id, `threat|${id}`);
  return trees.map((tree): AttackTree => {
    const anchor = tree.anchor;
    const analysis = tree.pathAnalysis;
    let pathAnalysis = analysis;
    if (analysis) {
      const paths = analysis.paths.map((p) =>
        machinePath(p, overlays.get(`${tree.id}|${p.pathKey}`)?.windowOfOpportunity, config),
      );
      const levels = (pick: (p: Path) => FeasibilityLevel | undefined) =>
        paths.map(pick).filter((l): l is FeasibilityLevel => !!l);
      const aggregatedFeasibility = aggregateFeasibility(levels((p) => p.feasibilityLevel));
      const cheapestPath = aggregatedFeasibility
        ? paths
            .filter((p) => p.feasibilityLevel === aggregatedFeasibility)
            .sort((a, b) => b.riskScore - a.riskScore || a.pathKey.localeCompare(b.pathKey))[0]
        : undefined;
      const byKey = new Map(paths.map((p) => [p.pathKey, p]));
      pathAnalysis = {
        ...analysis,
        paths,
        criticalPaths: analysis.criticalPaths.map((p) => byKey.get(p.pathKey) ?? p),
        aggregatedFeasibility,
        aggregatedLikelihoodLevel: aggregateFeasibility(levels((p) => p.likelihoodLevel)),
        cheapestPath,
      };
    }
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
      ...(pathAnalysis ? { pathAnalysis } : {}),
    };
  });
}

/** Per instance: the component's attack trees as the machine uses them. */
export function componentAttackTrees(project: MachineTrees): ComponentAttackTrees[] {
  const components = project.components;
  if (!components) return [];
  const config = machineFeasibility(project);
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const trees = instanceTrees(instance, imported, config);
    return trees.length > 0 ? [{ instance, imported, trees }] : [];
  });
}

/** Trees as AttackTreeData with the MACHINE's configuration. */
function asMachineTreeData(project: MachineTrees, trees: AttackTree[]): AttackTreeData {
  return { trees, configuration: machineConfiguration(project), lastModified: "" };
}

/** All instances' trees as one AttackTreeData — for the likelihood references. */
export function componentAttackTreeData(project: MachineTrees): AttackTreeData | null {
  const groups = componentAttackTrees(project);
  if (groups.length === 0) return null;
  return asMachineTreeData(project, groups.flatMap((g) => g.trees));
}

/** The attack-path threats of the instances, display ids with the prefix. */
export function componentAttackPathThreatReferences(
  project: MachineTrees,
  requireMitigation: boolean,
  tags?: ProjectTags,
): ThreatReference[] {
  return componentAttackTrees(project).flatMap(({ instance, trees }) =>
    buildAttackPathThreatReferences(asMachineTreeData(project, trees), requireMitigation, tags).map((ref) => ({
      ...ref,
      displayId: `${instance.prefix}:${ref.displayId}`,
    })),
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
export function componentAttackPathGroups(project: MachineTrees): ComponentAttackPathGroup[] {
  return componentAttackTrees(project).map(({ instance, imported, trees }) => {
    const overlays = new Map((instance.pathOverlays ?? []).map((o) => [`${o.treeKey}|${o.pathKey}`, o]));
    const source = imported.snapshot.attackTrees?.trees ?? [];
    const derived = new Map(source.map((t, i) => [t.id, trees[i]]));
    const paths: ComponentAttackPathRow[] = [];
    for (const tree of source) {
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

/** Per instance: paths still without the machine's rating, and paths it cannot rate. */
export function componentPathRatingGaps(
  project: MachineTrees,
): { instance: Instance; imported: Import; unrated: number; notRatable: number }[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const overlays = new Set((instance.pathOverlays ?? []).map((o) => `${o.treeKey}|${o.pathKey}`));
    let unrated = 0;
    let notRatable = 0;
    for (const tree of imported.snapshot.attackTrees?.trees ?? []) {
      if (tree.anchor?.type !== "asset") continue; // only asset-anchored trees make risks
      for (const path of tree.pathAnalysis?.paths ?? []) {
        if (!path.attackPotentialFactors) notRatable++;
        else if (!overlays.has(`${tree.id}|${path.pathKey}`)) unrated++;
      }
    }
    return unrated + notRatable > 0 ? [{ instance, imported, unrated, notRatable }] : [];
  });
}
