// ==================== ASSET VALIDATOR ====================
// Pure validation logic for AssetData.
// Returns structured AssetValidation — no side effects, no service deps.

import type { AssetData, AssetValidation } from "../models/asset-types";
import type { StaleReason } from "../models/asset-security-goals-types";
import { goalFindings, goalStates } from "./asset-goal-state";
import type { GoalFindingCode } from "./asset-goal-state";
import type { PhaseStatus } from "shared";

export function validateAssetData(assetData: AssetData): AssetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const impactScale = assetData.configuration?.impactScale ?? "4-level";

  if (assetData.assets.length === 0) {
    errors.push("tabs.assets.validation.noAssets");
  }

  for (const asset of assetData.assets) {
    if (!asset.name.trim()) {
      errors.push(`tabs.assets.validation.noName:${asset.id}`);
    }

    // Check if at least one CIANAAA dimension is active (level !== "none")
    // Replaces former: !asset.securityGoals.some((sg) => sg.enabled)
    if (!asset.securityGoals.some((sg) => sg.level !== "none")) {
      errors.push(`tabs.assets.validation.noSecurityGoal:${asset.id}`);
    }

    // Warn about active goals without a formal description
    for (const sg of asset.securityGoals.filter(
      (sg) => sg.level !== "none" && !sg.formalDescription.trim(),
    )) {
      warnings.push(
        `tabs.assets.validation.noSecurityGoalDescription:${asset.id}:${sg.type}`,
      );
    }

    // Manual physicalImpact override requires rationale (IEC 62443-4-1)
    if (
      asset.physicalImpactSource === "manual" &&
      !asset.physicalImpactRationale?.trim()
    ) {
      warnings.push(
        `tabs.assets.validation.noPhysicalImpactRationale:${asset.id}`,
      );
    }

    if (asset.linkedDFDElements.length === 0) {
      warnings.push(`tabs.assets.validation.notLinkedToDFD:${asset.id}`);
    }

    if (asset.impactRatings.some((r) => r.value === 0)) {
      warnings.push(`tabs.assets.validation.unratedImpact:${asset.id}`);
    }

    // Security-goal findings — from the single domain truth (goalStates).
    // Messages name the asset by its display id, not the internal UUID.
    const label = asset.displayId || asset.name || asset.id;
    const states = goalStates(asset, impactScale);
    asset.securityGoals.forEach((goal, i) => {
      for (const f of goalFindings(states[i], goal)) {
        const key = `${GOAL_FINDING_KEY[f.code]}${f.reason ? `.${STALE_KEY[f.reason]}` : ""}:${label}:${f.goal}`;
        (f.severity === "error" ? errors : f.severity === "warning" ? warnings : infos).push(key);
      }
    });
  }

  return {
    isComplete: errors.length === 0 && assetData.assets.length > 0,
    errors,
    warnings,
    infos,
    lastValidated: new Date().toISOString(),
  };
}

const GOAL_FINDING_KEY: Record<GoalFindingCode, string> = {
  GOAL_RATIONALE_MISSING: "tabs.assets.validation.goalRationaleMissing",
  GOAL_OVERRIDE_STALE: "tabs.assets.validation.goalOverrideStale",
  GOAL_UNASSESSED: "tabs.assets.validation.goalUnassessed",
  GOAL_PROVISIONAL: "tabs.assets.validation.goalProvisional",
  GOAL_NO_APPLICABLE_IMPACT: "tabs.assets.validation.goalNoApplicableImpact",
};

const STALE_KEY: Record<StaleReason, string> = {
  "suggestion-removed": "suggestionRemoved",
  "suggestion-added": "suggestionAdded",
  "level-raised": "levelRaised",
  "level-lowered": "levelLowered",
  "basis-changed": "basisChanged",
};

export function derivePhaseStatus(validation: AssetValidation): PhaseStatus {
  if (validation.isComplete) return "complete";
  if (validation.errors.length > 0) return "incomplete";
  return "in-progress";
}