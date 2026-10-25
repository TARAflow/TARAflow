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

import type { ProjectTags, ThreatReference } from "shared";
import type { AttackTreeData } from "features/attacktree";
import {
  generateThreatsFromAttackTree,
  applyAssessmentsToThreats,
  buildThreatId,
  isReadyForRisk,
} from "features/attacktree";
import {
  getAllMitigations,
  selectCategoryControls,
  selectCategoryVerifications,
} from "features/threats";

/**
 * Cap on total proposed controls after enrichment. The analyst's DSL [M-] refs
 * are always kept in full; catalog STRIDE-category controls only fill the
 * remaining slots up to this cap. Kept in sync with the generic element
 * fallback cap (element-generator.ts GENERIC_CATEGORY_CONTROL_CAP).
 */
const CATEGORY_CONTROL_CAP = 4;

/**
 * Top up a tree-derived threat's controls with catalog STRIDE-category controls.
 * The tree carries only the analyst's DSL [M-] refs; STRIDE element threats get
 * category controls from the catalog, so attack-path threats should too. DSL
 * refs stay first and are never dropped; deduped category controls fill up to
 * CATEGORY_CONTROL_CAP total.
 *
 * Mitigation catalog design D3 / D4: only controls whose context fits the
 * project; with a path attack vector (`av=`), controls for that vector first,
 * then vector-free ones, none for other vectors — and the verifications follow
 * the chosen controls before the category fill. Without a vector the choice is
 * the category order as before.
 */
function enrichWithCategoryControls(
  threat: ThreatReference,
  tags: ProjectTags | undefined,
): ThreatReference {
  const mits = threat.proposedMitigations ?? [];
  const mitIds = new Set(mits.flatMap((m) => (m.id ? [m.id] : [])));
  const mitTopUp = selectCategoryControls(threat.strideCategory, {
    attackVector: threat.attackVector,
    tags,
    exclude: mitIds,
    limit: CATEGORY_CONTROL_CAP - mits.length,
  });

  const vers = threat.proposedVerifications ?? [];
  const verIds = new Set(vers.flatMap((v) => (v.id ? [v.id] : [])));
  const controlVerifications = threat.attackVector
    ? [
        ...mits.map((m) => getAllMitigations().find((c) => c.id === m.id)),
        ...mitTopUp,
      ].flatMap((c) => c?.verifications ?? [])
    : [];
  const ownIds = [...new Set(controlVerifications)].filter((id) => !verIds.has(id));
  const verTopUp = [
    ...ownIds,
    ...selectCategoryVerifications(threat.strideCategory, {
      tags,
      exclude: new Set([...verIds, ...ownIds]),
      limit: CATEGORY_CONTROL_CAP,
    }).map((v) => v.id),
  ]
    .slice(0, Math.max(0, CATEGORY_CONTROL_CAP - vers.length))
    .map((id) => ({ id }));

  return {
    ...threat,
    proposedMitigations: [...mits, ...mitTopUp.map((m) => ({ id: m.id }))],
    proposedVerifications: [...vers, ...verTopUp],
  };
}

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
  requireMitigation: boolean = true,
  tags?: ProjectTags,
): ThreatReference[] {
  const trees = attackTrees?.trees ?? [];
  if (trees.length === 0) return [];

  const references: ThreatReference[] = [];

  for (let index = 0; index < trees.length; index++) {
    const tree = trees[index];
    // The generator is the single gate on "does this tree emit at all": it
    // returns [] for standalone / threat-anchored / asset-less trees. We do not
    // re-check the anchor here — that would duplicate (and risk diverging from)
    // its ISO 3.1.33 rule.
    // index + 1 is the tree's 1-based position in the project; it drives the
    // friendly AT-<treeNo>.<pathNo> display id on the emitted threats.
    const { threats } = generateThreatsFromAttackTree(tree, undefined, index + 1);
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
        // Two-stage gate: an attack-path threat reaches the Risk tab when the
        // path is RELEVANT and (outside ISO) has ≥1 mitigation. ISO 21434
        // assesses the risk (impact × feasibility) BEFORE deciding treatment,
        // so requireMitigation=false lets a relevant path reach the Risk tab
        // immediately; mitigations/treatment are decided there.
        // unrated / uncertain / not_relevant always stay in the attack-tree tab.
        return a
          ? a.relevance === "relevant" &&
              (requireMitigation ? isReadyForRisk(a) : true)
          : false;
      }).map((threat) => enrichWithCategoryControls(threat, tags)),
    );
  }

  return references;
}