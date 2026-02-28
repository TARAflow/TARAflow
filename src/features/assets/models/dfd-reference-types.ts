// ==================== DFD REFERENCE TYPES ====================
// features/assets/models/dfd-reference-types.ts
//
// Read-only Referenz-Typen für die Assets-Feature.
// Werden vom dfd-to-asset-mapper befüllt und sind bewusst
// unabhängig von den DFD-internen Typen (Dependency Inversion).
//
// HINWEIS: Diese Typen spiegeln die neue Asset-Relation-Struktur:
// - relationType (singular, AnyAssetRelationType) statt relationTypes[]
// - assetGroup als explizites Feld (steuert Tab-Anzeige + Farbe)
// - qualifier nur bei uses (System) und accesses (Infra)
// - Marker-Logik entfernt (positions, sizes, xmlIds)

// ==================== DFD ASSET REFERENCE ====================

/**
 * Read-only Referenz auf ein DFD Asset
 * Wird im Assets-Tab für Sync und Anzeige verwendet
 */
export interface DFDAssetReference {
  readonly id: string;
  readonly displayId: string;
  readonly name?: string;
  readonly description?: string;

  /**
   * Asset-Gruppe — steuert Tab-Anzeige [Data|Systems|Process|Infra|People]
   * und Farb-Kodierung im DrawIO-Layer
   */
  readonly assetGroup?:
    | "data"
    | "system"
    | "process"
    | "infrastructure"
    | "human";

  /** Schutzbedarf — für Chip-Anzeige im AssetRelationSelector */
  readonly protectionNeed?: "low" | "medium" | "high" | "critical";

  /**
   * DFD-Elemente mit denen dieses Asset verknüpft ist
   * Eine Zeile pro Relation (nicht pro Asset-Element-Paar)
   */
  readonly linkedElements?: ReadonlyArray<{
    readonly elementId: string;
    readonly elementName: string;
    readonly elementType: string;
    readonly displayId: string;
    /** Relation-Typ — gruppenspezifisch (z.B. "reads", "controls", "is_an") */
    readonly relationType?: string;
    /** Qualifier — nur bei uses (System) und accesses (Infra) */
    readonly qualifier?: string;
    readonly notes?: string;
  }>;
}

// ==================== DFD ELEMENT REFERENCE ====================

/**
 * Read-only Referenz auf ein DFD Element
 * Wird für Sync und Anzeige im Assets-Tab verwendet
 */
export interface DFDElementReference {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly displayId: string;

  /**
   * Asset-Relationen dieses Elements
   * Definiert vom User im Element-Beschreibungsformular
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    /** Asset-Gruppe — für Tab-Filter und DrawIO-Label-Farbe */
    readonly assetGroup:
      | "data"
      | "system"
      | "process"
      | "infrastructure"
      | "human";
    /** Relation-Typ — gruppenspezifisch */
    readonly relationType: string;
    /** Qualifier — nur bei uses (System) und accesses (Infra) */
    readonly qualifier?: string;
    readonly notes?: string;
  }>;
}

// ==================== DFD CONNECTION REFERENCE ====================

/**
 * Read-only Referenz auf einen DFD DataFlow
 * name = das Label des Pfeils im Diagram (war früher: label)
 */
export interface DFDConnectionReference {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Aktionstext des Datenflusses z.B. "send cmd", "request status" */
  readonly name?: string;
  readonly displayId: string;

  /**
   * Asset-Relationen dieses DataFlows
   * DataFlow erlaubt: transports (Data), invokes (Process), uses (System)
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    readonly assetGroup:
      | "data"
      | "system"
      | "process"
      | "infrastructure"
      | "human";
    readonly relationType: string;
    readonly qualifier?: string;
    readonly notes?: string;
  }>;
}

// ==================== ELEMENT LINK ====================

/**
 * Vereinfachter Link für Anzeige in der Asset-Tabelle
 * Abgeleitet aus DFDAssetReference.linkedElements
 */
export interface DFDElementLink {
  elementId: string;
  elementName: string;
  elementType: string;
  displayId: string;
  /** Relation-Typ — gruppenspezifisch */
  relationType?: string;
  /** Qualifier — nur bei uses/accesses */
  qualifier?: string;
  notes?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Gibt alle verlinkten Elemente für ein Asset zurück
 */
export function getLinkedElementsForAsset(
  assetId: string,
  dfdAssets?: ReadonlyArray<DFDAssetReference>,
): DFDElementLink[] {
  const dfdAsset = dfdAssets?.find((a) => a.id === assetId);
  if (!dfdAsset?.linkedElements) return [];

  return Array.from(dfdAsset.linkedElements).map((link) => ({
    elementId: link.elementId,
    elementName: link.elementName,
    elementType: link.elementType,
    displayId: link.displayId,
    relationType: link.relationType,
    qualifier: link.qualifier,
    notes: link.notes,
  }));
}

/**
 * Gibt alle Asset-Relationen eines Elements zurück
 * gefiltert nach Asset-Gruppe
 */
export function getElementRelationsByGroup(
  element: DFDElementReference,
  assetGroup: "data" | "system" | "process" | "infrastructure" | "human",
): NonNullable<DFDElementReference["assetRelations"]> {
  return (
    element.assetRelations?.filter((r) => r.assetGroup === assetGroup) ?? []
  );
}

/**
 * Prüft ob ein Element eine is_an Beziehung zu einem Asset hat
 */
export function hasIsAnRelation(
  element: DFDElementReference,
  assetId: string,
): boolean {
  return (
    element.assetRelations?.some(
      (r) => r.assetId === assetId && r.relationType === "is_an",
    ) ?? false
  );
}
