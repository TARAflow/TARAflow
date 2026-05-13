// ==================== ASSET VALIDATOR ====================
// Single Responsibility: Validate DFD asset properties

import type { DFDAsset } from "../../models/dfd-asset-types";
import { ValidationMessages } from "./validator-utils";

/**
 * Validate asset properties.
 * Called from dfd-validator.ts.
 */
export function validateAssetProperties(
  assets: DFDAsset[],
  warnings: string[],
): void {
  for (const asset of assets) {
    validateAssetBase(asset, warnings);
    validateAssetGroupProperties(asset, warnings);
  }
}

// ---------------------------------------------------------------------------
// Base validation — applies to all asset groups
// ---------------------------------------------------------------------------

function validateAssetBase(asset: DFDAsset, warnings: string[]): void {
  const displayId = asset.displayId ?? asset.name;

  if (!asset.name || asset.name.trim() === "") {
    warnings.push(
      `${ValidationMessages.ASSET_MISSING_NAME}|${displayId}|${asset.assetGroup}`,
    );
  }

  if (!asset.protectionNeed) {
    warnings.push(
      `${ValidationMessages.ASSET_MISSING_PROTECTION_NEED}|${displayId}|${asset.assetGroup}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Per-group property validation
// ---------------------------------------------------------------------------

function validateAssetGroupProperties(
  asset: DFDAsset,
  warnings: string[],
): void {
  const props = asset.properties;
  const displayId = asset.displayId ?? asset.name;

  function warn(key: string): void {
    warnings.push(`${key}|${displayId}|${asset.assetGroup}`);
  }

  switch (asset.assetGroup) {
    case "data":
      // dataType — required for Information Disclosure / Tampering threat selection
      if (!props?.dataType || props.dataType.length === 0) {
        warn(ValidationMessages.ASSET_MISSING_DATA_TYPE);
      }
      // lifecycle — required for retention/deletion threat scenarios
      if (!props?.lifecycle) {
        warn(ValidationMessages.ASSET_MISSING_LIFECYCLE);
      }
      break;

    case "system":
      // criticality — required for threat prioritisation
      if (!props?.criticality) {
        warn(ValidationMessages.ASSET_MISSING_CRITICALITY);
      }
      // exposure — required for attack surface assessment
      if (!props?.exposure) {
        warn(ValidationMessages.ASSET_MISSING_EXPOSURE);
      }
      break;

    case "infrastructure":
      // physicalAccessControl — replaces physicalAccessPossible + isPhysicalBarrier
      if (!props?.physicalAccessControl) {
        warn(ValidationMessages.ASSET_MISSING_PHYSICAL_ACCESS);
      }
      break;

    case "service":
      // serviceType — required for supply chain threat assessment
      if (!props?.serviceType) {
        warn(ValidationMessages.ASSET_MISSING_SERVICE_TYPE);
      }
      // responsibility — required for CRA Art. 13 supply chain obligations
      if (!props?.responsibility) {
        warn(ValidationMessages.ASSET_MISSING_RESPONSIBILITY);
      }
      break;

    case "human":
      // role — required for privilege escalation / insider threat scenarios
      if (!props?.role) {
        warn(ValidationMessages.ASSET_MISSING_ROLE);
      }
      break;

    case "process":
      // automationLevel — replaces boolean automated, affects DoS/Tampering impact
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