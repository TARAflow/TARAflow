// src/tests/component/asset-graph-positions.test.tsx
//
// Phase 3, FR-V15: node positions are remembered locally per project and
// restored when the graph is opened again; never in the project (D3).

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssetGraphView,
  positionsStorageKey,
  type AssetGraphSource,
} from "features/dfd/asset-graph";

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
  ],
  relations: [],
  elements: [],
};
const KEY = positionsStorageKey("proj-1");

const view = (projectId: string | null = "proj-1") =>
  render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={() => {}} projectId={projectId} />);
const at = (id: string) =>
  screen.getByTestId(`asset-graph-node-${id}`).getAttribute("transform")!.match(/translate\(([-\d.]+),([-\d.]+)\)/)!
    .slice(1)
    .map(Number);
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null") as { v: number; p: Record<string, number[]> } | null;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AssetGraphView — local positions (FR-V15)", () => {
  it("remembers the positions of the project's nodes", () => {
    view();
    act(() => vi.advanceTimersByTime(600));
    const s = stored()!;
    expect(s.v).toBe(1);
    expect(Object.keys(s.p).sort()).toEqual(["d1", "d2"]);
    expect(s.p.d1).toEqual(at("d1"));
  });

  it("restores remembered positions when opened again", () => {
    view();
    const [, laneY] = at("d1");
    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ v: 1, p: { d1: [900, laneY] } }));
    view();
    expect(at("d1")).toEqual([900, laneY]);
  });

  it("saves once more when the view goes away", () => {
    view();
    expect(stored()).toBeNull(); // debounced
    cleanup();
    expect(Object.keys(stored()!.p)).toContain("d1");
  });

  it("“Rearrange” replaces the remembered positions with a fresh layout", () => {
    view();
    const fresh = at("d1");
    cleanup();
    localStorage.setItem(KEY, JSON.stringify({ v: 1, p: { d1: [900, fresh[1]] } }));
    view();
    fireEvent.click(screen.getByTestId("asset-graph-rearrange"));
    expect(at("d1")).toEqual(fresh);
    act(() => vi.advanceTimersByTime(600));
    expect(stored()!.p.d1).toEqual(fresh);
  });

  it("without a project id nothing is stored; blocked storage does not break the view", () => {
    view(null);
    act(() => vi.advanceTimersByTime(600));
    expect(localStorage.length).toBe(0);
    cleanup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    view();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("asset-graph-node-d1")).toBeInTheDocument();
  });
});
