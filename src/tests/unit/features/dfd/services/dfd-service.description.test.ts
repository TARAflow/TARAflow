// Bug since the form redesign (46eddb9): the DFD's completeness counts the
// `description` of elements and flows, but saving rebuilt the records from
// the XML and kept only properties and asset relations — every description
// was dropped, so the DFD phase could never be complete. The description now
// survives the save like the properties.
import { describe, it, expect } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import type { DFDConnection, DFDElement } from "features/dfd/models/dfd-types";

type Merge<T> = (parsed: T[], existing: T[]) => T[];
const svc = dfdService as unknown as {
  mergeElementProperties: Merge<DFDElement>;
  mergeConnectionProperties: Merge<DFDConnection>;
};

const el = (id: string, over: Partial<DFDElement> = {}) =>
  ({ id, displayId: "P-1", name: "Parsed name", type: "Process", properties: {}, ...over }) as DFDElement;
const df = (id: string, over: Partial<DFDConnection> = {}) =>
  ({ id, displayId: "DF-1", name: "flow", from: "a", to: "b", properties: {}, ...over }) as DFDConnection;

describe("saving the DFD keeps the descriptions", () => {
  it("of elements: from the stored record, the rest from the parse", () => {
    const [merged] = svc.mergeElementProperties(
      [el("p1", { name: "Renamed in draw.io" })],
      [el("p1", { description: "Detects smoke.", name: "Old" })],
    );
    expect(merged.description).toBe("Detects smoke.");
    expect(merged.name).toBe("Renamed in draw.io");
  });

  it("of flows", () => {
    const [merged] = svc.mergeConnectionProperties([df("f1")], [df("f1", { description: "Alarm to panel." })]);
    expect(merged.description).toBe("Alarm to panel.");
  });

  it("adds no description where there was none", () => {
    const [merged] = svc.mergeElementProperties([el("p1")], [el("p1")]);
    expect(merged).not.toHaveProperty("description");
  });
});
