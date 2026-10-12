// B15: linkedElements carry the qualifier of all four qualified relations.

import { describe, expect, it } from "vitest";
import { syncAssetLinkedElements } from "features/dfd/services/dfd-finalize";

describe("syncAssetLinkedElements — qualifiers", () => {
  it("keeps the qualifier of service uses and physical accesses, not only system / infrastructure", () => {
    const elements = [
      {
        id: "p",
        type: "Process",
        name: "Ctrl",
        assetRelations: [
          { assetId: "sv", assetGroup: "service", relationType: "uses", qualifier: "sdk" },
          { assetId: "ph", assetGroup: "physical", relationType: "accesses", qualifier: "remote" },
          { assetId: "sy", assetGroup: "system", relationType: "uses", qualifier: "api" },
        ],
      },
    ];
    const assets = [{ id: "sv" }, { id: "ph" }, { id: "sy" }];
    const out = syncAssetLinkedElements(elements as never, [], assets as never);
    expect(out.map((a) => a.linkedElements?.[0]?.qualifier)).toEqual(["sdk", "remote", "api"]);
  });
});
