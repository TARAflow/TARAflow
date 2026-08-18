// src/tests/unit/app/utils/dfd-to-asset-mapper.test.ts
//
// Regression coverage for the bug where a SafetyAnnotation set via the
// Asset Relation Selector never reached Asset.physicalImpact /
// aggregatedImpact — traced to two lossy mirrors between
// element.assetRelations (the real source) and Asset.linkedDFDElements.
// This mapper is the first of those two hops; see
// asset-sync-service.safety.test.ts for the second.

import { describe, it, expect } from "vitest";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import type { DFDAsset, DFDElement, DFDConnection } from "features/dfd";

function makeAsset(overrides: Partial<DFDAsset> = {}): DFDAsset {
  return {
    id: "DA-001",
    displayId: "DA-001",
    name: "Meassure Data",
    assetGroup: "data",
    protectionNeed: "low",
    ...overrides,
  } as DFDAsset;
}

function makeElement(overrides: Partial<DFDElement> = {}): DFDElement {
  return {
    id: "el-1",
    displayId: "P-4",
    name: "Cloud Synchronization",
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
    id: "df-1",
    displayId: "DF-19",
    name: "push sync measure data",
    from: "el-1",
    to: "el-2",
    assetRelations: [],
    ...overrides,
  } as DFDConnection;
}

describe("mapDFDAssetsToAssetFeature", () => {
  it("carries safety through from an element's assetRelations", () => {
    const element = makeElement({
      assetRelations: [
        {
          assetId: "DA-001",
          assetGroup: "data",
          relationType: "reads",
          safety: {
            relevance: "direct",
            impact: "fatality",
            physicalHazardPotential: "high",
            rationale: "test fixture",
          },
        } as any,
      ],
    });

    const result = mapDFDAssetsToAssetFeature([makeAsset()], [element], []);

    expect(result).toHaveLength(1);
    const link = result[0].linkedElements?.find((l) => l.displayId === "P-4");
    expect(link?.safety).toEqual({
      relevance: "direct",
      impact: "fatality",
      physicalHazardPotential: "high",
      rationale: "test fixture",
    });
  });

  it("carries safety through from a connection's assetRelations", () => {
    const connection = makeConnection({
      assetRelations: [
        {
          assetId: "DA-001",
          assetGroup: "data",
          relationType: "transports",
          safety: { relevance: "indirect", impact: "reversible_injury" },
        } as any,
      ],
    });

    const result = mapDFDAssetsToAssetFeature([makeAsset()], [], [connection]);

    const link = result[0].linkedElements?.find((l) => l.displayId === "DF-19");
    expect(link?.safety?.relevance).toBe("indirect");
    expect(link?.elementType).toBe("DataFlow");
  });

  it("omits safety when a relation has none, rather than fabricating a default", () => {
    const element = makeElement({
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "stores" } as any,
      ],
    });

    const result = mapDFDAssetsToAssetFeature([makeAsset()], [element], []);
    const link = result[0].linkedElements?.find((l) => l.relationType === "stores");
    expect(link?.safety).toBeUndefined();
  });

  it("does not read DFDAsset.linkedElements at all — only assetRelations count", () => {
    // Even if the (now-unused, stale) mirror carries something, it must be
    // ignored. Regression guard for the exact bug: a stale/lossy
    // DFDAsset.linkedElements silently shadowing the real source.
    const staleAsset = makeAsset({
      linkedElements: [
        {
          elementId: "ghost",
          elementName: "Ghost Element",
          elementType: "Process",
          displayId: "P-999",
          relationType: "reads",
        },
      ],
    } as any);
    const element = makeElement({
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "reads" } as any,
      ],
    });

    const result = mapDFDAssetsToAssetFeature([staleAsset], [element], []);

    expect(result[0].linkedElements).toHaveLength(1);
    expect(result[0].linkedElements?.[0].displayId).toBe("P-4"); // not P-999
  });

  it("reads protectionNeed from the canonical top-level field, not properties.protectionNeed", () => {
    const asset = makeAsset({
      protectionNeed: "high",
      properties: { protectionNeed: "low" } as any, // stale mirror, must be ignored
    });

    const result = mapDFDAssetsToAssetFeature([asset], [], []);
    expect(result[0].protectionNeed).toBe("high");
  });

  it("isolates links per asset — a relation to asset A never leaks into asset B's linkedElements", () => {
    const element = makeElement({
      assetRelations: [
        { assetId: "DA-001", assetGroup: "data", relationType: "reads" } as any,
        { assetId: "DA-002", assetGroup: "data", relationType: "stores" } as any,
      ],
    });

    const result = mapDFDAssetsToAssetFeature(
      [makeAsset({ id: "DA-001" }), makeAsset({ id: "DA-002", displayId: "DA-002" })],
      [element],
      [],
    );

    const a1 = result.find((r) => r.id === "DA-001");
    const a2 = result.find((r) => r.id === "DA-002");
    expect(a1?.linkedElements).toHaveLength(1);
    expect(a1?.linkedElements?.[0].relationType).toBe("reads");
    expect(a2?.linkedElements).toHaveLength(1);
    expect(a2?.linkedElements?.[0].relationType).toBe("stores");
  });
});
