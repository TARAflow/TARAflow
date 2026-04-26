// ==================== INTERACTION THREAT SYNC ====================
// Single Responsibility: Synchronize per-interaction threats with DFD changes
// Now using DFDGraph for efficient element analysis

import type {
  ThreatTable,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
  DFDElementReference,
  DFDConnectionReference,
  DFDGraphReference,
} from "../../models/threat-types";
import {
  DataFlowChange,
  generateThreatIdPerInteraction,
} from "../../models/per-interaction-types";
import { interactionThreatGenerator } from "./interaction-generator";
import { DataFlowReference, DFDAnalysisContext } from "shared";

// ==================== ELEMENT CHANGE ====================

interface ElementChange {
  threatId: string;
  oldDisplayId: string;
  newDisplayId: string;
  elementId: string;
  elementType: string;
}

// ==================== TRUST BOUNDARY CHANGE ====================

interface TrustBoundaryChange {
  tableIndex: number;
  oldName: string;
  newName: string;
  trustBoundaryId: string;
}

// ==================== INTERACTION SYNC SERVICE ====================

export class InteractionThreatSync {
  /**
   * Check if threats are in sync with DFD connections using DFDGraph
   */
  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[],
  ): ThreatSyncStatus {
    // Early exit if no graph
    if (!project.dfdGraph) {
      return this.createEmptySyncStatus();
    }

    const graph = project.dfdGraph;

    // Build sets for quick lookup from graph
    const connectionIds = new Set(graph.connectionsById.keys());
    const interfaceIds = new Set(
      Array.from(graph.elementsById.values())
        .filter((e) =>
          ["interface", "physicalinterface"].includes(e.type.toLowerCase()),
        )
        .map((e) => e.id),
    );

    const threatenedConnections = new Set<string>();
    const threatenedInterfaces = new Set<string>();
    const orphanedThreatIds: string[] = [];
    const changedReferences: DataFlowChange[] = [];
    const changedElements: ElementChange[] = [];

    // ==================== Check Trust Boundary changes ====================
    const trustBoundaryChanges: TrustBoundaryChange[] = [];

    tables.forEach((table, tableIndex) => {
      if (!table.trustBoundaryId) return;

      const tb = graph.elementsById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        trustBoundaryChanges.push({
          tableIndex,
          oldName: table.trustBoundaryName,
          newName: tb.name,
          trustBoundaryId: table.trustBoundaryId,
        });
      }
    });

    // Check existing threats
    for (const table of tables) {
      for (const threat of table.threats) {
        // ==================== Check data flow threats ====================
        if (threat.dataFlow) {
          const connId = threat.dataFlow.connectionId;
          if (connId) {
            threatenedConnections.add(connId);

            // Check if connection still exists in graph
            const connection = graph.connectionsById.get(connId);
            if (!connection) {
              orphanedThreatIds.push(threat.id);
              continue;
            }

            // Check for changes
            const changes: (
              | "name"
              | "id"
              | "source"
              | "target"
              | "displayId"
            )[] = [];

            const currentTB = graph.elementsById.get(
              threat.trustBoundaryId || "",
            );
            if (currentTB) {
              const dataFlowIdPart = (connection.displayId || "").replace(
                /^DF-/,
                "",
              );
              const expectedId = generateThreatIdPerInteraction(
                currentTB.displayId || "",
                `DF${dataFlowIdPart}`,
                threat.strideCategory,
                threat.interactionContext.direction,
                threat.sequenceNumber,
              );

              if (threat.id !== expectedId) {
                changes.push("id");
              }
            }

            // dataFlowName stores the human-readable label of the connection
            const connLabel = connection.label || connection.name || "";
            if (connLabel !== threat.dataFlow.dataFlowName) {
              changes.push("name");
            }
            if (connection.from !== threat.dataFlow.sourceId) {
              changes.push("source");
            }
            if (connection.to !== threat.dataFlow.targetId) {
              changes.push("target");
            }

            const sourceElem = graph.elementsById.get(connection.from);
            const targetElem = graph.elementsById.get(connection.to);
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

        // ==================== Check interface threats ====================
        if (threat.linkedElement) {
          const elementId = threat.linkedElement.elementId;
          const elementType = threat.linkedElement.elementType;

          if (
            elementType === "Interface" ||
            elementType === "PhysicalInterface"
          ) {
            threatenedInterfaces.add(elementId);

            // Check if interface still exists in graph
            const element = graph.elementsById.get(elementId);
            if (!element) {
              orphanedThreatIds.push(threat.id);
              continue;
            }

            const currentTB = graph.elementsById.get(
              threat.trustBoundaryId || "",
            );
            if (currentTB) {
              const interfaceIdPart = (element.displayId || "").replace(
                /^IF-/,
                "",
              );
              const expectedId = generateThreatIdPerInteraction(
                currentTB.displayId || "",
                `IF${interfaceIdPart}`,
                threat.strideCategory,
                "incoming",
                threat.sequenceNumber,
              );

              if (threat.id !== expectedId) {
                changedElements.push({
                  threatId: threat.id,
                  oldDisplayId: threat.linkedElement.displayId || "",
                  newDisplayId: element.displayId,
                  elementId: element.id,
                  elementType: element.type,
                });
              }
            }

            // Check if interface displayId changed
            if (
              element.displayId &&
              element.displayId !== threat.linkedElement.displayId
            ) {
              if (!changedElements.find((c) => c.threatId === threat.id)) {
                changedElements.push({
                  threatId: threat.id,
                  oldDisplayId: threat.linkedElement.displayId || "",
                  newDisplayId: element.displayId,
                  elementId: element.id,
                  elementType: element.type,
                });
              }
            }
          }
        }
      }
    }

    // Find missing data flows
    const missingConnections: DFDConnectionReference[] = [];
    for (const [connId, connection] of graph.connectionsById) {
      // Skip connections explicitly excluded from threat generation
      const isExcluded =
        connection.excludeFromThreatGen ||
        (connection as any)?.properties?.excludeFromThreatGen;
      if (isExcluded) continue;

      if (!threatenedConnections.has(connId)) {
        missingConnections.push(connection);
      }
    }

    // Find missing interfaces
    const missingInterfaces: DFDElementReference[] = [];
    for (const interfaceId of interfaceIds) {
      if (!threatenedInterfaces.has(interfaceId)) {
        const element = graph.elementsById.get(interfaceId);
        if (element) {
          missingInterfaces.push(element);
        }
      }
    }

    const inSync =
      missingConnections.length === 0 &&
      missingInterfaces.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedReferences.length === 0 &&
      changedElements.length === 0 &&
      trustBoundaryChanges.length === 0;

    return {
      inSync,
      missingInThreats: {
        elements: missingInterfaces,
        dataFlows: missingConnections,
      },
      orphanedThreats: {
        elementIds: orphanedThreatIds,
        dataFlowIds: [],
        threatIds: orphanedThreatIds,
      },
      changedReferences: {
        elements: changedElements,
        dataFlows: changedReferences,
      },
      summary: {
        missingElementCount: missingInterfaces.length,
        missingDataFlowCount: missingConnections.length,
        orphanedThreatCount: orphanedThreatIds.length,
        changedReferenceCount:
          changedReferences.length +
          changedElements.length +
          trustBoundaryChanges.length,
      },
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Synchronize threats with DFD changes using DFDGraph
   */
  synchronizeThreats(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    tables: ThreatTable[],
    syncStatus: ThreatSyncStatus,
    options: {
      updateReferences: boolean;
      removeOrphaned: boolean;
    },
  ): ThreatSyncResult {
    // Early exit if no graph
    if (!project.dfdGraph) {
      return {
        success: false,
        added: 0,
        removed: 0,
        updated: 0,
        threatData: project.threats || {
          configuration: {
            activeMethod: "per-interaction" as const,
            zeroTrustMode: false,
            showThreatActor: false,
            customElementTemplates: [],
            customInteractionTemplates: [],
            customMitigations: [],
            customVerifications: [],
          },
          perElementTables: [],
          perInteractionTables: tables,
          lastModified: new Date().toISOString(),
        },
      };
    }

    const graph = project.dfdGraph;
    let updatedTables = [...tables];
    let added = 0;
    let removed = 0;
    let updated = 0;

    // ==================== Update Trust Boundary names ====================
    updatedTables = updatedTables.map((table) => {
      if (!table.trustBoundaryId) return table;

      const tb = graph.elementsById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        updated++;
        return {
          ...table,
          trustBoundaryName: tb.name,
        };
      }
      return table;
    });

    // ==================== Update source/target names when elements change ====================
    updatedTables = updatedTables.map((table) => ({
      ...table,
      threats: table.threats.map((threat) => {
        if (!threat.dataFlow) return threat;

        const sourceElem = graph.elementsById.get(threat.dataFlow.sourceId);
        const targetElem = graph.elementsById.get(threat.dataFlow.targetId);

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

    // ==================== Update changed interface displayIds ====================
    if (
      options.updateReferences &&
      syncStatus.changedReferences.elements.length > 0
    ) {
      const elementChangeMap = new Map(
        syncStatus.changedReferences.elements.map((c) => [c.threatId, c]),
      );

      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = elementChangeMap.get(threat.id);
          if (change && threat.linkedElement) {
            updated++;

            const currentTB = graph.elementsById.get(
              threat.trustBoundaryId || "",
            );
            const interfaceId = (change.newDisplayId || "").replace(/^IF-/, "");

            const newThreatId = generateThreatIdPerInteraction(
              currentTB?.displayId || "",
              `IF${interfaceId}`,
              threat.strideCategory,
              "incoming",
              threat.sequenceNumber,
            );

            return {
              ...threat,
              id: newThreatId,
              trustBoundaryDisplayId: currentTB?.displayId || "",
              linkedElement: {
                ...threat.linkedElement,
                displayId: change.newDisplayId,
              },
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // ==================== Update changed data flow references ====================
    if (
      options.updateReferences &&
      syncStatus.changedReferences.dataFlows.length > 0
    ) {
      const changeMap = new Map(
        syncStatus.changedReferences.dataFlows.map((c) => [c.threatId, c]),
      );

      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.dataFlow) {
            updated++;

            const connection = graph.connectionsById.get(change.newRef.id);
            const sourceElem = graph.elementsById.get(change.newRef.from);
            const targetElem = graph.elementsById.get(change.newRef.to);

            const currentTB = graph.elementsById.get(
              threat.trustBoundaryId || "",
            );
            const dataFlowId = (connection?.displayId || "").replace(
              /^DF-/,
              "",
            );

            const newThreatId = generateThreatIdPerInteraction(
              currentTB?.displayId || "",
              `DF${dataFlowId}`,
              threat.strideCategory,
              threat.interactionContext.direction,
              threat.sequenceNumber,
            );

            return {
              ...threat,
              id: newThreatId,
              trustBoundaryDisplayId: currentTB?.displayId || "",
              dataFlow: {
                connectionId: change.newRef.id,
                dataFlowId: connection?.displayId || threat.dataFlow.dataFlowId,
                dataFlowName:
                  change.newRef.label || threat.dataFlow.dataFlowName,
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

    // ==================== Remove orphaned threats ====================
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

    // ==================== Add missing threats ====================
    if (
      syncStatus.missingInThreats.dataFlows.length > 0 ||
      syncStatus.missingInThreats.elements.length > 0
    ) {
      const newThreats = interactionThreatGenerator.generateThreatsForProject(
        project,
        dfdContext,
      );

      // Filter to only keep threats for missing items
      const missingConnectionIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id),
      );
      const missingInterfaceIds = new Set(
        syncStatus.missingInThreats.elements.map((e) => e.id),
      );

      for (const newTable of newThreats) {
        // Match by BOTH ID AND name to avoid mixing tables with null IDs
        const existingTable = updatedTables.find(
          (t) =>
            t.trustBoundaryId === newTable.trustBoundaryId &&
            t.trustBoundaryName === newTable.trustBoundaryName,
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
          activeMethod: "per-interaction" as const,
          zeroTrustMode: false,
          showThreatActor: false,
          customElementTemplates: [],
          customInteractionTemplates: [],
          customMitigations: [],
          customVerifications: [],
        },
        perElementTables: project.threats?.perElementTables ?? [],
        perInteractionTables: updatedTables,
        lastModified: new Date().toISOString(),
      },
    };
  }

  /**
   * Create empty sync status for error cases
   */
  private createEmptySyncStatus(): ThreatSyncStatus {
    return {
      inSync: true,
      missingInThreats: {
        elements: [],
        dataFlows: [],
      },
      orphanedThreats: {
        elementIds: [],
        dataFlowIds: [],
        threatIds: [],
      },
      changedReferences: {
        elements: [],
        dataFlows: [],
      },
      summary: {
        missingElementCount: 0,
        missingDataFlowCount: 0,
        orphanedThreatCount: 0,
        changedReferenceCount: 0,
      },
      lastChecked: new Date().toISOString(),
    };
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatSync = new InteractionThreatSync();