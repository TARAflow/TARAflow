// src/app/utils/build-attack-tree-likelihood-references.ts
//
// App-layer read-model builder — the attack-tree LIKELIHOOD source for the Risk
// feature. Twin of build-attack-path-threat-references.ts (which supplies the
// THREATS); this one supplies the likelihood those (and threat-anchored) trees
// contribute to each risk, already mapped to the risk scale.
//
// LAYERING
// --------
// Lives in app/utils, not in a feature. It reads the attack-tree store
// (features/attacktree) and produces AttackTreeLikelihoodReference[] (a shared
// type consumed by features/risks). Neither feature imports the other; the app
// layer bridges them — exactly as buildAssetDataReference and
// buildAttackPathThreatReferences do.
//
// WHAT IT DOES
// ------------
// Every tree with a computed pathAnalysis contributes, in BOTH rating methods
// (Standard and ISO) and BOTH anchor kinds — because the *risk treatment* (
// MoSCoW, mitigations, prioritisation) lives in the Risk tab, so every tree that
// says something about likelihood should feed a risk there rather than have that
// workflow rebuilt in the attack-tree tab.
//
//   asset-anchored → PER PATH. Each emitted path becomes its own threat (5a) and
//     hence its own risk; each risk gets the likelihood of ITS path. The risk id
//     is buildThreatId(tree.id, pathKey, stride) — the same id the 5a threat
//     generator assigns, so risk.threatId matches by construction.
//
//   threat-anchored → AGGREGATED. The whole tree belongs to one risk
//     (anchor.threatId); all paths feed that single risk, so the tree's
//     aggregatedLikelihoodLevel (the MAX across paths, ISO 15.8 NOTE 2 — the
//     attacker takes the easiest route) is the value.
//
// Mapping B (FeasibilityLevel → risk scale) happens HERE, via the project's
// FeasibilityConfiguration.levelToRiskScale. features/risks never sees a
// FeasibilityLevel.

import type { AttackTreeLikelihoodReference } from "shared";
import type {
  AttackTreeData,
  AttackTree,
  FeasibilityLevel,
} from "features/attacktree";
import {
  buildThreatId,
  resolveFeasibilityConfiguration,
  generateThreatsFromAttackTree,
} from "features/attacktree";

/**
 * Map a FeasibilityLevel to the project's risk scale via Mapping B. Undefined
 * level (unrated path) → no contribution (returns undefined), so an unrated
 * path never silently becomes a low likelihood.
 */
function mapLevel(
  level: FeasibilityLevel | undefined,
  levelToRiskScale: Record<FeasibilityLevel, number>,
): number | undefined {
  if (!level) return undefined;
  return levelToRiskScale[level];
}

/**
 * Build the attack-tree likelihood references a project contributes to its
 * risks. One entry per (risk that a tree feeds).
 *
 * @param attackTrees  project.attackTrees (AttackTreeData, or null)
 * @returns            flat list across all trees; [] when there are no trees or
 *                     none carry a rated pathAnalysis
 */
export function buildAttackTreeLikelihoodReferences(
  attackTrees: AttackTreeData | null | undefined,
): AttackTreeLikelihoodReference[] {
  const trees = attackTrees?.trees ?? [];
  if (trees.length === 0) return [];

  // Project-wide feasibility config → the Mapping-B table. Resolve once.
  const feasibilityConfig = resolveFeasibilityConfiguration(
    attackTrees?.configuration,
  );
  const levelToRiskScale = feasibilityConfig.levelToRiskScale;

  const refs: AttackTreeLikelihoodReference[] = [];

  for (const tree of trees) {
    if (!tree.pathAnalysis || tree.pathAnalysis.paths.length === 0) continue;

    if (tree.anchor.type === "asset" && tree.anchor.assetId) {
      refs.push(...refsForAssetTree(tree, levelToRiskScale));
    } else if (tree.anchor.type === "threat" && tree.anchor.threatId) {
      const ref = refForThreatTree(tree, levelToRiskScale);
      if (ref) refs.push(ref);
    }
    // Standalone / risk-anchored trees do not feed a risk's likelihood here.
    // (Risk-anchored: the risk already exists and is the anchor; wiring that is
    // a separate decision, deliberately out of scope for this builder.)
  }

  return refs;
}

