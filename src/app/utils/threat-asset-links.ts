// src/app/utils/threat-asset-links.ts
//
// Which assets a threat is linked to. One rule for every consumer — the risk
// register (extractThreatReferences in workspace-layout) and the threat ↔ goal
// cross-checks of the asset tab:
//
//   1. the threat's own linkedAssetIds, when it has any;
//   2. otherwise the assets linked to its anchor element — the element of a
//      per-element threat, the data flow of a per-interaction threat (falling
//      back to its source element). An element is linked to an asset through
//      the asset's linkedDFDElements or an "is_an" asset relation on the
//      DFD element.
//
// Pure. Lives in app/utils because it reads the threat, asset and DFD stores.

interface AssetLinks {
  id: string;
  linkedDFDElements?: { elementId: string }[];
}

interface DfdElementLinks {
  id: string;
  assetRelations?: { assetId: string; relationType: string }[];
}

/** Anchor element id → linked asset ids. */
export function buildElementToAssetIds(
  assets: readonly AssetLinks[] | undefined,
  dfdElements: readonly DfdElementLinks[] | undefined,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (elementId: string, assetId: string) => {
    const ids = map.get(elementId) ?? [];
    if (!ids.includes(assetId)) ids.push(assetId);
    map.set(elementId, ids);
  };
  for (const asset of assets ?? []) {
    for (const el of asset.linkedDFDElements ?? []) add(el.elementId, asset.id);
  }
  for (const el of dfdElements ?? []) {
    for (const rel of el.assetRelations ?? []) {
      if (rel.relationType === "is_an") add(el.id, rel.assetId);
    }
  }
  return map;
}

interface ThreatAnchor {
  linkedAssetIds?: string[];
  linkedElement?: { elementId?: string } | null;
  dataFlow?: { connectionId?: string; fromElementId?: string } | null;
}

/** The threat's anchor element: element, else data flow, else its source. */
export function threatAnchorElementId(threat: ThreatAnchor): string | undefined {
  return (
    threat.linkedElement?.elementId ??
    threat.dataFlow?.connectionId ??
    threat.dataFlow?.fromElementId
  );
}

export function resolveThreatAssetIds(
  threat: ThreatAnchor,
  elementToAssetIds: Map<string, string[]>,
): string[] {
  if ((threat.linkedAssetIds?.length ?? 0) > 0) return threat.linkedAssetIds!;
  const elementId = threatAnchorElementId(threat);
  return elementId ? (elementToAssetIds.get(elementId) ?? []) : [];
}
