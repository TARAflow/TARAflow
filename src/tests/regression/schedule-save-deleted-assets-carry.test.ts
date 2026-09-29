// src/tests/regression/schedule-save-deleted-assets-carry.test.ts
//
// An asset deleted in the DFD tab is reported upward via
// DFDUpdateResult.deletedAssetIds so the app layer can remove it from the
// asset store too. scheduleSave REPLACES its pending result on every call, so
// a second edit inside the debounce window used to drop the deletion — the
// asset then stayed visible in the Asset tab. The ids must ride along with
// whatever update is emitted next.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import type { DFDProjectData, DFDData } from "features/dfd/models/dfd-types";

function makeDfd(): DFDData {
  return {
    elements: [],
    connections: [],
    assets: [
      { id: "a", displayId: "SY-001", name: "A" },
      { id: "b", displayId: "SY-002", name: "B" },
    ],
  } as unknown as DFDData;
}

function makeProject(dfd: DFDData): DFDProjectData {
  return {
    id: "proj-1",
    name: "Test",
    dfd,
    phaseStatus: {},
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "2020-01-01T00:00:00.000Z",
  } as unknown as DFDProjectData;
}

const PS = {} as DFDProjectData["phaseStatus"];

afterEach(() => {
  vi.useRealTimers();
});

describe("useDFDPersistence — deletedAssetIds survive later edits", () => {
  it("a deletion followed by another edit in the debounce window is still reported", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(makeDfd()), { onUpdate, debounceDelay: 500 }),
    );
    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: { ...base, assets: base.assets.filter((a) => a.id !== "a") },
        phaseStatus: PS,
        lastModified: "t1",
        deletedAssetIds: ["a"],
      }));
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((x) => ({ ...x, description: "edited" })),
        },
        phaseStatus: PS,
        lastModified: "t2",
      }));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const emitted = onUpdate.mock.calls[0][0];
    expect(emitted.deletedAssetIds).toEqual(["a"]);
    expect(emitted.dfd.assets.map((x: { id: string }) => x.id)).toEqual(["b"]);
  });

  it("reports a deletion exactly once", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(makeDfd()), { onUpdate, debounceDelay: 500 }),
    );
    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: { ...base, assets: base.assets.filter((a) => a.id !== "a") },
        phaseStatus: PS,
        lastModified: "t1",
        deletedAssetIds: ["a"],
      }));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: base,
        phaseStatus: PS,
        lastModified: "t2",
      }));
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0][0].deletedAssetIds).toEqual(["a"]);
    expect(onUpdate.mock.calls[1][0].deletedAssetIds).toBeUndefined();
  });
});
