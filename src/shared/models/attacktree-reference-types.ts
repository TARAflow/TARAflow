// ==================== ATTACK TREE REFERENCE TYPES ====================
// Minimal attack-tree likelihood snapshot consumed by the Risk feature.
// No dependency on attack-tree feature types — Dependency Inversion.
//
// The Risk feature must not import FeasibilityLevel, FeasibilityConfiguration,
// or any attacktree type. It needs exactly one thing from an attack tree: the
// likelihood a threat-anchored tree contributes to the referenced risk, ALREADY
// mapped to the active risk scale. That mapping (FeasibilityLevel / probability
// → risk scale, "Mapping B") happens on the attack-tree side of the app-layer
// builder, not here and not in features/risks.
//
// Consumers import directly from this file (re-exported by shared).

import { StrideCategory } from "./common-types";


// ==================== ATTACK TREE LIKELIHOOD REFERENCE ====================

/**
 * The likelihood one threat-anchored attack tree contributes to one risk.
 *
 * Populated by the app layer (an extractAttackTreeLikelihoodReferences-style
 * builder that holds both the attack-tree store and the risk scale). The Risk
 * feature reads `mappedValue` and never sees how it was derived.
 *
 * `treeId` / `pathKey` / `strideCategory` are opaque provenance to the Risk
 * feature — carried for the audit trail and to match a reference to its risk,
 * not interpreted.
 */
export interface AttackTreeLikelihoodReference {
  /** The risk this likelihood belongs to (matches Risk.threatId / id). */
  riskId: string;

  /** Provenance — opaque ids, not interpreted by the Risk feature. */
  treeId: string;
  pathKey: string;
  strideCategory: StrideCategory;

  /**
   * Raw likelihood component (0..1) BEFORE mapping — feasibility, or f·b in
   * 62443 mode, or probability in a p,i tree. Kept for the audit trail only;
   * the Risk feature does not compute with it.
   */
  likelihoodComponent: number;

  /**
   * The likelihood ALREADY mapped to the active risk scale (1..N). This is the
   * value that becomes the attack_tree_likelihood factor rating.
   */
  mappedValue: number;
}
