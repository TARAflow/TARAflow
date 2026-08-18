// src/tests/regression/schedule-drawio-save-lost-update.test.ts
//
// Regression coverage for: an asset/element/connection description edit
// (via scheduleSave, 500ms debounce) that is still PENDING — not yet
// flushed to onUpdate — gets silently discarded if a DrawIO autosave event
// (scheduleDrawioSave, 1500ms debounce) resolves in the meantime.
//
// Root cause: scheduleDrawioSave's timer callback reads `projectRef.current`
// only — the project PROP snapshot from the last render — and passes that
// into dfdService.saveDFDFromXml() as the merge base. It never consults
// `pendingSaveRef.current`, the freshest known dfd. saveDFDFromXml's
// mergeAssetProperties() merges the freshly-parsed XML against the STALE
// project.dfd.assets, and any pending description is gone from the result
// handed to onUpdate — which flows into workspace-layout.tsx's
// handleDFDUpdate, corrupting `patch.dfd` while `patch.assets` (built via
// syncFromDFD's content-aware merge) happens to survive. This produces the
// exact split observed in production traces: patch.assets correct,
// patch.dfd stale for the same asset id.
//
// Fix under test (not yet applied — THE BUG tests below should FAIL until
// it is, THE FIX tests document the required behavior once it lands):
//   1. scheduleDrawioSave must build its merge base the same way
//      scheduleSave does: `pendingSaveRef.current?.dfd ?? projectRef.current.dfd`.
//   2. After a DrawIO save successfully folds a pending edit into its
//      result, it must clear `pendingSaveRef.current` and cancel
//      `saveTimerRef.current` — otherwise scheduleSave's own timer later
//      fires with a now-stale pending value and overwrites the DrawIO
//      result's asset data.
//
// dfdParser.parse / dfdValidator.validate are mocked to isolate the race
// itself from XML-parsing specifics — every test asset that is NOT present
// in the (mocked, empty) parsed output falls into saveDFDFromXml's
// mergeAssetProperties "assetsOnlyInProject" branch, which spreads the
// existing asset through untouched. That makes the merge base — and ONLY
// the merge base — the variable under test.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { dfdValidator } from "features/dfd/services/dfd-validator";
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

