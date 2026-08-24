// src/tests/regression/schedule-save-own-race.test.ts
//
// Replaces the file previously at this path, which was an exact duplicate
// of schedule-drawio-save-lost-update.test.ts (same header comment claiming
// the OTHER file's name, same test bodies, same DrawIO-focused scenarios —
// zero independent coverage). This file instead covers races BETWEEN TWO
// scheduleSave CALLS THEMSELVES, with no DrawIO involved at all — a gap
// neither the original duplicate nor schedule-drawio-save-lost-update.test.ts
// ever exercised.
//
// Why this needed its own file: scheduleSave's fix (reading
// `pendingSaveRef.current?.dfd ?? lastCommittedDfdRef.current ??
// projectRef.current.dfd` as the updater's `base`) was built to survive
// scheduleDrawioSave racing against it. Whether it ALSO correctly survives
// a SECOND scheduleSave call racing against the first — the far more common
// case in practice (two quick edits to two different assets, or two edits
// to the same asset) — is a separate question the DrawIO-focused tests
// cannot answer, because they only ever schedule scheduleSave once per test.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import type { DFDProjectData, DFDData } from "features/dfd/models/dfd-types";

function makeDfd(overrides: Partial<DFDData> = {}): DFDData {
  return {
    elements: [],
    connections: [],
    assets: [],
    ...overrides,
  } as unknown as DFDData;
}

function makeProject(dfd: DFDData): DFDProjectData {
  return {
    id: "proj-1",
    name: "Test",
    dfd,
    phaseStatus: {} as any,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "2020-01-01T00:00:00.000Z",
  } as unknown as DFDProjectData;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useDFDPersistence — scheduleSave vs. scheduleSave (no DrawIO involved)", () => {
  it("two rapid edits to DIFFERENT assets, both before the debounce fires, both survive in the single flushed call", () => {
    // The second scheduleSave call's updater receives `base` computed from
    // pendingSaveRef.current?.dfd — which, at the moment of the SECOND
    // call, already holds the FIRST call's result. If that chain were
    // broken (e.g. base fell back to the stale projectRef.current.dfd
    // instead), the second call's updater would build its DFDData from a
    // snapshot missing the first edit, and — because scheduleSave replaces
    // pendingSaveRef.current wholesale — the first edit would be lost the
    // instant the second call runs, even though only ONE flush ever fires.
    const dfd = makeDfd({
      assets: [
        { id: "DA-001", displayId: "DA-001", name: "A", description: undefined } as any,
        { id: "DA-002", displayId: "DA-002", name: "B", description: undefined } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), { onUpdate, debounceDelay: 500 }),
    );

    vi.useFakeTimers();

    act(() => {
      // t=0 — edit DA-001.
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, description: "first" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });

    act(() => {
      // t=100 — edit DA-002, well before the 500ms timer fires. This
      // RESETS the debounce timer (single shared saveTimerRef) — only one
      // flush will happen, at t=600.
      vi.advanceTimersByTime(100);
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "second" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t2",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const assets = onUpdate.mock.calls[0][0].dfd.assets;
    expect(assets.find((a: any) => a.id === "DA-001").description).toBe(
      "first",
    );
    expect(assets.find((a: any) => a.id === "DA-002").description).toBe(
      "second",
    );
  });

  it("two rapid edits to the SAME asset's different fields both survive — the second doesn't clobber the first's field", () => {
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-001",
          displayId: "DA-001",
          name: "A",
          description: undefined,
          protectionNeed: "low",
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), { onUpdate, debounceDelay: 500 }),
    );

    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, description: "typed text" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, protectionNeed: "high" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t2",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const asset = onUpdate.mock.calls[0][0].dfd.assets[0];
    expect(asset.description).toBe("typed text");
    expect(asset.protectionNeed).toBe("high");
  });

  it("three edits in quick succession (each resetting the timer) still coalesce into exactly one flush with all three applied", () => {
    // Guards against a fix that only happens to work for exactly two
    // concurrent callers — the same class of guard
    // update-project-lost-update.test.ts applies to updateProject.
    const dfd = makeDfd({
      assets: [
        { id: "DA-001", displayId: "DA-001", name: "A" } as any,
        { id: "DA-002", displayId: "DA-002", name: "B" } as any,
        { id: "DA-003", displayId: "DA-003", name: "C" } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), { onUpdate, debounceDelay: 500 }),
    );

    vi.useFakeTimers();

    const edit = (id: string, description: string) =>
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === id ? { ...a, description } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: id,
      }));

    act(() => edit("DA-001", "a"));
    act(() => {
      vi.advanceTimersByTime(100);
      edit("DA-002", "b");
    });
    act(() => {
      vi.advanceTimersByTime(100);
      edit("DA-003", "c");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const assets = onUpdate.mock.calls[0][0].dfd.assets;
    expect(assets.find((a: any) => a.id === "DA-001").description).toBe("a");
    expect(assets.find((a: any) => a.id === "DA-002").description).toBe("b");
    expect(assets.find((a: any) => a.id === "DA-003").description).toBe("c");
  });

  it("an edit that arrives AFTER a previous one has already flushed is a genuinely SEPARATE, second onUpdate call", () => {
    // Guards against an over-eager fix that dedupes or drops a call just
    // because "we already saved recently" — flushing must not make the
    // hook forget how to schedule a brand new, independent save afterward.
    const dfd = makeDfd({
      assets: [{ id: "DA-001", displayId: "DA-001", name: "A" } as any],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), { onUpdate, debounceDelay: 500 }),
    );

    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, description: "first" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    act(() => {
      // A second, independent edit well after the first flushed.
      vi.advanceTimersByTime(200);
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, description: "second" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t2",
      }));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(
      onUpdate.mock.calls[1][0].dfd.assets.find(
        (a: any) => a.id === "DA-001",
      ).description,
    ).toBe("second");
  });

  it("with debounceDelay=0 (disabled), two immediate back-to-back saves both apply — the second's base isn't stale projectRef", () => {
    // debounceDelay<=0 takes the "save immediately" branch, which never
    // touches pendingSaveRef at all. lastCommittedDfdRef is what must
    // carry the first save's result forward as the second call's base,
    // since `project` (the prop) has not re-rendered between the two
    // synchronous calls in this test.
    const dfd = makeDfd({
      assets: [
        { id: "DA-001", displayId: "DA-001", name: "A" } as any,
        { id: "DA-002", displayId: "DA-002", name: "B" } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), { onUpdate, debounceDelay: 0 }),
    );

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-001" ? { ...a, description: "first" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });
    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "second" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t2",
      }));
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    // The second call's OWN result only touches DA-002 directly, but its
    // `base` must have come from the first call's already-saved dfd (via
    // lastCommittedDfdRef), not the original stale project.dfd — otherwise
    // DA-001's "first" description would be silently reverted to undefined
    // in this second onUpdate payload.
    const secondPayloadAssets = onUpdate.mock.calls[1][0].dfd.assets;
    expect(
      secondPayloadAssets.find((a: any) => a.id === "DA-001").description,
    ).toBe("first");
    expect(
      secondPayloadAssets.find((a: any) => a.id === "DA-002").description,
    ).toBe("second");
  });
});
