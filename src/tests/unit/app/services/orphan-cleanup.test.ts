import { describe, it, expect } from "vitest";
import type { Project } from "app/models/project-types";
import {
  scanProjectForOrphans,
  removeOrphans,
} from "app/services/orphan-cleanup";

// Minimal structural project: only the slices the adapter/remover read.
// TB1 exists in the DFD; boundary "2" was removed with the old DFD, so the
// [MTB] table is orphaned. The threat-anchored tree points at a gone threat.
const project = {
  dfd: {
    elements: [
      { id: "TB1", displayId: "OE-1" },
      { id: "MP5", displayId: "MP-3" },
    ],
    connections: [{ id: "DF-2", displayId: "DF-9" }],
  },
  assets: { assets: [{ id: "asset-lamp" }] },
  threats: {
    perElementTables: [
      { displayIdentifier: "[OE]", trustBoundaryId: "TB1", trustBoundaryName: "OE", threats: [{ id: "t1" }] },
      { displayIdentifier: "[MTB]", trustBoundaryId: "2", trustBoundaryName: "My TB", threats: [{ id: "o1" }, { id: "o2" }] },
    ],
    perInteractionTables: [
      { displayIdentifier: "[DF]", trustBoundaryId: null, trustBoundaryName: "", threats: [{ id: "t2" }] },
    ],
  },
  attackTrees: {
    trees: [
      { id: "tree-lamp", name: "x", anchor: { type: "asset", assetId: "asset-lamp" } },
      { id: "tree-orphan", name: "y", anchor: { type: "threat", threatId: "P1-T-1" } },
    ],
  },
} as unknown as Project;

describe("orphan-cleanup", () => {
  it("scans a project and flags the orphaned table + tree", () => {
    const report = scanProjectForOrphans(project);
    expect(report.threatTables.map((t) => t.displayIdentifier)).toEqual(["[MTB]"]);
    expect(report.threatTables[0].threatCount).toBe(2);
    expect(report.attackTrees.map((t) => t.id)).toEqual(["tree-orphan"]);
  });

  it("removes the orphaned table + tree and keeps everything else", () => {
    const report = scanProjectForOrphans(project);
    const result = removeOrphans(project, report);
    expect(result.perElementTables.map((t) => t.displayIdentifier)).toEqual(["[OE]"]);
    // the boundary-less [DF] table is always kept
    expect(result.perInteractionTables.map((t) => t.displayIdentifier)).toEqual(["[DF]"]);
    expect(result.trees.map((t) => t.id)).toEqual(["tree-lamp"]);
  });

  it("is a no-op on a clean project", () => {
    const clean = {
      dfd: { elements: [{ id: "TB1", displayId: "OE-1" }], connections: [] },
      assets: { assets: [{ id: "a" }] },
      threats: {
        perElementTables: [
          { displayIdentifier: "[OE]", trustBoundaryId: "TB1", trustBoundaryName: "OE", threats: [{ id: "t" }] },
        ],
        perInteractionTables: [],
      },
      attackTrees: { trees: [{ id: "tr", name: "ok", anchor: { type: "asset", assetId: "a" } }] },
    } as unknown as Project;
    const report = scanProjectForOrphans(clean);
    const result = removeOrphans(clean, report);
    expect(report.threatTables).toHaveLength(0);
    expect(report.attackTrees).toHaveLength(0);
    expect(result.perElementTables).toHaveLength(1);
    expect(result.trees).toHaveLength(1);
  });
});
