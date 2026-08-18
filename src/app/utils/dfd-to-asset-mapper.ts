// ==================== DFD TO ASSET MAPPER ====================
// app/utils/dfd-to-asset-mapper.ts
//
// Projects DFD data (DFD module model) into read-only reference types
// consumed by the Asset Tab / asset-sync-service.
//
// linkedElements source of truth (FIXED):
//   Previously built from DFDAsset.linkedElements — a mirror maintained by
//   dfd-service.syncAssetLinkedElements. That mirror does not carry
//   `safety`, so a SafetyAnnotation set via the Asset Relation Selector
//   never reached Asset.physicalImpact / aggregatedImpact — confirmed
//   against a real project: element.assetRelations[].safety was present,
//   DFDAsset.linkedElements[].safety was already gone one hop earlier.
//
//   Fixed by rebuilding linkedElements directly from
//   element.assetRelations / connection.assetRelations on every call —
//   the actual source of truth, never stale, always carries safety.
//   (This mirrors the approach the now-superseded
//   features/assets/services/dfd-to-asset-mapper.ts took — that file can
//   be deleted once this one is wired in everywhere.)

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
  AssetRelation,
} from "features/dfd";
import type {
  DFDAssetReference,
  DFDElementReference,
  DFDConnectionReference,
  DFDElementLink,
} from "features/assets";
import { isSystemUsesRelation, isInfraAccessesRelation } from "features/dfd";

function extractQualifier(relation: AssetRelation): string | undefined {
  // Qualifier only exists on uses (System) and accesses (Infra) relations
  if (isSystemUsesRelation(relation)) return relation.qualifier;
  if (isInfraAccessesRelation(relation)) return relation.qualifier;
  return undefined;
}

/**
 * Map DFD Assets to Asset Feature references.
 *
 * `elements`/`connections` are REQUIRED (not optional) — linkedElements is
 * rebuilt from their assetRelations, not from DFDAsset.linkedElements. Pass
 * `[]` explicitly if a caller genuinely has none (e.g. a DFD with only
 * assets and no diagram yet) rather than omitting the arguments, so it's
 * clear at the call site that this was a deliberate choice, not an
 * oversight — the omission of exactly this data is what caused the bug
 * this rewrite fixes.
 */
export function mapDFDAssetsToAssetFeature(
  dfdAssets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
): DFDAssetReference[] {
  const linksByAssetId = new Map<string, DFDElementLink[]>();

  const addLink = (assetId: string, link: DFDElementLink): void => {
    const existing = linksByAssetId.get(assetId) ?? [];
    linksByAssetId.set(assetId, [...existing, link]);
  };

  for (const element of elements) {
    for (const relation of element.assetRelations ?? []) {
      addLink(relation.assetId, {
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        displayId: element.displayId,
        relationType: relation.relationType,
        qualifier: extractQualifier(relation),
        notes: relation.notes,
        safety: relation.safety,
      });
    }
  }

  for (const connection of connections) {
    for (const relation of connection.assetRelations ?? []) {
      addLink(relation.assetId, {
        elementId: connection.id,
        elementName: connection.name ?? "Unnamed DataFlow",
        elementType: "DataFlow",
        displayId: connection.displayId,
        relationType: relation.relationType,
        qualifier: extractQualifier(relation),
        notes: relation.notes,
        safety: relation.safety,
      });
    }
  }

  return dfdAssets.map((asset) => ({
    id: asset.id,
    displayId: asset.displayId,
    name: asset.name,
    description: asset.description,
    assetGroup: asset.assetGroup,
    // Canonical field — DFDAsset.protectionNeed, NOT the
    // AssetProperties.protectionNeed mirror (see safety-types.ts comment:
    // "Mirror of DFDAsset.protectionNeed — canonical value on DFDAsset").
    protectionNeed: asset.protectionNeed,
    linkedElements: linksByAssetId.get(asset.id) ?? [],
  }));
}

/**
 * Map DFD Elements to Asset Feature references.
 * Unchanged from the previous version — element.assetRelations was already
 * read directly here, never through a mirror.
 */
export function mapDFDElementsToAssetFeature(
  dfdElements: DFDElement[],
): DFDElementReference[] {
  return dfdElements.map((element) => ({
    id: element.id,
    type: element.type,
    name: element.name,
    displayId: element.displayId,

    assetRelations: element.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      assetGroup: relation.assetGroup,
      relationType: relation.relationType,
      qualifier: extractQualifier(relation),
      notes: relation.notes,
    })),
  }));
}

/**
 * Map DFD Connections to Asset Feature references.
 * Unchanged from the previous version.
 */
export function mapDFDConnectionsToAssetFeature(
  dfdConnections: DFDConnection[],
): DFDConnectionReference[] {
  return dfdConnections.map((conn) => ({
    id: conn.id,
    from: conn.from,
    to: conn.to,
    name: conn.name,
    displayId: conn.displayId,

    assetRelations: conn.assetRelations?.map((relation) => ({
      assetId: relation.assetId,
      assetGroup: relation.assetGroup,
      relationType: relation.relationType,
      qualifier: extractQualifier(relation),
      notes: relation.notes,
    })),
  }));
}
