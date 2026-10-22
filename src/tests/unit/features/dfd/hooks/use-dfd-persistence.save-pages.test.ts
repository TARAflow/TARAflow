// Leveled DFD 5i: savePages must not drop the page thumbnails (D18). The
// callers (child pages, adoption, identity actions) compute dfd.pages from
// page-tree logic without thumbnails, and the update replaces dfd.pages.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";

vi.mock("features/dfd/services/dfd-storage-adapter", () => ({
  createDFDStorageAdapter: () => ({ syncFromLegacy: () => {}, getXml: () => "<mxfile/>" }),
}));
vi.mock("features/dfd/services/dfd-service", () => ({
  default: {
    // Echo the project's dfd like a successful save.
    saveDFD: (project: DFDProjectData) => ({
      success: true,
      dfd: { ...project.dfd },
      phaseStatus: {},
      lastModified: "2026-10-18T00:00:00.000Z",
    }),
  },
}));

import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";

describe("useDFDPersistence.savePages", () => {
  it("keeps the thumbnails of pages the caller passes without", async () => {
    const stored: DFDPage[] = [
      { pageId: "sys", name: "Top", order: 0, thumbnail: "data:top" },
      { pageId: "sen", name: "Sensor", decomposes: "mp1", order: 1, thumbnail: "data:sen" },
    ];
    const project = {
      id: "p",
      name: "p",
      phaseStatus: {},
      dfd: { xml: "<mxfile/>", pages: stored, elements: [], connections: [], assets: [], lastModified: "2026-10-17T00:00:00.000Z" },
    } as unknown as DFDProjectData;
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useDFDPersistence(project, { onUpdate }));

    // E.g. a new child page: computed from the tree, no thumbnails.
    await act(async () => {
      await result.current.savePages([
        { pageId: "sys", name: "Top", order: 0 },
        { pageId: "sen", name: "Sensor", decomposes: "mp1", order: 1, links: [] },
        { pageId: "new", name: "Gateway", decomposes: "mp2", order: 2 },
      ]);
    });
    const pages = onUpdate.mock.calls[0][0].dfd.pages as DFDPage[];
    expect(pages.map((p) => [p.pageId, p.thumbnail])).toEqual([
      ["sys", "data:top"],
      ["sen", "data:sen"],
      ["new", undefined],
    ]);
  });
});
