import { describe, it, expect } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { syncThreatsWithGraph } from "../../features/threats/services/sync-threats-with-graph";
import type { ThreatBundle } from "../../features/threats/models/threat-types";

/**
 * The live DFD-change path for the per-interaction method follows the same
 * policy as per-element:
 *   Class A — TB / endpoint rename, data-flow renumber → applied SILENTLY.
 *   Class B — a NEW or REMOVED interaction (the SET of threats changed) → NOT
 *             touched here; it surfaces via the sync banner.
 * Uses the real interaction checkSyncStatus (it does not call the generator),
 * so no stubbing is needed — only a coherent graph.
 */

const TB = { id: "tb1", type: "TrustBoundary", name: "Zone", displayId: "TB1" };
const S = { id: "s1", type: "Process", name: "Sensor", displayId: "P-1" };
const T = { id: "t1", type: "Process", name: "Controller", displayId: "P-2" };

function graphOf(elements: any[], connections: any[]) {
  return {
    elementsById: new Map(elements.map((e) => [e.id, e])),
    connectionsById: new Map(connections.map((c) => [c.id, c])),
  } as any;
}

function conn(id: string, from: string, to: string, displayId: string) {
  return { id, from, to, label: "telemetry", name: "telemetry", displayId };
}

function bundle(): ThreatBundle {
  return {
    configuration: { activeMethod: "per-interaction" },
    perElementTables: [],
    perInteractionTables: [
      {
        trustBoundaryId: "tb1",
        trustBoundaryName: "Zone",
        threats: [
          {
            id: "TB1-DF5-S-OUT-1",
            strideCategory: "S",
            sequenceNumber: 1,
            trustBoundaryId: "tb1",
            trustBoundaryDisplayId: "TB1",
            interactionContext: { direction: "outgoing" },
            dataFlow: {
              connectionId: "c1",
              dataFlowId: "DF-5",
              dataFlowName: "telemetry",
              sourceId: "s1",
              sourceName: "Sensor",
              sourceType: "Process",
              targetId: "t1",
              targetName: "Controller",
              targetType: "Process",
            },
          },
        ],
      },
    ],
    lastModified: new Date().toISOString(),
  } as unknown as ThreatBundle;
}

function interactionThreats(out: ThreatBundle | null) {
  return (out?.perInteractionTables ?? []).flatMap((t: any) => t.threats);
}

describe("syncThreatsWithGraph — per-interaction Class A/B policy", () => {
  it("Class A: a data-flow renumber regenerates the display id silently", () => {
    const graph = graphOf([TB, S, T], [conn("c1", "s1", "t1", "DF-9")]);
    const out = syncThreatsWithGraph(bundle(), graph);
    const threats = interactionThreats(out);

    expect(threats).toHaveLength(1);
    expect(threats[0].displayId).toBe("TB1-DF9-S-OUT-1");
  });

  it("Class A: an endpoint rename refreshes the source name silently", () => {
    const graph = graphOf(
      [TB, { ...S, name: "NewSensor" }, T],
      [conn("c1", "s1", "t1", "DF-5")],
    );
    const out = syncThreatsWithGraph(bundle(), graph);
    const threats = interactionThreats(out);

    expect(threats).toHaveLength(1);
    expect(threats[0].dataFlow.sourceName).toBe("NewSensor");
    expect(threats[0].id).toBe("TB1-DF5-S-OUT-1"); // id stable on rename
  });

  it("Class B (new interaction): a new data flow is NOT auto-generated", () => {
    // c1 still matches its threat; c2 is a brand-new interaction with no threat.
    const graph = graphOf(
      [TB, S, T],
      [
        conn("c1", "s1", "t1", "DF-5"),
        conn("c2", "t1", "s1", "DF-6"),
      ],
    );
    const out = syncThreatsWithGraph(bundle(), graph);
    const threats = interactionThreats(out);

    expect(threats).toHaveLength(1); // nothing generated for c2
    expect(threats.some((t: any) => t.dataFlow?.connectionId === "c2")).toBe(false);
  });

  it("Class B (orphaned): a dangling interaction threat is NOT auto-removed", () => {
    // The threat's connection c1 is gone from the graph → orphaned.
    const graph = graphOf([TB, S, T], [conn("c2", "t1", "s1", "DF-6")]);
    const out = syncThreatsWithGraph(bundle(), graph);
    const threats = interactionThreats(out);

    expect(threats).toHaveLength(1); // orphaned threat survives
    expect(threats[0].dataFlow.connectionId).toBe("c1");
  });
});
