// src/features/attacktree/services/attacktree-threat-sync.ts
//
// PHASE 5a — Sync asset-anchored attack-path threats (Class A / Class B).
//
// SCOPE — read this before extending
// ----------------------------------
// This is ONE of the two attack-tree sync axes, and deliberately only one:
//
//   Axis 2 (HERE): path identity within a LIVING, asset-anchored tree. The
//   anchor is intact; the DSL changed, so pathAnalysis changed. A new path is
//   Class A (silent unrated); an already-assessed path that vanished or was
//   renamed is Class B (banner — never silently drop the decision). Built on
//   Phase 1's diffPathAnalysis and the pathKey.
//
//   Axis 1 (NOT here): anchor integrity. A `threat`-anchored tree whose threat
//   was deleted is ORPHANED; an `asset`-anchored tree whose asset changed or
//   was deleted must react. That is a separate service — it depends on the
//   threats/assets features, has different invariants (orphan → notify +
//   delete) and a different test matrix. Kept out on purpose.
//
// LAYERING
// --------
// Pure, and free of any features/threats import. It consumes shared
// ThreatReference (what the generator emits) and the local AttackTree model.
// It emits overlaid ThreatReference[] and a PathDiff — the app layer feeds the
// former into syncRisksFromThreats and shows a banner on the latter.
//
// WHY OVERLAY INSTEAD OF PERSIST-THE-THREATS
// ------------------------------------------
// generateThreatsFromAttackTree is pure and deterministic: same tree → same
// threats, same ids (that is stated in its own header, and it is what makes
// this sync possible). So the threats are re-derivable and are NOT persisted.
// Only the analyst's decision is state — AttackPathAssessment on the tree.
// This function is where the two meet: fresh threats + stored decisions →
// threats that carry the decision.

import type { StrideCategory, ThreatReference, ThreatRelevanceRef } from "shared";
import type {
  AttackPathAssessment,
  AttackTree,
  PathAnalysis,
  RiskReference,
} from "../models/attacktree-types";
import {
  generateThreatsFromAttackTree,
  type EmissionOptions,
  DEFAULT_EMISSION_OPTIONS,
  buildThreatId,
} from "./attacktree-threat-generator";
import {
  diffPathAnalysis,
  type PathDiff,
} from "./attacktree-path-identity";

// ==================== ASSESSMENT KEY ====================

/**
 * An assessment is keyed by (pathKey, strideCategory) — a `destruction` path
 * produces two separately-assessable threats (T and D). This is the same tuple
 * the threat id encodes as AT-<treeId>-<pathKey>-<STRIDE>.
 */
function assessmentKey(pathKey: string, stride: StrideCategory): string {
  return `${pathKey}\u241F${stride}`;
}

// ==================== ASSESSMENT → THREAT ID ====================

/**
 * The threat id an assessment applies to, reconstructed deterministically.
 *
 * The generator builds ids as AT-<treeId>-<pathKey>-<STRIDE> via buildThreatId.
 * We build the same id from the assessment's tuple rather than parsing the id
 * apart (treeId and pathKey can both contain hyphens, so parsing is brittle).
 * This gives an id-keyed map, so the overlay is O(n+m), not O(n·m).
 */
function assessmentsByThreatId(
  treeId: string,
  assessments: readonly AttackPathAssessment[],
): Map<string, AttackPathAssessment> {
  const byId = new Map<string, AttackPathAssessment>();
  for (const a of assessments) {
    byId.set(buildThreatId(treeId, a.pathKey, a.strideCategory), a);
  }
  return byId;
}

/**
 * Inverse of buildThreatId: recover (pathKey, strideCategory) from a threat id.
 *
 * The relevance UI needs this to route a confirm/dismiss back to the right
 * assessment. It lives HERE, next to buildThreatId's consumers, so there is one
 * id↔tuple mapping in the codebase — not a second, drift-prone string-parse in
 * the component. The stride is already on the ThreatReference, so only pathKey
 * has to be recovered; we strip the known prefix/suffix and round-trip through
 * buildThreatId to reject anything that is not one of this tree's ids.
 */
