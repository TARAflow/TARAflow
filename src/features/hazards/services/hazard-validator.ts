// features/hazards/services/hazard-validator.ts
//
// R-rules for the hazard graph (IMPLEMENTATION-hazard-item.md changes 8-9):
//   - every Hazard Item needs >= 1 contributes_to input              (error)
//   - every Hazard Item needs >= 1 endangers edge                    (error)
//   - combinationType "ALL" with a single input is meaningless       (warning)
//   - edges must reference an existing Hazard Item (no dangling)      (error)
//   - edge endpoint/impact consistency                               (error, via relation service)
//   - no ISO 12100 hazard type, no description, no rationale        (warning —
//     the hazard is incomplete for the report; user 2026-10-30)
//
// Output shape mirrors AssetValidation for UI consistency. The rules yield
// coded findings (hazard-findings.ts, FX-1) — the UI translates them; errors
// and warnings are their English sentences.

import type { HazardData } from "../models/hazard-data-types";
import type { AssetReference, HazardItem, HazardRelation } from "shared";
import { isContributesTo, isEndangers } from "shared";
import { hazardRelationService } from "./hazard-relation-service";
import { hazardFindingLines, type HazardFinding } from "./hazard-findings";

export interface HazardIssue {
  errors: string[];
  warnings: string[];
  findings: HazardFinding[];
}

export interface HazardValidation {
  /** true only when at least one hazard exists and there are no errors. */
  isComplete: boolean;
  /** English sentences of the findings. */
  errors: string[];
  warnings: string[];
  /** The same, coded — for the findings panel in the UI language. */
  findings: HazardFinding[];
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
    const findings: HazardFinding[] = [];
    const hazard = labelOf(item);
    const add = (code: HazardFinding["code"], severity: HazardFinding["severity"], params = {}) =>
      findings.push({ code, severity, hazardId: item.id, params: { hazard, ...params } });

    const contributes = relations.filter(
      (r) => isContributesTo(r) && r.to === item.id,
    );
    const endangers = relations.filter(
      (r) => isEndangers(r) && r.from === item.id,
    );

    // A hazard the analyst ruled out of scope (no path through the system,
    // e.g. EN 50742: protective measure purely mechanical or organisational)
    // legitimately has no contributing asset.
    if (contributes.length === 0 && item.systemRelevance !== "out_of_scope") add("noContributor", "error");
    if (endangers.length === 0) add("endangersNothing", "error");
    if (!item.hazardType) add("noHazardType", "warning");
    if (!item.description?.trim()) add("noDescription", "warning");
    if (!item.rationale?.trim()) add("noRationale", "warning");
    if (item.combinationType === "ALL" && contributes.length < 2) add("allWithSingleInput", "warning");

    for (const r of contributes) {
      if (isContributesTo(r)) {
        for (const f of hazardRelationService.contributesToFindings(r, assets)) add(f.code, "error", f.params);
      }
    }
    for (const r of endangers) {
      if (isEndangers(r)) {
        for (const f of hazardRelationService.endangersFindings(r, assets)) add(f.code, "error", f.params);
      }
    }

    return { ...hazardFindingLines(findings), findings };
  },

  validate(
    data: HazardData,
    assets?: readonly AssetReference[],
  ): HazardValidation {
    const findings: HazardFinding[] = [];
    const ids = new Set(data.hazards.map((h) => h.id));

    // Dangling edges (referential integrity at the data level).
    for (const r of data.relations) {
      if (isContributesTo(r) && !ids.has(r.to)) {
        findings.push({ code: "danglingContributesTo", severity: "error", params: { id: r.to } });
      }
      if (isEndangers(r) && !ids.has(r.from)) {
        findings.push({ code: "danglingEndangers", severity: "error", params: { id: r.from } });
      }
    }

    for (const item of data.hazards) {
      findings.push(...this.validateHazard(item, data.relations, assets).findings);
    }

    const { errors, warnings } = hazardFindingLines(findings);
    return {
      isComplete: data.hazards.length > 0 && errors.length === 0,
      errors,
      warnings,
      findings,
      lastValidated: new Date().toISOString(),
    };
  },
};
