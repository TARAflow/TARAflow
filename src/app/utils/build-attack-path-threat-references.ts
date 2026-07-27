// src/app/utils/build-attack-path-threat-references.ts
//
// App-layer read-model builder — the third threat source for the Risk feature.
//
// Mirrors build-asset-data-reference.ts: the app layer is the only place that
// holds the attack-tree store AND can hand its output to the Risk feature. The
// Risk tab already consumes perElementThreats and perInteractionThreats; this
// adds perAttackPathThreats, produced the same way extractThreatReferences
// produces the STRIDE ones.
//
// WHAT IT DOES
// ------------
// For every ASSET-anchored tree (only those emit — ISO 3.1.33; the generator
// enforces it), it:
//   1. generates the tree's attack-path ThreatReferences (pure generator), and
//   2. overlays the analyst's persisted confirm/dismiss decisions
//      (pathAssessments on the tree) so relevance is carried, not reset.
//
// It does NOT run the Class A/B diff — that needs the tree's PREVIOUS
// pathAnalysis and belongs at edit time (the editor hook). This builder is
// pure, stateless and runs on every render, exactly like the other extractors:
// given the same trees it yields the same references.
//
// LAYERING
// --------
// Lives in app/utils, not in a feature: it bridges features/attacktree (the
// trees) to features/risks (the ThreatReference sink). Neither feature imports
// the other; the app layer wires them, as with buildAssetDataReference.

import type { ThreatReference } from "shared";
import type { AttackTreeData } from "features/attacktree";
import {
  generateThreatsFromAttackTree,
  applyAssessmentsToThreats,
  buildThreatId,
  isReadyForRisk,
} from "features/attacktree";

/**
 * Derive the attack-path ThreatReferences a project contributes to the risk
 * register, with analyst decisions overlaid.
 *
 * @param attackTrees  project.attackTrees (the AttackTreeData, or null)
 * @returns            flat list across all asset-anchored trees; [] when there
 *                     are no trees or none are asset-anchored
 */
export function buildAttackPathThreatReferences(
  attackTrees: AttackTreeData | null | undefined,
): ThreatReference[] {
  const trees = attackTrees?.trees ?? [];
  if (trees.length === 0) return [];

  const references: ThreatReference[] = [];

  for (const tree of trees) {
    // The generator is the single gate on "does this tree emit at all": it
    // returns [] for standalone / threat-anchored / asset-less trees. We do not
    // re-check the anchor here — that would duplicate (and risk diverging from)
    // its ISO 3.1.33 rule.
    const { threats } = generateThreatsFromAttackTree(tree);
    if (threats.length === 0) continue;

        const overlaid = applyAssessmentsToThreats(
          tree,
          threats,
          tree.pathAssessments ?? [],
        );
        const assessments = tree.pathAssessments ?? [];

    references.push(
      ...overlaid.filter((threat) => {
        const a = assessments.find(
          (x) =>
            buildThreatId(tree.id, x.pathKey, x.strideCategory) === threat.id,
        );
        // Two-stage gate: an attack-path threat reaches the Risk tab only when the
        // path is RELEVANT and has ≥1 mitigation. unrated / uncertain /
        // relevant-without-mitigation / not_relevant stay in the attack-tree tab.
        // (Verification is NOT required here — it gates "fully closed", not entry.)
        return a ? isReadyForRisk(a) && a.relevance === "relevant" : false;
      }),
    );
  }

  return references;
}