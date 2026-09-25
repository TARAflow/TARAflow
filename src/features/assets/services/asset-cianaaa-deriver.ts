// ==================== CIANAAA DERIVATION ENGINE ====================
// Derives SecurityGoal suggestions from DFD element-to-asset relations.
//
// Source of truth:
//   taraflow-asset-beziehungen.md § 4.2 "Schutzziel-Ableitung aus Beziehungstyp"
//   CIANAAA_Handover_v3.md
//
// Design:
//   - BASE_RULES determines WHICH CIANAAA dimensions apply (assetGroup + relationType aware)
//   - CIANAAA_APPLICABLE filters dimensions conceptually invalid for an asset category
//   - CIANAAALevel is derived from Cause Mechanism × Impact ratings (MAX over relevant criteria)
//   - Suggestions are computed at runtime — NEVER stored
//   - Only analyst decisions (source: "manual") are persisted
//   - Multiple relations on one asset → UNION of all suggested dimensions
//   - source: "manual" on an existing SecurityGoal is NEVER overwritten

import type { Asset, AssetConfiguration } from "../models/asset-types";
import type {
  SecurityGoal,
  SecurityGoalType,
  CIANAAALevel,
  CauseMechanismType,
} from "../models/asset-security-goals-types";
import {
  CAUSE_MECHANISM_TO_GOAL,
  CAUSE_MECHANISM_CRITERIA,
  CIANAAA_APPLICABLE,
} from "../models/asset-security-goals-types";
import type {
  ImpactScaleType,
  ImpactRating,
} from "../models/asset-impact-types";

// ==================== TYPES ====================

/** Flags that control conditional (*) and (**) rules */
interface AssetFlags {
  isSecureStorage: boolean; // (*) C for stores / is_an(process)
  isBusinessSecret: boolean; // (*) C for is_an(process)
  isPersonalData: boolean; // (**) Acc when relation has ** marker
}

// ==================== BASE RULES (§ 4.2) ====================
// Key: assetGroup:relationType[:qualifier]
// Value: SecurityGoalType[] — base flags (conditional flags added separately)
//
// Uses fine-grained assetGroup-aware keys — NOT simplified to relationType-only.
// The CIANAAA_APPLICABLE matrix provides a second filter layer.

type DerivationKey = string;

const BASE_RULES: Record<DerivationKey, SecurityGoalType[]> = {
  // ── Data Assets ────────────────────────────────────────────────
  "data:stores": ["I", "A"], // + C* if isSecureStorage
  "data:reads": ["C", "AuthZ"],
  "data:modifies": ["I", "AuthZ", "N"],
  "data:creates": ["I", "AuthN", "N"], // + Acc** if isPersonalData
  "data:destroys": ["I", "AuthZ", "N"], // + Acc** if isPersonalData
  "data:transports": ["I", "C", "AuthN"], // + Acc** if isPersonalData

  // ── Process Assets ─────────────────────────────────────────────
  "process:is_an": ["I", "A"], // + C* if isBusinessSecret
  "process:invokes": ["AuthZ", "N"], // + Acc** if isPersonalData
  "process:terminates": ["AuthZ", "I"],
  "process:suspends": ["AuthZ", "A"],
  "process:monitors": ["I", "N"], // + Acc** if isPersonalData
  "process:executes": ["I", "AuthZ", "N"], // + Acc** if isPersonalData

  // ── System Assets ──────────────────────────────────────────────
  "system:is_an": ["I", "A"],
  "system:controls": ["I", "A", "AuthZ"],
  "system:configures": ["I", "AuthZ", "N"],
  "system:depends_on": ["A"],
  "system:uses:network": ["AuthN", "AuthZ", "I"], // + Acc** if isPersonalData
  "system:uses:local": ["AuthZ", "I"],
  "system:uses:api": ["AuthN", "AuthZ", "I"], // + Acc** if isPersonalData
  "system:uses:hardware": ["AuthZ", "I"],
  "system:uses:library": ["I", "AuthZ"],

  // ── Infrastructure Assets ──────────────────────────────────────
  "infrastructure:is_an": ["I", "A"],
  "infrastructure:accesses:local": ["AuthZ", "N"],
  "infrastructure:accesses:internal": ["AuthZ", "N"],
  "infrastructure:accesses:remote": ["AuthN", "AuthZ", "N"], // + Acc** if isPersonalData
  "infrastructure:accesses:proximity": ["AuthZ", "N"],
  "infrastructure:secures": ["A", "I"],
  "infrastructure:powers": ["A"],
  "infrastructure:damages": ["A", "I"],
  "infrastructure:monitors": ["I", "N"], // + Acc** if isPersonalData

  // ── Human Assets ───────────────────────────────────────────────
  "human:is_an": [], // Protection Target — no CIANAAA flags on asset itself
  "human:affects_safety": ["A", "I"],
  "human:affects_privacy": ["C", "AuthZ", "Acc"],
  "human:tracks": ["C", "AuthZ", "Acc"],
  "human:exposes": ["C", "AuthN"], // + Acc** if isPersonalData
  "human:identifies": ["C", "AuthZ"],
};

