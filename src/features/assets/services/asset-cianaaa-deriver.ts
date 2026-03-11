// ==================== CIANAAA DERIVATION ENGINE ====================
// Derives SecurityGoal suggestions from DFD element-to-asset relations.
//
// Source of truth: taraflow-cnc-referenzfall.md § 4.2
// "Schutzziel-Ableitung aus Beziehungstyp"
//
// Rules:
//   - Suggestions are computed at runtime from linkedDFDElements + asset properties
//   - They are NEVER stored — only analyst decisions (source:"manual") are persisted
//   - Multiple relations on one asset → UNION of all flags
//   - source:"manual" on an existing SecurityGoal is NEVER overwritten

import type { Asset } from "../models/asset-types";
import type { SecurityGoal, SecurityGoalType } from "../models/asset-security-goals-types";

// ==================== TYPES ====================

/** Flags that control conditional (*) and (**) rules */
interface AssetFlags {
  isSecureStorage: boolean;   // (*) C for stores/is_an(process)
  isBusinessSecret: boolean;  // (*) C for is_an(process)
  isPersonalData: boolean;    // (**) Ac when relation has ** marker
}

// ==================== DERIVATION TABLE (§ 4.2) ====================
// Key: relationGroup:relationType[:qualifier]
// Value: SecurityGoalType[] — base flags (conditional flags added separately)

type DerivationKey = string;

