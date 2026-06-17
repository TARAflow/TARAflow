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
import {
  derivePhysicalImpact,
  deriveAggregatedImpact,
  overallImpactToBusinessLevel,
  type PhysicalImpactLevel,
} from "./asset-physical-impact-deriver";
import { applyHVAToAsset } from "./asset-hva-deriver";
import { SAFETY_CRITERION_ID } from "../models/asset-impact-types";

export interface DFDAssetSyncResult {
  assetData: AssetData;
  newAssets: string[];
  warnings: string[];
  hasChanges?: boolean;
}

/**
 * Sync DFD assets into asset data.
 * - Creates new Asset entries for DFD assets not yet in the list.
 * - Updates linkedDFDElements for existing assets.
 * - Warns about DFD assets no longer found.
 */

// ==================== IMPACT DERIVATION HELPER ====================

// ==================== LINKED-ELEMENT COMPARISON ====================
// Structural equality for DFDElementLink lists. Array order is significant
// (it mirrors source ordering); object key order is NOT. An absent field and an
// explicit `undefined` compare equal, so links freshly built by the mapper
// (which sets qualifier/notes/safety to undefined) match persisted links that
// simply omit those keys.

function safetyEqual(
  a: DFDElementLink["safety"],
  b: DFDElementLink["safety"],
): boolean {
  if (a === b) return true; // both undefined, or same reference
  if (!a || !b) return false; // exactly one set
  return (
    a.relevance === b.relevance &&
    a.impact === b.impact &&
    a.protectionTarget === b.protectionTarget
  );
}

function linkEqual(a: DFDElementLink, b: DFDElementLink): boolean {
  return (
    a.elementId === b.elementId &&
    a.elementName === b.elementName &&
    a.elementType === b.elementType &&
    a.displayId === b.displayId &&
    a.relationType === b.relationType &&
    a.qualifier === b.qualifier &&
    a.notes === b.notes &&
    safetyEqual(a.safety, b.safety)
  );
}