export function tupleForThreatId(
  treeId: string,
  threatId: string,
  stride: StrideCategory,
): { pathKey: string; strideCategory: StrideCategory } | null {
  const prefix = `AT-${treeId}-`;
  const suffix = `-${stride}`;
  if (!threatId.startsWith(prefix) || !threatId.endsWith(suffix)) return null;
  const pathKey = threatId.slice(prefix.length, threatId.length - suffix.length);
  if (!pathKey) return null;
  // Round-trip guard: reject any id that is not one this tree would produce.
  if (buildThreatId(treeId, pathKey, stride) !== threatId) return null;
  return { pathKey, strideCategory: stride };
}

// ==================== ASSESSED KEYS ====================

/**
 * The pathKeys that carry a decision the analyst actually made — i.e. anything
 * other than "unrated". A removed path is Class B only if its key is in here;
 * a path nobody ever rated being gone destroys nothing (Class A).
 *
 * Keyed by pathKey ALONE (not per-stride): diffPathAnalysis works on paths, not
 * on STRIDE-split threats. A path is "assessed" if ANY of the threats it
 * produced was assessed — losing the path would strand that decision.
 */
export function deriveAssessedKeys(
  assessments: readonly AttackPathAssessment[],
): Set<string> {
  const keys = new Set<string>();
  for (const a of assessments) {
    // "Assessed" = analyst work worth protecting from silent loss: a relevance
    // decision OR attached mitigations. A mitigation-only (still unrated) path
    // must raise the Class B banner if it vanishes.
    if (
      a.relevance !== "unrated" ||
      (a.mitigationIds?.length ?? 0) > 0 ||
      (a.verificationIds?.length ?? 0) > 0
    ) {
      keys.add(a.pathKey);
    }
  }
  return keys;
}

/**
 * Whether a path assessment can advance to the Risk tab — i.e. residual risk
 * can be judged. Needs relevance + at least one mitigation. Verification is NOT
 * required here: it confirms the mitigation works (assurance / later V&V), which
 * is downstream of computing residual risk. `not_relevant` is terminal (no risk).
 */
export function isReadyForRisk(a: AttackPathAssessment): boolean {
  if (a.relevance === "not_relevant") return true;
  if (a.relevance === "relevant") return (a.mitigationIds?.length ?? 0) > 0;
  return false;
}

/**
 * Whether a path assessment is FULLY closed — drives the dialog's done marker
 * and the "verification pending" indicator. Stricter than isReadyForRisk: a
 * relevant path also needs at least one verification (every mitigation should
 * have a test that checks it works). `not_relevant` is terminal.
 */
export function isPathAssessmentComplete(a: AttackPathAssessment): boolean {
  if (!isReadyForRisk(a)) return false;
  if (a.relevance === "not_relevant") return true;
  return (a.verificationIds?.length ?? 0) > 0;
}

// ==================== OVERLAY ====================

/**
 * Lay the persisted decisions over the freshly generated threats.
 *
 * The generator emits every threat as "unrated". For each, if an assessment
 * exists for its (pathKey, strideCategory), its relevance (and evalNote) is
 * written onto the returned copy. Threats with no assessment stay "unrated" —
 * a new path is silently pending review (Class A), no interruption.
 *
 * Pure: returns new objects, mutates nothing.
 */
