import { describe, it, expect } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { interactionThreatSync } from "../../../../../../features/threats/services/per-interaction/interaction-sync";
import type {
  ThreatTable,
  ThreatSyncStatus,
} from "../../../../../../features/threats/models/threat-types";

/**
 * interactionThreatSync.applyChangedReferences is the silent half of sync
 * (Class A) for the per-interaction method. It must refresh the TB name,
 * endpoint (source/target) names and the dataFlow mirror, and regenerate the
 * threat id (TB{n}-DF{m}-{stride}-{IN|OUT}-{seq}) on a renumber — never add or
 * remove a threat.
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

function conn(displayId: string) {
  return {
    id: "c1",
    from: "s1",
    to: "t1",
    label: "telemetry",
    name: "telemetry",
    displayId,
  };
}

function dfThreat(over: any = {}) {
  return {
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
    ...over,
  };
}

function tableOf(threats: any[]): ThreatTable {
  return {
    trustBoundaryId: "tb1",
    trustBoundaryName: "Zone",
    threats,
  } as unknown as ThreatTable;
}

function emptyStatus(): ThreatSyncStatus {
  return {
    inSync: true,
    missingInThreats: { elements: [], dataFlows: [] },
    orphanedThreats: { elementIds: [], dataFlowIds: [], threatIds: [] },
    changedReferences: { elements: [], dataFlows: [] },
    summary: {
      missingElementCount: 0,
      missingDataFlowCount: 0,
      orphanedThreatCount: 0,
      changedReferenceCount: 0,
    },
    lastChecked: new Date().toISOString(),
  } as ThreatSyncStatus;
}

describe("interactionThreatSync.applyChangedReferences", () => {
  it("renumber: regenerates the interaction threat id and refreshes the dataFlow", () => {
    const graph = graphOf([TB, S, T], [conn("DF-9")]); // connection renumbered
    const status = {
      ...emptyStatus(),
      changedReferences: {
        elements: [],
        dataFlows: [
          {
            threatId: "TB1-DF5-S-OUT-1",
            oldRef: dfThreat().dataFlow,
            newRef: {
              id: "c1",
              from: "s1",
              to: "t1",
              label: "telemetry",
              displayId: "DF-9",
            },
            changes: ["id"],
          },
        ],
      },
    } as ThreatSyncStatus;

    const { tables, updated } = interactionThreatSync.applyChangedReferences(
      [tableOf([dfThreat()])],
      status,
      graph,
    );

    expect(updated).toBe(1);
    const t = tables[0].threats[0] as any;
    expect(t.id).toBe("TB1-DF9-S-OUT-1");
    expect(t.dataFlow.dataFlowId).toBe("DF-9");
    expect(tables[0].threats).toHaveLength(1); // non-destructive
  });

  it("endpoint rename: refreshes the source name without changing the id", () => {
    const graph = graphOf(
      [TB, { ...S, name: "NewSensor" }, T],
      [conn("DF-5")],
    );
    const { tables, updated } = interactionThreatSync.applyChangedReferences(
      [tableOf([dfThreat()])],
      emptyStatus(), // no changedReferences — block 2 mirror still applies
      graph,
    );

    expect(updated).toBe(1);
    const t = tables[0].threats[0] as any;
    expect(t.dataFlow.sourceName).toBe("NewSensor");
    expect(t.id).toBe("TB1-DF5-S-OUT-1"); // id stable on pure rename
  });

  it("TB rename: refreshes the trust-boundary name on the table", () => {
    const graph = graphOf(
      [{ ...TB, name: "NewZone" }, S, T],
      [conn("DF-5")],
    );
    const { tables, updated } = interactionThreatSync.applyChangedReferences(
      [tableOf([dfThreat()])],
      emptyStatus(),
      graph,
    );

    expect(updated).toBe(1);
    expect(tables[0].trustBoundaryName).toBe("NewZone");
  });

  it("no drift: nothing is updated", () => {
    const graph = graphOf([TB, S, T], [conn("DF-5")]);
    const { updated } = interactionThreatSync.applyChangedReferences(
      [tableOf([dfThreat()])],
      emptyStatus(),
      graph,
    );
    expect(updated).toBe(0);
  });
});
