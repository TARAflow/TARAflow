// dfdToAsset.mapper.ts
import type { DFDAsset, DFDElement, DFDConnection } from "features/dfd";
import type { 
  AssetDFDAsset, 
  AssetDFDElement, 
  AssetDFDConnection 
} from "features/assets";

export function mapDFDAssetsToAssetFeature(dfdAssets: DFDAsset[]): AssetDFDAsset[] {
  return dfdAssets.map(asset => ({
    id: asset.id,
    displayId: asset.displayId,
    xmlIds: asset.xmlIds,
    positions: asset.positions,
    sizes: asset.sizes,
    linkedElements: asset.linkedElements,
  }));
}

export function mapDFDElementsToAssetFeature(dfdElements: DFDElement[]): AssetDFDElement[] {
  return dfdElements.map(element => ({
    id: element.id,
    type: element.type,
    name: element.name,
    displayId: element.displayId,
    linkedAssets: element.linkedAssets,
  }));
}

export function mapDFDConnectionsToAssetFeature(dfdConnections: DFDConnection[]): AssetDFDConnection[] {
  return dfdConnections.map(conn => ({
    id: conn.id,
    label: conn.label,
    displayId: conn.displayId,
    linkedAssets: conn.linkedAssets,
  }));
}
