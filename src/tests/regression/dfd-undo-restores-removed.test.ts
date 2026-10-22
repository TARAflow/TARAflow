// Leveled-DFD §5.2 "stale links", found in use (2026-10-22): a context copy
// deleted, the autosave dropped its identity link, Ctrl+Z brought the cell
// back — as a new definition of its own ("+ DF-3", "Identity", "Analysis:
// 1 flow now analysed on parent level"). And in any DFD an undone deletion
// lost the record's description, properties and asset relations. A save
// now gives both back when the same cell returns.
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { diffDfd } from "features/dfd/services/dfd-diff";
import type { DFDData, DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, mxfile, node, page } from "../fixtures/leveled-dfd-xml";

/** The project as last saved (`dfd`), or a first save of `xml`. */
function project(id: string, xml: string, dfd?: Partial<DFDData>, pages?: DFDPage[]): DFDProjectData {
  return {
    id,
    name: id,
    dfd: {
      elements: [],
      connections: [],
      assets: [],
      xml,
      ...dfd,
      ...(pages ? { pages } : {}),
    } as unknown as DFDData,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: new Date().toISOString(),
  };
}

/** Save `xml` on top of the last saved DFD, as the autosave does. */
const save = (id: string, xml: string, dfd?: DFDData, pages?: DFDPage[]) => {
  const result = dfdService.saveDFDFromXml(project(id, xml, dfd, pages), xml);
  expect(result.success).toBe(true);
  return { ...result.dfd, xml };
};

describe("undo in draw.io after an autosave", () => {
  it("a deleted context copy comes back as the copy it was", () => {
    const id = "proj-undo-copy";
    const full = mxfile(SYSTEM, SENSOR, CONTROLLER);
    const sensorWithoutCopy = page(
      "sen",
      "Sensor Module",
      node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
        node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500),
    );
    const first = save(id, full, undefined, LEVELED_PAGES);
    const deleted = save(id, mxfile(SYSTEM, sensorWithoutCopy, CONTROLLER), first);
    expect(deleted.pages?.find((p) => p.pageId === "sen")?.links?.map((l) => l.cellId)).toEqual(["sen_mp2"]);

    const undone = save(id, full, deleted);
    expect(undone.pages).toEqual(first.pages);
    expect(diffDfd(first, undone)).toEqual([]);
  });

  it("a deleted element comes back with its description, properties and asset relations", () => {
    const id = "proj-undo-record";
    const xml = (cells: string) => mxfile(page("p1", "Page-1", cells));
    const both = xml(node("a", "process", "Sensor", "P-1", 10) + node("b", "process", "Alarm", "P-2", 300));
    const first = save(id, both);
    const described = {
      ...first,
      elements: first.elements.map((e) =>
        e.id === "b"
          ? {
              ...e,
              description: "Sounds the alarm",
              properties: { ...e.properties, technology: "buzzer" },
              assetRelations: [{ assetId: "as1", relation: "processes" }],
            }
          : e,
      ),
    } as DFDData;
    const deleted = save(id, xml(node("a", "process", "Sensor", "P-1", 10)), described);
    expect(deleted.elements.map((e) => e.id)).toEqual(["a"]);

    const undone = save(id, both, deleted);
    const b = undone.elements.find((e) => e.id === "b")!;
    expect(b.description).toBe("Sounds the alarm");
    expect(b.properties).toMatchObject({ technology: "buzzer" });
    expect(b.assetRelations).toEqual([{ assetId: "as1", relation: "processes" }]);
  });
});
