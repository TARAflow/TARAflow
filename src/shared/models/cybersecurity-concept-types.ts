// shared/models/cybersecurity-concept-types.ts
//
// Cybersecurity goals, claims and verification records (ISO/SAE 21434 9.4:
// RQ-09-05/06/07 → WP-09-03/04/05; conformance plan Phase 4 minimal, decision
// 25) — stored as ONE object `project.cybersecurityConcept`, not inside
// `project.risks` (the attack-tree risk sync rebuilds that), so Phase 5
// (concept → requirements) can extend it.
//
// Links per risk, shared texts (decision 25): treatment is stored per risk
// (attack path); a goal or claim keeps the risks it covers. Every risk treated
// reduce needs ≥ 1 goal, retain / share ≥ 1 claim; report and overview group
// by threat scenario, derived from the linked risks.
//
// In shared: the Risk tab edits goals and claims, the Audit tab records the
// verification, the report renders all three.

import type { SecurityGoalType } from "./cianaaa-reference-types";

/** Asset × cybersecurity property a goal protects (the damage scenario). */
export interface AssetPropertyRef {
  assetId: string;
  property: SecurityGoalType;
}

/** CAL (ISO/SAE 21434 Annex E, informative) — optional. */
export type Cal = 1 | 2 | 3 | 4;

export interface CybersecurityGoal {
  id: string;
  /** "CSG-01" */
  displayId: string;
  /** Concept-level requirement to protect the asset property. */
  statement: string;
  /** Risks treated "reduce" this goal covers. */
  riskIds: string[];
  assetProperties: AssetPropertyRef[];
  cal?: Cal;
  calRationale?: string;
}

export type ClaimKind = "retain" | "share";

export interface CybersecurityClaim {
  id: string;
  /** "CLM-01" */
  displayId: string;
  statement: string;
  kind: ClaimKind;
  /** Risks treated "retain" / "share" this claim covers. */
  riskIds: string[];
  /** Assumptions of the Item Definition it relies on (retain: ≥ 1). */
  assumptionIds: string[];
  /** Share: who carries the risk. */
  responsibleParty?: string;
  /** ISO date by which the claim is to be reviewed (Clause 8 monitoring). */
  reviewBy?: string;
}

export type VerificationResult = "passed" | "passed-with-conditions" | "failed";

/** The four points of RQ-09-07. */
export type VerificationScope = "tara" | "treatment" | "goals-claims" | "consistency";

/** Version of verificationStateHash (app/services/verification-state.ts) — raise when what it covers changes. */
export const VERIFICATION_HASH_VERSION = 1;

export interface VerificationEntry {
  id: string;
  /** ISO date */
  date: string;
  reviewer: string;
  scope: VerificationScope[];
  result: VerificationResult;
  findings?: string;
  /** Hash of the analysis content the review covered. */
  stateHash: string;
  /**
   * Version of the hash function that computed `stateHash` (absent = 1). A
   * different version cannot be compared: the entry asks to be confirmed again.
   */
  hashVersion?: number;
  /** Project version at the review. */
  projectVersion?: string;
  /** The audit commit that fixed this entry, once committed. */
  commit?: string;
}

export interface CybersecurityConcept {
  goals: CybersecurityGoal[];
  claims: CybersecurityClaim[];
  verifications: VerificationEntry[];
  /** Highest CSG number ever issued — numbers are never reused (like M-C-nnn). */
  goalSeq?: number;
  /** Highest CLM number ever issued. */
  claimSeq?: number;
}

export function emptyCybersecurityConcept(): CybersecurityConcept {
  return { goals: [], claims: [], verifications: [] };
}

// ==================== IDS ====================

/** The number of a display id ("CSG-07" → 7), 0 when it has another form. */
export function displayNumber(prefix: string, displayId: string): number {
  const n = new RegExp(`^${prefix}-(\\d+)$`).exec(displayId)?.[1];
  return n ? Number(n) : 0;
}

/**
 * "CSG-01", "CLM-07" … — one past the highest number ever issued (`issued`,
 * the concept's counter) or in use; a deleted number is never issued again,
 * so report and tickets keep pointing at one goal (review 2026-10-30).
 */
