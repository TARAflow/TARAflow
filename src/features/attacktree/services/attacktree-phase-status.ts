// ==================== ATTACK TREE PHASE STATUS ====================
// The Attack Tree phase (required by ISO/SAE 21434 only — the overall
// progress counts it there): before, no code derived its status, so an
// ISO 21434 project could never reach 100 %.
//
//   not started  no attack tree
//   incomplete   a tree has validation errors
//   in progress  no attack-path risk yet, or one without its attack-tree
//                assessment (the tree's path not yet in the risk rating)
//   complete     every tree valid, every attack-path risk assessed

import type { PhaseStatus } from "shared";
import type { AttackTree } from "../models/attacktree-types";

/** What the rule reads of a risk (no dependency on the risks feature). */
export interface AttackPathRiskRef {
  sourceStrideMethod?: string;
  attackTreeAssessment?: unknown;
}

export function attackTreePhaseStatus(
  trees: readonly Pick<AttackTree, "validation">[] | undefined,
  risks: readonly AttackPathRiskRef[] | undefined,
): PhaseStatus {
  if (!trees || trees.length === 0) return "not-started";
  if (trees.some((t) => (t.validation?.errors?.length ?? 0) > 0)) return "incomplete";
  const paths = (risks ?? []).filter((r) => r.sourceStrideMethod === "attack-path");
  if (paths.length === 0 || paths.some((r) => !r.attackTreeAssessment)) return "in-progress";
  return "complete";
}
