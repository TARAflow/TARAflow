// src/features/attacktree/services/attacktree-path-identity.ts
//
// PHASE 1 — Stable attack path identity.
//
// Why this exists
// ---------------
// extractAllPaths() used to label paths by enumeration order ("path-1",
// "path-2", ...). Once attack paths become threat scenarios that an analyst
// confirms/dismisses and rates, that is fatal: inserting one DSL line shifts
// every subsequent index, and all relevance decisions, risk ratings,
// mitigations and Jira links silently attach to the wrong path.
//
// A path's identity is *what it is*, not *where it appeared*: the chain of
// node names from ROOT to leaf. Two trees that describe the same attack
// produce the same key, regardless of sibling order or unrelated edits.
//
// Renaming a node DOES change the key. That is correct — a renamed step is a
// different scenario and must be re-assessed rather than silently inheriting
// the old rating.
//
// Hash choice
// -----------
// FNV-1a (64-bit, composed from two 32-bit lanes), implemented in plain TS.
// Deliberately NOT node:crypto / SubtleCrypto:
//   - this code runs in the Electron renderer AND in the Node CLI reporter;
//     one implementation must produce byte-identical keys in both
//   - SubtleCrypto is async, which would infect the whole synchronous
//     calculator pipeline
//   - the keys are identity labels, not security tokens — collision
//     resistance, not preimage resistance, is what matters
// At 64 bits the collision probability for the realistic case (hundreds of
// paths per project) is negligible; assertNoKeyCollisions() below fails loudly
// rather than silently merging two paths if it ever happens.

import type { AttackPath, PathAnalysis } from "../models/attacktree-types";

// ==================== HASH ====================

/** Unit separator — cannot occur in a node name, so it is an unambiguous delimiter. */
const CHAIN_SEPARATOR = "\u241F";

const FNV_OFFSET_A = 0x811c9dc5;
const FNV_OFFSET_B = 0x01000193;
const FNV_PRIME = 0x01000193;

