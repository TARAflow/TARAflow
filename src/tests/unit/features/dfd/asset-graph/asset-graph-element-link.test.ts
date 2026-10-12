// FR-E7: pure helpers for DFD element → asset relations in the graph.

import { describe, expect, it } from "vitest";
import {
  allowedElementTypes,
  elementCandidates,
  elementTargetClasses,
  linkableElements,
  withoutElementRelation,
} from "features/dfd/asset-graph/asset-graph-element-link";
import { getAllowedRelations } from "features/dfd/models/asset-constants";

const rel = (assetId: string, relationType: string) => ({ assetId, relationType, assetGroup: "data" }) as never;

describe("asset graph — element links", () => {
  it("connections count as DataFlow; elements keep their type and relations", () => {
    const list = linkableElements({
      elements: [{ id: "p", displayId: "P-2", name: "Ctrl", type: "Process", assetRelations: [rel("d1", "reads")] }] as never,
      connections: [{ id: "c", displayId: "F-1", name: "Bus" }] as never,
    });
    expect(list.map((x) => [x.id, x.type, x.relations.length])).toEqual([
      ["p", "Process", 1],
      ["c", "DataFlow", 0],
    ]);
  });

  it("allowed types are the element rules", () => {
    expect(allowedElementTypes("DataFlow", "data")).toEqual(getAllowedRelations("DataFlow", "data"));
    expect(allowedElementTypes("TrustBoundary", "data")).toEqual([]);
  });

  it("candidates: only elements the rules allow, linked ones marked, sorted by id", () => {
    const list = linkableElements({
      elements: [
        { id: "p2", displayId: "P-10", type: "Process", assetRelations: [] },
        { id: "p1", displayId: "P-2", type: "Process", assetRelations: [rel("d1", "reads")] },
        { id: "tb", displayId: "TB-1", type: "TrustBoundary", assetRelations: [] },
      ] as never,
      connections: [],
    });
    expect(elementCandidates(list, "d1", "data").map((c) => [c.id, c.linked])).toEqual([
      ["p1", true],
      ["p2", false],
    ]);
  });

  it("target classes while dragging from an anchor", () => {
    const cls = elementTargetClasses("ChipBoundary", [
      { id: "d1", assetGroup: "data" },
      { id: "i1", assetGroup: "infrastructure" },
    ]);
    expect(cls.get("d1")).toBe("valid");
    expect(cls.get("i1")).toBe("invalid");
  });

  it("removing one relation keeps the others of the same asset", () => {
    const rels = [rel("d1", "reads"), rel("d1", "modifies"), rel("d2", "reads")];
    expect(withoutElementRelation(rels, "d1", "reads")).toEqual([rels[1], rels[2]]);
  });
});
