// src/tests/component/asset-graph-move.test.tsx
//
// Asset graph design FR-V17 (doc/InProgress/DFD/asset-graph-hazards-and-node-
// move.md): Ctrl / ⌘ + drag moves one node horizontally along its lane; y,
// the other nodes and the project stay as they are; the position is
// remembered locally (FR-V15) and survives until "Rearrange". The click that
// ends a move does not select the node.

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, positionsStorageKey, type AssetGraphSource } from "features/dfd/asset-graph";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const source: AssetGraphSource = {
  assets: [
    { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
    { id: "d2", displayId: "DA-002", name: "Config", assetGroup: "data" },
    { id: "h1", displayId: "HU-001", name: "Operator", assetGroup: "human" },
  ],
  relations: [],
  elements: [],
};

const onSelectAsset = vi.fn();
const view = () =>
  render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={onSelectAsset} projectId="proj-1" />);
/** Preset "All" — the default (architecture) hides the human layer. */
const showAll = () => {
  fireEvent.mouseDown(within(screen.getByTestId("asset-graph-preset")).getByRole("combobox"));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "all" }));
};
const at = (id: string) =>
  screen.getByTestId(`asset-graph-node-${id}`).getAttribute("transform")!.match(/translate\(([-\d.]+),([-\d.]+)\)/)!
    .slice(1)
    .map(Number);
const drag = (id: string, dx: number, keys: { ctrlKey?: boolean; metaKey?: boolean }) => {
  const node = screen.getByTestId(`asset-graph-node-${id}`);
  fireEvent.pointerDown(node, { button: 0, clientX: 100, clientY: 100, ...keys });
  act(() => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 100 + dx, clientY: 130 }));
  });
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerup", { clientX: 100 + dx, clientY: 130 }));
  });
  fireEvent.click(node);
};

beforeEach(() => {
  localStorage.clear();
  onSelectAsset.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AssetGraphView — moving a node (FR-V17)", () => {
  it("Ctrl + drag moves only that node, horizontally; the click does not select", () => {
    view();
    showAll();
    const [x1, y1] = at("d1");
    const d2 = at("d2");
    const h1 = at("h1");
    drag("d1", 200, { ctrlKey: true });
    expect(at("d1")).toEqual([x1 + 200, y1]); // zoom k = 1
    expect(at("d2")).toEqual(d2);
    expect(at("h1")).toEqual(h1);
    expect(onSelectAsset).not.toHaveBeenCalled();
  });

  it("⌘ + drag does the same (macOS)", () => {
    view();
    const [x1, y1] = at("d1");
    drag("d1", -90, { metaKey: true });
    expect(at("d1")).toEqual([x1 - 90, y1]);
  });

  it("without the key: no move, the click selects as before", () => {
    view();
    const before = at("d1");
    drag("d1", 200, {});
    expect(at("d1")).toEqual(before);
    expect(onSelectAsset).toHaveBeenCalledWith("d1");
  });

  it("a side-column node cannot be pushed into the vertical lanes (FR-V17d)", () => {
    view();
    showAll();
    const [hx] = at("h1");
    drag("h1", -5000, { ctrlKey: true });
    const [moved] = at("h1");
    expect(moved).toBeGreaterThan(Math.max(at("d1")[0], at("d2")[0]));
    expect(moved).toBeLessThan(hx);
  });

  it("the move is remembered locally and kept on reopening; Rearrange discards it", () => {
    view();
    const [x1, y1] = at("d1");
    drag("d1", 300, { ctrlKey: true });
    cleanup();
    const stored = JSON.parse(localStorage.getItem(positionsStorageKey("proj-1"))!);
    expect(stored.p.d1).toEqual([x1 + 300, y1]);
    view();
    expect(at("d1")).toEqual([x1 + 300, y1]);
    fireEvent.click(screen.getByTestId("asset-graph-rearrange"));
    expect(at("d1")).not.toEqual([x1 + 300, y1]);
  });

  it("Ctrl / ⌘ + Shift + → moves the focused node a third of the spacing (FR-V17e)", () => {
    view();
    const [x1, y1] = at("d1");
    const node = screen.getByTestId("asset-graph-node-d1");
    node.focus();
    fireEvent.keyDown(node, { key: "ArrowRight", ctrlKey: true, shiftKey: true });
    expect(at("d1")).toEqual([x1 + 50, y1]);
  });
});
