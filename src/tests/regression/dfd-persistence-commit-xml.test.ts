// src/tests/regression/dfd-persistence-commit-xml.test.ts
//
// Multi-project TARA (design §5): the component import is a programmatic
// XML edit. Its records (new pages with identity links, properties) must be
// the base of the save of its XML, and they must be known before anything
// else saves: in the manual test (2026-11-07) the thumbnail save after the
// first autosave still read the project prop — the page tree before the
// import — so the new child page counted as not adopted
// (ID_ADOPTION_PENDING); the adoption then re-linked the copies by display
// id and the boundary flows (DF-xx) lost their identity.
//   - commitXml saves the XML at once with the given base and hands it on
//   - it flushes a pending edit first; a refused save hands nothing on
//   - save() uses the freshest base, not the prop

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDData, DFDProjectData } from "features/dfd/models/dfd-types";

vi.mock("features/dfd/services/dfd-storage-adapter", () => ({
  createDFDStorageAdapter: () => ({ syncFromLegacy: () => {}, getXml: () => "<mxfile/>" }),
}));

const dfd = (lastModified: string, extra: Partial<DFDData> = {}): DFDData =>
  ({ elements: [], connections: [], assets: [], lastModified, ...extra }) as unknown as DFDData;
const project = (d: DFDData): DFDProjectData =>
  ({ id: "p", name: "p", dfd: d, phaseStatus: {}, settings: {}, lastModified: "" }) as unknown as DFDProjectData;
const echo = (d: DFDData) => ({ success: true, dfd: d, phaseStatus: {}, lastModified: d.lastModified }) as never;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDFDPersistence — commitXml / getBase", () => {
  it("getBase is the project's dfd until something newer exists", () => {
    const base = dfd("2026-01-01T00:00:00Z");
    const { result } = renderHook(() => useDFDPersistence(project(base), { onUpdate: vi.fn() }));
    expect(result.current.getBase()).toBe(base);
  });

  it("commitXml saves the XML with the given base and hands the result on at once", () => {
    const save = vi.spyOn(dfdService, "saveDFDFromXml").mockImplementation((p) => echo(p.dfd!));
    const onUpdate = vi.fn();
    const p = project(dfd("2026-01-01T00:00:00Z"));
    const options = { onUpdate };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    const committed = dfd(new Date().toISOString(), {
      pages: [{ pageId: "top", name: "Top", order: 0 }, { pageId: "cmp", name: "C", order: 1, decomposes: "mp", links: [{ cellId: "occ", tfId: "df", role: "ref" }] }],
      elements: [{ id: "cmp1", properties: { x: 1 } } as never],
    } as never);
    let out: unknown;
    act(() => {
      out = result.current.commitXml(committed, "<mxfile id='new'/>");
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].dfd).toBe(committed);
    expect(save.mock.calls[0][1]).toBe("<mxfile id='new'/>");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].dfd.pages[1].links).toEqual([{ cellId: "occ", tfId: "df", role: "ref" }]);
    expect(out).not.toBeNull();
    expect(result.current.getBase()).toBe(committed);
  });

  it("commitXml flushes a pending edit first", () => {
    vi.spyOn(dfdService, "saveDFDFromXml").mockImplementation((p) => echo(p.dfd!));
    const onUpdate = vi.fn();
    const p = project(dfd("2026-01-01T00:00:00Z"));
    const options = { onUpdate, debounceDelay: 500 };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    vi.useFakeTimers();
    act(() => {
      result.current.scheduleSave((base) => ({ dfd: { ...base, lastModified: "edit" }, phaseStatus: {} as never, lastModified: "edit" }));
      result.current.commitXml(dfd(new Date().toISOString()), "<mxfile/>");
    });
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0][0].dfd.lastModified).toBe("edit");
  });

  it("a refused commit hands nothing on", () => {
    vi.spyOn(dfdService, "saveDFDFromXml").mockReturnValue({ success: false, error: "stop" } as never);
    const onUpdate = vi.fn();
    const p = project(dfd("2026-01-01T00:00:00Z"));
    const options = { onUpdate };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    let out: unknown = "unset";
    act(() => {
      out = result.current.commitXml(dfd(new Date().toISOString()), "<mxfile/>");
    });
    expect(out).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("save() right after a commit uses the committed page tree, not the stale prop", async () => {
    vi.spyOn(dfdService, "saveDFDFromXml").mockImplementation((p) => echo(p.dfd!));
    const saveDfd = vi.spyOn(dfdService, "saveDFD").mockImplementation((p) => echo(p.dfd!));
    const p = project(dfd("2026-01-01T00:00:00Z")); // the prop: before the import
    const options = { onUpdate: vi.fn() };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    const committed = dfd(new Date().toISOString(), { pages: [{ pageId: "top", name: "Top", order: 0 }, { pageId: "cmp", name: "C", order: 1 }] } as never);
    act(() => {
      result.current.commitXml(committed, "<mxfile/>");
    });
    await act(async () => {
      await result.current.save("thumb");
    });
    expect(saveDfd).toHaveBeenCalledTimes(1);
    expect(saveDfd.mock.calls[0][0].dfd).toBe(committed);
  });
});
