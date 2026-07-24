// src/features/attacktree/utils/attacktree-labels.ts
//
// Human-facing wording for anchors, security goals and derived tree titles.
//
// Kept in one place because the same wording appears in the overview cards, the
// detail selector and (later) the report — and because the derivation has a rule
// worth stating once: a tree's DISPLAYED title is derived from its anchor, not
// read from `tree.name`.
//
// Why derived: `tree.name` is written once at creation, from the template
// ("Integrity Violation"). It names the template, not the analysis — it says
// nothing about which asset is attacked, and it freezes: improving the wording
// later would leave every existing tree on the old text. Deriving it from the
// anchor keeps the two in step and makes the rename rule fall out by itself —
// once renaming exists (UI rework §5), a stored name means "the analyst chose
// this" and wins; absent it, the derived title is used.
//
// LABEL SOURCES
// -------------
// STRIDE names come from the shared catalogue in common.json (`stride.<L>.name`)
// — it already exists and the Threat tab uses it, so the category must not be
// spelled a second time here.
//
// Security goals get their own section (`securityGoal.<type>.name`, mirroring
// the shape of `stride.<L>`) rather than
// borrowing `stride.<L>.securityProperty`: that field is the property STRIDE
// letters protect, and since CIANAAA maps BOTH `N` and `Acc` onto `R`, reading
// goal names back through STRIDE would label Accountability as
// "Non-repudiation". The mapping is deliberately not injective, so it cannot be
// inverted.

import type { TFunction } from "i18next";
import type { SecurityGoalType, StrideCategory } from "shared";
import { CIANAAA_TO_STRIDE } from "shared";
import type { AttackTree } from "../models/attacktree-types";

// ==================== FALLBACK WORDING ====================

/**
 * Used only until the catalogue entry exists — see LABEL SOURCES above.
 *
 * The catalogue entry deliberately carries `name` and `description` but NOT the
 * STRIDE category the goal maps to: that mapping is CIANAAA_TO_STRIDE in code,
 * and a second copy in the translation files could drift — per language.
 */
const SECURITY_GOAL_FALLBACK: Record<SecurityGoalType, string> = {
  C: "Confidentiality",
  I: "Integrity",
  A: "Availability",
  N: "Non-repudiation",
  AuthZ: "Authorization",
  AuthN: "Authentication",
  Acc: "Accountability",
};

// ==================== LABELS ====================

/** "N" → "Non-repudiation (N)" — a bare letter tells a reader nothing. */
export function securityGoalLabel(goal: SecurityGoalType, t: TFunction): string {
  const name = t(`common:securityGoal.${goal}.name`, {
    defaultValue: SECURITY_GOAL_FALLBACK[goal],
  });
  return `${name} (${goal})`;
}

/** Reuses the shared STRIDE catalogue the Threat tab already renders. */
export function strideLabel(stride: StrideCategory, t: TFunction): string {
  return t(`common:stride.${stride}.name`);
}

/** A list of goals, spelled out — for the coverage tooltip. */
export function securityGoalList(
  goals: SecurityGoalType[],
  t: TFunction,
): string {
  return goals.map((g) => securityGoalLabel(g, t)).join(", ");
}

// ==================== TREE TITLE ====================

/**
 * What the tree is about, in one line.
 *
 * Asset-anchored: the attack on the asset, named by the STRIDE category its
 * security goal maps to — "Tampering of \"Config Data\"". That is what the tree
 * analyses, and it stays true regardless of which template it started from.
 *
 * Anything else falls back to the stored name: a threat-anchored tree is about
 * its threat, which already has a description, and a standalone tree has no
 * anchor to derive from.
 */
export function treeDisplayTitle(tree: AttackTree, t: TFunction): string {
  if (
    tree.anchor.type === "asset" &&
    tree.anchor.securityGoal &&
    tree.anchor.assetName
  ) {
    const stride = CIANAAA_TO_STRIDE[tree.anchor.securityGoal];
    return t("attacktree:tabs.attacktree.tab.assetTreeTitle", {
      stride: strideLabel(stride, t),
      asset: tree.anchor.assetName,
      defaultValue: '{{stride}} of "{{asset}}"',
    });
  }
  return tree.name;
}

/** The line under the title: which goal, and how much has been analysed. */
export function treeDisplaySubtitle(tree: AttackTree, t: TFunction): string {
  const parts: string[] = [];

  if (tree.anchor.type === "asset" && tree.anchor.securityGoal) {
    parts.push(securityGoalLabel(tree.anchor.securityGoal, t));
  }

  const pathCount = tree.pathAnalysis?.paths.length ?? 0;
  parts.push(
    t("attacktree:tabs.attacktree.tab.pathCount", {
      count: pathCount,
      defaultValue: "{{count}} attack paths",
    }),
  );

  // Only decisions the analyst actually made — "unrated" is not a decision.
  const assessed = (tree.pathAssessments ?? []).filter(
    (a) => a.relevance !== "unrated",
  ).length;
  if (assessed > 0) {
    parts.push(
      t("attacktree:tabs.attacktree.tab.assessedCount", {
        count: assessed,
        defaultValue: "{{count}} assessed",
      }),
    );
  }

  return parts.join(" · ");
}