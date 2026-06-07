// features/hazards/services/hazard-service.ts
//
// CRUD over the Hazard Item itself plus referential integrity, id generation,
// the empty-item factory, validation wrapper, and the phase-status derivation.
//
// This is the SSOT operator: it transforms HazardData immutably. Persistence
// happens at the app layer via updateProject (no side effects here).
//
// Phase-status note: PhaseId lives in app/ and features must not import app/.
// So this service returns the status VALUE (deriveHazardPhaseStatus); the app
// layer applies it to phaseStatus[PhaseId.Hazard].

import type { HazardData } from "../models/hazard-data-types";
import type { HazardUpdateResult } from "../models/hazard-tab-types";
import type {
  AssetReference,
  HazardCategory,
  HazardCombinationType,
  HazardItem,
  HazardItemId,
  HazardRelation,
  HazardSource,
  PhaseStatus,
  PhysicalHazardPotential,
} from "shared";
import { DEFAULT_HAZARD_COMBINATION_TYPE, isContributesTo, isEndangers } from "shared";
import { hazardValidator, type HazardValidation } from "./hazard-validator";

// ==================== INPUT ====================

export interface CreateHazardItemInput {
  label?: string;
  hazardType?: HazardCategory;
  physicalHazardPotential?: PhysicalHazardPotential;
  combinationType?: HazardCombinationType;
  externalRef?: string;
  rationale?: string;
  source?: HazardSource;
}

// ==================== ID GENERATION ====================

function parseHazardNumericId(id: string): number {
  const m = id.match(/H-(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Generates the next sequential Hazard Item id (e.g. "H-01"). */
function generateNextHazardId(existing: readonly HazardItem[]): HazardItemId {
  if (existing.length === 0) return "H-01" as HazardItemId;

  const maxNumeric = Math.max(...existing.map((h) => parseHazardNumericId(h.id)));
  const nextNumeric = maxNumeric + 1;

  const sample = existing[0]?.id ?? "H-01";
  const match = sample.match(/H-(\d+)/);
  const padding = match ? match[1].length : 2;

  return `H-${String(nextNumeric).padStart(Math.max(padding, 2), "0")}` as HazardItemId;
}

// ==================== HELPERS ====================

function withTimestamp(data: HazardData): HazardData {
  return { ...data, lastModified: new Date().toISOString() };
}

// ==================== SERVICE ====================

export const hazardService = {
  generateNextHazardId,

  /** Builds a fresh Hazard Item with defaults (not yet added to the graph). */
  createHazardItem(
    data: HazardData,
    input: CreateHazardItemInput = {},
  ): HazardItem {
    return {
      id: generateNextHazardId(data.hazards),
      label: input.label ?? "",
      hazardType: input.hazardType,
      physicalHazardPotential: input.physicalHazardPotential,
      combinationType: input.combinationType ?? DEFAULT_HAZARD_COMBINATION_TYPE,
      externalRef: input.externalRef,
      rationale: input.rationale,
      source: input.source ?? "manual",
    };
  },

  addHazard(data: HazardData, item: HazardItem): HazardData {
    return withTimestamp({ ...data, hazards: [...data.hazards, item] });
  },

  updateHazard(data: HazardData, item: HazardItem): HazardData {
    return withTimestamp({
      ...data,
      hazards: data.hazards.map((h) => (h.id === item.id ? item : h)),
    });
  },

  /**
   * Deletes a Hazard Item and cascade-removes every edge referencing it
   * (referential integrity). Call getReferencingRelations first if the UI
   * needs to warn the analyst before destroying linked edges.
   */
  deleteHazard(data: HazardData, id: HazardItemId): HazardData {
    return withTimestamp({
      ...data,
      hazards: data.hazards.filter((h) => h.id !== id),
      relations: data.relations.filter(
        (r) =>
          !(isContributesTo(r) && r.to === id) &&
          !(isEndangers(r) && r.from === id),
      ),
    });
  },

  /** Edges that would be removed if the given Hazard Item were deleted. */
  getReferencingRelations(data: HazardData, id: HazardItemId): HazardRelation[] {
    return data.relations.filter(
      (r) =>
        (isContributesTo(r) && r.to === id) ||
        (isEndangers(r) && r.from === id),
    );
  },

  validate(
    data: HazardData,
    assets?: readonly AssetReference[],
  ): HazardValidation {
    return hazardValidator.validate(data, assets);
  },

  /**
   * Phase-status VALUE for the Hazard phase (the app layer applies it to the
   * PhaseId.Hazard key):
   *   no hazards               -> "not-started"
   *   hazards but errors/incomplete -> "in-progress"
   *   hazards and no errors     -> "complete"
   */
  deriveHazardPhaseStatus(
    data: HazardData,
    assets?: readonly AssetReference[],
  ): PhaseStatus {
    if (data.hazards.length === 0) return "not-started";
    return hazardValidator.validate(data, assets).isComplete
      ? "complete"
      : "in-progress";
  },

  /** Stamps lastModified and packages the tab's onUpdate payload. */
  toUpdateResult(data: HazardData): HazardUpdateResult {
    const stamped = withTimestamp(data);
    return { hazards: stamped, lastModified: stamped.lastModified };
  },
};
