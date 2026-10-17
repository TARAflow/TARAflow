// Leveled-DFD Phase 5d — child page per new multiprocess (D15–D17): draw.io
// creates the page first, then dfd.pages is saved; nothing happens for the
// multiprocesses of the DFD as opened, or when draw.io refuses.
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChildPages } from "features/dfd/hooks/use-child-pages";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "features/dfd/models/dfd-types";
import type { DrawioPageSyncSpec } from "features/dfd/services/drawio-bridge";
import { mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const project = (xml: string, pages?: DFDPage[]): DFDProjectData =>
  ({
    id: "p-child",
    name: "child",
    phaseStatus: {},
    dfd: { xml, pages, elements: [], connections: [], assets: [] },
  }) as unknown as DFDProjectData;

const EE = node("ee", "externalentity", "User", "EE-1", 10);
const OPENED = mxfile(page("p1", "Page-1", EE));
const WITH_MP = mxfile(page("p1", "Page-1", EE + node("mp", "multiprocess", "Gateway", "MP-xx", 300)));

function setup(syncResult = { success: true }) {
  const syncPages = vi.fn(async (_spec: DrawioPageSyncSpec) => syncResult);
  const savePages = vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult);
  const options = { enabled: true, syncPages, savePages, newPageId: () => "child1" };
  const hook = renderHook(({ p }: { p: DFDProjectData }) => useChildPages(p, options), {
    initialProps: { p: project(OPENED) },
  });
  return { ...hook, syncPages, savePages };
}

describe("useChildPages", () => {
  it("creates the page of a new multiprocess, names the root Top, then saves the pages", async () => {
    const { rerender, syncPages, savePages, result } = setup();
    rerender({ p: project(WITH_MP) });

    await waitFor(() => expect(savePages).toHaveBeenCalledTimes(1));
    expect(syncPages.mock.calls.map((c) => c[0])).toEqual([
      {
        create: [
          { pageId: "child1", name: "Gateway", decomposes: "mp", links: [{ pageId: "p1", cellId: "mp" }] },
        ],
        rename: [],
      },
      { create: [], rename: [{ pageId: "p1", name: "Top" }] },
    ]);
    expect(savePages.mock.calls[0][0]).toEqual([
      { pageId: "p1", name: "Top", order: 0 },
      { pageId: "child1", name: "Gateway", decomposes: "mp", order: 1 },
    ]);
    // The new page is not in the saved XML yet.
    expect(result.current.settling).toBe(true);
  });

  it("never gives the multiprocesses of the opened DFD a page", async () => {
    const syncPages = vi.fn();
    const savePages = vi.fn();
    renderHook(() =>
      useChildPages(project(WITH_MP), { enabled: true, syncPages, savePages }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(syncPages).not.toHaveBeenCalled();
    expect(savePages).not.toHaveBeenCalled();
  });

  it("leaves a classic project untouched when draw.io cannot create the page", async () => {
    const { rerender, syncPages, savePages } = setup({ success: false });
    rerender({ p: project(WITH_MP) });
    await waitFor(() => expect(syncPages).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(syncPages).toHaveBeenCalledTimes(1); // no rename to Top
    expect(savePages).not.toHaveBeenCalled(); // no dfd.pages
    // …and does not retry on the next save.
    rerender({ p: project(WITH_MP + " ") });
    await new Promise((r) => setTimeout(r, 20));
    expect(syncPages).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the plugin is not ready", async () => {
    const syncPages = vi.fn();
    const { rerender } = renderHook(
      ({ p }: { p: DFDProjectData }) =>
        useChildPages(p, { enabled: false, syncPages, savePages: vi.fn() }),
      { initialProps: { p: project(OPENED) } },
    );
    rerender({ p: project(WITH_MP) });
    await new Promise((r) => setTimeout(r, 20));
    expect(syncPages).not.toHaveBeenCalled();
  });

  it("settles once the saved XML contains the new page", async () => {
    const { rerender, savePages, result } = setup();
    rerender({ p: project(WITH_MP) });
    await waitFor(() => expect(savePages).toHaveBeenCalled());
    const pages = savePages.mock.calls[0][0];
    const arrived = mxfile(
      page("p1", "Top", EE + node("mp", "multiprocess", "Gateway", "MP-xx", 300)),
      page("child1", "Gateway", ""),
    );
    rerender({ p: project(arrived, pages) });
    await waitFor(() => expect(result.current.settling).toBe(false));
  });
});
