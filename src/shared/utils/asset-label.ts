// ==================== ASSET LABEL ====================
// How an asset is named wherever it appears outside the Asset tab:
// "DA-005: sensor firmware". The display id is what the analyst uses to find
// the asset; the name alone is ambiguous. Name only when there is no id.

export function formatAssetLabel(asset: { displayId?: string; name: string }): string {
  return asset.displayId ? `${asset.displayId}: ${asset.name}` : asset.name;
}
