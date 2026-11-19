// ==================== ASSET VALIDATOR ====================
// Single Responsibility: Validate DFD asset properties

import type { ValidationFinding } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { ValidationMessages } from "./validator-utils";

/**
 * Validate asset properties.
 * Called from dfd-validator.ts.
 *
 * A missing name is a warning. A missing group property is an INFO (model
 * field purpose design §7, review 2026-11-14): no calculation reads these
 * fields yet — they are recorded with the asset (documentation, or context
 * for the attack feasibility rating to come) — so they neither warn nor keep
 * the DFD phase from "complete".
 */
export function validateAssetProperties(
  assets: DFDAsset[],
  warnings: ValidationFinding[],
  infos: ValidationFinding[],
): void {
  for (const asset of assets) {
    validateAssetBase(asset, warnings);
    validateAssetGroupProperties(asset, infos);
  }
}

// ---------------------------------------------------------------------------
// Base validation — applies to all asset groups
// ---------------------------------------------------------------------------

function validateAssetBase(
  asset: DFDAsset,
  warnings: ValidationFinding[],
): void {
  const displayId = asset.displayId ?? asset.name;

  if (!asset.name || asset.name.trim() === "") {
    warnings.push({
      key: ValidationMessages.ASSET_MISSING_NAME,
      displayId,
      elementId: asset.id,
      params: { name: displayId },
    });
  }
}

// ---------------------------------------------------------------------------
// Per-group property validation
// ---------------------------------------------------------------------------

function validateAssetGroupProperties(
  asset: DFDAsset,
  infos: ValidationFinding[],
): void {
  const props = asset.properties;
  const displayId = asset.displayId ?? asset.name;

  function note(key: string): void {
    infos.push({
      key,
      displayId,
      elementId: asset.id,
      params: { name: displayId },
    });
  }

  switch (asset.assetGroup) {
    case "data":
      // dataType — recorded with the asset; no calculation reads it yet (P4, 0.19)
      if (!props?.dataType || props.dataType.length === 0) {
        note(ValidationMessages.ASSET_MISSING_DATA_TYPE);
      }
      // lifecycle — context for the attack feasibility rating; not evaluated yet
      if (!props?.lifecycle) {
        note(ValidationMessages.ASSET_MISSING_LIFECYCLE);
      }
      break;

    case "system":
      // exposure — recorded with the asset; not evaluated (the flows' exposure level is)
      if (!props?.exposure) {
        note(ValidationMessages.ASSET_MISSING_EXPOSURE);
      }
      break;

    case "infrastructure":
      // physicalAccessControl — recorded with the asset; not evaluated (the physical boundary's is)
      if (!props?.physicalAccessControl) {
        note(ValidationMessages.ASSET_MISSING_PHYSICAL_ACCESS);
      }
      break;

    case "service":
      // serviceType — recorded with the asset; no calculation reads it yet
      if (!props?.serviceType) {
        note(ValidationMessages.ASSET_MISSING_SERVICE_TYPE);
      }
      // responsibility — context (third party, supply chain); not evaluated yet
      if (!props?.responsibility) {
        note(ValidationMessages.ASSET_MISSING_RESPONSIBILITY);
      }
      break;

    case "human":
      // role — recorded with the asset; not evaluated (the external entity's type is)
      if (!props?.role) {
        note(ValidationMessages.ASSET_MISSING_ROLE);
      }
      break;

    case "process":
      // automationLevel — context for the attack feasibility rating; not evaluated yet
      if (!props?.automationLevel) {
        note(ValidationMessages.ASSET_MISSING_AUTOMATION_LEVEL);
      }
      break;

    // function, physical: no mandatory fields — all optional by design
    case "function":
    case "physical":
      break;
  }
}