// Relations that carry (*) conditional Confidentiality
const CONFIDENTIALITY_STAR_RELATIONS: Set<DerivationKey> = new Set([
  "data:stores",
  "process:is_an",
]);

// Relations that carry (**) conditional Accountability
const ACCOUNTABILITY_STAR_STAR_RELATIONS: Set<DerivationKey> = new Set([
  "data:creates",
  "data:destroys",
  "data:transports",
  "process:invokes",
  "process:monitors",
  "process:executes",
  "system:uses:network",
  "system:uses:api",
  "infrastructure:accesses:remote",
  "infrastructure:monitors",
  "human:exposes",
]);

// ==================== HELPERS ====================

function buildKey(
  assetGroup: string,
  relationType: string,
  qualifier?: string,
): DerivationKey {
  const base = `${assetGroup}:${relationType}`;
  return qualifier ? `${base}:${qualifier}` : base;
}

function extractFlags(asset: Asset): AssetFlags {
  return {
    isSecureStorage:  asset.properties?.isSecureStorage  ?? false,
    isBusinessSecret: asset.properties?.isBusinessSecret ?? false,
    isPersonalData:   asset.properties?.isPersonalData   ?? false,
  };
}

// ==================== LEVEL DERIVATION ====================

/**
 * Map a numeric impact scale value to CIANAAALevel.
 * Handles 3-level, 4-level, and 5-level scales uniformly.
 * Returns "none" for null/0 values (no artificial defaults).
 */
export function numericToCIANAAALevel(
  value: number | null | "na",
  scale: ImpactScaleType,
): CIANAAALevel {
  if (!value || value === "na" || value <= 0) return "none";

  const scaleMax = scale === "3-level" ? 3 : scale === "5-level" ? 5 : 4; // default 4-level

  if (value >= scaleMax)      return "critical";
  if (value >= scaleMax - 1)  return "high";
  if (value >= scaleMax - 2)  return "medium";
  return "low";
}

/**
 * Compute the MAX of all rated impact criteria and map to CIANAAALevel.
 * Used as fallback when no mechanism-specific criteria are rated yet.
 * Returns "low" as absolute minimum — never "none" — because a graph-suggested
 * goal IS applicable even before impact assessment is complete.
 */
export function computeMaxRatingLevel(
  impactRatings: ImpactRating[],
  impactScale: ImpactScaleType,
): CIANAAALevel {
  const ratedValues = impactRatings
    .filter(
      (r): r is ImpactRating & { value: number } =>
        typeof r.value === "number" && r.value > 0,
    )
    .map((r) => r.value);
  if (ratedValues.length === 0) return "low"; // absolute minimum for pre-selection
  return numericToCIANAAALevel(Math.max(...ratedValues), impactScale);
}

/**
 * Derive CIANAAALevel for a given SecurityGoalType from the asset's impact ratings.
 *
 * Algorithm:
 *   1. Find which CauseMechanism maps to this SecurityGoalType
 *   2. Get the relevant Impact criteria IDs for that mechanism
 *   3. MAX over all rated relevant criteria present in the asset
 *   4. Map numeric MAX → CIANAAALevel via scale-aware bucketing
 *   5. Return "none" if no relevant criteria are rated (no artificial defaults)
 */