export function applyAssessmentsToThreats(
  tree: AttackTree,
  threats: readonly ThreatReference[],
  assessments: readonly AttackPathAssessment[],
): ThreatReference[] {
  if (assessments.length === 0) return threats.map((t) => ({ ...t }));

  const byId = assessmentsByThreatId(tree.id, assessments);

  return threats.map((threat) => {
    const a = byId.get(threat.id);
    if (!a) return { ...threat };
    // relevance + the analyst's catalogue selections cross over. mitigationIds
    // and verificationIds become proposal drafts, UNIONed with any the generator
    // already emitted from legacy DSL leaves so neither source is dropped.
    // evalNote stays on the assessment (no ThreatReference field for it).
    return {
      ...threat,
      relevance: a.relevance,
      proposedMitigations: mergeIdDrafts(
        threat.proposedMitigations,
        a.mitigationIds,
      ),
      proposedVerifications: mergeIdDrafts(
        threat.proposedVerifications,
        a.verificationIds,
      ),
    };
  });
}

/**
 * Union a threat's existing proposal drafts (generator's DSL parse) with the
 * assessment's catalogue ids, de-duped by id, order preserved. Same shape for
 * mitigations and verifications.
 */
function mergeIdDrafts<T extends { id?: string }>(
  existing: readonly T[] | undefined,
  ids: readonly string[] | undefined,
): T[] {
  const base: T[] = existing ? [...existing] : [];
  if (!ids || ids.length === 0) return base;
  const have = new Set(base.map((d) => d.id).filter(Boolean));
  for (const id of ids)
    if (!have.has(id)) {
      base.push({ id } as T);
      have.add(id);
    }
  return base;
}
// ==================== RECONCILIATION (Class A / B) ====================

export interface AttackPathSyncResult {
  /** Freshly generated threats, with persisted decisions overlaid. */
  threats: ThreatReference[];
  /**
   * The assessment set to persist. Class B removals are KEPT (their decision
   * is not silently discarded); Class A additions need no entry (absence reads
   * as unrated). So today this equals the input — the caller still persists it
   * because the diff may drive a banner that ends in the analyst pruning it.
   */
  assessments: AttackPathAssessment[];
  /** The path-level diff. `requiresBanner` is true iff an assessed path is gone. */
  diff: PathDiff;
}

/**
 * Reconcile a tree's emitted threats against its stored decisions after its
 * pathAnalysis was recomputed.
 *
 * @param tree      the tree AFTER recompute (its pathAnalysis is `next`)
 * @param previous  the pathAnalysis BEFORE the recompute (for the A/B diff);
 *                  undefined on first analysis → every path is an addition (A)
 * @param options   emission policy (defaults to cheapest-per-goal)
 *
 * Only asset-anchored trees emit — for anything else this returns empty threats
 * and an empty diff, exactly as generateThreatsFromAttackTree does. The
 * assessments are still returned untouched so the caller never loses them.
 */
export function reconcileAttackPathThreats(
  tree: AttackTree,
  previous: PathAnalysis | undefined,
  options: EmissionOptions = DEFAULT_EMISSION_OPTIONS,
): AttackPathSyncResult {
  const assessments = tree.pathAssessments ?? [];

  const { threats: rawThreats } = generateThreatsFromAttackTree(tree, options);
  const threats = applyAssessmentsToThreats(tree, rawThreats, assessments);

  const assessedKeys = deriveAssessedKeys(assessments);
  const diff = diffPathAnalysis(previous, tree.pathAnalysis, assessedKeys);

  return { threats, assessments: [...assessments], diff };
}

// ==================== ASSESSMENT WRITE (workflow entry point) ====================

/**
 * Record (or clear) the analyst's decision on one emitted threat.
 *
 * This is the ONLY writer of AttackPathAssessment. The UI calls it from the
 * confirm/dismiss/uncertain table; setting "unrated" removes the entry (the
 * default reads as unrated anyway, so we don't store noise).
 *
 * Pure: returns a new assessment array; the caller writes it onto the tree via
 * updateTree, which persists through the existing auto-save path.
 */
