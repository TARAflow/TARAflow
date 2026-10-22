// Leveled-DFD Phase 5i — export only the pages that changed (D18).
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePageThumbnails } from "features/dfd/hooks/use-page-thumbnails";
import type { DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import { mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const TOP = page("sys", "Top", node("mp1", "multiprocess", "Sensor Module", "MP-1", 10));
const SEN = page("sen", "Sensor Module", node("p", "process", "Part", "P-1.1", 10));

const project = (xml: string, pages?: DFDPage[]): DFDProjectData =>
  ({
    id: "p",
    name: "p",
    phaseStatus: {},
    dfd: { xml, pages, elements: [], connections: [], assets: [] },
  }) as unknown as DFDProjectData;

const withThumbs: DFDPage[] = [
  { pageId: "sys", name: "Top", order: 0, thumbnail: "data:top" },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1, thumbnail: "data:sen" },
];

function setup(renderable = true) {
  const exportPageSvgs = vi.fn(async (ids: string[]) => ({
    success: true,
    svgs: Object.fromEntries(ids.map((id) => [id, `data:new-${id}`])),
  }));
  const storeThumbnails = vi.fn();
  const options = {
    enabled: true,
    exportPageSvgs,
    storeThumbnails,
    isRenderable: async () => renderable,
  };
  return { exportPageSvgs, storeThumbnails, options };
}

describe("usePageThumbnails", () => {
  it("keeps stored thumbnails at opening and exports the page that changes", async () => {
    const { exportPageSvgs, storeThumbnails, options } = setup();
    const { rerender } = renderHook(({ p }: { p: DFDProjectData }) => usePageThumbnails(p, options), {
      initialProps: { p: project(mxfile(TOP, SEN), withThumbs) },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(exportPageSvgs).not.toHaveBeenCalled();

    rerender({ p: project(mxfile(TOP, SEN.replace('x="10"', 'x="77"')), withThumbs) });
    await waitFor(() => expect(storeThumbnails).toHaveBeenCalledWith({ sen: "data:new-sen" }));
    expect(exportPageSvgs).toHaveBeenCalledWith(["sen"]);
  });

  it("exports pages without thumbnail", async () => {
    const { exportPageSvgs, options } = setup();
    renderHook(() =>
      usePageThumbnails(
        project(mxfile(TOP, SEN), withThumbs.map(({ thumbnail: _t, ...p }) => p)),
        options,
      ),
    );
    await waitFor(() => expect(exportPageSvgs).toHaveBeenCalledWith(["sys", "sen"]));
  });

  it("waits while the DFD iframe cannot render", async () => {
    const { exportPageSvgs, options } = setup(false);
    renderHook(() =>
      usePageThumbnails(project(mxfile(TOP, SEN), withThumbs.map(({ thumbnail: _t, ...p }) => p)), options),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(exportPageSvgs).not.toHaveBeenCalled();
  });

  it("tries again after a pause, without a change of the DFD", async () => {
    // Reported with 5i: thumbnails appeared only after several edits.
    const { exportPageSvgs, storeThumbnails, options } = setup();
    let renderable = false;
    const opts = { ...options, isRenderable: async () => renderable, retryMs: 10 };
    renderHook(() =>
      usePageThumbnails(project(mxfile(TOP, SEN), withThumbs.map(({ thumbnail: _t, ...p }) => p)), opts),
    );
    await new Promise((r) => setTimeout(r, 15));
    expect(exportPageSvgs).not.toHaveBeenCalled();
    renderable = true;
    await waitFor(() => expect(storeThumbnails).toHaveBeenCalled());
    expect(exportPageSvgs).toHaveBeenCalledWith(["sys", "sen"]);
  });

  it("exports a thumbnail again that was lost by another save", async () => {
    const { exportPageSvgs, options } = setup();
    const { rerender } = renderHook(({ p }: { p: DFDProjectData }) => usePageThumbnails(p, options), {
      initialProps: { p: project(mxfile(TOP, SEN), withThumbs) },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(exportPageSvgs).not.toHaveBeenCalled();
    rerender({ p: project(mxfile(TOP, SEN), [withThumbs[0], { ...withThumbs[1], thumbnail: undefined }]) });
    await waitFor(() => expect(exportPageSvgs).toHaveBeenCalledWith(["sen"]));
  });

  it("leaves a classic project alone", async () => {
    const { exportPageSvgs, options } = setup();
    renderHook(() => usePageThumbnails(project(mxfile(TOP)), options));
    await new Promise((r) => setTimeout(r, 20));
    expect(exportPageSvgs).not.toHaveBeenCalled();
  });
});
