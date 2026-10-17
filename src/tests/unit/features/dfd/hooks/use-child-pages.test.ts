// Leveled-DFD Phase 5d — child page per new multiprocess (D15–D17): draw.io
// creates the page first, then dfd.pages is saved; nothing happens for the
// multiprocesses of the DFD as opened, or when draw.io refuses.
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChildPages } from "features/dfd/hooks/use-child-pages";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "features/dfd/models/dfd-types";
import type { DrawioPageSyncSpec } from "features/dfd/services/drawio-bridge";
import { mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const project = (
  xml: string,
  pages?: DFDPage[],
  elements: { id: string; type: string; properties?: object }[] = [],
): DFDProjectData =>
  ({
    id: "p-child",
    name: "child",
    phaseStatus: {},
    dfd: { xml, pages, elements, connections: [], assets: [] },
  }) as unknown as DFDProjectData;

const EE = node("ee", "externalentity", "User", "EE-1", 10);
const OPENED = mxfile(page("p1", "Page-1", EE));
const WITH_MP = mxfile(page("p1", "Page-1", EE + node("mp", "multiprocess", "Gateway", "MP-xx", 300)));

function setup(syncResult = { success: true }) {
  const syncPages = vi.fn(async (_spec: DrawioPageSyncSpec) => syncResult);
  const savePages = vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult);
  const options = {
    enabled: true,
    syncPages,
    savePages,
    markNoChildPage: vi.fn(),
    newPageId: () => "child1",
  };
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
      useChildPages(project(WITH_MP), {
        enabled: true,
        syncPages,
        savePages,
        markNoChildPage: vi.fn(),
      }),
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

  it("in a leveled project gives every multiprocess without page one, also at open", async () => {
    // Reported with 5d: "MyProcess" drawn on the root page got no page, and
    // after reopening it counted as "existing". D15 holds for every MP of a
    // leveled project; only a classic project is protected on open.
    const top = page(
      "p1",
      "Top",
      EE + node("mp", "multiprocess", "Gateway", "MP-1", 300) +
        node("mine", "multiprocess", "MyProcess", "MP-xx", 600),
    );
    const pages: DFDPage[] = [
      { pageId: "p1", name: "Top", order: 0 },
      { pageId: "gw", name: "Gateway", decomposes: "mp", order: 1 },
    ];
    const xml = mxfile(top, page("gw", "Gateway", ""));
    const syncPages = vi.fn(async (_spec: DrawioPageSyncSpec) => ({ success: true }));
    const savePages = vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult);
    renderHook(() =>
      useChildPages(project(xml, pages), {
        enabled: true,
        syncPages,
        savePages,
        markNoChildPage: vi.fn(),
        newPageId: () => "child-mine",
      }),
    );
    await waitFor(() => expect(savePages).toHaveBeenCalledTimes(1));
    expect(syncPages.mock.calls[0][0].create.map((c) => c.name)).toEqual(["MyProcess"]);
    expect(savePages.mock.calls[0][0].at(-1)).toEqual({
      pageId: "child-mine",
      name: "MyProcess",
      decomposes: "mine",
      order: 2,
    });
  });

  it("keeps a page draw.io did not insert out of dfd.pages", async () => {
    const { rerender, syncPages, savePages } = setup({
      success: true,
      created: [],
      errors: ["page not inserted (diagram not editable?): Gateway"],
    } as never);
    rerender({ p: project(WITH_MP) });
    await waitFor(() => expect(syncPages).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(savePages).not.toHaveBeenCalled(); // classic project stays classic
  });

  it("does nothing while the plugin is not ready", async () => {
    const syncPages = vi.fn();
    const { rerender } = renderHook(
      ({ p }: { p: DFDProjectData }) =>
        useChildPages(p, {
          enabled: false,
          syncPages,
          savePages: vi.fn(),
          markNoChildPage: vi.fn(),
        }),
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

  describe("deleted child pages (reported with 5d)", () => {
    const pages: DFDPage[] = [
      { pageId: "p1", name: "Top", order: 0 },
      { pageId: "gw", name: "Gateway", decomposes: "mp", order: 1 },
      { pageId: "my", name: "MyProcess", decomposes: "mine", order: 2 },
    ];
    const opts = () => ({
      enabled: true,
      syncPages: vi.fn(async (_spec: DrawioPageSyncSpec) => ({ success: true })),
      savePages: vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult),
      markNoChildPage: vi.fn(),
    });

    it("MP deleted first, then its page: the entry leaves dfd.pages", async () => {
      const xml = mxfile(
        page("p1", "Top", EE + node("mp", "multiprocess", "Gateway", "MP-1", 300)),
        page("gw", "Gateway", ""),
      );
      const o = opts();
      renderHook(() =>
        useChildPages(project(xml, pages, [{ id: "mp", type: "Multiprocess" }]), o),
      );
      await waitFor(() => expect(o.savePages).toHaveBeenCalledTimes(1));
      expect(o.savePages.mock.calls[0][0].map((p) => p.pageId)).toEqual(["p1", "gw"]);
      expect(o.markNoChildPage).not.toHaveBeenCalled(); // the MP is gone anyway
      expect(o.syncPages).not.toHaveBeenCalled();
    });

    it("page deleted, MP still there: entry removed and the MP keeps no page", async () => {
      const xml = mxfile(
        page(
          "p1",
          "Top",
          EE + node("mp", "multiprocess", "Gateway", "MP-1", 300) +
            node("mine", "multiprocess", "MyProcess", "MP-2", 600),
        ),
        page("gw", "Gateway", ""),
      );
      const elements = [
        { id: "mp", type: "Multiprocess" },
        { id: "mine", type: "Multiprocess" },
      ];
      const o = opts();
      const { rerender } = renderHook(({ p }: { p: DFDProjectData }) => useChildPages(p, o), {
        initialProps: { p: project(xml, pages, elements) },
      });
      await waitFor(() => expect(o.savePages).toHaveBeenCalledTimes(1));
      expect(o.markNoChildPage).toHaveBeenCalledWith("mine");

      // Saved: entry gone, MP marked — no new page for it.
      rerender({
        p: project(xml, pages.slice(0, 2), [
          { id: "mp", type: "Multiprocess" },
          { id: "mine", type: "Multiprocess", properties: { noChildPage: true } },
        ]),
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(o.syncPages).not.toHaveBeenCalled();
      expect(o.savePages).toHaveBeenCalledTimes(1);
    });

    it("a page just created and not yet saved is not taken for deleted", async () => {
      const { rerender, savePages, result } = setup();
      rerender({ p: project(WITH_MP) });
      await waitFor(() => expect(savePages).toHaveBeenCalledTimes(1));
      // dfd.pages has the new page, the saved XML not yet (autosave pending).
      rerender({ p: project(WITH_MP, savePages.mock.calls[0][0]) });
      await new Promise((r) => setTimeout(r, 20));
      expect(savePages).toHaveBeenCalledTimes(1);
      expect(result.current.settling).toBe(true);
    });
  });
});
