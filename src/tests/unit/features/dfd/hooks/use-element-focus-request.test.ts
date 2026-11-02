// tests/unit/features/dfd/hooks/use-element-focus-request.test.ts
//
// "Show in the diagram" from the Compliance to-do list: the DFD tab switches
// to the drawing, waits for draw.io and selects the element exactly once.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  SELECT_AFTER_SWITCH_MS,
  useElementFocusRequest,
  type ElementFocusRequest,
} from "features/dfd/hooks/use-element-focus-request";
import type { DFDViewMode } from "features/dfd/models/dfd-types";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

interface Props {
  request: ElementFocusRequest | null;
  viewMode: DFDViewMode;
  pluginReady: boolean;
}

function setup(initial: Props) {
  const setViewMode = vi.fn();
  const selectCell = vi.fn();
  const hook = renderHook((p: Props) => useElementFocusRequest(p.request, p.viewMode, setViewMode, p.pluginReady, selectCell), {
    initialProps: initial,
  });
  return { ...hook, setViewMode, selectCell };
}

describe("useElementFocusRequest", () => {
  it("in the drawing with draw.io ready: selects the element right away, once", () => {
    const request = { elementId: "df-7" };
    const { selectCell, setViewMode, rerender } = setup({ request, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    expect(selectCell).toHaveBeenCalledWith("df-7");
    rerender({ request, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    expect(selectCell).toHaveBeenCalledTimes(1);
    expect(setViewMode).not.toHaveBeenCalled();
  });

  it("from another view: switches to the drawing, selects after the re-initialisation", () => {
    const request = { elementId: "p-1" };
    const { selectCell, setViewMode, rerender } = setup({ request, viewMode: "describe", pluginReady: true });
    expect(setViewMode).toHaveBeenCalledWith("draw");
    rerender({ request, viewMode: "draw", pluginReady: true });
    vi.advanceTimersByTime(SELECT_AFTER_SWITCH_MS - 1);
    expect(selectCell).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(selectCell).toHaveBeenCalledWith("p-1");
  });

  it("waits until draw.io is ready", () => {
    const request = { elementId: "df-7" };
    const { selectCell, rerender } = setup({ request, viewMode: "draw", pluginReady: false });
    vi.runAllTimers();
    expect(selectCell).not.toHaveBeenCalled();
    rerender({ request, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    expect(selectCell).toHaveBeenCalledWith("df-7");
  });

  it("a new request for the same element selects it again; no request does nothing", () => {
    const { selectCell, rerender } = setup({ request: null, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    expect(selectCell).not.toHaveBeenCalled();
    rerender({ request: { elementId: "df-7" }, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    rerender({ request: { elementId: "df-7" }, viewMode: "draw", pluginReady: true });
    vi.runAllTimers();
    expect(selectCell).toHaveBeenCalledTimes(2);
  });
});
