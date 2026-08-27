// src/tests/regression/cross-channel-stale-base-asset-drop.test.ts
//
// Reproduces the "is_an asset vanishes after adding a relation" bug at the
// persistence-hook level — the mechanism confirmed from a real project file
// where element.assetRelations referenced assets (SY-001, FU-001) that no
// longer existed in dfd.assets.
//
// Mechanism: project.dfd has TWO writers. The DFD tab writes through
// useDFDPersistence (which maintains lastCommittedDfdRef). Other channels
// (Assets tab, Hazards, initial backfill) write project.dfd directly via
// updateProject, BYPASSING this hook — so lastCommittedDfdRef never learns
// about their writes. Yet scheduleSave picks its `base` as:
//
//     pendingSaveRef.current?.dfd
//       ?? lastCommittedDfdRef.current   // stale, but non-null → WINS
//       ?? projectRef.current.dfd        // fresher, never consulted
//
// So when a foreign channel added the asset and the DFD tab then adds the
// relation, the relation edit builds on the STALE base (no asset) and the
// wholesale pending replacement drops the asset from dfd.assets. commitAssetSync
// then faithfully prunes it from the Assets tab too — gone from both.
//
// The fix: `base` must be the FRESHEST of the three by lastModified, so a
// foreign project.dfd update is not shadowed by a stale lastCommittedDfdRef.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import type { DFDProjectData, DFDData } from "features/dfd/models/dfd-types";

function makeDfd(overrides: Partial<DFDData> = {}): DFDData {
  return {
    elements: [],
    connections: [],
    assets: [],
    lastModified: "2020-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as DFDData;
}

function makeProject(dfd: DFDData): DFDProjectData {
  return {
    id: "proj-1",
    name: "Test",
    dfd,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: "2020-01-01T00:00:00.000Z",
  } as unknown as DFDProjectData;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useDFDPersistence — foreign project.dfd write must not be shadowed by stale lastCommittedDfdRef", () => {
  it("keeps an asset added via a foreign channel when the next DFD-tab edit only touches an element", () => {
    // t=0: DFD tab mounts with a project whose dfd has the element but NO
    // asset yet. lastCommittedDfdRef initializes to THIS dfd.
    const flashEl = {
      id: "11",
      type: "DataStore",
      name: "Flash",
      displayId: "DS-1",
      assetRelations: [],
    } as unknown as DFDData["elements"][number];

    const initialDfd = makeDfd({
      elements: [flashEl],
      assets: [],
      lastModified: "2020-01-01T00:00:00.000Z",
    });

    const onUpdate = vi.fn();

    const { result, rerender } = renderHook(
      ({ project }) =>
        useDFDPersistence(project, { onUpdate, debounceDelay: 500 }),
      { initialProps: { project: makeProject(initialDfd) } },
    );

    // A FOREIGN channel (e.g. Assets tab / Hazards / backfill) creates the
    // asset SY-001 and writes project.dfd directly via updateProject. In the
    // component tree this arrives as a new `project` prop — NOT through this
    // hook's scheduleSave — so projectRef updates but lastCommittedDfdRef does
    // not. The foreign write carries a newer lastModified, as every real
    // updateDFD/updateProject does.
    const foreignDfd = makeDfd({
      elements: [flashEl],
      assets: [
        {
          id: "SY-001",
          displayId: "SY-001",
          name: "Data Service",
          assetGroup: "system",
          description: undefined,
          linkedElements: [],
        } as never,
      ],
      lastModified: "2026-01-01T00:00:00.000Z",
    });

    rerender({ project: makeProject(foreignDfd) });

    vi.useFakeTimers();

    // Now the DFD tab adds the is_an relation to the Flash element. This
    // updater ONLY edits the element — it carries base.assets through
    // untouched. If base is the fresh dfd, SY-001 survives; if base is the
    // stale lastCommittedDfdRef (no asset), SY-001 is dropped.
    act(() => {
      result.current.scheduleSave((base) => ({
        dfd: {
          ...base,
          elements: base.elements.map((el) =>
            el.id === "11"
              ? {
                  ...el,
                  assetRelations: [
                    {
                      assetId: "SY-001",
                      assetGroup: "system",
                      relationType: "is_an",
                    },
                  ],
                }
              : el,
          ),
          lastModified: "2026-02-02T00:00:00.000Z",
        },
        phaseStatus: {} as never,
        lastModified: "2026-02-02T00:00:00.000Z",
      }));
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const saved = onUpdate.mock.calls[0][0].dfd as DFDData;

    // The relation must be there (this part always worked)...
    const rel = saved.elements
      .find((e) => e.id === "11")!
      .assetRelations!.find((r) => r.assetId === "SY-001");
    expect(rel).toBeDefined();

    // ...and — THE BUG — the asset object must NOT have been dropped.
    const ids = saved.assets.map((a) => a.id);
    expect(ids).toContain("SY-001");
  });
});