export function nextConceptDisplayId(
  prefix: "CSG" | "CLM",
  items: readonly { displayId: string }[],
  issued = 0,
): string {
  const max = Math.max(issued, ...items.map((x) => displayNumber(prefix, x.displayId)));
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

let conceptSeq = 0;
const newId = (prefix: string) => {
  conceptSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${conceptSeq.toString(36)}`;
};

// ==================== GOALS: PURE OPERATIONS ====================

/** A new goal, linked to one risk (not yet stored). */
export function newGoal(
  concept: CybersecurityConcept,
  riskId: string,
  statement: string,
  assetProperties: AssetPropertyRef[] = [],
): CybersecurityGoal {
  return {
    id: newId("csg"),
    displayId: nextConceptDisplayId("CSG", concept.goals, concept.goalSeq),
    statement: statement.trim(),
    riskIds: [riskId],
    assetProperties,
  };
}

/** Store a new goal; the counter remembers its number. */
export function addGoal(concept: CybersecurityConcept, goal: CybersecurityGoal): CybersecurityConcept {
  const goalSeq = Math.max(concept.goalSeq ?? 0, displayNumber("CSG", goal.displayId));
  return { ...concept, goals: [...concept.goals, goal], goalSeq };
}

export function updateGoal(
  concept: CybersecurityConcept,
  id: string,
  change: Partial<Omit<CybersecurityGoal, "id" | "displayId">>,
): CybersecurityConcept {
  return { ...concept, goals: concept.goals.map((g) => (g.id === id ? { ...g, ...change } : g)) };
}

/** Link a goal to a risk (no-op when linked already). */
export function linkGoal(concept: CybersecurityConcept, goalId: string, riskId: string): CybersecurityConcept {
  return {
    ...concept,
    goals: concept.goals.map((g) =>
      g.id === goalId && !g.riskIds.includes(riskId) ? { ...g, riskIds: [...g.riskIds, riskId] } : g,
    ),
  };
}

/** Unlink a goal from a risk; the goal itself stays (an unused goal is a finding). */
export function unlinkGoal(concept: CybersecurityConcept, goalId: string, riskId: string): CybersecurityConcept {
  return {
    ...concept,
    goals: concept.goals.map((g) => (g.id === goalId ? { ...g, riskIds: g.riskIds.filter((r) => r !== riskId) } : g)),
  };
}

export function goalsOfRisk(concept: CybersecurityConcept | undefined, riskId: string): CybersecurityGoal[] {
  return (concept?.goals ?? []).filter((g) => g.riskIds.includes(riskId));
}

// ==================== CLAIMS: PURE OPERATIONS ====================

/** A new claim, linked to one risk (not yet stored). */
export function newClaim(
  concept: CybersecurityConcept,
  riskId: string,
  kind: ClaimKind,
  statement: string,
): CybersecurityClaim {
  return {
    id: newId("clm"),
    displayId: nextConceptDisplayId("CLM", concept.claims, concept.claimSeq),
    statement: statement.trim(),
    kind,
    riskIds: [riskId],
    assumptionIds: [],
  };
}

/** Store a new claim; the counter remembers its number. */
export function addClaim(concept: CybersecurityConcept, claim: CybersecurityClaim): CybersecurityConcept {
  const claimSeq = Math.max(concept.claimSeq ?? 0, displayNumber("CLM", claim.displayId));
  return { ...concept, claims: [...concept.claims, claim], claimSeq };
}

export function updateClaim(
  concept: CybersecurityConcept,
  id: string,
  change: Partial<Omit<CybersecurityClaim, "id" | "displayId">>,
): CybersecurityConcept {
  return { ...concept, claims: concept.claims.map((c) => (c.id === id ? { ...c, ...change } : c)) };
}

export function linkClaim(concept: CybersecurityConcept, claimId: string, riskId: string): CybersecurityConcept {
  return {
    ...concept,
    claims: concept.claims.map((c) =>
      c.id === claimId && !c.riskIds.includes(riskId) ? { ...c, riskIds: [...c.riskIds, riskId] } : c,
    ),
  };
}

export function unlinkClaim(concept: CybersecurityConcept, claimId: string, riskId: string): CybersecurityConcept {
  return {
    ...concept,
    claims: concept.claims.map((c) => (c.id === claimId ? { ...c, riskIds: c.riskIds.filter((r) => r !== riskId) } : c)),
  };
}

export function claimsOfRisk(concept: CybersecurityConcept | undefined, riskId: string): CybersecurityClaim[] {
  return (concept?.claims ?? []).filter((c) => c.riskIds.includes(riskId));
}

// ==================== MERGE / REMOVE (overall view) ====================

const union = <T,>(a: readonly T[], b: readonly T[], key: (x: T) => string) => {
  const seen = new Set(a.map(key));
  return [...a, ...b.filter((x) => !seen.has(key(x)))];
};

/** Merge goal `fromId` into `intoId`: its risks and asset properties move over, it goes. */
export function mergeGoals(concept: CybersecurityConcept, fromId: string, intoId: string): CybersecurityConcept {
  const from = concept.goals.find((g) => g.id === fromId);
  if (!from || fromId === intoId || !concept.goals.some((g) => g.id === intoId)) return concept;
  return {
    ...concept,
    goals: concept.goals
      .filter((g) => g.id !== fromId)
      .map((g) =>
        g.id === intoId
          ? {
              ...g,
              riskIds: union(g.riskIds, from.riskIds, (x) => x),
              assetProperties: union(g.assetProperties, from.assetProperties, (x) => `${x.assetId}:${x.property}`),
            }
          : g,
      ),
  };
}

/** Merge claim `fromId` into `intoId` (same kind only): risks and assumptions move over. */
export function mergeClaims(concept: CybersecurityConcept, fromId: string, intoId: string): CybersecurityConcept {
  const from = concept.claims.find((c) => c.id === fromId);
  const into = concept.claims.find((c) => c.id === intoId);
  if (!from || !into || fromId === intoId || from.kind !== into.kind) return concept;
  return {
    ...concept,
    claims: concept.claims
      .filter((c) => c.id !== fromId)
      .map((c) =>
        c.id === intoId
          ? {
              ...c,
              riskIds: union(c.riskIds, from.riskIds, (x) => x),
              assumptionIds: union(c.assumptionIds, from.assumptionIds, (x) => x),
            }
          : c,
      ),
  };
}

export function removeGoal(concept: CybersecurityConcept, id: string): CybersecurityConcept {
  return { ...concept, goals: concept.goals.filter((g) => g.id !== id) };
}

export function removeClaim(concept: CybersecurityConcept, id: string): CybersecurityConcept {
  return { ...concept, claims: concept.claims.filter((c) => c.id !== id) };
}