export function deriveCIANAAALevel(
  goalType: SecurityGoalType,
  impactRatings: ImpactRating[],
  impactScale: ImpactScaleType,
): CIANAAALevel {
  // Find the Cause Mechanism that maps to this goal type
  const mechanism = (
    Object.entries(CAUSE_MECHANISM_TO_GOAL) as [CauseMechanismType, SecurityGoalType][]
  ).find(([, goal]) => goal === goalType)?.[0];

  if (!mechanism) return "none";

  const criteriaIds = CAUSE_MECHANISM_CRITERIA[mechanism];

  // Collect ratings for the relevant criteria that are actually rated
  const relevantValues = impactRatings
    .filter(
      (r): r is ImpactRating & { value: number } =>
        criteriaIds.includes(r.criterionId) &&
        typeof r.value === "number" &&
        r.value > 0,
    )
    .map((r) => r.value);

  if (relevantValues.length === 0) return "none";

  const maxValue = Math.max(...relevantValues);
  return numericToCIANAAALevel(maxValue, impactScale);
}

// ==================== LEVEL EXPLANATION ====================

/**
 * Why a graph-suggested goal carries the level it does.
 *
 * ONE source of truth for the level of a suggested goal: the deriver stores
 * `.level`, the dialog and the documentation render the rest. Keeping the
 * decision and its explanation in one function is what stops them drifting.
 *
 *   mechanism      — a criterion relevant to the goal's cause mechanism is rated;
 *                    level = MAX over those (criterionId/value = the driver)
 *   not-applicable — every relevant criterion present on the asset is "na":
 *                    the analyst said "no damage via this mechanism" → floor
 *   fallback       — no relevant criterion is decided yet, but others are
 *                    rated → MAX over all rated criteria (conservative while
 *                    the assessment is incomplete)
 *   floor          — nothing rated at all → floor
 *
 * The floor is "low", never "none": the goal is suggested by the graph, and
 * "none" would silently drop its STRIDE category in the threat generator.
 */
export type LevelExplanation =
  | { kind: "mechanism"; level: CIANAAALevel; criterionId: string; value: number }
  | { kind: "not-applicable"; level: CIANAAALevel; criterionIds: string[] }
  | { kind: "fallback"; level: CIANAAALevel; criterionId: string; value: number }
  | { kind: "floor"; level: CIANAAALevel };

const FLOOR_LEVEL: CIANAAALevel = "low";

function mechanismCriteria(goalType: SecurityGoalType): string[] {
  const mechanism = (
    Object.entries(CAUSE_MECHANISM_TO_GOAL) as [CauseMechanismType, SecurityGoalType][]
  ).find(([, goal]) => goal === goalType)?.[0];
  return mechanism ? CAUSE_MECHANISM_CRITERIA[mechanism] : [];
}

function maxRated(
  ratings: ImpactRating[],
): (ImpactRating & { value: number }) | null {
  return ratings
    .filter(
      (r): r is ImpactRating & { value: number } =>
        typeof r.value === "number" && r.value > 0,
    )
    .reduce<(ImpactRating & { value: number }) | null>(
      (max, r) => (!max || r.value > max.value ? r : max),
      null,
    );
}

/**
 * Explain the level of a graph-suggested goal. Pure — call at render time.
 * Only meaningful for goals the graph suggests; non-suggested goals are
 * "none" regardless (see deriveSecurityGoalSuggestions).
 */
