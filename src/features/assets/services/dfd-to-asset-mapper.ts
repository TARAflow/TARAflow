// ==================== DFD-TO-ASSET MAPPER ====================
// features/assets/services/dfd-to-asset-mapper.ts
//
// Projects DFDData (DFD module model) into read-only reference types
// consumed by the Asset Tab.
//
// Responsibilities:
//   1. DFDAsset[]     → DFDAssetReference[]     (with safety projection)
//   2. DFDElement[]   → DFDElementReference[]
//   3. DFDConnection[] → DFDConnectionReference[]
//
// Single Source of Truth: linkedElements are rebuilt from element.assetRelations,
// NOT from DFDAsset.linkedElements — this ensures safety data is always current.
//
// Relation to dfd-service.syncAssetLinkedElements:
//   That method keeps DFDAsset.linkedElements consistent within the DFD module.
//   This mapper is a separate read-only projection for the Asset Tab.

import type {
  DFDAssetReference,
  DFDElementReference,
  DFDConnectionReference,
  DFDElementLink,
  SafetyAnnotationSummary,
} from "../models/dfd-reference-types";

import type {
  DFDData,
  DFDElement,
  DFDConnection,
} from "../../dfd/models/dfd-types";

import type { AssetRelation } from "../../dfd/models/asset-relation-types";
import type { SafetyAnnotation } from "../../dfd/models/safety-types";

import {
  isSystemUsesRelation,
  isInfraAccessesRelation,
} from "../../dfd/models/asset-relation-types";

// ==================== RESULT TYPE ====================

export interface DFDMappingResult {
  assetReferences: DFDAssetReference[];
  elementReferences: DFDElementReference[];
  connectionReferences: DFDConnectionReference[];
}

// ==================== SAFETY PROJECTION ====================

/**
 * Project SafetyAnnotation (DFD model) → SafetyAnnotationSummary (Asset model).
 * Drops fields not needed for impact derivation (physicalHazardPotential,
 * affectedSafetyFunctions, rationale — these stay in the DFD layer).
 */
function projectSafety(
  safety: SafetyAnnotation | undefined,
): SafetyAnnotationSummary | undefined {
  if (!safety || safety.relevance === "none") return undefined;

  return {
    relevance: safety.relevance,
    impact: safety.impact,
    protectionTarget: safety.protectionTarget,
  };
}

// ==================== LINK BUILDER ====================

/**
 * Extract a qualifier from a relation (uses / accesses variants only).
 */
function extractQualifier(relation: AssetRelation): string | undefined {
  if (isSystemUsesRelation(relation)) return relation.qualifier;
  if (isInfraAccessesRelation(relation)) return relation.qualifier;
  return undefined;
}

/**
 * Build a DFDElementLink from an element + one of its assetRelations.
 * Used to populate DFDAssetReference.linkedElements.
 */
function buildElementLink(
  elementId: string,
  elementName: string,
  elementType: string,
  displayId: string,
  relation: AssetRelation,
): DFDElementLink {
  return {
    elementId,
    elementName,
    elementType,
    displayId,
    relationType: relation.relationType,
    qualifier: extractQualifier(relation),
    notes: relation.notes,
    safety: projectSafety(relation.safety),
  };
}

// ==================== CORE MAPPER ====================

/**
 * Map DFDData → DFDMappingResult.
 *
 * Builds all three reference arrays in a single pass over elements and
 * connections. Safe to call on every DFD change — pure function, no side
 * effects.
 */
