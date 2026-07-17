// src/features/attacktree/services/attacktree-threat-generator.ts
//
// PHASE 4 — The attack tree becomes a THREAT generator.
//
// This is the move that makes the whole refactor cheap. The tree does NOT emit
// Risks — it emits Threats, exactly like the per-element and per-interaction
// STRIDE generators already do. Consequently:
//
//   Risk.threatId stays intact.        generateRiskId() stays R-${threatId}.
//   syncRisksFromThreats() is unchanged.  The Risks tab is a single register.
//
// The Risks tab never learns which generator produced a threat. It doesn't have
// to. `sourceStrideMethod: "attack-path"` records it for traceability.
//
// LAYERING
// --------
// attacktree must not import from features/threats (its own architecture rule).
// So the generator emits ThreatReference — the lean, dependency-inverted snapshot
// that already lives in shared/models and that the Risk feature already consumes.
// It carries everything the register needs and NOTHING that would pull in the
// threat feature. The app layer translates ThreatReference → full Threat at sync
// time, exactly as extractThreatReferences already does for the STRIDE generators.
//
// WHAT A THREAT IS HERE
// ---------------------
// One threat = one attack path (ROOT → leaf) × one STRIDE category.
//
// Not one leaf, not one node: the PATH is the threat scenario. ISO 21434 3.1.4
// defines an attack path as the set of deliberate actions realising a threat
// scenario, and 15.6 sanctions deriving those paths from an attack tree.
//
// The "× one STRIDE category" is not padding. ATTACK_GOAL_TO_STRIDE maps
// `destruction` onto BOTH T and D — a destructive attack compromises integrity
// *and* availability. Those are two different threats: they may violate different
// security goals of the asset and may need different controls. Emitting one
// threat that claims to be both cannot be treated cleanly in the register, so
// they are emitted separately. Every other goal maps 1:1 and yields one threat.
//
// ONLY ASSET-ANCHORED TREES EMIT
// ------------------------------
// ISO 3.1.33: a threat scenario is by definition the compromise of a
// cybersecurity property OF ONE OR MORE ASSETS. No asset → no threat scenario →
// no damage scenario → no impact → no risk value.
//
// Standalone trees remain legal and useful — 15.6 is also invoked from 8.5
// (vulnerability analysis), where the only question is whether a weakness is
// exploitable at all. They simply contribute nothing to the register, and the
// validator says so.

import type {
  AttackPath,
  AttackTree,
  PathAnalysis,
} from "../models/attacktree-types";
import { ATTACK_GOAL_TO_STRIDE } from "../models/attacktree-types";
import {
  FeasibilityLevel,
  FEASIBILITY_RANK,
} from "../models/attacktree-feasibility-types";
import { buildAttackPathThreatId } from "./attacktree-path-identity";
import type {
  MitigationDraftRef,
  StrideCategory,
  ThreatReference,
} from "shared";

// ==================== EMISSION POLICY ====================

/**
 * Which attack paths become threat scenarios.
 *
 * Lives in the ATTACK TREE config, not the Risk config: this decides what counts
 * as a threat scenario, which is a property of the path analysis. In the Risk
 * config a user could silently change the threat population without ever opening
 * the Attack Tree tab.
 */
export type PathEmissionPolicy =
  | "cheapest-per-goal"
  | "above-threshold"
  | "all";

export interface EmissionOptions {
  policy: PathEmissionPolicy;
  /** Only for "above-threshold". */
  threshold?: FeasibilityLevel;
  /**
   * IEC 62443 / classic mode only. When set, paths whose attacker benefit is
   * negligible are not emitted: an attack nobody profits from is not a
   * reasonably foreseeable scenario. Never applied in ISO mode, where benefit
   * has no bearing on anything in the register (Cl. 3.1.29).
   */
  suppressNegligibleBenefit?: boolean;
}

export const DEFAULT_EMISSION_OPTIONS: EmissionOptions = {
  // Backed by 15.8 NOTE 2, which gives the MAXIMUM as the example for
  // aggregating the feasibility of several attack paths: the attacker takes the
  // easiest route, so the cheapest path is the threat scenario.
  policy: "cheapest-per-goal",
  threshold: "medium",
  suppressNegligibleBenefit: false,
};

// ==================== PATH SELECTION ====================

/**
 * A path with no feasibility is NEVER emitted, under any policy.
 *
 * An unrated path cannot be assessed: it would enter the register with no
 * likelihood and sit there looking like the safest thing in the project. The
 * validator already warns about the unrated leaf; the register must not paper
 * over it by inventing a threat around it.
 */
