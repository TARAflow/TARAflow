// ==================== ASSET VALIDATOR ====================
// Single Responsibility: Validate DFD asset properties

import type { ValidationFinding } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { ValidationMessages } from "./validator-utils";

/**
 * Validate asset properties.
 * Called from dfd-validator.ts.
 */
export function validateAssetProperties(
  assets: DFDAsset[],
  warnings: ValidationFinding[],
): void {
  for (const asset of assets) {
    validateAssetBase(asset, warnings);
    validateAssetGroupProperties(asset, warnings);
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
  warnings: ValidationFinding[],
): void {
  const props = asset.properties;
  const displayId = asset.displayId ?? asset.name;

  function warn(key: string): void {
    warnings.push({
      key,
      displayId,
      elementId: asset.id,
      params: { name: displayId },
    });
  }

  switch (asset.assetGroup) {
    case "data":
      // dataType — documents the asset; no calculation reads it yet (P4, 0.19)
      if (!props?.dataType || props.dataType.length === 0) {
        warn(ValidationMessages.ASSET_MISSING_DATA_TYPE);
      }
      // lifecycle — context for the attack feasibility rating; not evaluated yet
      if (!props?.lifecycle) {
        warn(ValidationMessages.ASSET_MISSING_LIFECYCLE);
      }
      break;

    case "system":
      // criticality — a rating entered as a field; no calculation reads it
      if (!props?.criticality) {
        warn(ValidationMessages.ASSET_MISSING_CRITICALITY);
      }
      // exposure — documents the asset; not evaluated (the flows' exposure level is)
      if (!props?.exposure) {
        warn(ValidationMessages.ASSET_MISSING_EXPOSURE);
      }
      break;

    case "infrastructure":
      // physicalAccessControl — documents the asset; not evaluated (the physical boundary's is)
      if (!props?.physicalAccessControl) {
        warn(ValidationMessages.ASSET_MISSING_PHYSICAL_ACCESS);
      }
      break;

    case "service":
      // serviceType — documents the asset; no calculation reads it yet
      if (!props?.serviceType) {
        warn(ValidationMessages.ASSET_MISSING_SERVICE_TYPE);
      }
      // responsibility — context (third party, supply chain); not evaluated yet
      if (!props?.responsibility) {
        warn(ValidationMessages.ASSET_MISSING_RESPONSIBILITY);
      }
      break;

    case "human":
      // role — documents the asset; not evaluated (the external entity's type is)
      if (!props?.role) {
        warn(ValidationMessages.ASSET_MISSING_ROLE);
      }
      break;

    case "process":
      // automationLevel — context for the attack feasibility rating; not evaluated yet
      if (!props?.automationLevel) {
        warn(ValidationMessages.ASSET_MISSING_AUTOMATION_LEVEL);
      }
      break;

    // function, physical: no mandatory fields — all optional by design
    case "function":
    case "physical":
      break;
  }
}