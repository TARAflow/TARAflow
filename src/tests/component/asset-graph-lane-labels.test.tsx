// src/tests/component/asset-graph-lane-labels.test.tsx
//
// User 2026-11-06: the label of a lane (Data, Function, …, DFD elements,
// free row) stays visible when the graph is scrolled to the right — it sits
// left of its lane, but never left of the visible area.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { laneLabelX } from "features/dfd/asset-graph/asset-graph-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => ((o?.defaultValue as string | undefined) ?? k),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

describe("lane labels stay in view", () => {
  it("left of the lane while that is visible; at the left edge once scrolled further", () => {
    // Not scrolled: the visible area starts far left — the label sits before the lane.
    expect(laneLabelX("Data", -500, 1)).toBe(-68 - 28);
    // Scrolled to the right: the visible area starts at x = 2000 — the label follows.
    expect(laneLabelX("Data", 2000, 1)).toBe(2008);
    // Zoomed out: the 8 px margin is in screen pixels.
    expect(laneLabelX("Data", 2000, 0.5)).toBe(2016);
  });

  it("each lane with rows has its label", () => {
    const source: AssetGraphSource = {
      assets: [
        { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
        { id: "f1", displayId: "FU-001", name: "E-Stop", assetGroup: "function" },
      ],
      relations: [],
      elements: [],
    };
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} onShowElement={vi.fn()} />);
    expect(screen.getByTestId("asset-graph-lane-label-data")).toBeInTheDocument();
    expect(screen.getByTestId("asset-graph-lane-label-function")).toBeInTheDocument();
  });
});
