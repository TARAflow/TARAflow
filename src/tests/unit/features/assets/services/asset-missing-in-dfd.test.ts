// User 2026-10-30 (Smoke Detector): the Asset tab reported "3 asset(s) not
// placed in DFD: HU-001, HU-002, IF-001" — people and the building, endangered
// by hazards and cause of none. Such pure protection targets are reached
// through the hazard chain and the asset graph, never through the DFD; the
// asset validation exempts them already, the banner now does too.
import { describe, it, expect } from "vitest";
import { getAssetsMissingInDFD } from "features/assets/services/asset-sync-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const asset = (id: string, assetGroup: string, source = "manual"): Any => ({ id, displayId: id, name: id, assetGroup, source });
const link = { hazardId: "H-01" } as Any;
const assetData: Any = {
  assets: [asset("HU-001", "human"), asset("IF-001", "infrastructure"), asset("DA-001", "data"), asset("SY-009", "system"), asset("DA-002", "data", "dfd")],
};
const hazardLinks: Any = {
  "HU-001": { endangeredBy: [link], contributesTo: [], isHazardTarget: true },
  "IF-001": { endangeredBy: [link], contributesTo: [], isHazardTarget: true },
  // endangered AND a cause: part of the analysed system, so it belongs in the DFD
  "SY-009": { endangeredBy: [link], contributesTo: [link], isHazardTarget: true },
};

describe("assets missing in the DFD", () => {
  it("pure protection targets of the hazard analysis are left out", () => {
    expect(getAssetsMissingInDFD(assetData, [], hazardLinks).map((a) => a.id)).toEqual(["DA-001", "SY-009"]);
  });

  it("without the hazard links: every manual asset without a DFD place, as before", () => {
    expect(getAssetsMissingInDFD(assetData, []).map((a) => a.id)).toEqual(["HU-001", "IF-001", "DA-001", "SY-009"]);
  });
});