function linkedElementsEqual(
  a: DFDElementLink[],
  b: DFDElementLink[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((link, i) => linkEqual(link, b[i]));
}

/**
 * Derive physicalImpact and aggregatedImpact for an asset after sync.
 * Uses fresh linkedDFDElements for physicalImpact derivation.
 * Respects manual overrides on physicalImpact.
 */
function deriveAndApplyImpacts(asset: Asset, linkedDFDElements: DFDElementLink[]): Asset {
  // Step 1 — physicalImpact from SafetyAnnotations (severity-based)
  let physicalLevel: PhysicalImpactLevel | undefined;
  let physicalDirect: boolean;

  if (asset.physicalImpactSource === "manual" && asset.physicalImpact) {
    physicalLevel = asset.physicalImpact as PhysicalImpactLevel;
    physicalDirect =
      physicalLevel === "fatality" || physicalLevel === "irreversible_injury";
  } else {
    const derived = derivePhysicalImpact(linkedDFDElements);
    physicalLevel = derived.level; // undefined if no safety annotations
    physicalDirect = linkedDFDElements.some(
      (l) =>
        l.safety?.relevance === "direct" &&
        (l.safety.impact === "fatality" || l.safety.impact === "irreversible_injury"),
    );
  }

  // Step 2 — aggregatedImpact (undefined physicalLevel → purely business-driven)
  const businessLevel = overallImpactToBusinessLevel(asset.overallImpact);
  const aggregated = deriveAggregatedImpact(
    physicalLevel,
    physicalDirect,
    businessLevel,
    asset.properties?.isHighValueAsset,
    asset.properties?.assetDestructionImpact,
  );

  return {
    ...asset,
    physicalImpact: physicalLevel,
    physicalImpactSource: asset.physicalImpactSource === "manual" ? "manual" : "derived",
    aggregatedImpact: aggregated,
    linkedDFDElements,
  };
}

export function syncFromDFD(
  assetData: AssetData,
  dfdAssets: AssetDFDAsset[],
  _dfdElements: AssetDFDElement[], // reserved for future graph traversal
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
        ...createEmptyAsset(
          dfdAsset.id,
          assetData.configuration,
          dfdAsset.assetGroup,
        ),
        name: dfdAsset.name ?? dfdAsset.id,
        assetGroup: dfdAsset.assetGroup ?? "data",
        source: "dfd",
        syncedWithDFD: true,
        linkedDFDElements,
        properties: {
          description: dfdAsset.description ?? "",
          protectionNeed: dfdAsset.protectionNeed,
        },
      };
      updatedAssets = [...updatedAssets, newAsset];
      newAssetIds.push(dfdAsset.id);
    } else {
      // Update existing — preserve all analyst-set fields, only refresh links
      const existing = updatedAssets[existingIndex];

      // Check if anything actually changed before updating
      const newName = dfdAsset.name ?? existing.name;
      const newGroup = dfdAsset.assetGroup ?? existing.assetGroup;
      const nameChanged = newName !== existing.name;
      const groupChanged = newGroup !== existing.assetGroup;
      // Structural compare — order-insensitive on object keys (array order stays
      // significant). Replaces a JSON.stringify diff that flagged unchanged links
      // as changed whenever the persisted key order differed from the mapper's,
      // producing spurious updates (and hasChanges) on every re-sync.
      const linkedChanged = !linkedElementsEqual(
        linkedDFDElements,
        existing.linkedDFDElements,
      );

      if (!nameChanged && !groupChanged && !linkedChanged) {
        // Nothing changed — keep existing asset reference unchanged
        continue;
      }

      const updated: Asset = {
        ...existing,
        name: newName,
        syncedWithDFD: true,
        linkedDFDElements,
        assetGroup: newGroup,
        properties: {
          ...existing.properties,
          description:
            existing.properties?.description ?? dfdAsset.description ?? "",
          protectionNeed:
            dfdAsset.protectionNeed ?? existing.properties?.protectionNeed,
        },
        overallImpact: calculateOverallImpact(
          existing.impactRatings,
          assetData.configuration.calculationMethod,
          assetData.configuration.roundingMethod,
          assetData.configuration.impactCriteria,
        ),
        lastModified: new Date().toISOString(),
      };
      const withPhysical = deriveAndApplyImpacts(updated, linkedDFDElements);
      updatedAssets = updatedAssets.map((a, i) =>
        i === existingIndex ? withPhysical : a,
      );
    }
  }

  // Warn about DFD-sourced assets no longer present in DFD
  const dfdAssetIds = new Set(dfdAssets.map((a) => a.id));
  const removedAssets = updatedAssets.filter(
    (a) => a.source === "dfd" && !dfdAssetIds.has(a.id),
  );
  if (removedAssets.length > 0) {
    updatedAssets = updatedAssets.filter(
      (a) => !(a.source === "dfd" && !dfdAssetIds.has(a.id)),
    );
    removedAssets.forEach((a) =>
      warnings.push(`Asset ${a.id} (${a.name}) removed — no longer in DFD`),
    );
  }

  // Auto-add safety criterion when safety annotations are found in DFD
  const hasSafetyAnnotations = updatedAssets.some((a) =>
    a.linkedDFDElements.some((l) => l.safety && l.safety.relevance !== "none"),
  );
  const alreadyHasSafety = assetData.configuration.impactCriteria.some(
    (c) => c.id === SAFETY_CRITERION_ID,
  );
  const updatedConfiguration =
    hasSafetyAnnotations && !alreadyHasSafety
      ? {
          ...assetData.configuration,
          impactCriteria: [
            ...assetData.configuration.impactCriteria,
            { id: SAFETY_CRITERION_ID, weight: 1 },
          ],
        }
      : assetData.configuration;

  // Only bump lastModified if something actually changed
  const hasChanges =
    newAssetIds.length > 0 ||
    removedAssets.length > 0 ||
    updatedConfiguration !== assetData.configuration ||
    updatedAssets.length !== assetData.assets.length ||
    updatedAssets.some((a, i) => a !== assetData.assets[i]);

  return {
    assetData: hasChanges
      ? {
          ...assetData,
          configuration: updatedConfiguration,
          assets: updatedAssets,
          lastModified: new Date().toISOString(),
        }
      : assetData,
    newAssets: newAssetIds,
    warnings,
    hasChanges,
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