function isEmittable(path: AttackPath, options: EmissionOptions): boolean {
  if (!path.feasibilityLevel) return false;

  if (
    options.suppressNegligibleBenefit &&
    path.benefit === "negligible"
  ) {
    return false;
  }

  return true;
}

/** Select the paths that become threats, per the configured policy. */
export function selectEmittablePaths(
  analysis: PathAnalysis,
  options: EmissionOptions = DEFAULT_EMISSION_OPTIONS,
): AttackPath[] {
  const candidates = analysis.paths.filter((p) => isEmittable(p, options));

  if (candidates.length === 0) return [];

  switch (options.policy) {
    case "all":
      return candidates;

    case "above-threshold": {
      const floor = FEASIBILITY_RANK[options.threshold ?? "medium"];
      return candidates.filter(
        (p) => FEASIBILITY_RANK[p.feasibilityLevel!] >= floor,
      );
    }

    case "cheapest-per-goal":
    default: {
      // One threat per (tree × attack goal): the most feasible route to that
      // goal. Bounded threat count — a realistic tree has 20–50 leaves, and
      // emitting all of them would bury the analyst without adding scenarios.
      // The non-emitted paths stay documented in the tree and in the report.
      const bestByGoal = new Map<string, AttackPath>();

      for (const path of candidates) {
        // A path may carry several goals along its chain; key on each, so a path
        // that is the cheapest route to TWO goals is emitted for both.
        const goals = path.attackGoals.length > 0 ? path.attackGoals : ["__none__"];

        for (const goal of goals) {
          const incumbent = bestByGoal.get(goal);

          if (!incumbent) {
            bestByGoal.set(goal, path);
            continue;
          }

          const challengerRank = FEASIBILITY_RANK[path.feasibilityLevel!];
          const incumbentRank = FEASIBILITY_RANK[incumbent.feasibilityLevel!];

          if (challengerRank > incumbentRank) {
            bestByGoal.set(goal, path);
          } else if (challengerRank === incumbentRank) {
            // Deterministic tie-break. A wobbling "cheapest path" would make the
            // emitted threat set change between runs and defeat Phase 1's stable
            // identity: the analyst's confirm decisions would drift.
            if (
              path.riskScore > incumbent.riskScore ||
              (path.riskScore === incumbent.riskScore &&
                path.pathKey.localeCompare(incumbent.pathKey) < 0)
            ) {
              bestByGoal.set(goal, path);
            }
          }
        }
      }

      // De-duplicate: one path can win several goals.
      const unique = new Map<string, AttackPath>();
      bestByGoal.forEach((p) => unique.set(p.pathKey, p));
      return [...unique.values()];
    }
  }
}

// ==================== STRIDE MAPPING ====================

/**
 * The STRIDE categories a path attacks.
 *
 * `destruction` maps onto BOTH T and D — it compromises integrity *and*
 * availability — so such a path yields two threats. Every other goal maps 1:1.
 *
 * A path with no goal at all yields none: without a goal there is no STRIDE
 * category, and a threat without one cannot be filed. The validator warns.
 */
export function strideCategoriesForPath(path: AttackPath): StrideCategory[] {
  const categories = new Set<StrideCategory>();

  for (const goal of path.attackGoals) {
    const mapped = ATTACK_GOAL_TO_STRIDE[goal];
    if (mapped) mapped.forEach((c) => categories.add(c));
  }

  return [...categories];
}

// ==================== THREAT CONSTRUCTION ====================

/**
 * Threat id: AT-<treeId>-<pathKey>-<STRIDE>
 *
 * The pathKey (Phase 1) is what keeps an analyst's confirm/dismiss decision, risk
 * rating and Jira link attached to the right path across DSL edits. The STRIDE
 * suffix separates the two threats a `destruction` path produces while keeping
 * both traceable back to the one path.
 */
export function buildThreatId(
  treeId: string,
  pathKey: string,
  strideCategory: StrideCategory,
): string {
  return `${buildAttackPathThreatId(treeId, pathKey)}-${strideCategory}`;
}

/** The attack chain, rendered for the threat's attackDescription. */
function describeAttackChain(path: AttackPath): string {
  return path.path.join(" > ");
}

function toMitigationDrafts(mitigationIds: string[]): MitigationDraftRef[] {
  // Just the ids. Display text and implemented-status are resolved at sync time
  // from the catalog and from Risk.selectedMitigations — the same way the STRIDE
  // generators' references are enriched. The tree does not know either.
  return mitigationIds.map((id) => ({ id }));
}