/**
 * Asset-anchored: per emitted path. We reuse the 5a generator to get exactly the
 * paths that emit (same emission policy, same suppression), then for each we
 * rebuild the SAME threat id the generator used, so the reference's riskId
 * matches the risk that path's threat became.
 */
function refsForAssetTree(
  tree: AttackTree,
  levelToRiskScale: Record<FeasibilityLevel, number>,
): AttackTreeLikelihoodReference[] {
  const out: AttackTreeLikelihoodReference[] = [];
  const { threats } = generateThreatsFromAttackTree(tree);
  if (threats.length === 0) return out;

  // Index paths by pathKey for the per-path likelihood lookup.
  const pathByKey = new Map(
    tree.pathAnalysis!.paths.map((p) => [p.pathKey, p]),
  );

  // Each emitted threat carries id = buildThreatId(tree.id, pathKey, stride).
  // We recover (pathKey, stride) not by parsing the id but by re-deriving it:
  // the generator already gave us the threat with its id and strideCategory, and
  // the path is found by matching the id against every path's (key, stride).
  for (const threat of threats) {
    // Find the path whose (pathKey, stride) rebuilds this threat's id.
    const match = [...pathByKey.values()].find(
      (p) =>
        buildThreatId(tree.id, p.pathKey, threat.strideCategory) === threat.id,
    );
    if (!match) continue;

    const mappedValue = mapLevel(match.likelihoodLevel, levelToRiskScale);
    if (mappedValue === undefined) continue; // unrated path → no contribution

    out.push({
      riskId: threat.id, // === risk.threatId by construction (createEmptyRisk)
      treeId: tree.id,
      pathKey: match.pathKey,
      strideCategory: threat.strideCategory,
      likelihoodComponent: match.feasibility ?? match.probability ?? 0,
      mappedValue,
    });
  }

  return out;
}

/**
 * Threat-anchored: one risk (anchor.threatId), aggregated likelihood (max).
 */
function refForThreatTree(
  tree: AttackTree,
  levelToRiskScale: Record<FeasibilityLevel, number>,
): AttackTreeLikelihoodReference | null {
  // Once a primary path is chosen (attacktree-threat-generator.ts), it alone
  // drives the anchor threat's likelihood — every OTHER path that reaches the
  // same effect became its own threat/risk (refsForAssetTree-style, via the
  // secondary-threat branch) and must not ALSO count here, or the same
  // evidence would be double-counted across two risks. Without a primary
  // path (default, unset), fall back to the original MAX-over-all-paths
  // behaviour — unchanged for every project that doesn't use this feature.
  const primaryPath = tree.primaryPathKey
    ? tree.pathAnalysis!.paths.find((p) => p.pathKey === tree.primaryPathKey)
    : undefined;

  const level = primaryPath
    ? primaryPath.feasibilityLevel
    : tree.pathAnalysis!.aggregatedLikelihoodLevel;
  const component = primaryPath
    ? (primaryPath.feasibility ?? primaryPath.probability ?? 0)
    : (tree.pathAnalysis!.aggregatedLikelihood ?? 0);

  const mappedValue = mapLevel(level, levelToRiskScale);
  if (mappedValue === undefined) return null; // no rated path → no contribution

  const threatId = tree.anchor.threatId!;

  // A threat-anchored tree must carry a STRIDE category to attribute its
  // likelihood; without one we cannot form a valid reference, so contribute
  // nothing (mirrors an unrated path contributing nothing).
  const stride = tree.anchor.strideCategory;
  if (!stride) return null;

  return {
    riskId: threatId, // risk.threatId === anchor.threatId
    treeId: tree.id,
    // provenance: which path drove the number — the primary path once one is
    // chosen, otherwise the whole-tree max as before.
    pathKey: primaryPath ? primaryPath.pathKey : "*aggregated*",
    strideCategory: stride,
    likelihoodComponent: component,
    mappedValue,
  };
}