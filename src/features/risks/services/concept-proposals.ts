// features/risks/services/concept-proposals.ts
//
// Goal proposals (ISO 21434 plan Phase 4, decision 25): the asset × property a
// risk violates — its linked assets' active security goals of the types its
// STRIDE category breaks (shared violatesGoal / goalTypesFor) — with the goal's
// formal description as the proposed statement. Pure.

import { goalTypesFor, type AssetDataReference, type AssetPropertyRef, type CybersecurityConcept } from "shared";
import type { Risk } from "../models/risk-assessment-types";
import { conceptKindFor } from "../models/concept-kind";

export interface GoalProposal extends AssetPropertyRef {
  /** "DA-001 Alarm message × I" */
  label: string;
  /** The formal description of the asset's security goal ("" if none). */
  statement: string;
}

/** The asset × properties one risk violates. */
export function goalProposalsForRisk(risk: Risk, assetDataRef: AssetDataReference | undefined): GoalProposal[] {
  const out: GoalProposal[] = [];
  for (const assetId of risk.linkedAssetIds ?? []) {
    const asset = assetDataRef?.assets.find((a) => a.id === assetId);
    if (!asset) continue;
    for (const type of goalTypesFor(risk.strideCategory)) {
      const goal = asset.securityGoals?.find((g) => g.type === type && g.level !== "none");
      if (!goal) continue;
      out.push({
        assetId,
        property: type,
        label: `${asset.displayId ?? ""} ${asset.name ?? ""} × ${type}`.trim(),
        statement: goal.formalDescription ?? "",
      });
    }
  }
  return out;
}

export interface OpenGoalProposal extends GoalProposal {
  /** Risks treated reduce without a goal that violate this asset × property. */
  riskIds: string[];
}

/** Proposals for every reduce risk still without a goal, one per asset × property. */
export function openGoalProposals(
  risks: readonly Risk[],
  concept: CybersecurityConcept | undefined,
  assetDataRef: AssetDataReference | undefined,
): OpenGoalProposal[] {
  const covered = new Set((concept?.goals ?? []).flatMap((g) => g.riskIds));
  const byKey = new Map<string, OpenGoalProposal>();
  for (const risk of risks) {
    if (conceptKindFor(risk.treatment) !== "goal" || covered.has(risk.id)) continue;
    for (const p of goalProposalsForRisk(risk, assetDataRef)) {
      const key = `${p.assetId}:${p.property}`;
      const entry = byKey.get(key) ?? { ...p, riskIds: [] };
      entry.riskIds.push(risk.id);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}
