// tests/unit/features/dfd/services/validators/connection-validator.unconnected.test.ts
//
// validateUnconnectedElements — ChipBoundary connectivity via two topologies:
//   (A) direct DataFlow endpoint     — e.g. Developer -> JTAG -> MCU (R9)
//   (B) spatial container whose enclosed elements carry the flows
//       — e.g. Application + Firmware inside the ESP32 die (EdGe model).
//
// ⚠ WIRING: deep import specifiers; reuses ./dfd-factory (el, dataStore, conn).
// ⚠ RED until validateUnconnectedElements gains the `graph?` 4th parameter —
//   the container test below fails against the current 3-arg signature.

import { describe, it, expect } from "vitest";
import { validateUnconnectedElements } from "features/dfd/services/validators/connection-validator";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import type { DFDGraph } from "features/dfd/models/dfd-graph-types";
import type {
  DFDElement,
  DFDConnection,
  ValidationFinding,
} from "features/dfd/models/dfd-types";
import { el, dataStore, conn } from "./dfd-factory";

// The function only reads `elementChipBoundaries` (elementId -> enclosing chip
// ids). Stub just that map; cast through unknown to satisfy DFDGraph.
function graphWith(membership: Record<string, string[]>): DFDGraph {
  return {
    elementChipBoundaries: new Map(Object.entries(membership)),
  } as unknown as DFDGraph;
}

function run(
  elements: DFDElement[],
  connections: DFDConnection[],
  graph?: DFDGraph,
) {
  const warnings: ValidationFinding[] = [];
  validateUnconnectedElements(elements, connections, warnings, graph);
  return warnings.filter(
    (w) => w.key === ValidationMessages.UNCONNECTED_ELEMENT,
  );
}

const flaggedIds = (ws: ValidationFinding[]) => ws.map((w) => w.elementId);

describe("validateUnconnectedElements — ChipBoundary", () => {
  it("does NOT flag a ChipBoundary whose enclosed elements carry the flows (EdGe topology)", () => {
    // CB encloses P-2 + DS-2; flows touch P-2/DS-2, never the CB itself.
    const cb = el({ id: "CB", type: "ChipBoundary", name: "ESP32 [CB]" });
    const app = el({ id: "P-2", type: "Process", name: "Application" });
    const fw = dataStore("DS-2", {}, "Firmware");
    const backend = el({ id: "P-1", type: "Process", name: "SW-Update API" });

    const elements = [cb, app, fw, backend];
    const connections = [
      conn({ id: "DF-2", from: "P-2", to: "P-1" }), // crosses the chip boundary
      conn({ id: "DF-6", from: "DS-2", to: "P-2" }), // internal to the chip
    ];
    const graph = graphWith({ "P-2": ["CB"], "DS-2": ["CB"] });

    expect(flaggedIds(run(elements, connections, graph))).not.toContain("CB");
  });

  it("DOES flag an empty ChipBoundary (no members, not an endpoint)", () => {
    // Real modelling gap the rule must keep catching — regression guard.
    const cb = el({ id: "CB", type: "ChipBoundary", name: "Orphan [CB]" });
    expect(flaggedIds(run([cb], [], graphWith({})))).toContain("CB");
  });

  it("does NOT flag a ChipBoundary used as a direct DataFlow endpoint (R9 / JTAG)", () => {
    // Endpoint topology already handled by the from/to set — guard it stays green.
    const cb = el({ id: "CB", type: "ChipBoundary", name: "MCU [CB]" });
    const dbg = el({ id: "EE-1", type: "ExternalEntity", name: "Debugger" });
    const connections = [conn({ id: "DF-1", from: "EE-1", to: "CB" })];
    expect(flaggedIds(run([cb, dbg], connections, graphWith({})))).not.toContain(
      "CB",
    );
  });

  it("still flags a genuinely unconnected Process (rule not weakened for non-boundaries)", () => {
    const p = el({ id: "P-9", type: "Process", name: "Dangling" });
    expect(flaggedIds(run([p], [], graphWith({})))).toContain("P-9");
  });
});