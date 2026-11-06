// ==================== CONCEPT RELINK ====================
// FX-5: goals and claims orphaned by a renamed attack-tree node. An
// attack-path risk's id holds the path key — the chain of node names — so a
// rename makes a new risk and the old one disappears; goals and claims keep
// the old id (REMOVED_RISK). Re-linking is the analyst's decision (a renamed
// step may be a different scenario); this module only proposes the risks the
// dead link most likely meant and performs the swap.

import {
  linkClaim,
  linkGoal,
  unlinkClaim,
  unlinkGoal,
  type CybersecurityClaim,
  type CybersecurityConcept,
  type CybersecurityGoal,
} from "shared";
import type { Risk } from "../models/risk-assessment-types";

export type ConceptItemKind = "goal" | "claim";

/**
 * Whether `riskId` (an id that no longer exists) was an attack-path risk of
 * the same tree and STRIDE category as `candidate`: the ids agree except for
 * the path key. Read from the candidate's own id, so the id format stays
 * where it is built (attack-tree feature).
 */
function sameTreeAndStride(riskId: string, candidate: Risk): boolean {
  const pathKey = candidate.attackTreeAssessment?.pathKey;
  if (!pathKey) return false;
  const at = candidate.id.lastIndexOf(pathKey);
  if (at < 0) return false;
  const prefix = candidate.id.slice(0, at);
  const suffix = candidate.id.slice(at + pathKey.length);
  return riskId.length > prefix.length + suffix.length && riskId.startsWith(prefix) && riskId.endsWith(suffix);
}

/**
 * The risks a dead link of `item` may be re-linked to: attack-path risks of
 * the same tree and STRIDE category the item is not linked to yet. Paths no
 * goal / claim of the same kind covers come first (a renamed path is new),
 * then by label.
 */
export function relinkCandidates(
  removedRiskId: string,
  item: CybersecurityGoal | CybersecurityClaim,
  kind: ConceptItemKind,
  risks: readonly Risk[],
  concept: CybersecurityConcept,
): Risk[] {
  const linked = new Set(item.riskIds);
  const items: readonly (CybersecurityGoal | CybersecurityClaim)[] = kind === "goal" ? concept.goals : concept.claims;
  const covered = new Set(items.flatMap((x) => x.riskIds));
  return risks
    .filter((r) => !linked.has(r.id) && sameTreeAndStride(removedRiskId, r))
    .sort(
      (a, b) =>
        Number(covered.has(a.id)) - Number(covered.has(b.id)) ||
        a.threatDisplayId.localeCompare(b.threatDisplayId, undefined, { numeric: true }),
    );
}

/** Replace the dead link `fromRiskId` of the item by `toRiskId`, or drop it (`null`). */
export function relinkConceptItem(
  concept: CybersecurityConcept,
  kind: ConceptItemKind,
  itemId: string,
  fromRiskId: string,
  toRiskId: string | null,
): CybersecurityConcept {
  const unlink = kind === "goal" ? unlinkGoal : unlinkClaim;
  const link = kind === "goal" ? linkGoal : linkClaim;
  const without = unlink(concept, itemId, fromRiskId);
  return toRiskId ? link(without, itemId, toRiskId) : without;
}
