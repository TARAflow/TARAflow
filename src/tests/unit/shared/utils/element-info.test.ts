// src/tests/unit/shared/utils/element-info.test.ts
//
// Element info in the Threats tab (manual test 2026-11-24): what the DFD knows
// about an element or a data flow, read from the analysis graph.

import { describe, it, expect } from "vitest";
import { elementInfo, flowInfo, propertyFormKey } from "shared/utils/element-info";
import type { DFDGraphReference } from "shared";

function graph(): DFDGraphReference {
  const elements = [
    { id: "tb", type: "TrustBoundary", name: "Device", displayId: "TB-1" },
    { id: "p1", type: "Process", name: "Controller", displayId: "P-1", properties: { runsAs: "system" } },
    {
      id: "ds3",
      type: "DataStore",
      name: "Config Store",
      displayId: "DS-3",
      properties: {
        description: "Parameters of the burner",
        encryptionAtRest: "none",
        storedDataTypes: ["configuration", "credentials"],
        backupEnabled: false,
        notes: "",
        nested: { a: 1 },
      },
      assetRelations: [{ assetId: "a1" }, { assetId: "a1" }],
    },
  ];
  const connections = [
    { id: "c1", from: "p1", to: "ds3", displayId: "DF-3", name: "write config", properties: { protocol: "spi" }, assetRelations: [{ assetId: "a1" }] },
    { id: "c2", from: "ds3", to: "p1", displayId: "DF-4", label: "read config" },
  ];
  return {
    elementsById: new Map(elements.map((e) => [e.id, e])),
    connectionsById: new Map(connections.map((c) => [c.id, c])),
    assetsById: new Map([["a1", { id: "a1", name: "Burner parameters" }]]),
    outgoingConnections: new Map([["p1", ["c1"]], ["ds3", ["c2"]]]),
    incomingConnections: new Map([["ds3", ["c1"]], ["p1", ["c2"]]]),
    elementTrustBoundaries: new Map([["ds3", ["tb"]]]),
    trustBoundaryElements: new Map(),
    elementChipBoundaries: new Map(),
    chipBoundaryElements: new Map(),
    elementPhysicalBoundaries: new Map(),
    physicalBoundaryElements: new Map(),
    dataFlowAnalysis: new Map(),
    trustBoundaryHierarchy: new Map(),
    effectiveElementTrustBoundary: new Map(),
  };
}

describe("elementInfo", () => {
  it("shows the element with description, filled-in properties, boundaries, flows and assets", () => {
    const info = elementInfo(graph(), "ds3");
    expect(info).toMatchObject({
      kind: "element",
      displayId: "DS-3",
      name: "Config Store",
      type: "DataStore",
      description: "Parameters of the burner",
      boundaries: ["Device"],
      assets: ["Burner parameters"],
    });
    // description shown separately; empty text and objects left out
    expect(info?.properties).toEqual([
      { key: "encryptionAtRest", value: "none" },
      { key: "storedDataTypes", value: ["configuration", "credentials"] },
      { key: "backupEnabled", value: false },
    ]);
    expect(info?.flows).toEqual([
      { direction: "in", displayId: "DF-3", name: "write config", partnerDisplayId: "P-1", partnerName: "Controller" },
      { direction: "out", displayId: "DF-4", name: "read config", partnerDisplayId: "P-1", partnerName: "Controller" },
    ]);
  });

  it("is null without a graph or for an element the graph does not have", () => {
    expect(elementInfo(null, "ds3")).toBeNull();
    expect(elementInfo(graph(), "gone")).toBeNull();
    expect(elementInfo(graph(), undefined)).toBeNull();
  });
});

describe("flowInfo", () => {
  it("finds the flow by connection id and shows source and target", () => {
    const info = flowInfo(graph(), { connectionId: "c1" });
    expect(info).toMatchObject({ kind: "flow", displayId: "DF-3", name: "write config", type: "DataFlow", assets: ["Burner parameters"] });
    expect(info?.endpoints).toMatchObject([
      { role: "source", displayId: "P-1", name: "Controller", type: "Process" },
      { role: "target", displayId: "DS-3", name: "Config Store", type: "DataStore" },
    ]);
    // the endpoints carry their own info — the target's properties decide many ratings
    expect(info?.endpoints[1]?.element).toMatchObject({ displayId: "DS-3", description: "Parameters of the burner" });
    expect(info?.endpoints[0]?.element?.properties).toEqual([{ key: "runsAs", value: "system" }]);
    expect(info?.properties).toEqual([{ key: "protocol", value: "spi" }]);
  });

  it("falls back to the display id when the threat has no connection id", () => {
    expect(flowInfo(graph(), { displayId: "DF-4" })?.id).toBe("c2");
    expect(flowInfo(graph(), { connectionId: "stale", displayId: "DF-4" })?.id).toBe("c2");
    expect(flowInfo(graph(), { displayId: "DF-99" })).toBeNull();
  });
});

describe("propertyFormKey", () => {
  it("maps element types to the DFD form's i18n segment", () => {
    expect(propertyFormKey("DataStore")).toBe("datastore");
    expect(propertyFormKey("ExternalEntity")).toBe("external_entity");
    expect(propertyFormKey("DataFlow")).toBe("dataflow");
    expect(propertyFormKey("Multiprocess")).toBe("multiprocess");
  });
});
