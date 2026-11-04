// tests/unit/features/attacktree/hooks/use-attacktree-data.flush.test.tsx
//
// The Attack Tree tab is keyed by project id, so a project switch (or closing
// the project) unmounts it. Its auto-save is debounced (1 s); a change still
// inside that window was dropped with the cleared timer. The hook now flushes
// a pending change on unmount — through the onUpdate it was given, which the
// workspace pins to the tab's own project.

import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAttackTreeData } from "features/attacktree/hooks/use-attacktree-data";
import type { AttackTreeAnchor } from "features/attacktree/models/attacktree-types";
import { makeProjectData } from "../attacktree-factory";

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-001",
  assetName: "Config Database",
  securityGoal: "C",
};

describe("useAttackTreeData — flush on unmount", () => {
  it("saves a change still inside the debounce window when the tab unmounts", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const project = makeProjectData();
      const { result, unmount } = renderHook(() => useAttackTreeData(project, onUpdate));

      act(() => {
        result.current.createTree(ASSET_ANCHOR);
      });
      act(() => {
        vi.advanceTimersByTime(300); // well inside the 1 s debounce
      });
      expect(onUpdate).not.toHaveBeenCalled();

      unmount();

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate.mock.calls[0][0].attackTrees.trees).toHaveLength(1);

      // And nothing more after the timer would have fired.
      vi.advanceTimersByTime(2000);
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not save on unmount when nothing is pending", () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useAttackTreeData(makeProjectData(), onUpdate));
    unmount();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