export function setPathAssessment(
  assessments: readonly AttackPathAssessment[],
  pathKey: string,
  strideCategory: StrideCategory,
  relevance: ThreatRelevanceRef,
  evalNote?: string,
  mitigationIds?: string[],
  verificationIds?: string[],
): AttackPathAssessment[] {
  const key = assessmentKey(pathKey, strideCategory);
  const existing = assessments.find(
    (a) => assessmentKey(a.pathKey, a.strideCategory) === key,
  );
  const rest = assessments.filter(
    (a) => assessmentKey(a.pathKey, a.strideCategory) !== key,
  );

  // Merge, not full-replace (see mitigationIds note). undefined = keep, [] = clear.
  const mergedMit = mitigationIds ?? existing?.mitigationIds;
  const normalizedMitigationIds =
    mergedMit && mergedMit.length > 0 ? mergedMit : undefined;
  const mergedVer = verificationIds ?? existing?.verificationIds;
  const normalizedVerificationIds =
    mergedVer && mergedVer.length > 0 ? mergedVer : undefined;

  // Drop a truly inert entry: unrated AND nothing attached at all.
  if (
    relevance === "unrated" &&
    !normalizedMitigationIds &&
    !normalizedVerificationIds &&
    (evalNote === undefined || evalNote === "")
  ) {
    return rest;
  }

  return [
    ...rest,
    {
      pathKey,
      strideCategory,
      relevance,
      evalNote,
      mitigationIds: normalizedMitigationIds,
      verificationIds: normalizedVerificationIds,
      lastModified: new Date().toISOString(),
    },
  ];
}

/**
 * Apply an analyst's relevance decision on a specific emitted threat, by id.
 *
 * This is the pure core of the confirm/dismiss/uncertain UI: it maps the
 * threat back to its (pathKey, strideCategory) and writes the decision. The
 * component is a thin shell over this — the logic lives here so it is testable
 * without rendering (and survives the coming UI overhaul, which will replace
 * the component but not this mapping).
 *
 * Returns the SAME array (referential identity) when the threat id does not
 * belong to this tree, so a stray click can't silently mutate state.
 */
export function applyRelevanceDecision(
  treeId: string,
  assessments: readonly AttackPathAssessment[],
  threatId: string,
  strideCategory: StrideCategory,
  relevance: ThreatRelevanceRef,
  evalNote?: string,
): AttackPathAssessment[] {
  const tuple = tupleForThreatId(treeId, threatId, strideCategory);
  if (!tuple) return assessments as AttackPathAssessment[];
  return setPathAssessment(
    assessments,
    tuple.pathKey,
    tuple.strideCategory,
    relevance,
    evalNote,
  );
}

// ==================== DELETION IMPACT (guarded delete) ====================

export interface AttackTreeDeletionImpact {
  /** Rated paths (relevance !== "unrated") — the analyst decisions at stake. */
  assessedPathCount: number;
  /** Risks in the register derived from those decisions. */
  riskCount: number;
}

/**
 * What deleting this tree concretely costs (Phase 8 step 4, Class B: never
 * ask for a delete confirmation without naming what's at stake).
 *
 * Threat-anchored trees contribute their aggregated likelihood to an
 * EXISTING risk (anchor.threatId) rather than emitting one of their own —
 * that risk survives the tree's deletion, so it is deliberately not counted
 * here.
 */
export function computeDeletionImpact(
  tree: AttackTree,
  risks: readonly RiskReference[],
): AttackTreeDeletionImpact {
  const assessments = tree.pathAssessments ?? [];
  const assessedPathCount = deriveAssessedKeys(assessments).size;

  const threatIds = new Set(
    assessments
      .filter((a) => a.relevance !== "unrated")
      .map((a) => buildThreatId(tree.id, a.pathKey, a.strideCategory)),
  );

  const riskCount = risks.filter((r) => threatIds.has(r.threatId)).length;

  return { assessedPathCount, riskCount };
}

// ==================== EXPORT ====================

export const attackTreeThreatSync = {
  reconcileAttackPathThreats,
  applyAssessmentsToThreats,
  deriveAssessedKeys,
  setPathAssessment,
  applyRelevanceDecision,
  tupleForThreatId,
  computeDeletionImpact,
};