const BASE_RULES: Record<DerivationKey, SecurityGoalType[]> = {
  // ── Data Assets ────────────────────────────────────────────────
  "data:stores":      ["I", "A"],            // + C* if isSecureStorage
  "data:reads":       ["C", "AuthZ"],
  "data:modifies":    ["I", "AuthZ", "N"],
  "data:creates":     ["I", "AuthN", "N"],   // + Acc** if isPersonalData
  "data:destroys":    ["I", "AuthZ", "N"],   // + Acc** if isPersonalData
  "data:transports":  ["I", "C", "AuthN"],   // + Acc** if isPersonalData

  // ── Process Assets ─────────────────────────────────────────────
  "process:is_an":    ["I", "A"],            // + C* if isBusinessSecret
  "process:invokes":  ["AuthZ", "N"],        // + Acc** if isPersonalData
  "process:terminates": ["AuthZ", "I"],
  "process:suspends": ["AuthZ", "A"],
  "process:monitors": ["I", "N"],            // + Acc** if isPersonalData
  "process:executes": ["I", "AuthZ", "N"],   // + Acc** if isPersonalData

  // ── System Assets ──────────────────────────────────────────────
  "system:is_an":         ["I", "A"],
  "system:controls":      ["I", "A", "AuthZ"],
  "system:configures":    ["I", "AuthZ", "N"],
  "system:depends_on":    ["A"],
  "system:uses:network":  ["AuthN", "AuthZ", "I"],  // + Acc** if isPersonalData
  "system:uses:local":    ["AuthZ", "I"],
  "system:uses:api":      ["AuthN", "AuthZ", "I"],  // + Acc** if isPersonalData
  "system:uses:hardware": ["AuthZ", "I"],
  "system:uses:library":  ["I", "AuthZ"],

  // ── Infrastructure Assets ──────────────────────────────────────
  "infrastructure:is_an":              ["I", "A"],
  "infrastructure:accesses:local":     ["AuthZ", "N"],
  "infrastructure:accesses:internal":  ["AuthZ", "N"],
  "infrastructure:accesses:remote":    ["AuthN", "AuthZ", "N"],  // + Acc** if isPersonalData
  "infrastructure:accesses:proximity": ["AuthZ", "N"],
  "infrastructure:secures":  ["A", "I"],
  "infrastructure:powers":   ["A"],
  "infrastructure:damages":  ["A", "I"],
  "infrastructure:monitors": ["I", "N"],   // + Acc** if isPersonalData

  // ── Human Assets ───────────────────────────────────────────────
  "human:is_an":          [],              // Protection Target — no CIANAAA flags on asset itself
  "human:affects_safety": ["A", "I"],
  "human:affects_privacy":["C", "AuthZ", "Acc"],
  "human:tracks":         ["C", "AuthZ", "Acc"],
  "human:exposes":        ["C", "AuthN"], // + Acc** if isPersonalData
  "human:identifies":     ["C", "AuthZ"],
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

// ==================== HELPER ====================

function buildKey(
  assetGroup: string,
  relationType: string,
  qualifier?: string,
): DerivationKey {
  const base = `${assetGroup}:${relationType}`;
  if (qualifier) return `${base}:${qualifier}`;
  return base;
}

function extractFlags(asset: Asset): AssetFlags {
  return {
    isSecureStorage:  asset.properties?.isSecureStorage  ?? false,
    isBusinessSecret: asset.properties?.isBusinessSecret ?? false,
    isPersonalData:   asset.properties?.isPersonalData   ?? false,
  };
}

// ==================== DERIVATION ENGINE ====================

/**
 * Derive SecurityGoal suggestions for an asset based on its linkedDFDElements.
 *
 * Returns a complete SecurityGoal[] where:
 * - enabled goals have source:"suggested"
 * - disabled goals have source:undefined (not derived)
 * - existing source:"manual" entries are NEVER overwritten
 *
 * @param asset    - the asset to compute suggestions for
 * @param existing - current SecurityGoal[] stored on the asset (may have manual overrides)
 */
export function deriveSecurityGoalSuggestions(
  asset: Asset,
  existing: SecurityGoal[],
): SecurityGoal[] {
  const flags = extractFlags(asset);
  const suggested = new Set<SecurityGoalType>();

  for (const link of asset.linkedDFDElements) {
    const assetGroup = (asset.properties?.category ?? "data") as string;
    const relationType = link.relationType ?? "";
    const qualifier = link.qualifier;

    const key = buildKey(assetGroup, relationType, qualifier);
    const baseGoals = BASE_RULES[key] ?? [];

    for (const goal of baseGoals) {
      suggested.add(goal);
    }

    // (*) Conditional Confidentiality
    if (CONFIDENTIALITY_STAR_RELATIONS.has(key)) {
      const isProcess = assetGroup === "process";
      if (
        (assetGroup === "data" && flags.isSecureStorage) ||
        (isProcess && flags.isBusinessSecret)
      ) {
        suggested.add("C");
      }
    }

    // (**) Conditional Accountability
    if (ACCOUNTABILITY_STAR_STAR_RELATIONS.has(key) && flags.isPersonalData) {
      suggested.add("Acc");
    }
  }

  // Merge suggestions with existing — never overwrite source:"manual"
  return existing.map((sg): SecurityGoal => {
    if (sg.source === "manual") {
      // Analyst decision is authoritative — preserve as-is
      return sg;
    }

    const isSuggested = suggested.has(sg.type);
    return {
      ...sg,
      enabled: isSuggested,
      source: isSuggested ? "suggested" : undefined,
      // Clear rationale when suggestion is withdrawn
      rationale: isSuggested ? sg.rationale : undefined,
    };
  });
}

/**
 * Returns only the SecurityGoalTypes that the engine would suggest for an asset.
 * Useful for rendering a "what the graph suggests" preview without mutating state.
 */
export function computeSuggestedGoalTypes(asset: Asset): Set<SecurityGoalType> {
  const flags = extractFlags(asset);
  const suggested = new Set<SecurityGoalType>();

  for (const link of asset.linkedDFDElements) {
    const assetGroup = (asset.properties?.category ?? "data") as string;
    const key = buildKey(assetGroup, link.relationType ?? "", link.qualifier);
    const baseGoals = BASE_RULES[key] ?? [];

    for (const goal of baseGoals) suggested.add(goal);

    if (CONFIDENTIALITY_STAR_RELATIONS.has(key)) {
      if (
        (assetGroup === "data" && flags.isSecureStorage) ||
        (assetGroup === "process" && flags.isBusinessSecret)
      ) {
        suggested.add("C");
      }
    }

    if (ACCOUNTABILITY_STAR_STAR_RELATIONS.has(key) && flags.isPersonalData) {
      suggested.add("Acc");
    }
  }

  return suggested;
}

/**
 * Returns a human-readable explanation of why a SecurityGoalType was suggested.
 * Used for tooltip/rationale display in the Asset Tab UI.
 */
export function explainSuggestion(
  asset: Asset,
  goalType: SecurityGoalType,
): string[] {
  const flags = extractFlags(asset);
  const reasons: string[] = [];

  for (const link of asset.linkedDFDElements) {
    const assetGroup = (asset.properties?.category ?? "data") as string;
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

  return reasons;
}