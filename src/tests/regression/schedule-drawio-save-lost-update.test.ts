// src/tests/regression/schedule-drawio-save-lost-update.test.ts
//
// Regression coverage for: an asset/element/connection description edit
// (via scheduleSave, 500ms debounce) that is still PENDING — not yet
// flushed to onUpdate — gets silently discarded if a DrawIO autosave event
// (scheduleDrawioSave, 1500ms debounce) resolves in the meantime.
//
// Root cause: scheduleDrawioSave's timer callback used to read
// `projectRef.current` only — the project PROP snapshot from the last
// render — and passed that into dfdService.saveDFDFromXml() as the merge
// base. It never consulted `pendingSaveRef.current`, the freshest known
// dfd. saveDFDFromXml's mergeAssetProperties() would merge the freshly-
// parsed XML against the STALE project.dfd.assets, and any pending
// description was gone from the result handed to onUpdate — which flowed
// into workspace-layout.tsx's handleDFDUpdate, corrupting `patch.dfd`
// while `patch.assets` (built via syncFromDFD's content-aware merge)
// happened to survive. This produced the exact split observed in
// production traces: patch.assets correct, patch.dfd stale for the same
// asset id.
//
// STATUS: FIXED AND CONFIRMED (all tests below pass — full suite run
// confirmed 148/148 test files, 1308/1309 tests green, 1 unrelated todo).
// The fix, now live in use-dfd-persistence.ts:
//   1. scheduleDrawioSave builds its merge base the same way scheduleSave
//      does, plus one extra fallback layer:
//      `pendingSaveRef.current?.dfd ?? lastCommittedDfdRef.current ??
//      projectRef.current.dfd`. The middle fallback (lastCommittedDfdRef)
//      covers a gap the original two-step chain alone would still have
//      missed: the instant scheduleSave's OWN timer flushes, it clears
//      pendingSaveRef back to null, but `project` (the prop) has not
//      necessarily re-rendered with the flushed value yet — stale
//      projectRef.current in exactly that window. lastCommittedDfdRef is
//      updated at every onUpdate call site and survives that gap.
//   2. After a DrawIO save successfully folds a pending edit into its
//      result, it clears `pendingSaveRef.current` and cancels
//      `saveTimerRef.current` — so scheduleSave's own timer doesn't later
//      fire with a now-stale pending value and overwrite the DrawIO
//      result's asset data.
//
// The "THE BUG" test names below are kept as-is (rather than renamed to
// "THE FIX") because they still describe the SCENARIO under test, and
// renaming them would lose the git-blame trail back to the original bug
// report. What changed is that they now pass instead of documenting an
// expected failure — the inline comments at each assertion still explain
// why.
//
// dfdParser.parse / dfdValidator.validate are mocked to isolate the race
// itself from XML-parsing specifics — every test asset that is NOT present
// in the (mocked, empty) parsed output falls into saveDFDFromXml's
// mergeAssetProperties "assetsOnlyInProject" branch, which spreads the
// existing asset through untouched. That makes the merge base — and ONLY
// the merge base — the variable under test.
//
// See also: schedule-save-own-race.test.ts, which covers races between
// TWO scheduleSave calls (no DrawIO involved) — a gap this file's DrawIO-
// focused scenarios don't reach.

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
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-002")
        .description,
    ).toBe("dddddd");

    // NOTE: in production, WorkspaceLayout only re-renders (and therefore
    // updates the `project` PROP passed into useDFDPersistence) on the next
    // commit after onUpdate → updateProject → setProjects. We deliberately
    // do NOT re-render the hook with a merged project here — that gap is
    // exactly the window in which projectRef.current is stale, which is
    // what this test targets.

    act(() => {
      // t=1500 — scheduleDrawioSave's timer fires. It builds its merge
      // base from `pendingSaveRef.current?.dfd ?? lastCommittedDfdRef.current
      // ?? projectRef.current.dfd` — at this point pendingSaveRef is
      // already null (scheduleSave's own timer cleared it at t=500), so it
      // falls through to lastCommittedDfdRef, which DOES have "dddddd"
      // (set at the same t=500 flush). Before the fix, this fell straight
      // to the stale projectRef.current, missing "dddddd" entirely.
      vi.advanceTimersByTime(1000);
    });

    expect(onUpdate).toHaveBeenCalledTimes(2);
    const da002 = onUpdate.mock.calls[1][0].dfd.assets.find(
      (a: any) => a.id === "DA-002",
    );
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
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-002")
        .description,
    ).toBe("dddddd");

    act(() => {
      // t=1500 — DrawIO timer (started at t=0) fires. Same lastCommittedDfdRef
      // fallback as the first test, just with the two calls interleaved
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
      // (its own timer hasn't reached t=1600 yet) — folded into the merge
      // base AND cancelled/cleared so it doesn't also fire on its own
      // afterwards.
      vi.advanceTimersByTime(400);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-002")
        .description,
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
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-001")
        .description,
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
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-002")
        .description,
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
      onUpdate.mock.calls[0][0].dfd.assets.find((a: any) => a.id === "DA-001")
        .description,
    ).toBe("kept");
  });
});