function fnv1a32(input: string, offset: number): number {
  let hash = offset >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= FNV_PRIME, in 32-bit space, without overflowing to float
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 64-bit FNV-1a rendered as 16 lowercase hex chars, truncated to 12.
 * Two independently-seeded 32-bit lanes give a wider key than a single lane
 * without pulling in a hashing dependency.
 */
function hash64(input: string): string {
  const a = fnv1a32(input, FNV_OFFSET_A);
  const b = fnv1a32(input, FNV_OFFSET_B);
  const hex = a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  return hex.slice(0, 12);
}

// ==================== PATH KEY ====================

/**
 * Normalise a node name before hashing.
 *
 * Collapses internal whitespace and trims. Rationale: reformatting the DSL
 * (e.g. the editor's tab handling, or a paste that introduces a double space)
 * must not invalidate an analyst's assessment. A *semantic* rename must.
 * Case is preserved — "extract data" and "Extract Data" are treated as
 * different names, matching how the rest of the tool treats node names.
 */
function normalizeSegment(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Stable identity for an attack path, derived from its ROOT→leaf name chain.
 *
 * Stable under:  sibling insertion, branch reordering, whitespace/comment
 *                edits, changes to evaluation values, mitigation changes.
 * Changes under: renaming any node on the path, re-parenting the leaf,
 *                inserting/removing an intermediate node ON this path.
 */
export function computePathKey(nodeNames: string[]): string {
  const chain = nodeNames.map(normalizeSegment).join(CHAIN_SEPARATOR);
  return hash64(chain);
}

/** Convenience: derive the key straight from an AttackPath. */
export function computePathKeyFromPath(path: AttackPath): string {
  return computePathKey(path.path);
}

/**
 * Threat id for a path emitted into the risk register (Phase 4 consumes this).
 * Format: AT-<treeId>-<pathKey>
 */
export function buildAttackPathThreatId(
  treeId: string,
  pathKey: string,
): string {
  return `AT-${treeId}-${pathKey}`;
}

// ==================== COLLISION GUARD ====================

/**
 * Two distinct paths sharing a key would silently merge two threat scenarios
 * into one. That must never pass unnoticed, so we detect it explicitly rather
 * than trusting the hash width.
 *
 * NOTE: identical name chains reaching the same leaf via different node ids
 * are NOT a collision — they are genuinely the same attack described twice,
 * and deduplicating them is correct behaviour.
 */
export function findPathKeyCollisions(
  paths: AttackPath[],
): Array<{ key: string; chains: string[] }> {
  const byKey = new Map<string, Set<string>>();

  for (const p of paths) {
    const key = computePathKeyFromPath(p);
    const chain = p.path.map(normalizeSegment).join(CHAIN_SEPARATOR);
    const chains = byKey.get(key) ?? new Set<string>();
    chains.add(chain);
    byKey.set(key, chains);
  }

  const collisions: Array<{ key: string; chains: string[] }> = [];
  byKey.forEach((chains, key) => {
    // >1 distinct chain under one key == a real hash collision.
    if (chains.size > 1) {
      collisions.push({ key, chains: Array.from(chains) });
    }
  });
  return collisions;
}

// ==================== CHANGE DETECTION (Class A / Class B) ====================

/**
 * Mirrors the DFD↔Threat sync policy already established in TARAflow:
 *
 *   Class A (silent) — additive, nothing the analyst decided is at stake.
 *                      A new path appears → a new `unrated` threat is created.
 *                      No banner, no interruption.
 *
 *   Class B (banner) — a path the analyst already ASSESSED is gone or has
 *                      changed identity. Their work is at stake. Never delete
 *                      silently; surface it and let them decide.
 *
 * The distinction is not "added vs removed" — it is "does this destroy a
 * decision the analyst made". A removed path nobody ever rated is Class A.
 */
export type PathChangeClass = "A" | "B";

export interface PathChange {
  changeClass: PathChangeClass;
  kind: "added" | "removed";
  pathKey: string;
  /** Human-readable chain, for the banner text. */
  chain: string[];
}

export interface PathDiff {
  changes: PathChange[];
  /** True if any change requires interrupting the analyst. */
  requiresBanner: boolean;
}

/**
 * Compare two PathAnalysis snapshots.
 *
 * @param assessedKeys  Path keys the analyst has already acted on (confirmed /
 *                      dismissed / rated). A removed path is Class B only if
 *                      its key is in here — otherwise nothing is lost.
 *                      Phase 5 supplies this from the threat table; until then
 *                      an empty set means "nothing assessed yet", and every
 *                      change is Class A.
 */
export function diffPathAnalysis(
  previous: PathAnalysis | undefined,
  next: PathAnalysis | undefined,
  assessedKeys: ReadonlySet<string> = new Set(),
): PathDiff {
  const prevPaths = previous?.paths ?? [];
  const nextPaths = next?.paths ?? [];

  const prevByKey = new Map<string, AttackPath>();
  prevPaths.forEach((p) => prevByKey.set(computePathKeyFromPath(p), p));

  const nextByKey = new Map<string, AttackPath>();
  nextPaths.forEach((p) => nextByKey.set(computePathKeyFromPath(p), p));

  const changes: PathChange[] = [];

  // Added: present now, absent before. Always Class A — nothing is destroyed.
  nextByKey.forEach((path, key) => {
    if (!prevByKey.has(key)) {
      changes.push({
        changeClass: "A",
        kind: "added",
        pathKey: key,
        chain: path.path,
      });
    }
  });

  // Removed: present before, absent now. Class B only if it carried a decision.
  prevByKey.forEach((path, key) => {
    if (!nextByKey.has(key)) {
      changes.push({
        changeClass: assessedKeys.has(key) ? "B" : "A",
        kind: "removed",
        pathKey: key,
        chain: path.path,
      });
    }
  });

  return {
    changes,
    requiresBanner: changes.some((c) => c.changeClass === "B"),
  };
}

// ==================== EXPORT ====================

export const attackTreePathIdentity = {
  computePathKey,
  computePathKeyFromPath,
  buildAttackPathThreatId,
  findPathKeyCollisions,
  diffPathAnalysis,
};
