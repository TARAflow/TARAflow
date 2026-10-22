// Leveled-DFD Phase 1.4 (leveled-dfd-multi-diagram-design.md §5.2):
// saving drops identity links whose cell no longer exists, so a stale link
// can never attach to a different cell later (draw.io may reuse an id).
// Classic projects never get a dfd.pages entry from saving.
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import type {
  DFDData,
  DFDPage,
  DFDProjectData,
} from "features/dfd/models/dfd-types";
import { mxfile, node, page } from "../fixtures/leveled-dfd-xml";

const XML = mxfile(
  page("sys", "System", node("p1", "process", "Gateway", "P-1", 100)),
);

function project(pages?: DFDPage[]): DFDProjectData {
  return {
    id: "proj-links",
    name: "links",
    dfd: {
      xml: XML,
      elements: [],
      connections: [],
      assets: [],
      ...(pages ? { pages } : {}),
    } as unknown as DFDData,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: new Date().toISOString(),
  };
}

describe("save keeps dfd.pages consistent with the XML", () => {
  it("drops the link of a cell that was deleted in draw.io", () => {
    const pages: DFDPage[] = [
      {
        pageId: "sys",
        name: "System",
        order: 0,
        links: [
          { cellId: "deleted_cell", tfId: "mp9", role: "ref" },
          { cellId: "p1", tfId: "gw", role: "definition" },
        ],
      },
    ];
    const result = dfdService.saveDFDFromXml(project(pages), XML);
    expect(result.success).toBe(true);
    expect(result.dfd.pages).toEqual([
      {
        pageId: "sys",
        name: "System",
        order: 0,
        links: [{ cellId: "p1", tfId: "gw", role: "definition" }],
      },
    ]);
    // The surviving link is applied: the element carries its tfId.
    expect(result.dfd.elements.map((e) => e.id)).toEqual(["gw"]);
  });

  it("adds no dfd.pages to a classic project", () => {
    const result = dfdService.saveDFDFromXml(project(), XML);
    expect(result.success).toBe(true);
    expect(result.dfd).not.toHaveProperty("pages");
  });
});