function createThreatForPath(
  tree: AttackTree,
  path: AttackPath,
  strideCategory: StrideCategory,
  assetId: string,
): ThreatReference {
  return {
    id: buildThreatId(tree.id, path.pathKey, strideCategory),
    strideCategory,

    // The ROOT is the threat scenario; the chain is how it is realised.
    threatDescription: tree.ast?.name ?? tree.name,
    attackDescription: describeAttackChain(path),
    causeDescription: `Attack path analysis (${tree.name})`,

    // Traceability: this is what marks the threat as tree-derived. The register
    // treats it like any other; nothing branches on it except the reporter.
    sourceStrideMethod: "attack-path",

    // The analyst still decides. unrated → confirm / dismiss / uncertain, the
    // same workflow as every other threat. The tree proposes; it does not decide.
    relevance: "unrated",

    linkedAssetIds: [assetId],
    proposedMitigations: toMitigationDrafts(path.mitigations),
    // Verifications are resolved from the catalog by the threat/app layer, as for
    // the STRIDE generators. Nothing to seed from the tree.
    proposedVerifications: [],

    // An attack path crosses whatever boundaries it crosses; it is not filed
    // under one. Null keeps it out of the per-boundary tables rather than
    // asserting a boundary it does not have.
    trustBoundaryId: null,
    trustBoundaryName: null,
  };
}

// ==================== ENTRY POINT ====================

export interface AttackTreeThreatGenerationResult {
  threats: ThreatReference[];
  /** Paths deliberately not emitted — listed in the report so silence isn't mistaken for absence. */
  suppressedPaths: Array<{ path: AttackPath; reason: string }>;
}

/**
 * Generate the threat scenarios an attack tree contributes to the register.
 *
 * Pure: no I/O, no mutation of the tree. Given the same tree and options it
 * always produces the same threats, with the same ids — which is what makes the
 * Class A/B sync in Phase 5 possible.
 */
export function generateThreatsFromAttackTree(
  tree: AttackTree,
  options: EmissionOptions = DEFAULT_EMISSION_OPTIONS,
): AttackTreeThreatGenerationResult {
  const suppressedPaths: Array<{ path: AttackPath; reason: string }> = [];

  // Not asset-anchored → analysis only, no register contribution (ISO 3.1.33: a
  // threat scenario is by definition the compromise of a property OF AN ASSET).
  //
  // AttackTreeAnchor is a flat interface, not a discriminated union, so
  // `type === "asset"` does NOT guarantee assetId is set. A tree claiming an
  // asset anchor without an asset is broken — emitting an asset-less threat from
  // it would put an unattributable entry in the register.
  if (tree.anchor.type !== "asset" || !tree.anchor.assetId) {
    return { threats: [], suppressedPaths };
  }

  if (!tree.pathAnalysis || tree.pathAnalysis.paths.length === 0) {
    return { threats: [], suppressedPaths };
  }

  const assetId = tree.anchor.assetId;
  const emittable = selectEmittablePaths(tree.pathAnalysis, options);
  const emittedKeys = new Set(emittable.map((p) => p.pathKey));

  for (const path of tree.pathAnalysis.paths) {
    if (emittedKeys.has(path.pathKey)) continue;

    suppressedPaths.push({
      path,
      reason: !path.feasibilityLevel
        ? "not rated"
        : options.suppressNegligibleBenefit && path.benefit === "negligible"
          ? "negligible attacker benefit"
          : `not selected by policy "${options.policy}"`,
    });
  }

  const threats: ThreatReference[] = [];

  for (const path of emittable) {
    const categories = strideCategoriesForPath(path);

    if (categories.length === 0) {
      // No attack goal → no STRIDE category → the threat cannot be filed.
      suppressedPaths.push({ path, reason: "no attack goal declared" });
      continue;
    }

    for (const strideCategory of categories) {
      threats.push(createThreatForPath(tree, path, strideCategory, assetId));
    }
  }

  return { threats, suppressedPaths };
}

/** All trees in a project. */
export function generateThreatsFromAttackTrees(
  trees: AttackTree[],
  options: EmissionOptions = DEFAULT_EMISSION_OPTIONS,
): AttackTreeThreatGenerationResult {
  const threats: ThreatReference[] = [];
  const suppressedPaths: AttackTreeThreatGenerationResult["suppressedPaths"] = [];

  for (const tree of trees) {
    const result = generateThreatsFromAttackTree(tree, options);
    threats.push(...result.threats);
    suppressedPaths.push(...result.suppressedPaths);
  }

  return { threats, suppressedPaths };
}

// ==================== EXPORT ====================

export const attackTreeThreatGenerator = {
  generateThreatsFromAttackTree,
  generateThreatsFromAttackTrees,
  selectEmittablePaths,
  strideCategoriesForPath,
  buildThreatId,
};