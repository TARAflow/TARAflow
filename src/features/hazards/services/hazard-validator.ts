// features/hazards/services/hazard-validator.ts
//
// R-rules for the hazard graph (IMPLEMENTATION-hazard-item.md changes 8-9):
//   - every Hazard Item needs >= 1 contributes_to input              (error)
//   - every Hazard Item needs >= 1 endangers edge                    (error)
//   - combinationType "ALL" with a single input is meaningless       (warning)
//   - edges must reference an existing Hazard Item (no dangling)      (error)
//   - edge endpoint/impact consistency                               (error, via relation service)
//
// Output shape mirrors AssetValidation for UI consistency.

import type { HazardData } from "../models/hazard-data-types";
import type { AssetReference, HazardItem, HazardRelation } from "shared";
import { isContributesTo, isEndangers } from "shared";
import { hazardRelationService } from "./hazard-relation-service";

export interface HazardIssue {
  errors: string[];
  warnings: string[];
}

export interface HazardValidation {
  /** true only when at least one hazard exists and there are no errors. */
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

function labelOf(item: HazardItem): string {
  return item.label?.trim() || item.id;
}

export const hazardValidator = {
  /** Validates a single Hazard Item against its incident edges. */
  validateHazard(
    item: HazardItem,
    relations: readonly HazardRelation[],
    assets?: readonly AssetReference[],
  ): HazardIssue {
    const errors: string[] = [];
    const warnings: string[] = [];

    const contributes = relations.filter(
      (r) => isContributesTo(r) && r.to === item.id,
    );
    const endangers = relations.filter(
      (r) => isEndangers(r) && r.from === item.id,
    );

    if (contributes.length === 0) {
      errors.push(`Hazard "${labelOf(item)}" has no contributes_to input.`);
    }
    if (endangers.length === 0) {
      errors.push(`Hazard "${labelOf(item)}" endangers no protection target.`);
    }
    if (item.combinationType === "ALL" && contributes.length < 2) {
      warnings.push(
        `Hazard "${labelOf(item)}" uses combinationType "ALL" with a single input — combinatorics has no effect here.`,
      );
    }

    for (const r of contributes) {
      if (isContributesTo(r)) {
        errors.push(...hazardRelationService.validateContributesTo(r, assets));
      }
    }
    for (const r of endangers) {
      if (isEndangers(r)) {
        errors.push(...hazardRelationService.validateEndangers(r, assets));
      }
    }

    return { errors, warnings };
  },

  /** Validates the whole hazard graph. */
  validate(
    data: HazardData,
    assets?: readonly AssetReference[],
  ): HazardValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const ids = new Set(data.hazards.map((h) => h.id));

    // Dangling edges (referential integrity at the data level).
    for (const r of data.relations) {
      if (isContributesTo(r) && !ids.has(r.to)) {
        errors.push(`Dangling contributes_to edge -> unknown hazard "${r.to}".`);
      }
      if (isEndangers(r) && !ids.has(r.from)) {
        errors.push(`Dangling endangers edge from unknown hazard "${r.from}".`);
      }
    }

    for (const item of data.hazards) {
      const issue = this.validateHazard(item, data.relations, assets);
      errors.push(...issue.errors);
      warnings.push(...issue.warnings);
    }

    return {
      isComplete: data.hazards.length > 0 && errors.length === 0,
      errors,
      warnings,
      lastValidated: new Date().toISOString(),
    };
  },
};