export function explainLevel(
  goalType: SecurityGoalType,
  impactRatings: ImpactRating[],
  impactScale: ImpactScaleType,
): LevelExplanation {
  const criteriaIds = mechanismCriteria(goalType);
  const relevant = impactRatings.filter((r) =>
    criteriaIds.includes(r.criterionId),
  );

  const driver = maxRated(relevant);
  if (driver) {
    return {
      kind: "mechanism",
      level: numericToCIANAAALevel(driver.value, impactScale),
      criterionId: driver.criterionId,
      value: driver.value,
    };
  }

  // Explicit "no damage via this mechanism": every relevant criterion present
  // is "na". Must NOT fall through to the MAX-of-all fallback — that would let
  // e.g. safety=4 turn a confidentiality goal "critical" although the analyst
  // just declared confidentiality damage not applicable.
  if (relevant.length > 0 && relevant.every((r) => r.value === "na")) {
    return {
      kind: "not-applicable",
      level: FLOOR_LEVEL,
      criterionIds: relevant.map((r) => r.criterionId),
    };
  }

  const anyDriver = maxRated(impactRatings);
  if (anyDriver) {
    return {
      kind: "fallback",
      level: numericToCIANAAALevel(anyDriver.value, impactScale),
      criterionId: anyDriver.criterionId,
      value: anyDriver.value,
    };
  }

  return { kind: "floor", level: FLOOR_LEVEL };
}

// ==================== DERIVATION ENGINE ====================

/**
 * Derive SecurityGoal suggestions for an asset based on its linkedDFDElements.
 *
 * Returns a complete SecurityGoal[] where:
 *   - Suggested goals have source: "suggested" and level derived from impact
 *   - Non-suggested goals have level: "none" and source: undefined
 *   - Existing source: "manual" entries are NEVER overwritten
 *
 * Bug fix: uses asset.assetGroup (canonical) instead of asset.properties?.category (legacy).
 *
 * @param asset         - the asset to compute suggestions for
 * @param existing      - current SecurityGoal[] stored on the asset (may have manual overrides)
 * @param impactScale   - project scale config needed for level derivation
 */
export function deriveSecurityGoalSuggestions(
  asset: Asset,
  existing: SecurityGoal[],
  impactScale: ImpactScaleType = "4-level",
): SecurityGoal[] {
  const flags = extractFlags(asset);

  // Use canonical assetGroup field — NOT the legacy properties.category
  // Bug fix: was (asset.properties?.category ?? "data")
  const assetGroup = asset.assetGroup as string;

  const applicability = CIANAAA_APPLICABLE[assetGroup];
  const suggested = new Set<SecurityGoalType>();

  for (const link of asset.linkedDFDElements) {
    const relationType = link.relationType ?? "";
    const qualifier = link.qualifier;

    const key = buildKey(assetGroup, relationType, qualifier);
    const baseGoals = BASE_RULES[key] ?? [];

    for (const goal of baseGoals) {
      // Filter by CIANAAA_APPLICABLE matrix
      if (applicability?.[goal] !== false) {
        suggested.add(goal);
      }
    }

    // (*) Conditional Confidentiality
    if (
      CONFIDENTIALITY_STAR_RELATIONS.has(key) &&
      applicability?.["C"] !== false
    ) {
      const isProcess = assetGroup === "process";
      if (
        (assetGroup === "data" && flags.isSecureStorage) ||
        (isProcess && flags.isBusinessSecret)
      ) {
        suggested.add("C");
      }
    }

    // (**) Conditional Accountability
    if (
      ACCOUNTABILITY_STAR_STAR_RELATIONS.has(key) &&
      flags.isPersonalData &&
      applicability?.["Acc"] !== false
    ) {
      suggested.add("Acc");
    }
  }

  // Merge suggestions with existing — never overwrite source: "manual"
  return existing.map((sg): SecurityGoal => {
    // Analyst decision is authoritative — preserve as-is
    if (sg.source === "manual") return sg;

    const isSuggested = suggested.has(sg.type);

    if (!isSuggested) {
      return {
        ...sg,
        level: "none",
        source: undefined,
        rationale: undefined,
      };
    }

    // Level + its reason come from ONE function (see explainLevel) so the
    // stored level and the displayed/documented explanation cannot diverge.
    const { level } = explainLevel(sg.type, asset.impactRatings, impactScale);

    return {
      ...sg,
      level,
      source: "suggested",
      rationale: sg.rationale,
    };
  });
}

// ==================== READ-ONLY HELPERS ====================

/**
 * Returns only the SecurityGoalTypes that the engine would suggest for an asset.
 * Useful for rendering previews without mutating state.
 */
