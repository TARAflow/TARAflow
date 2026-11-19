// ==================== RISK DIALOG — ISO NOTES ====================
// Split out of risk-dialog.tsx (MT-2): ISO/SAE 21434 residual attack potential and the notes
// that say where the panels' feasibility and impact come from.

import type { RiskDialogModel } from "./use-risk-dialog-model";
import { ISO_AP_FACTOR_IDS, isoFactorPoints } from "./local-risk-state";
import { FactorRating } from "../../models/risk-factor-types";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../../models/risk-factor-types";
import { iso21434Feasibility } from "../../models/iso21434-core";
import { feasibilityFromRiskScaleValue } from "../../models/iso-risk-matrix";
import { feasibilityLevelToRiskScale } from "shared";

  // Residual attack potential → G.7 band → risk-scale likelihood, from a
  // ratings array. Uses the SAME level→scale mapping the tree used for the
  // before value (passed through on the assessment), so before/after stay
  // comparable. Returns null until all five factors are rated.
export function isoResidualOf(m: RiskDialogModel, ratings: FactorRating[]): { ap: number; band: string; likelihood: number } | null {
  const { configuration } = m;
  let ap = 0;
  for (const id of ISO_AP_FACTOR_IDS) {
    const v = ratings.find((r) => r.factorId === id)?.value ?? 0;
    if (v <= 0) return null; // not fully rated → no residual yet
    ap += isoFactorPoints(id, v);
  }
  const band = iso21434Feasibility(ap);
  const map: Record<string, number> = feasibilityLevelToRiskScale(configuration.scale);
  return { ap, band, likelihood: map[band] ?? 0 };
}

  // ISO: where the panels' feasibility and impact come from (user
  // 2026-10-30) — replaces the read-only tree row (before) and the residual
  // box under the factors (after); the factors below stay the input.
export function isoFeasibilityNoteOf(m: RiskDialogModel, mitigated: boolean): string | undefined {
  const { t, configuration, currentRisk, local, isISO, treeAssessment, hasTreeIsoFactors } = m;
  const isoResidual = (ratings: FactorRating[]) => isoResidualOf(m, ratings);
  if (!isISO) return undefined;
  const ratings = mitigated ? local.mitigatedFactorRatings : local.factorRatings;
  const factors = isoResidual(ratings);
  const factorsNote = factors
    ? t("tabs.risks.dialog.isoNote.factors", { ap: factors.ap, defaultValue: "Five factors · AP {{ap}}" })
    : undefined;
  const rateFactors = t("tabs.risks.dialog.isoNote.rateFactors", {
    defaultValue: "Rate all five factors",
  });
  if (!mitigated) {
    if (!treeAssessment) return factorsNote ?? rateFactors;
    const tree =
      currentRisk.sourceStrideMethod === "attack-path" && currentRisk.threatDisplayId
        ? t("tabs.risks.dialog.isoNote.treePath", {
            path: currentRisk.threatDisplayId,
            defaultValue: "Attack tree path {{path}}",
          })
        : t("tabs.risks.dialog.isoNote.tree", { defaultValue: "Attack tree (highest path)" });
    return factors ? `${tree} · AP ${factors.ap}` : tree;
  }
  const level = feasibilityFromRiskScaleValue(
    ratings.find((r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID)?.value,
    configuration.scale,
  );
  if (hasTreeIsoFactors || !treeAssessment) {
    if (factorsNote) return factorsNote;
    return level && treeAssessment
      ? t("tabs.risks.dialog.isoNote.storedLevel", {
          defaultValue: "Stored residual level — rate all five factors",
        })
      : rateFactors;
  }
  return level
    ? t("tabs.risks.dialog.isoNote.residualLevel", { defaultValue: "Residual attack-tree level" })
    : t("tabs.risks.dialog.isoNote.setResidualLevel", {
        defaultValue: "Set the residual attack-tree level below",
      });
}

export function isoImpactNoteOf(m: RiskDialogModel, mitigated: boolean): string | undefined {
  const { t, isISO, linkedAssets } = m;
  if (!isISO) return undefined;
  if (mitigated) {
    return t("tabs.risks.dialog.isoNote.impactUnchanged", {
      defaultValue: "Unchanged (damage scenario)",
    });
  }
  const asset = linkedAssets[0];
  return asset
    ? t("tabs.risks.dialog.isoNote.damageScenario", {
        asset: asset.displayId ?? asset.name,
        defaultValue: "Damage scenario of {{asset}}",
      })
    : undefined;
}
