// ==================== ELEMENT THREAT SYNC ====================
// Single Responsibility: Synchronize per-element threats with DFD changes

import type {
  ThreatTable,
  ThreatProjectData,
  ThreatSyncStatus,
  ThreatSyncResult,
  DFDElementReference,
  DFDConnectionReference,
} from "../../models/threat-types";
import {
  LinkedDFDElement,
  ElementChange,
  STRIDE_PER_ELEMENT_TYPE,
} from "../../models/per-element-types";
import { elementThreatGenerator } from "./element-generator";

// ==================== ELEMENT SYNC SERVICE ====================

export class ElementThreatSync {
  /**
   * Check if threats are in sync with DFD elements
   */
  checkSyncStatus(
    project: ThreatProjectData,
    tables: ThreatTable[]
  ): ThreatSyncStatus {
    const elements = project.dfdElements || [];
    const connections = project.dfdConnections || [];

    // Lookups und Sammlungen
    const connectionById = new Map(connections.map((c) => [c.id, c]));
    const threatenedElements = new Set<string>();
    const threatenedConnections = new Set<string>();

    const orphanedThreatIds: string[] = [];
    const changedReferences: ElementChange[] = [];

    // Bestehende Threats prüfen
    for (const table of tables) {
      for (const threat of table.threats) {
        if (!threat.linkedElement) continue;

        const elementId = threat.linkedElement.elementId;
        const elementType = threat.linkedElement.elementType;

        // DataFlow-Referenzen gegen dfdConnections prüfen
        if (elementType === "DataFlow") {
          const conn = connectionById.get(elementId);
          if (conn) {
            threatenedConnections.add(conn.id);

            const changes: ("name" | "id" | "type")[] = [];
            // Label/Name geändert?
            if (
              (threat.linkedElement.elementName || "") !== (conn.label || "")
            ) {
              changes.push("name");
            }
            // DisplayId geändert (DF-Nummer/Renummerierung)?
            if (
              threat.linkedElement.displayId &&
              conn.displayId &&
              threat.linkedElement.displayId !== conn.displayId
            ) {
              changes.push("id");
            }

            if (changes.length > 0) {
              changedReferences.push({
                threatId: threat.id,
                oldRef: threat.linkedElement,
                newRef: {
                  id: conn.id,
                  name: conn.label || "",
                  type: "DataFlow",
                  displayId: conn.displayId,
                  position: { x: 0, y: 0 },
                  size: { width: 0, height: 0 },
                } as DFDElementReference,
                changes,
              });
            }
          } else {
            // Verbindung fehlt → verwaister Threat
            orphanedThreatIds.push(threat.id);
          }
          // WICHTIG: normalen Element-Branch überspringen
          continue;
        }

        // Normale DFD-Elemente gegen dfdElements prüfen
        const element = elements.find((e) => e.id === elementId);
        if (!element) {
          orphanedThreatIds.push(threat.id);
          continue;
        }

        threatenedElements.add(elementId);

        // Änderungen (Name/Typ) erfassen
        const elemChanges: ("name" | "id" | "type")[] = [];
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

    // Fehlende Elemente (anwendbare ohne Threats)
    const missingElements: DFDElementReference[] = [];
    for (const element of elements) {
      if (element.type === "TrustBoundary") continue;

      const applicableStride = STRIDE_PER_ELEMENT_TYPE[element.type];
      if (!applicableStride || applicableStride.length === 0) continue;

      if (!threatenedElements.has(element.id)) {
        missingElements.push(element);
      }
    }

    // Fehlende DataFlows (Verbindungen ohne Threats)
    const missingConnections: DFDConnectionReference[] = [];
    for (const connection of connections) {
      if (!threatenedConnections.has(connection.id)) {
        missingConnections.push(connection);
      }
    }

    const inSync =
      missingElements.length === 0 &&
      missingConnections.length === 0 &&
      orphanedThreatIds.length === 0 &&
      changedReferences.length === 0;

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
    },
    catalog: { threatTemplates: any[] }
  ): ThreatSyncResult {
    let updatedTables = [...tables];
    let added = 0;
    let removed = 0;
    let updated = 0;

    // 1) Referenzen aktualisieren (Elemente + DataFlows als ElementChange)
    if (
      options.updateReferences &&
      syncStatus.changedReferences.elements.length > 0
    ) {
      const changeMap = new Map(
        syncStatus.changedReferences.elements.map((c) => [c.threatId, c])
      );

      updatedTables = updatedTables.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          const change = changeMap.get(threat.id);
          if (change && threat.linkedElement) {
            updated++;
            return {
              ...threat,
              linkedElement: {
                elementId: change.newRef.id,
                elementName: change.newRef.name,
                elementType: change.newRef.type, // z.B. "DataFlow"
                displayId: change.newRef.displayId,
              } as LinkedDFDElement,
              lastModified: new Date().toISOString(),
            };
          }
          return threat;
        }),
      }));
    }

    // 2) Verwaiste Threats entfernen
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

    // 3) Fehlende Element-Threats hinzufügen (bestehender Code)
    if (syncStatus.missingInThreats.elements.length > 0) {
      const elements = project.dfdElements || [];
      const trustBoundaries = elements.filter(
        (e) => e.type === "TrustBoundary"
      );

      for (const missingElement of syncStatus.missingInThreats.elements) {
        // TB-Zugehörigkeit (vereinfachte Logik)
        const tb = trustBoundaries.find((tb) =>
          this.elementBelongsToTrustBoundary(elements, missingElement.id, tb.id)
        );

        const trustBoundaryId = tb?.id || null;
        const trustBoundaryName = tb?.name || "External Entities";

        // Threats für das Element generieren
        const newThreats = elementThreatGenerator["generateThreatsForElement"](
          missingElement,
          trustBoundaryId,
          trustBoundaryName,
          catalog
        );

        // Tabelle finden oder erstellen
        let table = updatedTables.find(
          (t) =>
            t.trustBoundaryId === trustBoundaryId &&
            t.trustBoundaryName === trustBoundaryName
        );
        if (!table) {
          table = {
            trustBoundaryId,
            trustBoundaryName,
            displayIdentifier: trustBoundaryId
              ? `[${trustBoundaryId}]`
              : "[EE]",
            threats: [],
          };
          updatedTables.push(table);
        }

        table.threats.push(...newThreats);
        added += newThreats.length;
      }
    }

    // 4) Fehlende DataFlow-Threats hinzufügen (NEU)
    if (syncStatus.missingInThreats.dataFlows.length > 0) {
      const missingConnIds = new Set(
        syncStatus.missingInThreats.dataFlows.map((df) => df.id)
      );

      // Für jede fehlende Verbindung DataFlow-Pseudo-Element bauen und Threats generieren
      const newDfThreats = syncStatus.missingInThreats.dataFlows.flatMap(
        (conn) => {
          const dfElem: DFDElementReference = {
            id: conn.id,
            type: "DataFlow",
            name:
              conn.label ||
              (conn.displayId ? conn.displayId : `DataFlow ${conn.id}`),
            displayId: conn.displayId,
            position: { x: 0, y: 0 },
            size: { width: 0, height: 0 },
          };
          // Generator für EIN Element nutzen
          return elementThreatGenerator["generateThreatsForElement"](
            dfElem,
            null, // DataFlows gehören nicht zu einer TB
            "Data Flows", // Eigene Tabelle
            catalog
          );
        }
      );

      // "Data Flows"-Tabelle finden oder anlegen
      let dfTable = updatedTables.find(
        (t) =>
          t.trustBoundaryId === null && t.trustBoundaryName === "Data Flows"
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

      // Nur jene Threats übernehmen, deren Verbindung tatsächlich fehlt
      const threatsForMissing = newDfThreats.filter(
        (t) =>
          t.linkedElement?.elementType === "DataFlow" &&
          t.linkedElement?.elementId &&
          missingConnIds.has(t.linkedElement.elementId)
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
          activeMethod: "per-element",
          customThreatTemplates: [],
          customMitigationTemplates: [],
          customVerificationTemplates: [],
        },
        perElementTables: updatedTables,
        perInteractionTables: project.threats?.perInteractionTables ?? [],
        lastModified: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract the trust boundary id from name [TB]
   */
  private extractTBIdentifier(name: string, tbIndex?: number): string {
    const tbMatch = name.match(/\[TB-?(\d+)\]/i);
    if (tbMatch) return `TB${tbMatch[1]}`;

    const bracketMatch = name.match(/\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].replace(/-/g, "");

    if (tbIndex !== undefined) return `TB${tbIndex + 1}`;

    return name
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase();
  }

  /**
   * Check if element belongs to trust boundary
   */
  private elementBelongsToTrustBoundary(
    elements: DFDElementReference[],
    elementId: string,
    trustBoundaryId: string
  ): boolean {
    // TODO: Implement proper boundary membership logic
    // For now, return true (simplified)
    return true;
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatSync = new ElementThreatSync();