export function mapDFDToAssetReferences(dfd: DFDData): DFDMappingResult {
  // ── Build: assetId → DFDElementLink[] ─────────────────────────
  // Iterate elements + connections, collect one link per relation.
  const linksByAssetId = new Map<string, DFDElementLink[]>();

  function addLink(assetId: string, link: DFDElementLink): void {
    const existing = linksByAssetId.get(assetId) ?? [];
    linksByAssetId.set(assetId, [...existing, link]);
  }

  for (const element of dfd.elements) {
    if (!element.assetRelations?.length) continue;

    for (const relation of element.assetRelations) {
      addLink(
        relation.assetId,
        buildElementLink(
          element.id,
          element.name,
          element.type,
          element.displayId,
          relation,
        ),
      );
    }
  }

  for (const connection of dfd.connections) {
    if (!connection.assetRelations?.length) continue;

    for (const relation of connection.assetRelations) {
      addLink(
        relation.assetId,
        buildElementLink(
          connection.id,
          connection.name ?? "Unnamed DataFlow",
          "DataFlow",
          connection.displayId,
          relation,
        ),
      );
    }
  }

  // ── Project: DFDAsset[] → DFDAssetReference[] ─────────────────
  const assetReferences: DFDAssetReference[] = dfd.assets.map((asset) => ({
    id: asset.id,
    displayId: asset.displayId,
    name: asset.name,
    description: asset.description,
    assetGroup: asset.assetGroup,
    protectionNeed: asset.properties?.protectionNeed,
    linkedElements: linksByAssetId.get(asset.id) ?? [],
  }));

  // ── Project: DFDElement[] → DFDElementReference[] ─────────────
  const elementReferences: DFDElementReference[] = dfd.elements.map(
    (element) => ({
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
    }),
  );

  // ── Project: DFDConnection[] → DFDConnectionReference[] ───────
  const connectionReferences: DFDConnectionReference[] = dfd.connections.map(
    (connection) => ({
      id: connection.id,
      from: connection.from,
      to: connection.to,
      name: connection.name,
      displayId: connection.displayId,
      assetRelations: connection.assetRelations?.map((relation) => ({
        assetId: relation.assetId,
        assetGroup: relation.assetGroup,
        relationType: relation.relationType,
        qualifier: extractQualifier(relation),
        notes: relation.notes,
      })),
    }),
  );

  return { assetReferences, elementReferences, connectionReferences };
}

// ==================== INCREMENTAL HELPERS ====================

/**
 * Remap asset references for a single changed element.
 * Useful when only one element's assetRelations changed — avoids full remap.
 *
 * Returns updated assetReferences with links for the affected assets patched.
 * All other asset references are returned unchanged (same object references).
 */
export function remapElementLinks(
  existing: DFDAssetReference[],
  changedElement: DFDElement | DFDConnection,
  allElements: DFDElement[],
  allConnections: DFDConnection[],
): DFDAssetReference[] {
  // Determine which asset IDs are affected by the changed element
  const affectedAssetIds = new Set<string>(
    changedElement.assetRelations?.map((r) => r.assetId) ?? [],
  );

  // Also include asset IDs that had the element linked before (removals)
  for (const ref of existing) {
    const wasLinked = ref.linkedElements?.some(
      (l) => l.elementId === changedElement.id,
    );
    if (wasLinked) affectedAssetIds.add(ref.id);
  }

  if (affectedAssetIds.size === 0) return existing;

  // Rebuild links only for affected assets
  const isConnection = "from" in changedElement;
  const elementName = isConnection
    ? (changedElement as DFDConnection).name ?? "Unnamed DataFlow"
    : (changedElement as DFDElement).name;
  const elementType = isConnection ? "DataFlow" : (changedElement as DFDElement).type;

  // New links contributed by the changed element
  const newLinksByAssetId = new Map<string, DFDElementLink>();
  for (const relation of changedElement.assetRelations ?? []) {
    newLinksByAssetId.set(
      relation.assetId,
      buildElementLink(
        changedElement.id,
        elementName,
        elementType,
        changedElement.displayId,
        relation,
      ),
    );
  }

  return existing.map((ref) => {
    if (!affectedAssetIds.has(ref.id)) return ref;

    // Remove stale links from this element, add fresh link if still present
    const filteredLinks = (ref.linkedElements ?? []).filter(
      (l) => l.elementId !== changedElement.id,
    );
    const newLink = newLinksByAssetId.get(ref.id);
    const updatedLinks = newLink
      ? [...filteredLinks, newLink]
      : filteredLinks;

    return { ...ref, linkedElements: updatedLinks };
  });
}