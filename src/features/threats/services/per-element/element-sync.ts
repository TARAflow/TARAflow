// ==================== ELEMENT THREAT SYNC ====================
// Single Responsibility: Synchronize per-element threats with DFD changes
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
  ElementChange,
  STRIDE_PER_ELEMENT_TYPE,
} from "../../models/per-element-types";
import { elementThreatGenerator } from "./element-generator";
import { DFDAnalysisContext, type LinkedDFDElement } from "shared";

// ==================== TRUST BOUNDARY CHANGE ====================

interface TrustBoundaryChange {
  tableIndex: number;
  oldName: string;
  newName: string;
  trustBoundaryId: string;
}

// ==================== ELEMENT SYNC SERVICE ====================

export class ElementThreatSync {
  /**
   * Check if threats are in sync with DFD elements using DFDGraph
   */
  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[],
  ): ThreatSyncStatus {
    if (!project.dfdGraph) {
      return this.createEmptySyncStatus();
    }

    const graph = project.dfdGraph;
    const threatenedElements = new Set<string>();
    const threatenedConnections = new Set<string>();

    const orphanedThreatIds: string[] = [];
    const changedReferences: ElementChange[] = [];

    // ── Trust Boundary changes ────────────────────────────────────────────
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

    // ── Check existing threats ────────────────────────────────────────────
    for (const table of tables) {
      for (const threat of table.threats) {
        if (!threat.linkedElement) continue;

        const elementId = threat.linkedElement.elementId;
        const elementType = threat.linkedElement.elementType;

        // DataFlow references
        if (elementType === "DataFlow") {
          const conn = graph.connectionsById.get(elementId);
          if (conn) {
            threatenedConnections.add(conn.id);

            const dataFlowIdNormalized = (conn.displayId || "").replace(
              /-/g,
              "",
            );
            const expectedId = `${dataFlowIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;

            const changes: ("name" | "id" | "type")[] = [];

            if (threat.id !== expectedId) {
              changes.push("id");
            }

            if (
              (threat.linkedElement.elementName || "") !==
              (conn.label || conn.name || "")
            ) {
              changes.push("name");
            }

            if (
              threat.linkedElement.displayId &&
              conn.displayId &&
              threat.linkedElement.displayId !== conn.displayId
            ) {
              if (!changes.includes("id")) {
                changes.push("id");
              }
            }

            if (changes.length > 0) {
              changedReferences.push({
                threatId: threat.id,
                oldRef: threat.linkedElement,
                newRef: {
                  id: conn.id,
                  name: conn.label || conn.name || "",
                  type: "DataFlow",
                  displayId: conn.displayId,
                  position: { x: 0, y: 0 },
                  size: { width: 0, height: 0 },
                } as DFDElementReference,
                changes,
              });
            }
          } else {
            orphanedThreatIds.push(threat.id);
          }
          continue;
        }

        // Normal DFD elements
        const element = graph.elementsById.get(elementId);
        if (!element) {
          orphanedThreatIds.push(threat.id);
          continue;
        }

        threatenedElements.add(elementId);

        const currentTB = threat.trustBoundaryId
          ? graph.elementsById.get(threat.trustBoundaryId)
          : null;
        const isInterface =
          element.type === "Interface" || element.type === "PhysicalInterface";

        let expectedId: string;
        if (isInterface && currentTB) {
          const interfaceIdNormalized = (element.displayId || "").replace(
            /-/g,
            "",
          );
          expectedId = `${currentTB.displayId}-${interfaceIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;
        } else {
          const elementIdNormalized = (element.displayId || element.id).replace(
            /-/g,
            "",
          );
          expectedId = `${elementIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;
        }

        const elemChanges: ("name" | "id" | "type")[] = [];

        if (threat.id !== expectedId) {
          elemChanges.push("id");
        }
        if (element.name !== threat.linkedElement.elementName) {
          elemChanges.push("name");
        }
        if (element.type !== threat.linkedElement.elementType) {
          elemChanges.push("type");
        }

        if (elemChanges.length > 0) {
          changedReferences.push({
            threatId: threat.id,
            oldRef: threat.linkedElement,
            newRef: {
              id: element.id,
              name: element.name,
              type: element.type,
              displayId: element.displayId,
            } as DFDElementReference,
            changes: elemChanges,
          });
        }
      }
    }

    // ── Missing elements ──────────────────────────────────────────────────
    const missingElements: DFDElementReference[] = [];
    for (const element of graph.elementsById.values()) {
      if (element.type === "TrustBoundary") continue;
      if (element.type === "ExternalEntity") continue;

      const applicableStride = STRIDE_PER_ELEMENT_TYPE[element.type];
      if (!applicableStride || applicableStride.length === 0) continue;

      if (!threatenedElements.has(element.id)) {
        missingElements.push(element);
      }
    }

    // ── Missing External Entities ─────────────────────────────────────────
    for (const element of graph.elementsById.values()) {
      if (element.type !== "ExternalEntity") continue;

      const applicableStride = STRIDE_PER_ELEMENT_TYPE[element.type];
      if (!applicableStride || applicableStride.length === 0) continue;

      if (!threatenedElements.has(element.id)) {
        missingElements.push(element);
      }
    }

    // ── Missing DataFlows ─────────────────────────────────────────────────
    const missingConnections: DFDConnectionReference[] = [];
    for (const connection of graph.connectionsById.values()) {
      // Skip connections explicitly excluded from threat generation
      const isExcluded =
        connection.excludeFromThreatGen ||
        (connection as any)?.properties?.excludeFromThreatGen;
      if (isExcluded) continue;

      if (!threatenedConnections.has(connection.id)) {
        missingConnections.push(connection);
      }
    }

    const inSync =
      missingElements.length === 0 &&
      missingConnections.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedReferences.length === 0 &&
      trustBoundaryChanges.length === 0;

    return {
      inSync,
      missingInThreats: {
        elements: missingElements,
        dataFlows: missingConnections,
      },
      orphanedThreats: {
        elementIds: orphanedThreatIds,
        dataFlowIds: [],
        threatIds: orphanedThreatIds,
      },
      changedReferences: {
        elements: changedReferences,
        dataFlows: [],
      },
      summary: {
        missingElementCount: missingElements.length,
        missingDataFlowCount: missingConnections.length,
        orphanedThreatCount: orphanedThreatIds.length,
        changedReferenceCount:
          changedReferences.length + trustBoundaryChanges.length,
      },
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Synchronize threats with DFD changes using DFDGraph.
   * Note: catalog parameter removed — generator uses threat-catalog-service directly.
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
    if (!project.dfdGraph) {
      return {
        success: false,
        added: 0,
        removed: 0,
        updated: 0,
        threatData: project.threats || {
          configuration: {
            activeMethod: "per-element" as const,
            zeroTrustMode: false,
            showThreatActor: false,
            customElementTemplates: [],
            customInteractionTemplates: [],
            customMitigations: [],
            customVerifications: [],
          },
          perElementTables: tables,
          perInteractionTables: [],
          lastModified: new Date().toISOString(),
        },
      };
    }

    const graph = project.dfdGraph;
    let updatedTables = [...tables];
    let added = 0;
    let removed = 0;
    let updated = 0;

    // ── Update Trust Boundary names ───────────────────────────────────────
    const trustBoundaryChanges = this.findTrustBoundaryChanges(tables, graph);
    if (trustBoundaryChanges.length > 0) {
      trustBoundaryChanges.forEach((change) => {
        const table = updatedTables[change.tableIndex];
        if (table) {
          table.trustBoundaryName = change.newName;
          updated++;
        }
      });
    }

    // ── Update Threat IDs ─────────────────────────────────────────────────
    updatedTables = updatedTables.map((table) => ({
      ...table,
      threats: table.threats.map((threat) => {
        if (!threat.linkedElement) return threat;

        const elementId = threat.linkedElement.elementId;
        const elementType = threat.linkedElement.elementType;

        // DataFlows
        if (elementType === "DataFlow") {
          const conn = graph.connectionsById.get(elementId);
          if (!conn) return threat;

          const dataFlowIdNormalized = (conn.displayId || "").replace(/-/g, "");
          const newThreatId = `${dataFlowIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;

          if (threat.id !== newThreatId) {
            updated++;
            return {
              ...threat,
              id: newThreatId,
              linkedElement: {
                ...threat.linkedElement,
                elementName:
                  conn.label || conn.name || threat.linkedElement.elementName,
                displayId: conn.displayId,
              },
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }

        // Normal Elements & Interfaces
        const element = graph.elementsById.get(elementId);
        if (!element) return threat;

        const currentTB = threat.trustBoundaryId
          ? graph.elementsById.get(threat.trustBoundaryId)
          : null;
        const isInterface =
          element.type === "Interface" || element.type === "PhysicalInterface";

        let newThreatId: string;
        if (isInterface && currentTB) {
          const interfaceIdNormalized = (element.displayId || "").replace(
            /-/g,
            "",
          );
          newThreatId = `${currentTB.displayId}-${interfaceIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;
        } else {
          const elementIdNormalized = (element.displayId || element.id).replace(
            /-/g,
            "",
          );
          newThreatId = `${elementIdNormalized}-${threat.strideCategory}-${threat.sequenceNumber}`;
        }

        if (threat.id !== newThreatId) {
          updated++;
          return {
            ...threat,
            id: newThreatId,
            trustBoundaryDisplayId:
              currentTB?.displayId || threat.trustBoundaryDisplayId,
            linkedElement: {
              ...threat.linkedElement,
              elementName: element.name,
              elementType: element.type,
              displayId: element.displayId,
            },
            lastModified: new Date().toISOString(),
          };
        }
        return threat;
      }),
    }));

    // ── Update changed references ─────────────────────────────────────────
    if (
      options.updateReferences &&
      syncStatus.changedReferences.elements.length > 0
    ) {
      const changeMap = new Map(
        syncStatus.changedReferences.elements.map((c) => [c.threatId, c]),
      );

      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.linkedElement) {
            if (
              change.changes.includes("name") ||
              change.changes.includes("type")
            ) {
              updated++;
              return {
                ...threat,
                linkedElement: {
                  elementId: change.newRef.id,
                  elementName: change.newRef.name,
                  elementType: change.newRef.type,
                  displayId: change.newRef.displayId,
                } as LinkedDFDElement,
                lastModified: new Date().toISOString(),
              };
            }
          }
          return threat;
        }),
      }));
    }

    // ── Remove orphaned threats ───────────────────────────────────────────
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

    // ── Add missing element threats ───────────────────────────────────────
    if (syncStatus.missingInThreats.elements.length > 0) {
      for (const missingElement of syncStatus.missingInThreats.elements) {
        const trustBoundaryId = this.getElementTrustBoundary(
          graph,
          missingElement.id,
        );

        let trustBoundaryName: string;
        let trustBoundaryDisplayId: string;
        let isInterfaceWithoutTB = false;

        if (missingElement.type === "ExternalEntity") {
          trustBoundaryName = "External Entities";
          trustBoundaryDisplayId = "";
        } else if (
          (missingElement.type === "Interface" ||
            missingElement.type === "PhysicalInterface") &&
          !trustBoundaryId
        ) {
          trustBoundaryName = "Physical Interfaces";
          trustBoundaryDisplayId = "";
          isInterfaceWithoutTB = true;
        } else if (trustBoundaryId) {
          const tb = graph.elementsById.get(trustBoundaryId);
          trustBoundaryName = tb?.name || "Unknown";
          trustBoundaryDisplayId = tb?.displayId || "";
        } else {
          trustBoundaryName = "No Trust Boundary";
          trustBoundaryDisplayId = "";
        }

        // Build a minimal project stub so the generator can run without
        // a full project object. settings = undefined → no context filtering
        // (correct for sync — we don't want to filter here).
        const projectStub = {
          ...project,
          dfdGraph: {
            ...graph,
            // Provide a single-element map so elementToAssets lookup works
            elementsById: graph.elementsById,
            connectionsById: graph.connectionsById,
          },
        } as ThreatProjectData;

        const newThreats =
          elementThreatGenerator.generateThreatsForSingleElement(
            missingElement,
            missingElement.type === "ExternalEntity" || isInterfaceWithoutTB
              ? null
              : trustBoundaryId,
            trustBoundaryName,
            trustBoundaryDisplayId,
            new Map(), // elementToAssets
            projectStub, // project
          );

        let table = updatedTables.find((t) => {
          if (missingElement.type === "ExternalEntity") {
            return t.trustBoundaryName === "External Entities";
          }
          if (isInterfaceWithoutTB) {
            return t.trustBoundaryName === "Physical Interfaces";
          }
          return (
            t.trustBoundaryId === trustBoundaryId &&
            t.trustBoundaryName === trustBoundaryName
          );
        });

        if (!table) {
          table = {
            trustBoundaryId:
              missingElement.type === "ExternalEntity" || isInterfaceWithoutTB
                ? null
                : trustBoundaryId,
            trustBoundaryName,
            displayIdentifier:
              missingElement.type === "ExternalEntity"
                ? "[EE]"
                : isInterfaceWithoutTB
                  ? "[IF]"
                  : `[${trustBoundaryDisplayId}]`,
            threats: [],
          };
          updatedTables.push(table);
        }

        table.threats.push(...newThreats);
        added += newThreats.length;
      }
    }

    // ── Add missing DataFlow threats ──────────────────────────────────────
    if (syncStatus.missingInThreats.dataFlows.length > 0) {
      const missingConnIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id),
      );

      const projectStub = { ...project } as ThreatProjectData;

      const newDfThreats = syncStatus.missingInThreats.dataFlows.flatMap(
        (conn) => {
          const dfElem: DFDElementReference = {
            id: conn.id,
            type: "DataFlow",
            name: conn.label || conn.displayId || `DataFlow ${conn.id}`,
            displayId: conn.displayId,
          };

          return elementThreatGenerator.generateThreatsForSingleElement(
            dfElem,
            null,
            "Data Flows",
            "",
            new Map(), // elementToAssets
            projectStub, // project
          );
        },
      );

      let dfTable = updatedTables.find(
        (t) =>
          t.trustBoundaryId === null && t.trustBoundaryName === "Data Flows",
      );
      if (!dfTable) {
        dfTable = {
          trustBoundaryId: null,
          trustBoundaryName: "Data Flows",
          displayIdentifier: "[DF]",
          threats: [],
        };
        updatedTables.push(dfTable);
      }

      const threatsForMissing = newDfThreats.filter(
        (t) =>
          t.linkedElement?.elementType === "DataFlow" &&
          t.linkedElement?.elementId &&
          missingConnIds.has(t.linkedElement.elementId),
      );

      dfTable.threats.push(...threatsForMissing);
      added += threatsForMissing.length;
    }

    return {
      success: true,
      added,
      removed,
      updated,
      threatData: {
        configuration: {
          activeMethod: "per-element" as const,
          zeroTrustMode: false,
          showThreatActor: false,
          customElementTemplates: [],
          customInteractionTemplates: [],
          customMitigations: [],
          customVerifications: [],
        },
        perElementTables: updatedTables,
        perInteractionTables: project.threats?.perInteractionTables ?? [],
        lastModified: new Date().toISOString(),
      },
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getElementTrustBoundary(
    graph: DFDGraphReference,
    elementId: string,
  ): string | null {
    const effectiveTB = graph.effectiveElementTrustBoundary.get(elementId);
    return effectiveTB || null;
  }

  private findTrustBoundaryChanges(
    tables: ThreatTable[],
    graph: DFDGraphReference,
  ): TrustBoundaryChange[] {
    const changes: TrustBoundaryChange[] = [];

    tables.forEach((table, tableIndex) => {
      if (!table.trustBoundaryId) return;

      const tb = graph.elementsById.get(table.trustBoundaryId);
      if (tb && tb.name !== table.trustBoundaryName) {
        changes.push({
          tableIndex,
          oldName: table.trustBoundaryName,
          newName: tb.name,
          trustBoundaryId: table.trustBoundaryId,
        });
      }
    });

    return changes;
  }

  private createEmptySyncStatus(): ThreatSyncStatus {
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
    };
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatSync = new ElementThreatSync();