describe("useDFDPersistence — scheduleDrawioSave lost-update race", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parseSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let validateSpy: any;

  beforeEach(() => {
    // Empty parse result — every existing asset/element/connection falls
    // into the "not in parsed XML" preservation branch of the merge
    // functions, so the test isolates the merge BASE, not parser behavior.
    parseSpy = vi.spyOn(dfdParser, "parse").mockReturnValue({
      elements: [],
      connections: [],
      assets: [],
      stats: {} as any,
      unconnectedDataflows: [],
    } as any);

    validateSpy = vi.spyOn(dfdValidator, "validate").mockReturnValue({
      isValid: true,
      isComplete: true,
      errors: [],
      warnings: [],
      scenario: null,
    } as any);
  });

  afterEach(() => {
    parseSpy.mockRestore();
    validateSpy.mockRestore();
    vi.useRealTimers();
  });

  it("THE BUG: a pending scheduleSave description edit is discarded by a DrawIO autosave that resolves before it flushes", () => {
    const dfd = makeDfd({
      assets: [
        { id: "DA-001", displayId: "DA-001", name: "A" } as any,
        {
          id: "DA-002",
          displayId: "DA-002",
          name: "B",
          description: undefined,
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      // t=0 — user edits DA-002's description. Scheduled 500ms out; stored
      // in pendingSaveRef. `project` (the prop) is NOT yet updated — that
      // only happens once onUpdate fires and the parent re-renders.
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "dddddd" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });

    act(() => {
      // t=0+ε — canvas interaction fires a DrawIO autosave event. Its own
      // 1500ms timer starts BEFORE scheduleSave's 500ms timer has flushed.
      result.current.scheduleDrawioSave("<xml/>");
    });

    act(() => {
      // t=500 — scheduleSave flushes. onUpdate receives "dddddd".
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-002",
      ).description,
    ).toBe("dddddd");

    // NOTE: in production, WorkspaceLayout only re-renders (and therefore
    // updates the `project` PROP passed into useDFDPersistence) on the next
    // commit after onUpdate → updateProject → setProjects. We deliberately
    // do NOT re-render the hook with a merged project here — that gap is
    // exactly the window in which projectRef.current is stale, which is
    // what this test targets.

    act(() => {
      // t=1500 — scheduleDrawioSave's timer fires. It builds its merge
      // base from `projectRef.current` — still the ORIGINAL project,
      // missing "dddddd".
      vi.advanceTimersByTime(1000);
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    const da002 = onUpdate.mock.calls[1][0].dfd.assets.find(
      (a: any) => a.id === "DA-002",
    );

    // Documents the CORRECT behavior. Fails until scheduleDrawioSave builds
    // its base as `pendingSaveRef.current?.dfd ?? projectRef.current.dfd`.
    expect(da002.description).toBe("dddddd");
  });

  it("THE BUG (reverse order): a scheduleSave edit arriving AFTER scheduleDrawioSave has already started must still win", () => {
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-002",
          displayId: "DA-002",
          name: "B",
          description: undefined,
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      // t=0 — DrawIO autosave fires first. Its 1500ms timer is running.
      result.current.scheduleDrawioSave("<xml/>");
    });

    act(() => {
      // t=200 — user edits DA-002's description while the DrawIO timer is
      // still pending. scheduleSave's own 500ms timer will flush at t=700,
      // well BEFORE the DrawIO timer fires at t=1500.
      vi.advanceTimersByTime(200);
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "dddddd" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });

    act(() => {
      // t=700 — scheduleSave flushes.
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-002",
      ).description,
    ).toBe("dddddd");

    act(() => {
      // t=1500 — DrawIO timer (started at t=0) fires. Same staleness
      // problem as the first test, just with the two calls interleaved
      // the other way round.
      vi.advanceTimersByTime(800);
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    const da002 = onUpdate.mock.calls[1][0].dfd.assets.find(
      (a: any) => a.id === "DA-002",
    );
    expect(da002.description).toBe("dddddd");
  });

  it("THE FIX, part 2: a scheduleSave edit still pending when the DrawIO timer resolves is folded in AND its own timer is cancelled — no stale second call", () => {
    // With the default delays (save=500ms, drawio=1500ms), scheduleSave's
    // timer always fires FIRST when both start around the same time — so
    // by the time scheduleDrawioSave's callback runs, pendingSaveRef is
    // already back to null (see lastCommittedDfdRef in the fix). The
    // scenario where pendingSaveRef is genuinely STILL populated when the
    // DrawIO timer resolves needs the edit to arrive late enough that its
    // own 500ms timer would fire AFTER the DrawIO timer — e.g. the user is
    // mid-edit right as an in-flight DrawIO autosave (started earlier)
    // resolves.
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-002",
          displayId: "DA-002",
          name: "B",
          description: undefined,
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      // t=0 — DrawIO autosave starts. Resolves at t=1500.
      result.current.scheduleDrawioSave("<xml/>");
    });

    act(() => {
      // t=1100 — user edits DA-002's description. Its own 500ms timer
      // would fire at t=1600 — AFTER the DrawIO timer at t=1500.
      vi.advanceTimersByTime(1100);
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "dddddd" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
    });

    act(() => {
      // t=1500 — DrawIO timer fires. pendingSaveRef is STILL populated
      // (its own timer hasn't reached t=1600 yet) — the fix must fold it
      // into the merge base AND cancel/clear it so it doesn't also fire
      // on its own afterwards.
      vi.advanceTimersByTime(400);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-002",
      ).description,
    ).toBe("dddddd");

    act(() => {
      // t=1600+ — advance well past where the now-cancelled scheduleSave
      // timer would have fired. Must NOT produce a second, redundant call.
      vi.advanceTimersByTime(1000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("a DrawIO autosave with NO pending scheduleSave edit behaves as before (no regression)", () => {
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-001",
          displayId: "DA-001",
          name: "A",
          description: "kept",
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      result.current.scheduleDrawioSave("<xml/>");
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-001",
      ).description,
    ).toBe("kept");
  });

  it("a pending edit already flushed via flush() before the DrawIO timer fires is NOT re-applied or duplicated (no regression)", () => {
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-002",
          displayId: "DA-002",
          name: "B",
          description: undefined,
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          assets: base.assets.map((a) =>
            a.id === "DA-002" ? { ...a, description: "dddddd" } : a,
          ),
        },
        phaseStatus: {} as any,
        lastModified: "t1",
      }));
      result.current.scheduleDrawioSave("<xml/>");
    });

    act(() => {
      // Explicit flush (e.g. tab switch) before either timer fires —
      // pendingSaveRef is cleared by flush() itself.
      result.current.flush();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-002",
      ).description,
    ).toBe("dddddd");

    act(() => {
      // flush() cancels the DrawIO timer too — advancing well past 1500ms
      // must not produce a second call.
      vi.advanceTimersByTime(5000);
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("two DrawIO autosave events in quick succession only produce ONE save, using the latest XML", () => {
    const dfd = makeDfd({
      assets: [
        {
          id: "DA-001",
          displayId: "DA-001",
          name: "A",
          description: "kept",
        } as any,
      ],
    });
    const onUpdate = vi.fn();

    const { result } = renderHook(() =>
      useDFDPersistence(makeProject(dfd), {
        onUpdate,
        debounceDelay: 500,
        drawioAutosaveDelay: 1500,
      }),
    );

    vi.useFakeTimers();

    act(() => {
      result.current.scheduleDrawioSave('<xml v="1"/>');
    });
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.scheduleDrawioSave('<xml v="2"/>'); // resets the 1500ms timer
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    // Description untouched either way — this test guards the debounce
    // coalescing behavior itself, independent of the description race.
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find(
        (a: any) => a.id === "DA-001",
      ).description,
    ).toBe("kept");
  });
});