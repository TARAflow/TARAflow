// shared/models/hazard-types.ts
//
// Core type definitions for the hazard model (Phase 1 — types only, no logic, no UI).
// See IMPLEMENTATION-hazard-item.md (Phase 1) and IMPLEMENTATION-hazard-tab-ui.md.
//
// A HazardItem is NOT an asset. It is the explicit hazard and the convergence point
// between contributing assets (contributes_to) and endangered protection targets
// (endangers). Per hazard the cardinality is N:1:M; globally it is m:n:m, with the
// hazard item as the pivot that collapses N*M direct links into N+M.
//
// Lives in shared/models because DFD (graph embedding, Phase 4) and threat generation
// (Phase 3) consume these types — a feature-owned location would force feature<->feature
// imports.

import type { HazardImpact } from "./hazard-impact";
import type {
  SafetyRelevance, // reused: "none" | "indirect" | "direct" (causal immediacy)
  ValueSource, // reused: "derived" | "manual"
  PhysicalHazardPotential, // reused — see note: export this from safety-types.ts
} from "./safety-types";

// --- Branded id ---------------------------------------------------------------------
export type HazardItemId = string & { readonly __brand: "HazardItemId" };

// --- Vocabularies -------------------------------------------------------------------

// ISO 12100 hazard category. NOTE: the "environment" value here means slip/trip/fall
// type hazards (ISO 12100) and is unrelated to the Environment ASSET category
// (a protection target). The two concepts coexist without conflict.
export type HazardCategory =
  | "mechanical"
  | "electrical"
  | "thermal"
  | "noise"
  | "vibration"
  | "radiation"
  | "material_substance"
  | "ergonomic"
  | "environment"
  | "combined"
  | "other";

// How multiple contributes_to inputs combine into the hazard.
//  - "ANY" (default): each cause alone triggers the hazard (OR gate).
//  - "ALL": only all contributions together arm the hazard (AND gate, combinatorial).
export type HazardCombinationType = "ANY" | "ALL";
export const DEFAULT_HAZARD_COMBINATION_TYPE: HazardCombinationType = "ANY";

// Where the hazard item originated. Drives the source badge in the master list and
// distinguishes collapsed/auto-derived items (Phase 4 collapsed mode).
export type HazardSource = "manual" | "imported" | "graph";

// --- HazardItem node ----------------------------------------------------------------
// Lean by design: contributes_to / endangers are stored as edges (below), never
// embedded here. This preserves the single source of truth and the m:n:m structure.
export interface HazardItem {
  id: HazardItemId;
  label: string;
  hazardType?: HazardCategory; // ISO 12100 classification
  physicalHazardPotential?: PhysicalHazardPotential;
  combinationType: HazardCombinationType; // default DEFAULT_HAZARD_COMBINATION_TYPE
  externalRef?: string; // e.g. id in an external FMEA / hazard register
  rationale?: string;
  source: HazardSource;
}

// --- Edges --------------------------------------------------------------------------
// Separate relation system from AssetToAssetRelation: a HazardItem is not an asset and
// has no AssetGroup / asset id, so it cannot use targetGroup / targetAssetId.
// `from` / `to` are the node references; `provenance` is the derived/manual marker
// (reusing ValueSource, kept distinct from any node `source`).

// Asset --contributes_to--> HazardItem. Carries the Likelihood/path side.
export interface ContributesToRelation {
  type: "contributes_to";
  from: string; // contributing asset id (AssetReference.id) — Data/Function/Process/System/Physical/Infrastructure
  to: HazardItemId;
  relevance: SafetyRelevance; // functional: direct control of the physical action?
  hazardDistance: number; // topological distance to the hazard, >= 0 (0 = at the hazard)
  rationale?: string;
  provenance?: ValueSource;
}

// HazardItem --endangers--> protection target. Carries the Impact side.
export interface EndangersRelation {
  type: "endangers";
  from: HazardItemId;
  to: string; // protection target asset id (Human / Environment / Infrastructure) — Phase 2 check
  impact: HazardImpact; // severity scale depends on the target kind
  rationale?: string;
  provenance?: ValueSource;
}

export type HazardRelation = ContributesToRelation | EndangersRelation;

// --- Narrowing guards ---------------------------------------------------------------
export function isContributesTo(
  relation: HazardRelation,
): relation is ContributesToRelation {
  return relation.type === "contributes_to";
}

export function isEndangers(
  relation: HazardRelation,
): relation is EndangersRelation {
  return relation.type === "endangers";
}
