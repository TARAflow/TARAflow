// Leveled-DFD Phase 5d — child page per new multiprocess (D15–D17): draw.io
// creates the page first, then dfd.pages is saved; nothing happens for the
// multiprocesses of the DFD as opened, or when draw.io refuses.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
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
    setNoChildPage: vi.fn(),
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
      { create: [], rename: [{ pageId: "p1", name: "Top" }], link: [] },
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
        setNoChildPage: vi.fn(),
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
        setNoChildPage: vi.fn(),
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
          setNoChildPage: vi.fn(),
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
      setNoChildPage: vi.fn(),
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
      expect(o.setNoChildPage).not.toHaveBeenCalled(); // the MP is gone anyway
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
      expect(o.setNoChildPage).toHaveBeenCalledWith("mine", true);

      // Saved: entry gone, MP marked — no new page for it.
      rerender({
        p: project(xml, pages.slice(0, 2), [
          { id: "mp", type: "Multiprocess" },
          { id: "mine", type: "Multiprocess", properties: { noChildPage: true } },
        ]),
      });
      await new Promise((r) => setTimeout(r, 20));
      // No page for "mine" (5e may still add the missing link of MP-1).
      expect(o.syncPages.mock.calls.every((c) => c[0].create.length === 0)).toBe(true);
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

  describe("5e: links on later copies, orphan pages, create child page", () => {
    const pages: DFDPage[] = [
      { pageId: "p1", name: "Top", order: 0 },
      { pageId: "gw", name: "Gateway", decomposes: "mp", order: 1 },
    ];
    const opts = () => ({
      enabled: true,
      syncPages: vi.fn(async (_spec: DrawioPageSyncSpec) => ({ success: true, created: ["new1"] })),
      savePages: vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult),
      setNoChildPage: vi.fn(),
      newPageId: () => "new1",
    });
    // MP-1 with its page link on Top; a copy on the Gateway page's sibling
    // drawn later, without link.
    const linked = (id: string, label: string, display: string, x: number, target: string) =>
      node(id, "multiprocess", label, display, x).replace(
        `type="multiprocess" id="${id}"`,
        `type="multiprocess" id="${id}" link="data:page/id,${target}"`,
      );

    it("links a copy drawn after the page was created, once", async () => {
      const xml = mxfile(
        page("p1", "Top", EE + linked("mp", "Gateway", "MP-1", 300, "gw")),
        page("gw", "Gateway", node("gw_p", "process", "Part", "P-1.1", 10)),
        page("other", "Other", node("cp", "multiprocess", "Gateway", "MP-1", 10)),
      );
      const withOther: DFDPage[] = [
        ...pages,
        { pageId: "other", name: "Other", decomposes: "mx", order: 2, links: [{ cellId: "cp", tfId: "mp", role: "ref" }] },
      ];
      const o = opts();
      const { rerender } = renderHook(({ p }: { p: DFDProjectData }) => useChildPages(p, o), {
        initialProps: {
          p: project(xml, withOther, [
            { id: "mp", type: "Multiprocess" },
            { id: "mx", type: "Multiprocess" },
          ]),
        },
      });
      await waitFor(() => expect(o.syncPages).toHaveBeenCalled());
      const linkCall = o.syncPages.mock.calls.find((c) => (c[0].link ?? []).length > 0)!;
      expect(linkCall[0].link).toEqual([{ pageId: "other", cellId: "cp", target: "gw" }]);
      const calls = o.syncPages.mock.calls.length;
      rerender({
        p: project(xml + " ", withOther, [
          { id: "mp", type: "Multiprocess" },
          { id: "mx", type: "Multiprocess" },
        ]),
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(o.syncPages.mock.calls.filter((c) => (c[0].link ?? []).length > 0)).toHaveLength(1);
      expect(o.syncPages.mock.calls.length).toBeGreaterThanOrEqual(calls);
    });

    it("asks about the page of a deleted multiprocess and deletes it on request", async () => {
      // MP-1 deleted on Top; its page Gateway is still there.
      const xml = mxfile(page("p1", "Top", EE), page("gw", "Gateway", ""));
      const o = opts();
      const { result } = renderHook(() => useChildPages(project(xml, pages), o));
      await waitFor(() =>
        expect(result.current.orphanPages).toEqual([
          { pageId: "gw", name: "Gateway", decomposes: "mp" },
        ]),
      );
      await act(async () => {
        await result.current.resolveOrphan("gw", true);
      });
      expect(o.syncPages).toHaveBeenCalledWith({ create: [], rename: [], remove: ["gw"] });
      expect(result.current.orphanPages).toEqual([]);
    });

    it("keeps asking and reports the error when draw.io did not delete the page", async () => {
      const xml = mxfile(page("p1", "Top", EE), page("gw", "Gateway", ""));
      const o = {
        ...opts(),
        syncPages: vi.fn(async (_spec: DrawioPageSyncSpec) => ({
          success: true,
          errors: ["page not removed: gw (graph enabled: false, pages: 2 -> 2)"],
        })),
      };
      const { result } = renderHook(() => useChildPages(project(xml, pages), o));
      await waitFor(() => expect(result.current.orphanPages).toHaveLength(1));
      let error: string | null = null;
      await act(async () => {
        error = await result.current.resolveOrphan("gw", true);
      });
      expect(error).toContain("page not removed");
      expect(result.current.orphanPages).toHaveLength(1);
    });

    it("keeps the page when the analyst says so, and does not ask again", async () => {
      const xml = mxfile(page("p1", "Top", EE), page("gw", "Gateway", ""));
      const o = opts();
      const { result, rerender } = renderHook(
        ({ p }: { p: DFDProjectData }) => useChildPages(p, o),
        { initialProps: { p: project(xml, pages) } },
      );
      await waitFor(() => expect(result.current.orphanPages).toHaveLength(1));
      await act(async () => {
        await result.current.resolveOrphan("gw", false);
      });
      rerender({ p: project(xml + " ", pages) });
      await new Promise((r) => setTimeout(r, 20));
      expect(result.current.orphanPages).toEqual([]);
      expect(o.syncPages).not.toHaveBeenCalled();
    });

    it("creates a child page on request, also for an opted-out multiprocess", async () => {
      const xml = mxfile(
        page(
          "p1",
          "Top",
          EE + linked("mp", "Gateway", "MP-1", 300, "gw") +
            node("mine", "multiprocess", "MyProcess", "MP-2", 600),
        ),
        page("gw", "Gateway", node("gw_p", "process", "Part", "P-1.1", 10)),
      );
      const elements = [
        { id: "mp", type: "Multiprocess" },
        { id: "mine", type: "Multiprocess", properties: { noChildPage: true } },
      ];
      const o = opts();
      const { result } = renderHook(() => useChildPages(project(xml, pages, elements), o));
      await new Promise((r) => setTimeout(r, 20));
      expect(o.syncPages).not.toHaveBeenCalled(); // opted out: nothing automatic

      let ok = false;
      act(() => {
        ok = result.current.decompose("mine");
      });
      expect(ok).toBe(true);
      expect(o.setNoChildPage).toHaveBeenCalledWith("mine", false);
      await waitFor(() => expect(o.savePages).toHaveBeenCalled());
      expect(o.syncPages.mock.calls[0][0].create.map((c) => c.name)).toEqual(["MyProcess"]);
      expect(o.savePages.mock.calls[0][0].at(-1)).toMatchObject({ decomposes: "mine" });
    });

    it("refuses to create a second page for a decomposed multiprocess", () => {
      const xml = mxfile(page("p1", "Top", EE + node("mp", "multiprocess", "Gateway", "MP-1", 300)), page("gw", "Gateway", ""));
      const o = opts();
      const { result } = renderHook(() =>
        useChildPages(project(xml, pages, [{ id: "mp", type: "Multiprocess" }]), o),
      );
      expect(result.current.decompose("mp")).toBe(false);
    });
  });
});
