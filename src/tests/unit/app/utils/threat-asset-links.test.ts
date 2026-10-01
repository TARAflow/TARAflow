// tests/unit/app/utils/threat-asset-links.test.ts
//
// One threat → asset link rule for the risk register and the threat ↔ goal
// cross-checks (extracted from workspace-layout).

import { describe, expect, it } from "vitest";
import {
  buildElementToAssetIds,
  resolveThreatAssetIds,
} from "app/utils/threat-asset-links";

const assets = [
  { id: "a1", linkedDFDElements: [{ elementId: "P-1" }] },
  { id: "a2", linkedDFDElements: [{ elementId: "DF-1" }] },
];
const dfdElements = [{ id: "P-1", assetRelations: [{ assetId: "a3", relationType: "is_an" }] }];

describe("threat → asset link rule (shared with the risk register)", () => {
  const map = buildElementToAssetIds(assets, dfdElements);

  it("element links from linkedDFDElements and is_an relations", () => {
    expect(map.get("P-1")).toEqual(["a1", "a3"]);
  });

  it("own linkedAssetIds win; else the anchor element; a flow falls back to its source", () => {
    expect(resolveThreatAssetIds({ linkedAssetIds: ["x"], linkedElement: { elementId: "P-1" } }, map)).toEqual(["x"]);
    expect(resolveThreatAssetIds({ linkedElement: { elementId: "P-1" } }, map)).toEqual(["a1", "a3"]);
    expect(resolveThreatAssetIds({ dataFlow: { connectionId: "DF-1" } }, map)).toEqual(["a2"]);
    expect(resolveThreatAssetIds({ dataFlow: { fromElementId: "P-1" } }, map)).toEqual(["a1", "a3"]);
    expect(resolveThreatAssetIds({}, map)).toEqual([]);
  });
});
