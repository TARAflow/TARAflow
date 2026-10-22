// Leveled-DFD §11.3: the DFD diff classifies its changes. Elements and flows
// (classic and leveled alike): added / removed / modified are semantic; the
// layout fields of a record are not changes of the model.
import { describe, it, expect } from "vitest";
import { diffDfd } from "features/dfd/services/dfd-diff";
import type { DFDConnection, DFDElement } from "features/dfd/models/dfd-types";

const el = (id: string, over: Partial<DFDElement> = {}) =>
  ({
    id,
    displayId: id.toUpperCase(),
    name: `Element ${id}`,
    type: "Process",
    position: { x: 0, y: 0 },
    size: { width: 80, height: 60 },
    properties: { runsAs: "user" },
    ...over,
  }) as unknown as DFDElement;
const df = (id: string, from: string, to: string, over: Partial<DFDConnection> = {}) =>
  ({ id, displayId: id.toUpperCase(), name: `Flow ${id}`, from, to, properties: {}, ...over }) as DFDConnection;

const BEFORE = { elements: [el("p1"), el("p2"), el("p3")], connections: [df("f1", "p1", "p2")] };

describe("diffDfd — elements and flows", () => {
  it("finds added, removed and renamed elements, all semantic", () => {
    const after = {
      elements: [el("p1"), el("p2", { name: "Renamed" }), el("p4")],
      connections: BEFORE.connections,
    };
    expect(diffDfd(BEFORE, after).map((c) => [c.kind, c.category, c.subject, c.displayId])).toEqual([
      ["modified", "semantic", "element", "P2"],
      ["added", "semantic", "element", "P4"],
      ["removed", "semantic", "element", "P3"],
    ]);
    expect(diffDfd(BEFORE, after)[0].fields).toEqual([{ field: "name", before: "Element p2", after: "Renamed" }]);
  });

  it("compares properties per key — refines and abstract included", () => {
    const after = {
      elements: [el("p1", { properties: { runsAs: "root" } as never }), el("p2"), el("p3")],
      connections: [df("f1", "p1", "p2", { properties: { refines: "f0", abstract: true } as never })],
    };
    const changes = diffDfd(BEFORE, after);
    expect(changes.map((c) => c.fields)).toEqual([
      [{ field: "properties.runsAs", before: "user", after: "root" }],
      [
        { field: "properties.abstract", before: undefined, after: true },
        { field: "properties.refines", before: undefined, after: "f0" },
      ],
    ]);
  });

  it("reports a flow's changed endpoint", () => {
    const after = { elements: BEFORE.elements, connections: [df("f1", "p1", "p3")] };
    expect(diffDfd(BEFORE, after)).toEqual([
      expect.objectContaining({ kind: "modified", subject: "flow", displayId: "F1", fields: [{ field: "to", before: "p2", after: "p3" }] }),
    ]);
  });

  it("ignores layout fields and asset relations (compared in the asset phase)", () => {
    const after = {
      elements: [el("p1", { position: { x: 50, y: 9 }, size: { width: 1, height: 1 } }), el("p2"), el("p3")],
      connections: [df("f1", "p1", "p2", { waypoints: [{ x: 1, y: 2 }], assetRelations: [{ assetId: "a" }] as never })],
    };
    expect(diffDfd(BEFORE, after)).toEqual([]);
  });

  it("treats a missing side as empty", () => {
    expect(diffDfd(null, BEFORE).every((c) => c.kind === "added")).toBe(true);
    expect(diffDfd(BEFORE, undefined).every((c) => c.kind === "removed")).toBe(true);
  });
});
