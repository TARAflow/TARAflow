// features/hazards/services/hazard-relation-service.ts
//
// CRUD + validation for the two Hazard edges (contributes_to / endangers).
// A HazardItem is NOT an asset and has no AssetGroup, so these edges form a
// SEPARATE relation system from AssetToAssetRelation (see hazard-types.ts).
// Consequently the validation does NOT piggyback on ALLOWED_A2A_RELATIONS; it
// uses a dedicated, minimal rule set keyed by the asset's category.
//
// DECISION TO CONFIRM (refines IMPLEMENTATION-hazard-item.md change 7 / §6):
// change 7 spoke of extending ALLOWED_A2A_RELATIONS, but since the hazard end
// of the edge has no asset group, a dedicated matrix is cleaner. The allowed
// categories live in eligible-assets-service.ts and are reused here.
//
// All operations are immutable: they return a new HazardData with a fresh
// lastModified. Edges carry no id; they are identified by their endpoints
// (contributes_to: asset->hazard, endangers: hazard->targetAsset).

import type { HazardData } from "../models/hazard-data-types";
import type {
  AssetReference,
  ContributesToRelation,
  EndangersRelation,
  HazardImpact,
  HazardItemId,
  SafetyRelevance,
  ValueSource,
} from "shared";
import { isContributesTo, isEndangers } from "shared";
import {
  HAZARD_CONTRIBUTOR_GROUPS,
  HAZARD_TARGET_GROUPS,
  targetKindForAssetGroup,
} from "./eligible-assets-service";

// ==================== PARAMS ====================

export interface AddContributesToParams {
  assetId: string;
  hazardId: HazardItemId;
  relevance: SafetyRelevance;
  /** Topological distance to the hazard, >= 0 (0 = at the hazard). */
  hazardDistance: number;
  rationale?: string;
  provenance?: ValueSource;
}

export interface AddEndangersParams {
  hazardId: HazardItemId;
  targetAssetId: string;
  impact: HazardImpact;
  rationale?: string;
  provenance?: ValueSource;
}

export type ContributesToPatch = Partial<
  Pick<ContributesToRelation, "relevance" | "hazardDistance" | "rationale" | "provenance">
>;

export type EndangersPatch = Partial<
  Pick<EndangersRelation, "impact" | "rationale" | "provenance">
>;

// ==================== HELPERS ====================

function withTimestamp(data: HazardData): HazardData {
  return { ...data, lastModified: new Date().toISOString() };
}

function findAsset(
  assets: readonly AssetReference[] | undefined,
  id: string,
): AssetReference | undefined {
  return assets?.find((a) => a.id === id);
}

// ==================== SERVICE ====================

export const hazardRelationService = {
  // ---- contributes_to ------------------------------------------------------

  /** Adds a contributes_to edge. Idempotent on (asset, hazard). */
  addContributesTo(data: HazardData, p: AddContributesToParams): HazardData {
    const exists = data.relations.some(
      (r) => isContributesTo(r) && r.from === p.assetId && r.to === p.hazardId,
    );
    if (exists) return data;

    const rel: ContributesToRelation = {
      type: "contributes_to",
      from: p.assetId,
      to: p.hazardId,
      relevance: p.relevance,
      hazardDistance: p.hazardDistance,
      rationale: p.rationale,
      provenance: p.provenance,
    };
    return withTimestamp({ ...data, relations: [...data.relations, rel] });
  },

  removeContributesTo(
    data: HazardData,
    assetId: string,
    hazardId: HazardItemId,
  ): HazardData {
    return withTimestamp({
      ...data,
      relations: data.relations.filter(
        (r) =>
          !(isContributesTo(r) && r.from === assetId && r.to === hazardId),
      ),
    });
  },

  updateContributesTo(
    data: HazardData,
    assetId: string,
    hazardId: HazardItemId,
    patch: ContributesToPatch,
  ): HazardData {
    return withTimestamp({
      ...data,
      relations: data.relations.map((r) =>
        isContributesTo(r) && r.from === assetId && r.to === hazardId
          ? { ...r, ...patch }
          : r,
      ),
    });
  },

  // ---- endangers -----------------------------------------------------------

  /** Adds an endangers edge. Idempotent on (hazard, targetAsset). */
  addEndangers(data: HazardData, p: AddEndangersParams): HazardData {
    const exists = data.relations.some(
      (r) =>
        isEndangers(r) && r.from === p.hazardId && r.to === p.targetAssetId,
    );
    if (exists) return data;

    const rel: EndangersRelation = {
      type: "endangers",
      from: p.hazardId,
      to: p.targetAssetId,
      impact: p.impact,
      rationale: p.rationale,
      provenance: p.provenance,
    };
    return withTimestamp({ ...data, relations: [...data.relations, rel] });
  },

  removeEndangers(
    data: HazardData,
    hazardId: HazardItemId,
    targetAssetId: string,
  ): HazardData {
    return withTimestamp({
      ...data,
      relations: data.relations.filter(
        (r) =>
          !(isEndangers(r) && r.from === hazardId && r.to === targetAssetId),
      ),
    });
  },

  updateEndangers(
    data: HazardData,
    hazardId: HazardItemId,
    targetAssetId: string,
    patch: EndangersPatch,
  ): HazardData {
    return withTimestamp({
      ...data,
      relations: data.relations.map((r) =>
        isEndangers(r) && r.from === hazardId && r.to === targetAssetId
          ? { ...r, ...patch }
          : r,
      ),
    });
  },

  // ---- validation ----------------------------------------------------------
  // assets is optional: without the snapshot only endpoint-independent checks
  // run (category and discriminator consistency are skipped, not failed).

  validateContributesTo(
    rel: ContributesToRelation,
    assets?: readonly AssetReference[],
  ): string[] {
    const errors: string[] = [];
    if (rel.hazardDistance < 0) {
      errors.push(`contributes_to: hazardDistance must be >= 0 (got ${rel.hazardDistance})`);
    }
    const asset = findAsset(assets, rel.from);
    if (asset && !HAZARD_CONTRIBUTOR_GROUPS.includes(asset.assetGroup)) {
      errors.push(
        `contributes_to: asset group "${asset.assetGroup}" is not an allowed hazard source`,
      );
    }
    return errors;
  },

  validateEndangers(
    rel: EndangersRelation,
    assets?: readonly AssetReference[],
  ): string[] {
    const errors: string[] = [];
    const asset = findAsset(assets, rel.to);
    if (asset) {
      if (!HAZARD_TARGET_GROUPS.includes(asset.assetGroup)) {
        errors.push(
          `endangers: asset group "${asset.assetGroup}" is not a valid protection target`,
        );
      }
      const expected = targetKindForAssetGroup(asset.assetGroup);
      if (expected && rel.impact.target !== expected) {
        errors.push(
          `endangers: impact.target "${rel.impact.target}" does not match target asset group "${asset.assetGroup}"`,
        );
      }
    }
    return errors;
  },
};
