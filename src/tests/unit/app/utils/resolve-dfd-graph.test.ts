// src/tests/unit/app/utils/resolve-dfd-graph.test.ts
//
// The Threats tab only renders with a DFD analysis context, i.e. a graph.
// dfd.graph is derived and never persisted; it must be rebuilt at the point of
// use rather than relying on a side-effect save (the per-open thumbnail save
// used to do that, and removing it left the Threats tab empty).

import { describe, it, expect, vi } from "vitest";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";

const dfd: any = {
  xml: "<mxGraphModel/>",
  elements: [
    {
      id: "p1", type: "Process", name: "App", displayId: "P-1",
      position: { x: 0, y: 0 }, size: { width: 140, height: 40 }, properties: {},
    },
    {
      id: "ds1", type: "DataStore", name: "Cache", displayId: "DS-1",
      position: { x: 300, y: 0 }, size: { width: 140, height: 40 }, properties: {},
    },
  ],
  connections: [
    {
      id: "c1", from: "p1", to: "ds1", name: "write", displayId: "DF-1",
      waypoints: [], properties: {},
    },
  ],
  assets: [],
};

describe("resolveDfdGraph", () => {
  it("returns the stored graph untouched", () => {
    const graph = { nodes: [] } as any;
    expect(resolveDfdGraph({ ...dfd, graph })).toBe(graph);
  });

  it("builds the graph when it is missing (persisted project state)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const graph = resolveDfdGraph(dfd);
    expect(graph).toBeDefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is undefined for an empty DFD (no Threats context expected)", () => {
    expect(resolveDfdGraph({ ...dfd, elements: [] })).toBeUndefined();
    expect(resolveDfdGraph(undefined)).toBeUndefined();
  });

  it("logs and returns undefined when building fails", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveDfdGraph({ elements: [{}], connections: null } as any)).toBeUndefined();
    expect(error).toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});
