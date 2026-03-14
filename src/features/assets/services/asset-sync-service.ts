// ==================== ASSET SYNC SERVICE ====================
// Responsible solely for synchronising DFD assets into AssetData.
// Single Responsibility: DFD → Asset mapping. No CRUD, no validation.

import type {
  Asset,
  AssetData,
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
  DFDElementLink,
} from "../models/asset-types";
import { createEmptyAsset, parseAssetId } from "./asset-factory";
import { calculateOverallImpact } from "./asset-impact-calculator";

export interface DFDAssetSyncResult {
  assetData: AssetData;
  newAssets: string[];
  warnings: string[];
}

/**
 * Sync DFD assets into asset data.
 * - Creates new Asset entries for DFD assets not yet in the list.
 * - Updates linkedDFDElements for existing assets.
 * - Warns about DFD assets no longer found.
 */
export function syncFromDFD(
  assetData: AssetData,
  dfdAssets: AssetDFDAsset[],
  _dfdElements: AssetDFDElement[],   // reserved for future graph traversal
  _dfdConnections: AssetDFDConnection[], // reserved for future graph traversal
): DFDAssetSyncResult {
  const warnings: string[] = [];
  const newAssetIds: string[] = [];
  let updatedAssets = [...assetData.assets];

  for (const dfdAsset of dfdAssets) {
    // Skip unassigned placeholder labels
    if (dfdAsset.id === "A-xx" || dfdAsset.id.includes("xx")) {
      warnings.push(`Unassigned asset label found: ${dfdAsset.id}`);
      continue;
    }

    const linkedDFDElements: DFDElementLink[] = (
      dfdAsset.linkedElements ?? []
    ).map((link) => ({
      elementId: String(link.elementId ?? ""),
      elementName: String(link.elementName ?? ""),
      elementType: String(link.elementType ?? "unknown"),
      displayId: String(link.displayId ?? ""),
      relationType: String(link.relationType ?? ""),
      qualifier: link.qualifier,
      notes: link.notes,
      // Safety context projected by dfd-to-asset-mapper — passed through unchanged
      safety: link.safety,
    }));

    const existingIndex = updatedAssets.findIndex((a) => a.id === dfdAsset.id);

    if (existingIndex === -1) {
      // New asset from DFD
      const newAsset: Asset = {
        ...createEmptyAsset(dfdAsset.id, assetData.configuration),
        name: dfdAsset.name ?? dfdAsset.id,
        source: "dfd",
        syncedWithDFD: true,
        linkedDFDElements,
        // Populate properties so asset-table can render the category
        // colour (ID chip, Type column) and HVA star without falling
        // back to the ID-prefix heuristic.
        properties: {
          description: dfdAsset.description ?? "",
          category: dfdAsset.assetGroup,
          protectionNeed: dfdAsset.protectionNeed,
          isHighValueAsset: dfdAsset.isHighValueAsset ?? false,
        },
      };
      updatedAssets = [...updatedAssets, newAsset];
      newAssetIds.push(dfdAsset.id);
    } else {
      // Update existing — preserve all analyst-set fields, only refresh links
      const existing = updatedAssets[existingIndex];
      const updated: Asset = {
        ...existing,
        name: dfdAsset.name ?? existing.name,
        syncedWithDFD: true,
        linkedDFDElements,
        // Refresh DFD-owned fields in properties — category and isHighValueAsset
        // can change in the DFD layer and must stay in sync.
        // Analyst-set fields (description, owner, notes, …) are preserved via
        // the spread of existing.properties below.
        properties: {
          ...existing.properties,
          description:
            existing.properties?.description ?? dfdAsset.description ?? "",
          category: dfdAsset.assetGroup,
          protectionNeed:
            dfdAsset.protectionNeed ?? existing.properties?.protectionNeed,
          isHighValueAsset:
            dfdAsset.isHighValueAsset ??
            existing.properties?.isHighValueAsset ??
            false,
        },
        // Recalculate impact with current config + criteria weights
        overallImpact: calculateOverallImpact(
          existing.impactRatings,
          assetData.configuration.calculationMethod,
          assetData.configuration.roundingMethod,
          assetData.configuration.impactCriteria,
        ),
        lastModified: new Date().toISOString(),
      };
      updatedAssets = updatedAssets.map((a, i) =>
        i === existingIndex ? updated : a,
      );
    }
  }

  // Warn about DFD-sourced assets no longer present in DFD
  const dfdAssetIds = new Set(dfdAssets.map((a) => a.id));
  for (const asset of updatedAssets) {
    if (asset.source === "dfd" && !dfdAssetIds.has(asset.id)) {
      warnings.push(
        `Asset ${asset.id} (${asset.name}) no longer present in DFD`,
      );
    }
  }

  return {
    assetData: {
      ...assetData,
      assets: updatedAssets,
      lastModified: new Date().toISOString(),
    },
    newAssets: newAssetIds,
    warnings,
  };
}

/**
 * Return assets that exist in AssetData but are absent from DFD.
 * Used to highlight orphaned manual assets in the UI.
 */
export function getAssetsMissingInDFD(
  assetData: AssetData,
  dfdAssets: AssetDFDAsset[],
): Asset[] {
  const dfdAssetIds = new Set(dfdAssets.map((a) => a.id));
  return assetData.assets.filter(
    (asset) => asset.source === "manual" && !dfdAssetIds.has(asset.id),
  );
}