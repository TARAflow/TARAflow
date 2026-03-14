// ==================== ASSET VALIDATOR ====================
// Pure validation logic for AssetData.
// Returns structured AssetValidation — no side effects, no service deps.

import type { AssetData, AssetValidation } from "../models/asset-types";
import type { PhaseStatus } from "shared";

export function validateAssetData(assetData: AssetData): AssetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (assetData.assets.length === 0) {
    errors.push("tabs.assets.validation.noAssets");
  }

  for (const asset of assetData.assets) {
    if (!asset.name.trim()) {
      errors.push(`tabs.assets.validation.noName:${asset.id}`);
    }

    if (!asset.securityGoals.some((sg) => sg.enabled)) {
      errors.push(`tabs.assets.validation.noSecurityGoal:${asset.id}`);
    }

    for (const sg of asset.securityGoals.filter(
      (sg) => sg.enabled && !sg.formalDescription.trim(),
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
  }

  return {
    isComplete: errors.length === 0 && assetData.assets.length > 0,
    errors,
    warnings,
    lastValidated: new Date().toISOString(),
  };
}

export function derivePhaseStatus(validation: AssetValidation): PhaseStatus {
  if (validation.isComplete) return "complete";
  if (validation.errors.length > 0) return "incomplete";
  return "in-progress";
}