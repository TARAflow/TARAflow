// tests/unit/features/threats/services/refresh-linked-assets.test.ts
//
// A threat's linkedAssetIds is cached at generation time. When an asset
// relation is later added on the DFD (e.g. a DataFlow gains a safety-function
// asset), the cache goes stale and the risk — which inherits linkedAssetIds
// from the threat — never sees the asset, so EN 50742 severity can't resolve.
// syncThreatsWithGraph now re-derives linkedAssetIds from the current asset
// store on every graph sync; this covers that re-derivation.

import { describe, it, expect } from "vitest";

import { refreshLinkedAssets } from "features/threats/services/sync-threats-with-graph";

// Minimal asset store: "AC" (a data asset carrying the severity) is linked to
// connection "7"; "SY" is linked to nothing relevant here.
const assetDataRef = {
  assets: [
    { id: "AC", name: "Config Data", linkedElementIds: ["3", "7"] },
    { id: "SY", name: "E-Stop", linkedElementIds: [] },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bundle = (threats: any[]): any => ({
  perElementTables: [{ threats }],
  perInteractionTables: [],
});

describe("refreshLinkedAssets — DFD asset-relation change propagates to threats", () => {
  it("a DataFlow-anchored threat gains the asset newly related to its connection", () => {
    const out = refreshLinkedAssets(
      bundle([
        {
          id: "t1",
          linkedElement: { elementId: "7", elementType: "DataFlow" },
          dataFlow: null,
          linkedAssetIds: [], // stale — relation added after generation
        },
      ]),
      assetDataRef,
    );

    expect(out.perElementTables[0].threats[0].linkedAssetIds).toEqual(["AC"]);
  });

  it("drops a stale link when the asset is no longer related to the element", () => {
    const out = refreshLinkedAssets(
      bundle([
        {
          id: "t2",
          linkedElement: { elementId: "3", elementType: "Process" },
          dataFlow: null,
          linkedAssetIds: ["SY"], // SY is not linked to element 3 anymore
        },
      ]),
      assetDataRef,
    );

    // element 3 carries AC (creates/modifies), not SY
    expect(out.perElementTables[0].threats[0].linkedAssetIds).toEqual(["AC"]);
  });

  it("leaves an element with no asset relations empty", () => {
    const out = refreshLinkedAssets(
      bundle([
        {
          id: "t3",
          linkedElement: { elementId: "99", elementType: "Process" },
          dataFlow: null,
          linkedAssetIds: [],
        },
      ]),
      assetDataRef,
    );

    expect(out.perElementTables[0].threats[0].linkedAssetIds).toEqual([]);
  });

  it("unions connection + endpoints for a per-interaction threat", () => {
    const out = refreshLinkedAssets(
      bundle([
        {
          id: "t4",
          linkedElement: null,
          dataFlow: {
            connectionId: "7",
            fromElementId: "3",
            toElementId: "99",
          },
          linkedAssetIds: [],
        },
      ]),
      assetDataRef,
    );

    // conn 7 → AC, element 3 → AC (deduped), element 99 → none
    expect(out.perElementTables[0].threats[0].linkedAssetIds).toEqual(["AC"]);
  });

  it("returns the same threat object when nothing changed (no churn)", () => {
    const threat = {
      id: "t5",
      linkedElement: { elementId: "7", elementType: "DataFlow" },
      dataFlow: null,
      linkedAssetIds: ["AC"], // already correct
    };
    const out = refreshLinkedAssets(bundle([threat]), assetDataRef);

    expect(out.perElementTables[0].threats[0]).toBe(threat);
  });
});