export function computeSuggestedGoalTypes(asset: Asset): Set<SecurityGoalType> {
  const flags = extractFlags(asset);
  const assetGroup = asset.assetGroup as string; // canonical field
  const applicability = CIANAAA_APPLICABLE[assetGroup];
  const suggested = new Set<SecurityGoalType>();

  for (const link of asset.linkedDFDElements) {
    const key = buildKey(assetGroup, link.relationType ?? "", link.qualifier);
    const baseGoals = BASE_RULES[key] ?? [];

    for (const goal of baseGoals) {
      if (applicability?.[goal] !== false) suggested.add(goal);
    }

    if (
      CONFIDENTIALITY_STAR_RELATIONS.has(key) &&
      applicability?.["C"] !== false
    ) {
      if (
        (assetGroup === "data" && flags.isSecureStorage) ||
        (assetGroup === "process" && flags.isBusinessSecret)
      ) {
        suggested.add("C");
      }
    }

    if (
      ACCOUNTABILITY_STAR_STAR_RELATIONS.has(key) &&
      flags.isPersonalData &&
      applicability?.["Acc"] !== false
    ) {
      suggested.add("Acc");
    }
  }

  return suggested;
}

/**
 * Returns the derived CIANAAALevel that the engine would assign for a given
 * SecurityGoalType, given the current impact ratings.
 * Pure function — call at render time for Threat Preview, never store result.
 */
export function computeSuggestedLevel(
  asset: Asset,
  goalType: SecurityGoalType,
  impactScale: ImpactScaleType = "4-level",
): CIANAAALevel {
  const suggested = computeSuggestedGoalTypes(asset);
  if (!suggested.has(goalType)) return "none";
  // Same rule as the stored level — previously this skipped the fallback and
  // could preview "none" for a goal the deriver stores as "low" or higher.
  return explainLevel(goalType, asset.impactRatings, impactScale).level;
}

/**
 * Returns a human-readable explanation of why a SecurityGoalType was suggested
 * and what drives its level.
 * Used for tooltip/rationale display in the Asset Tab UI.
 */
export function explainSuggestion(
  asset: Asset,
  goalType: SecurityGoalType,
  impactScale: ImpactScaleType = "4-level",
): { reasons: string[]; levelDriver: string | null } {
  const flags = extractFlags(asset);
  const assetGroup = asset.assetGroup as string; // canonical field
  const reasons: string[] = [];

  for (const link of asset.linkedDFDElements) {
    const key = buildKey(assetGroup, link.relationType ?? "", link.qualifier);
    const baseGoals = BASE_RULES[key] ?? [];

    if (baseGoals.includes(goalType)) {
      reasons.push(
        `${link.elementName} → ${link.relationType}${link.qualifier ? ` [${link.qualifier}]` : ""}`,
      );
    }

    if (goalType === "C" && CONFIDENTIALITY_STAR_RELATIONS.has(key)) {
      if (
        (assetGroup === "data" && flags.isSecureStorage) ||
        (assetGroup === "process" && flags.isBusinessSecret)
      ) {
        reasons.push(
          `${link.elementName} → ${link.relationType} (*: ${assetGroup === "data" ? "secureStorage" : "businessSecret"})`,
        );
      }
    }

    if (
      goalType === "Acc" &&
      ACCOUNTABILITY_STAR_STAR_RELATIONS.has(key) &&
      flags.isPersonalData
    ) {
      reasons.push(
        `${link.elementName} → ${link.relationType} (**: personalData)`,
      );
    }
  }

  const explanation = explainLevel(goalType, asset.impactRatings, impactScale);
  let levelDriver: string | null;
  switch (explanation.kind) {
    case "mechanism":
      levelDriver = `${explanation.criterionId} = ${explanation.value} → ${explanation.level}`;
      break;
    case "not-applicable":
      levelDriver = `${explanation.criterionIds.join(", ")} = n/a → ${explanation.level} (floor — no damage via this mechanism)`;
      break;
    case "fallback":
      levelDriver = `max(${explanation.criterionId} = ${explanation.value}) → ${explanation.level} (fallback — no specific criteria rated)`;
      break;
    case "floor":
      levelDriver = null;
      break;
  }

  return { reasons, levelDriver };
}