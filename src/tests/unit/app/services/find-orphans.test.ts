import { describe, it, expect } from "vitest";
import {
  findOrphans,
  totalOrphanedThreats,
  hasOrphans,
  type OrphanScanInput,
} from "app/services/find-orphans";

// Mirrors the headlamp ISO 21434 project after the DFD rework:
// - [OE]/[NECU]/[GPB]/[NPB] tables point at existing boundaries → keep
// - [DF]/[EE] tables have no boundary (not boundary-scoped) → keep
// - [MTB]/[STM]/[DB] tables point at boundaries removed with the old DFD → orphan
// - one asset-anchored tree (valid) + one threat-anchored tree whose anchor
//   threat was removed on re-generation → orphan
const input: OrphanScanInput = {
  dfdElementIds: new Set(["TB1", "TB2", "GPB-id", "NPB-id", "DF-2", "MP5"]),
  assetIds: new Set(["asset-lamp", "asset-firmware"]),
  threatTables: [
    { displayIdentifier: "[OE]", trustBoundaryId: "TB1", threats: [{ id: "t1" }, { id: "t2" }] },
    { displayIdentifier: "[NECU]", trustBoundaryId: "TB2", threats: [{ id: "t3" }] },
    { displayIdentifier: "[DF]", trustBoundaryId: null, threats: [{ id: "t4" }] },
    { displayIdentifier: "[EE]", threats: [{ id: "t5" }] }, // no boundary key at all
    { displayIdentifier: "[MTB]", trustBoundaryId: "2", threats: [{ id: "o1" }, { id: "o2" }] },
    { displayIdentifier: "[STM]", trustBoundaryId: "16", threats: [{ id: "o3" }] },
    { displayIdentifier: "[DB]", trustBoundaryId: "15", threats: [{ id: "o4" }, { id: "o5" }] },
  ],
  attackTrees: [
    { id: "tree-lamp", name: "DA-001 … (I)", anchor: { type: "asset", assetId: "asset-lamp" } },
    { id: "tree-orphan", name: "Undefined fail-safe", anchor: { type: "threat", threatId: "P1-T-1" } },
    { id: "tree-gone-asset", name: "Old asset tree", anchor: { type: "asset", assetId: "asset-deleted" } },
  ],
};

describe("findOrphans", () => {
  const report = findOrphans(input);

  it("flags only boundary-scoped tables whose boundary is gone", () => {
    const ids = report.threatTables.map((t) => t.displayIdentifier).sort();
    expect(ids).toEqual(["[DB]", "[MTB]", "[STM]"]);
  });

  it("never flags tables that are not boundary-scoped ([DF]/[EE])", () => {
    const ids = report.threatTables.map((t) => t.displayIdentifier);
    expect(ids).not.toContain("[DF]");
    expect(ids).not.toContain("[EE]");
  });

  it("counts the threats that would be removed with the orphaned tables", () => {
    expect(totalOrphanedThreats(report)).toBe(5); // o1..o5
  });

  it("flags a threat-anchored tree whose anchor threat is gone", () => {
    const t = report.attackTrees.find((x) => x.id === "tree-orphan");
    expect(t?.reason).toBe("missing-threat");
  });

  it("flags an asset-anchored tree whose asset is gone, keeps the valid one", () => {
    const reasons = new Map(report.attackTrees.map((t) => [t.id, t.reason]));
    expect(reasons.get("tree-gone-asset")).toBe("missing-asset");
    expect(reasons.has("tree-lamp")).toBe(false); // valid → not orphaned
  });

  it("reports no orphans for a clean project", () => {
    const clean = findOrphans({
      dfdElementIds: new Set(["TB1"]),
      assetIds: new Set(["a"]),
      threatTables: [{ displayIdentifier: "[OE]", trustBoundaryId: "TB1", threats: [{ id: "t" }] }],
      attackTrees: [{ id: "tr", name: "ok", anchor: { type: "asset", assetId: "a" } }],
    });
    expect(hasOrphans(clean)).toBe(false);
  });
});
