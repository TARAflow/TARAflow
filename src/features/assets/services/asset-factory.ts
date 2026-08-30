// ==================== ASSET FACTORY ====================
// Pure factory functions for creating and renumbering Asset objects.
// No business logic, no side effects.

import type { AssetGroup } from "shared";
import type { Asset, AssetConfiguration, AssetData } from "../models/asset-types";
import { DEFAULT_ASSET_CONFIGURATION } from "../models/asset-types";
import { SECURITY_GOALS } from "../models/asset-security-goals-types";

// ==================== ID HELPERS ====================

export function parseAssetId(id: string): number {
  const match = id.match(/A-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function generateNextAssetId(existingAssets: Asset[]): string {
  if (existingAssets.length === 0) return "A-01";

  const maxNumeric = Math.max(...existingAssets.map((a) => a.numericId));
  const nextNumeric = maxNumeric + 1;

  const existingId = existingAssets[0]?.id || "A-01";
  const match = existingId.match(/A-(\d+)/);
  const padding = match ? match[1].length : 2;

  return `A-${String(nextNumeric).padStart(padding, "0")}`;
}

export function renumberAssets(assets: Asset[]): Asset[] {
  return assets
    .sort((a, b) => a.numericId - b.numericId)
    .map((asset, index) => {
      const newNumericId = index + 1;
      const padding = String(assets.length).length;
      const newId = `A-${String(newNumericId).padStart(Math.max(padding, 2), "0")}`;
      return { ...asset, id: newId, numericId: newNumericId };
    });
}

/**
 * Create empty asset with defaults.
 *
 * Security goals are initialized with level: "none" (was: enabled: false).
 * They will be populated by the CIANAAA deriver once the analyst completes
 * the impact assessment and selects Cause Mechanisms.
 */
export function createEmptyAsset(
  id: string,
  configuration: AssetConfiguration,
  assetGroup: AssetGroup = "data",
  displayId: string = id,
): Asset {
  // numericId sorts/renumbers by the readable label, not the (opaque UUID) id.
  const numericId = parseAssetId(displayId);

  return {
    id,
    displayId,
    numericId,
    name: "",
    assetGroup,
    impactRatings: configuration.impactCriteria.map((criterion) => ({
      criterionId: criterion.id,
      value: null,
    })),
    overallImpact: 0,
    securityGoals: SECURITY_GOALS.map((sg) => ({
      type: sg.type,
      level: "none", // was: enabled: false
      formalDescription: "",
    })),
    linkedDFDElements: [],
    source: "manual",
    syncedWithDFD: false,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}



export function createDefaultAssetData(): AssetData {
  return {
    configuration: { ...DEFAULT_ASSET_CONFIGURATION },
    assets: [],
    lastModified: new Date().toISOString(),
  };
}