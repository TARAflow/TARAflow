// app/utils/build-verification-checklist.ts
//
// The open findings per point of RQ-09-07 (ISO/SAE 21434; plan Phase 4,
// decision 25) — the checklist of a new verification entry in the Audit tab.
// App layer: it combines the Item Definition findings (overview feature) and
// the goal / claim findings (risks feature). Counts warnings only.
//
//   a) tara          the Item Definition the TARA is checked against
//   b) treatment     treatment decisions: avoid without justification, a
//                    goal / claim that no longer fits the treatment, reduce
//                    without a mitigation or without a residual rating
//   c) goals-claims  goals and claims vs. the treatments: missing, empty,
//                    retain without assumption, share without party
//   d) consistency   invalid assumptions, links to removed risks, overdue
//                    reviews

import type { Project } from "app/models/project-types";
import { EMPTY_PROJECT_TAGS, regulationPresetFromTags, type VerificationScope } from "shared";
import { itemDefinitionFindings } from "features/overview/services/item-definition-findings";
import { conceptFindings, type ConceptFindingCode } from "features/risks/services/concept-findings";
import { buildAssumptionUsage } from "./build-item-model-items";

const SCOPE_OF: Record<ConceptFindingCode, VerificationScope | null> = {
  AVOID_UNJUSTIFIED: "treatment",
  CONTROL_MISSING: "treatment",
  RESIDUAL_MISSING: "treatment",
  TREATMENT_MISMATCH: "treatment",
  GOAL_MISSING: "goals-claims",
  CLAIM_MISSING: "goals-claims",
  EMPTY_STATEMENT: "goals-claims",
  NO_ASSUMPTION: "goals-claims",
  NO_PARTY: "goals-claims",
  INVALID_ASSUMPTION: "consistency",
  REMOVED_RISK: "consistency",
  REVIEW_OVERDUE: "consistency",
  UNUSED: null,
};

export function buildVerificationChecklist(
  project: Project,
  today: string,
): { scope: VerificationScope; open: number }[] {
  const presetId = regulationPresetFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS);
  const counts: Record<VerificationScope, number> = { tara: 0, treatment: 0, "goals-claims": 0, consistency: 0 };
  for (const f of itemDefinitionFindings({
    description: project.info?.description,
    itemDefinition: project.itemDefinition,
    presetId,
    assumptionUsage: buildAssumptionUsage(project),
    today,
  })) {
    if (f.severity !== "warning") continue;
    counts[f.code === "ITEM_ASSUMPTION_INVALID_IN_USE" ? "consistency" : "tara"] += 1;
  }
  for (const f of conceptFindings({
    risks: project.risks?.risks ?? [],
    concept: project.cybersecurityConcept,
    assumptions: project.itemDefinition?.assumptions,
    isoMode: presetId === "iso-21434",
    today,
  })) {
    const scope = f.severity === "warning" ? SCOPE_OF[f.code] : null;
    if (scope) counts[scope] += 1;
  }
  return (Object.keys(counts) as VerificationScope[]).map((scope) => ({ scope, open: counts[scope] }));
}
