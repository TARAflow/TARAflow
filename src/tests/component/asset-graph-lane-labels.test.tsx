// src/tests/component/asset-graph-lane-labels.test.tsx
//
// User 2026-11-06: every lane label stays visible when the graph is scrolled
// to the right — categories, DFD elements, free rows and the side column
// (hazards, persons, …). Labels are left-aligned on one line, drawn on top of
// nodes and edges; a side-column label stays at its column while that is in
// view, at the left edge (below the label at the same height) once not.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssetGraphView, type AssetGraphSource } from "features/dfd/asset-graph";
import { LANE_LABEL_LEFT, laneLabels, type LaneLabelInput } from "features/dfd/asset-graph/asset-graph-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => ((o?.defaultValue as string | undefined) ?? k),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const LANES: LaneLabelInput[] = [
  { id: "free", text: "Free row", kind: "free", top: -450 },
  { id: "data", text: "Data", kind: "vertical", top: -150 },
  { id: "human", text: "Person", kind: "orthogonal", top: -150, columnX: 1000 },
  { id: "hazards", text: "Hazards", kind: "orthogonal", top: -450, columnX: 1000 },
];
const byId = (labels: ReturnType<typeof laneLabels>) => Object.fromEntries(labels.map((l) => [l.id, l]));

describe("lane labels", () => {
  it("not scrolled: one left-aligned line before the lanes; the side column at its column", () => {
    const l = byId(laneLabels(LANES, -500, 1));
    for (const id of ["free", "data"]) expect(l[id]).toMatchObject({ x: LANE_LABEL_LEFT, anchor: "start", sticky: false });
    expect(l.human).toMatchObject({ x: 1000 - 34, anchor: "end", sticky: false, y: -130 });
  });

  it("scrolled past the lanes' start: all lane labels at the left edge, aligned", () => {
    const l = byId(laneLabels(LANES, 400, 1));
    for (const id of ["free", "data"]) expect(l[id]).toMatchObject({ x: 408, anchor: "start", sticky: true });
    // The column is still in view.
    expect(l.human).toMatchObject({ x: 966, anchor: "end", sticky: false });
  });

  it("scrolled past the side column: its labels join the left edge, below the label at the same height", () => {
    const l = byId(laneLabels(LANES, 2000, 1));
    expect(l.data).toMatchObject({ x: 2008, y: -130 });
    expect(l.human).toMatchObject({ x: 2008, y: -130 + 16, anchor: "start", sticky: true });
    expect(l.free).toMatchObject({ x: 2008, y: -430 });
    expect(l.hazards).toMatchObject({ x: 2008, y: -430 + 16, sticky: true });
  });

  it("zoomed out: the margin to the edge is in screen pixels", () => {
    expect(byId(laneLabels(LANES, 2000, 0.5)).data.x).toBe(2016);
  });

  it("drawn on top: the labels come after the nodes in the SVG", () => {
    const source: AssetGraphSource = {
      assets: [
        { id: "d1", displayId: "DA-001", name: "Measure Data", assetGroup: "data" },
        { id: "h1", displayId: "HU-001", name: "Operator", assetGroup: "human" },
      ],
      relations: [],
      elements: [],
    };
    render(<AssetGraphView source={source} selectedAssetId={null} onSelectAsset={vi.fn()} onShowElement={vi.fn()} />);
    const label = screen.getByTestId("asset-graph-lane-label-free");
    const node = screen.getByTestId("asset-graph-node-h1");
    expect(node.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const id of ["data", "human", "free", "free-2"]) expect(screen.getByTestId(`asset-graph-lane-label-${id}`)).toBeInTheDocument();
  });
});
