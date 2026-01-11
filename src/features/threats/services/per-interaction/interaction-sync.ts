// ==================== INTERACTION THREAT SYNC ====================
// Single Responsibility: Synchronize per-interaction threats with DFD changes

import type {
  ThreatTable,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
  DFDElementReference,
  DFDConnectionReference,
} from "../../models/threat-types";
import {
  DataFlowReference,
  DataFlowChange,
} from "../../models/per-interaction-types";
import { interactionThreatGenerator } from "./interaction-generator";

// ==================== INTERACTION SYNC SERVICE ====================

export class InteractionThreatSync {
  /**
   * Check if threats are in sync with DFD connections
   */
  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[]
  ): ThreatSyncStatus {
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];
    const elementById = new Map(elements.map((e) => [e.id, e]));

    // Build sets for quick lookup
    const connectionIds = new Set(connections.map((c) => c.id));
    const interfaceIds = new Set(
      elements
        .filter((e) => e.type === "Interface" || e.type === "PhysicalInterface")
        .map((e) => e.id)
    );

    const threatenedConnections = new Set<string>();
    const threatenedInterfaces = new Set<string>();
    const orphanedThreatIds: string[] = [];
    const changedReferences: DataFlowChange[] = [];

    // Check existing threats
    for (const table of tables) {
      for (const threat of table.threats) {
        // Check data flow threats
        if (threat.dataFlow) {
          const connId = threat.dataFlow.connectionId;
          if (connId) {
            threatenedConnections.add(connId);

            // Check if connection still exists
            const connection = connections.find((c) => c.id === connId);
            if (!connection) {
              orphanedThreatIds.push(threat.id);
              continue;
            }

            // Check for changes
            const changes: ("name" | "id" | "source" | "target")[] = [];
            if (connection.label !== threat.dataFlow.dataFlowName) {
              changes.push("name");
            }
            if (connection.from !== threat.dataFlow.sourceId) {
              changes.push("source");
            }
            if (connection.to !== threat.dataFlow.targetId) {
              changes.push("target");
            }

            const sourceElem = elementById.get(connection.from);
            const targetElem = elementById.get(connection.to);
            if (sourceElem && sourceElem.name !== threat.dataFlow.sourceName) {
              changes.push("source");
            }
            if (targetElem && targetElem.name !== threat.dataFlow.targetName) {
              changes.push("target");
            }

            if (changes.length > 0) {
              changedReferences.push({
                threatId: threat.id,
                oldRef: threat.dataFlow,
                newRef: connection,
                changes,
              });
            }
          }
        }

        // Check interface threats
        if (threat.linkedElement) {
          const elementId = threat.linkedElement.elementId;
          const elementType = threat.linkedElement.elementType;

          if (
            elementType === "Interface" ||
            elementType === "PhysicalInterface"
          ) {
            threatenedInterfaces.add(elementId);

            // Check if interface still exists
            if (!interfaceIds.has(elementId)) {
              orphanedThreatIds.push(threat.id);
            }
          }
        }
      }
    }

    // Find missing connections
    const missingConnections: DFDConnectionReference[] = [];
    for (const connection of connections) {
      if (!threatenedConnections.has(connection.id)) {
        missingConnections.push(connection);
      }
    }

    // Find missing interfaces
    const missingInterfaces: DFDElementReference[] = [];
    for (const element of elements) {
      if (
        (element.type === "Interface" ||
          element.type === "PhysicalInterface") &&
        !threatenedInterfaces.has(element.id)
      ) {
        missingInterfaces.push(element);
      }
    }

    const inSync =
      missingConnections.length === 0 &&
      missingInterfaces.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedReferences.length === 0;

    return {
      inSync,
      missingInThreats: {
        elements: missingInterfaces,
        dataFlows: missingConnections,
      },
      orphanedThreats: {
        elementIds: [],
        dataFlowIds: orphanedThreatIds,
        threatIds: orphanedThreatIds,
      },
      changedReferences: {
        elements: [],
        dataFlows: changedReferences,
      },
      summary: {
        missingElementCount: missingInterfaces.length,
        missingDataFlowCount: missingConnections.length,
        orphanedThreatCount: orphanedThreatIds.length,
        changedReferenceCount: changedReferences.length,
      },
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Synchronize threats with DFD changes
   */
  synchronizeThreats(
    project: ThreatProjectData,
    tables: ThreatTable[],
    syncStatus: ThreatSyncStatus,
    options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    }
  ): ThreatSyncResult {
    let updatedTables = [...tables];
    let added = 0;
    let removed = 0;
    let updated = 0;

    const elements = project.dfdElements || [];
    const elementById = new Map(elements.map((e) => [e.id, e]));

    // Update Trust Boundary names
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");
    const trustBoundaryById = new Map(trustBoundaries.map((tb) => [tb.id, tb]));

    updatedTables = updatedTables.map((table) => {
      if (!table.trustBoundaryId) return table;

      const tb = trustBoundaryById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        updated++;
        return {
          ...table,
          trustBoundaryName: tb.name,
        };
      }
      return table;
    });

    // Update source/target names when elements change
    updatedTables = updatedTables.map((table) => ({
      ...table,
      threats: table.threats.map((threat) => {
        if (!threat.dataFlow) return threat;

        const sourceElem = elementById.get(threat.dataFlow.sourceId);
        const targetElem = elementById.get(threat.dataFlow.targetId);

        const sourceChanged =
          sourceElem && sourceElem.name !== threat.dataFlow.sourceName;
        const targetChanged =
          targetElem && targetElem.name !== threat.dataFlow.targetName;

        if (sourceChanged || targetChanged) {
          updated++;
          return {
            ...threat,
            dataFlow: {
              ...threat.dataFlow,
              sourceName: sourceElem?.name || threat.dataFlow.sourceName,
              targetName: targetElem?.name || threat.dataFlow.targetName,
            } as DataFlowReference,
            lastModified: new Date().toISOString(),
          };
        }
        return threat;
      }),
    }));

    // Update changed data flow references
    if (
      options.updateReferences &&
      syncStatus.changedReferences.dataFlows.length > 0
    ) {
      const changeMap = new Map(
        syncStatus.changedReferences.dataFlows.map((c) => [c.threatId, c])
      );

      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.dataFlow) {
            updated++;

            const sourceElem = elementById.get(change.newRef.from);
            const targetElem = elementById.get(change.newRef.to);

            return {
              ...threat,
              dataFlow: {
                connectionId: change.newRef.id,
                dataFlowId: threat.dataFlow.dataFlowId,
                dataFlowName: change.newRef.label || threat.dataFlow.dataFlowName,
                sourceId: change.newRef.from,
                sourceName: sourceElem?.name || threat.dataFlow.sourceName,
                sourceType: sourceElem?.type || threat.dataFlow.sourceType,
                targetId: change.newRef.to,
                targetName: targetElem?.name || threat.dataFlow.targetName,
                targetType: targetElem?.type || threat.dataFlow.targetType,
              } as DataFlowReference,
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // Remove orphaned threats
    if (
      options.removeOrphaned &&
      syncStatus.orphanedThreats.threatIds.length > 0
    ) {
      const orphanedSet = new Set(syncStatus.orphanedThreats.threatIds);
      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.filter((t) => {
          if (orphanedSet.has(t.id)) {
            removed++;
            return false;
          }
          return true;
        }),
      }));
    }

    // Add missing threats
    if (
      syncStatus.missingInThreats.dataFlows.length > 0 ||
      syncStatus.missingInThreats.elements.length > 0
    ) {
      const newThreats = interactionThreatGenerator.generateThreatsForProject(
        project
      );

      // Filter to only keep threats for missing items
      const missingConnectionIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id)
      );
      const missingInterfaceIds = new Set(
        syncStatus.missingInThreats.elements.map((e) => e.id)
      );

      for (const newTable of newThreats) {
        const existingTable = updatedTables.find(
          (t) => t.trustBoundaryId === newTable.trustBoundaryId
        );

        const threatsForMissing = newTable.threats.filter((threat) => {
          if (threat.dataFlow) {
            const connId = threat.dataFlow.connectionId;
            return connId ? missingConnectionIds.has(connId) : false;
          } else if (threat.linkedElement) {
            return missingInterfaceIds.has(threat.linkedElement.elementId);
          }
          return false;
        });

        if (existingTable) {
          existingTable.threats.push(...threatsForMissing);
          added += threatsForMissing.length;
        } else if (threatsForMissing.length > 0) {
          updatedTables.push({ ...newTable, threats: threatsForMissing });
          added += threatsForMissing.length;
        }
      }
    }

    return {
      success: true,
      added,
      removed,
      updated,
      threatData: {
        configuration: {
          activeMethod: "per-interaction",
          customThreatTemplates: [],
          customMitigationTemplates: [],
          customVerificationTemplates: [],
        },
        perElementTables: project.threats?.perElementTables ?? [],
        perInteractionTables: updatedTables,
        lastModified: new Date().toISOString(),
      },
    };
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatSync = new InteractionThreatSync();