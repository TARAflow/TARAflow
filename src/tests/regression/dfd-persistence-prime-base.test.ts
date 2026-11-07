// src/tests/regression/dfd-persistence-prime-base.test.ts
//
// Multi-project TARA, phase 1 (design §5): the component import is a
// programmatic XML edit. Its new records (pages, properties) must be the
// base of the save of its XML — otherwise saveDFDFromXml merges against the
// old records and the component's properties are lost. primeBase makes the
// given dfd the base; getBase reads the freshest base.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import dfdService from "features/dfd/services/dfd-service";
import type { DFDData, DFDProjectData } from "features/dfd/models/dfd-types";

const dfd = (lastModified: string, extra: Partial<DFDData> = {}): DFDData =>
  ({ elements: [], connections: [], assets: [], lastModified, ...extra }) as unknown as DFDData;
const project = (d: DFDData): DFDProjectData =>
  ({ id: "p", name: "p", dfd: d, phaseStatus: {}, settings: {}, lastModified: "" }) as unknown as DFDProjectData;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDFDPersistence — primeBase / getBase", () => {
  it("getBase is the project's dfd until something newer exists", () => {
    const base = dfd("2026-01-01T00:00:00Z");
    const { result } = renderHook(() => useDFDPersistence(project(base), { onUpdate: vi.fn() }));
    expect(result.current.getBase()).toBe(base);
  });

  it("a primed dfd is the base of the next drawio save", () => {
    const save = vi.spyOn(dfdService, "saveDFDFromXml").mockReturnValue({ success: false, error: "stop" } as never);
    // Stable inputs: a new onUpdate per render would change flush and its
    // unmount effect would cancel the timer.
    const p = project(dfd("2026-01-01T00:00:00Z"));
    const options = { onUpdate: vi.fn(), drawioAutosaveDelay: 10 };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    const primed = dfd(new Date().toISOString(), { elements: [{ id: "cmp1", properties: { x: 1 } } as never] });
    vi.useFakeTimers();
    act(() => {
      result.current.primeBase(primed);
      result.current.scheduleDrawioSave("<mxfile/>");
    });
    expect(result.current.getBase()).toBe(primed);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].dfd).toBe(primed);
    expect(save.mock.calls[0][1]).toBe("<mxfile/>");
  });

  it("primeBase flushes a pending edit first", () => {
    const onUpdate = vi.fn();
    const p = project(dfd("2026-01-01T00:00:00Z"));
    const options = { onUpdate, debounceDelay: 500 };
    const { result } = renderHook(() => useDFDPersistence(p, options));
    vi.useFakeTimers();
    act(() => {
      result.current.scheduleSave((base) => ({ dfd: { ...base, lastModified: "edit" }, phaseStatus: {} as never, lastModified: "edit" }));
      result.current.primeBase(dfd(new Date().toISOString()));
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].dfd.lastModified).toBe("edit");
  });
});
