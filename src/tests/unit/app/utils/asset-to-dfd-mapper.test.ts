// src/tests/unit/app/utils/asset-to-dfd-mapper.test.ts
//
// Step 2.1 of the asset-store consolidation: deriveDfdAssets reconstructs
// the DFDAsset[] shape from the canonical feature store (project.assets) +
// the diagram, so DFDData.assets can stop being a stored second store.
//
// It is the inverse of mapDFDAssetsToAssetFeature. linkedElements must be
// DERIVED from element/connection.assetRelations (the source of truth), not
// read back from any stored mirror.

import { describe, it, expect } from "vitest";
import { deriveDfdAssets } from "app/utils/asset-to-dfd-mapper";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import type { DFDElement, DFDConnection } from "features/dfd";
import type { Asset } from "features/assets";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "DA-001",
    numericId: 1,
    name: "Config Data",
    assetGroup: "data",
    impactRatings: [],
    overallImpact: 0,
    securityGoals: [],
    linkedDFDElements: [],
    source: "dfd",
    syncedWithDFD: true,
    properties: {},
    ...overrides,
  } as Asset;
}

function makeElement(overrides: Partial<DFDElement> = {}): DFDElement {
  return {
    id: "3",
    displayId: "P-1",
    name: "MyProcess",
    type: "Process",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 60 },
    properties: {},
    assetRelations: [],
    ...overrides,
  } as DFDElement;
}

function makeConnection(overrides: Partial<DFDConnection> = {}): DFDConnection {
  return {
    id: "c-1",
    displayId: "DF-1",
    name: "USB",
    source: "3",
    target: "5",
    properties: {},
    assetRelations: [],
    ...overrides,
  } as DFDConnection;
}

describe("deriveDfdAssets — feature store → DFDAsset[] bridge", () => {
  it("maps the core fields, using the feature id as displayId", () => {
    const assets = [
      makeAsset({
        id: "SY-001",
        name: "Data Service",
        assetGroup: "system",
        properties: { description: "the service", protectionNeed: "high" },
      }),
    ];

    const [dfdAsset] = deriveDfdAssets(assets, [], []);

    expect(dfdAsset.id).toBe("SY-001");
    expect(dfdAsset.displayId).toBe("SY-001");
    expect(dfdAsset.name).toBe("Data Service");
    expect(dfdAsset.assetGroup).toBe("system");
    expect(dfdAsset.description).toBe("the service");
    expect(dfdAsset.protectionNeed).toBe("high");
  });

  it("leaves description/protectionNeed undefined when the feature asset has none", () => {
    const [dfdAsset] = deriveDfdAssets([makeAsset({ properties: {} })], [], []);
    expect(dfdAsset.description).toBeUndefined();
    expect(dfdAsset.protectionNeed).toBeUndefined();
  });

  it("derives linkedElements from element.assetRelations (is_an included)", () => {
    const flash = makeElement({
      id: "11",
      name: "Flash",
      displayId: "DS-1",
      type: "DataStore",
      assetRelations: [
        { assetId: "SY-001", assetGroup: "system", relationType: "is_an" },
      ],
    });

    const [dfdAsset] = deriveDfdAssets(
      [makeAsset({ id: "SY-001", assetGroup: "system" })],
      [flash],
      [],
    );

    expect(dfdAsset.linkedElements).toHaveLength(1);
    expect(dfdAsset.linkedElements![0]).toMatchObject({
      elementId: "11",
      elementName: "Flash",
      elementType: "DataStore",
      relationType: "is_an",
    });
  });

  it("derives linkedElements from connection.assetRelations as DataFlow links", () => {
    const conn = makeConnection({
      id: "c-9",
      displayId: "DF-9",
      name: "telemetry",
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "transports" },
      ],
    });

    const [dfdAsset] = deriveDfdAssets([makeAsset({ id: "DA-001" })], [], [conn]);

    expect(dfdAsset.linkedElements).toHaveLength(1);
    expect(dfdAsset.linkedElements![0]).toMatchObject({
      elementId: "c-9",
      elementType: "DataFlow",
      relationType: "transports",
    });
  });

  it("gives an unreferenced asset an empty linkedElements array", () => {
    const [dfdAsset] = deriveDfdAssets([makeAsset({ id: "DA-999" })], [], []);
    expect(dfdAsset.linkedElements).toEqual([]);
  });

  it("aggregates multiple relations (creates + modifies) onto one asset", () => {
    const proc = makeElement({
      id: "3",
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "creates" },
        { assetId: "DA-001", assetGroup: "data", relationType: "modifies" },
      ],
    });

    const [dfdAsset] = deriveDfdAssets([makeAsset({ id: "DA-001" })], [proc], []);
    expect(dfdAsset.linkedElements).toHaveLength(2);
    expect(dfdAsset.linkedElements!.map((l) => l.relationType)).toEqual([
      "creates",
      "modifies",
    ]);
  });

  it("round-trips link count with the forward mapper (derive → map preserves links)", () => {
    const proc = makeElement({
      id: "3",
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "creates" },
      ],
    });
    const assets = [makeAsset({ id: "DA-001" })];

    const dfdAssets = deriveDfdAssets(assets, [proc], []);
    const refs = mapDFDAssetsToAssetFeature(dfdAssets, [proc], []);

    const ref = refs.find((r) => r.id === "DA-001");
    expect(ref?.linkedElements).toHaveLength(1);
    expect(ref?.linkedElements?.[0]).toMatchObject({
      elementId: "3",
      relationType: "creates",
    });
  });
});
