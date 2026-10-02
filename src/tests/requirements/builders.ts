// src/tests/requirements/builders.ts
//
// Small, readable project pieces for the requirement tests. Every builder goes
// through the REAL services (deriver, app-layer reference builder) — the tests
// check the chain the app runs, not hand-made intermediate objects.

import type { Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type {
  SecurityGoal,
  SecurityGoalType,
} from "features/assets/models/asset-security-goals-types";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import type { AssetDataReference } from "shared";

export const SCALE = "4-level" as const;
export const GOAL_TYPES: SecurityGoalType[] = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];

export const r = (criterionId: string, value: number | null | "na"): ImpactRating => ({
  criterionId,
  value,
});

/**
 * A data asset linked to DFD elements with a "transports" relation, goals
 * derived by the real deriver (as after an asset sync in the app).
 */
export function dataAsset(
  id: string,
  ratings: ImpactRating[],
  elementIds: string[] = ["DF-1"],
  relationType = "transports",
): Asset {
  const base = {
    id,
    displayId: id.toUpperCase(),
    name: `Asset ${id}`,
    assetGroup: "data",
    properties: {},
    impactRatings: ratings,
    linkedDFDElements: elementIds.map((elementId) => ({
      elementId,
      elementName: elementId,
      relationType,
    })),
    securityGoals: GOAL_TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
  return rederive(base);
}

/** Run the deriver again — what the app does after any impact / relation change. */
export function rederive(asset: Asset): Asset {
  return {
    ...asset,
    securityGoals: deriveSecurityGoalSuggestions(asset, asset.securityGoals, SCALE),
  };
}

export const goal = (a: Asset, t: SecurityGoalType): SecurityGoal =>
  a.securityGoals.find((g) => g.type === t)!;

export const withGoal = (a: Asset, g: SecurityGoal): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});

/** The asset data reference the app layer hands to the threat and risk tabs. */
export function assetRef(
  assets: Asset[],
  impactCriteria?: { id: string; weight: number }[],
): AssetDataReference {
  return buildAssetDataReference(assets, {}, SCALE, impactCriteria);
}
