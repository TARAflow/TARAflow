import { AssetData } from "features/assets";

export function mockAssetData(overrides?: Partial<AssetData>): AssetData {
  return {
    configuration: {} as any,
    assets: [],
    lastModified: new Date().toISOString(),
    ...overrides,
  };
}