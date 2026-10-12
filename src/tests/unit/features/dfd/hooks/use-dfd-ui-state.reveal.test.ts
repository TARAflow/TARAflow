// tests/unit/features/dfd/hooks/use-dfd-ui-state.reveal.test.ts
//
// A finding in the "describe" view opens its group and its entry — and
// never closes one that is already open (unlike the toggles).

import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDFDUIState } from "features/dfd/hooks/use-dfd-ui-state";

describe("useDFDUIState.revealElement", () => {
  it("opens group and entry; repeating keeps them open", () => {
    const { result } = renderHook(() => useDFDUIState({ projectId: "p-reveal" } as never));
    act(() => result.current.revealElement("assets", "a1"));
    expect(result.current.expandedGroups).toContain("assets");
    expect(result.current.expandedElements).toContain("a1");
    act(() => result.current.revealElement("assets", "a1"));
    expect(result.current.expandedGroups.filter((g) => g === "assets")).toHaveLength(1);
    expect(result.current.expandedElements).toEqual(["a1"]);
  });
});
