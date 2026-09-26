// ==================== ASSET VALIDATOR ====================
// Pure validation logic for AssetData.
// Returns structured AssetValidation — no side effects, no service deps.

import type { AssetData, AssetValidation } from "../models/asset-types";
import type { StaleReason } from "../models/asset-security-goals-types";
import { goalFindings, goalStates } from "./asset-goal-state";
import type { GoalFindingCode } from "./asset-goal-state";
import type { PhaseStatus } from "shared";

/**
 * How a validation message names an asset: display id plus name, e.g.
 * "DA-001 (Calibration data)". Never the internal UUID — the analyst cannot
 * find an asset by it. Colons are stripped from the name because the message
 * key uses ":" as separator (key:asset:goal).
 */
export function assetLabel(asset: {
  id: string;
  displayId?: string;
  name?: string;
}): string {
  const name = asset.name?.trim().replace(/\s*:\s*/g, " ");
  const id = asset.displayId || asset.id;
  return name ? `${id} (${name})` : id;
}

export function validateAssetData(assetData: AssetData): AssetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const impactScale = assetData.configuration?.impactScale ?? "4-level";

  if (assetData.assets.length === 0) {
    errors.push("tabs.assets.validation.noAssets");
  }

  for (const asset of assetData.assets) {
    const label = assetLabel(asset);
    if (!asset.name.trim()) {
      errors.push(`tabs.assets.validation.noName:${label}`);
    }

    // Check if at least one CIANAAA dimension is active (level !== "none")
    // Replaces former: !asset.securityGoals.some((sg) => sg.enabled)
    if (!asset.securityGoals.some((sg) => sg.level !== "none")) {
      errors.push(`tabs.assets.validation.noSecurityGoal:${label}`);
    }

    // Warn about active goals without a formal description
    for (const sg of asset.securityGoals.filter(
      (sg) => sg.level !== "none" && !sg.formalDescription.trim(),
    )) {
      warnings.push(
        `tabs.assets.validation.noSecurityGoalDescription:${label}:${sg.type}`,
      );
    }

    // Manual physicalImpact override requires rationale (IEC 62443-4-1)
    if (
      asset.physicalImpactSource === "manual" &&
      !asset.physicalImpactRationale?.trim()
    ) {
      warnings.push(
        `tabs.assets.validation.noPhysicalImpactRationale:${label}`,
      );
    }

    if (asset.linkedDFDElements.length === 0) {
      warnings.push(`tabs.assets.validation.notLinkedToDFD:${label}`);
    }

    if (asset.impactRatings.some((r) => r.value === 0)) {
      warnings.push(`tabs.assets.validation.unratedImpact:${label}`);
    }

    // Security-goal findings — from the single domain truth (goalStates).
    // Messages name the asset by its display id, not the internal UUID.
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