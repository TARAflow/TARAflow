// ==================== ASSET RELATION TYPES ====================
// Typdefinitionen für alle Asset-Gruppen und deren Beziehungstypen
//
// Konzept: "Active-Impact Modell"
// DFD-Element → wirkt auf → Asset
//
// Zwei Perspektiven:
// - Angriffsvektor:    Wie kann ein Angreifer das System kompromittieren? (Likelihood)
// - Schadenspotenzial: Welche Kaskadeneffekte bei Ausfall? (Impact)
//
// is_an ist EXKLUSIV: Ein Element ist entweder Instanz eines Assets
// ODER hat Auswirkungsbeziehungen - nie beides gleichzeitig.

import type { SafetyAnnotation } from "./safety-types";

// ==================== ASSET GROUP ====================

/**
 * Die fünf Asset-Gruppen in TARAflow
 * Entspricht den Tabs in der UI: [Data] [Systems] [Process] [Infra] [People]
 */
export type AssetGroup =
  | "data"
  | "system"
  | "process"
  | "infrastructure"
  | "human";

// ==================== DATA ASSET RELATIONS ====================

/**
 * Beziehungstypen für Data Assets
 * Beschreibt Auswirkungen auf Daten und Informationen
 */
export type DataAssetRelationType =
  | "creates"    // Element erzeugt das Data Asset
  | "reads"      // Element liest das Data Asset
  | "modifies"   // Element verändert das Data Asset
  | "deletes"    // Element löscht das Data Asset
  | "stores"     // Element speichert das Data Asset
  | "transports" // Element transportiert das Data Asset
  | "is_an";     // Element ist eine Instanz des Data Assets

// ==================== PROCESS ASSET RELATIONS ====================

/**
 * Beziehungstypen für Process Assets
 * Beschreibt Auswirkungen auf Prozesse und Abläufe
 */
export type ProcessAssetRelationType =
  | "executes"   // Element führt den Prozess aus
  | "invokes"    // Element startet/ruft den Prozess auf
  | "terminates" // Element beendet den Prozess
  | "suspends"   // Element pausiert den Prozess
  | "monitors"   // Element überwacht den Prozess
  | "is_an";     // Element ist eine Instanz des Process Assets

// ==================== SYSTEM ASSET RELATIONS ====================

/**
 * Beziehungstypen für System Assets
 * Unterscheidet aktive Nutzung (Angriffsvektor) von Abhängigkeiten (Impact)
 *
 * WICHTIG: "uses" erfordert zwingend einen SystemUsesQualifier
 */
export type SystemAssetRelationType =
  | "controls"   // Element hat umfassende Kontrolle (start/stop/suspend/configure)
  | "configures" // Element ändert Konfiguration
  | "monitors"   // Element beobachtet/liest Systemzustand
  | "uses"       // Element nutzt Funktionalität [REQUIRES QUALIFIER]
  | "depends_on" // Element ist abhängig vom System (Kaskadeneffekt bei Ausfall)
  | "is_an";     // Element ist eine Instanz des System Assets

/**
 * Qualifier für "uses"-Beziehung bei System Assets
 * Präzisiert welche Systemfunktionalität genutzt wird
 * Ermöglicht genaue Angriffsvektor-Analyse
 */
export type SystemUsesQualifier =
  | "network"         // Netzwerkzugriff (uses [network]) → Authentication + Authorization
  | "local"           // Lokaler Zugriff (uses [local])   → Authorization
  | "authentication"  // Nutzt Auth-Funktion (Login, Token-Validierung)
  | "authorization"   // Nutzt Berechtigungsprüfung (RBAC, ACL)
  | "api"             // Nutzt API-Endpoint (REST, gRPC, GraphQL)
  | "storage"         // Nutzt Speicherfunktion (DB, Filesystem, Cache)
  | "computation"     // Nutzt Rechenfunktion (ML-Inferenz, Kryptographie)
  | "messaging"       // Nutzt Messaging/Queue (MQTT, AMQP, Kafka)
  | "configuration"   // Nutzt Konfigurationsfunktion (Settings, Feature Flags)
  | "monitoring"      // Nutzt Monitoring/Logging (Metrics, Traces)
  | "networking";     // Nutzt Netzwerkfunktion (DNS, Proxy, Load Balancer)

/**
 * Qualifier für "accesses"-Beziehung bei Infrastructure Assets
 * Bestimmt die Schutzziele: remote erfordert zusätzlich Authentication
 *
 * - local:    Physischer Zugang vor Ort        → Authorization, Non-Repudiation
 * - internal: Zugang innerhalb der Anlage      → Authorization, Non-Repudiation
 * - remote:   Fernzugang via Netzwerk/VPN      → Authentication, Authorization,
 *                                                 Non-Repudiation, Accountability
 */
export type InfraAccessesQualifier = "local" | "internal" | "remote";

// ==================== INFRASTRUCTURE ASSET RELATIONS ====================

/**
 * Beziehungstypen für Infrastructure Assets
 * Fokus auf physischen Zustand und Zugriffsschutz
 */
export type InfraAssetRelationType =
  | "accesses"  // Element hat physischen Zugriff auf das Asset
  | "secures"   // Element schützt das physische Asset (z.B. Schließsystem)
  | "damages"   // Element kann das Asset physisch beschädigen (Sabotage)
  | "powers"    // Element stellt die Energieversorgung sicher
  | "monitors"  // Element überwacht physische Parameter (Temp, Rauch, Intrusion)
  | "is_an";    // Element ist eine Instanz des Infrastructure Assets

// ==================== HUMAN ASSET RELATIONS ====================

/**
 * Beziehungstypen für Human Assets
 * Menschen als Schutzobjekte (Safety / Security / Privacy)
 */
export type HumanAssetRelationType =
  | "affects_safety"   // Element beeinflusst physische Sicherheit
  | "affects_privacy"  // Element beeinträchtigt Privatsphäre / DSGVO
  | "identifies"       // Element identifiziert / de-anonymisiert Person
  | "tracks"           // Element verfolgt / überwacht Person
  | "exposes"          // Element gefährdet / exponiert Person
  | "is_an";           // Element repräsentiert diese Person / Rolle

// ==================== UNION TYPES ====================

/**
 * Alle Relation-Typen über alle Asset-Gruppen
 * Für generische Funktionen die gruppenunabhängig arbeiten
 */
export type AnyAssetRelationType =
  | DataAssetRelationType
  | ProcessAssetRelationType
  | SystemAssetRelationType
  | InfraAssetRelationType
  | HumanAssetRelationType;

// ==================== DISCRIMINATED UNION: ASSET RELATIONS ====================
// is_an ist EXKLUSIV - schließt alle anderen Relationen aus
// Wird auf Typ-Ebene erzwungen, nicht nur per UI-Validierung

/**
 * is_an Beziehung - exklusiv, keine weiteren Relationen möglich
 * Schafft logisch eindeutige Brücke für transitive Ableitungen
 */
export interface IsAnRelation {
  readonly relationType: "is_an";
  assetId: string;
  assetGroup: AssetGroup;
  notes?: string;
  safety?: SafetyAnnotation;
}

// ==================== DATA ASSET RELATION ====================

export interface DataAssetInteractionRelation {
  readonly relationType: Exclude<DataAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "data";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type DataAssetRelation = IsAnRelation | DataAssetInteractionRelation;

// ==================== PROCESS ASSET RELATION ====================

export interface ProcessAssetInteractionRelation {
  readonly relationType: Exclude<ProcessAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "process";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type ProcessAssetRelation = IsAnRelation | ProcessAssetInteractionRelation;

// ==================== SYSTEM ASSET RELATION ====================

/**
 * "uses"-Beziehung mit Pflicht-Qualifier
 * Getrennt modelliert damit qualifier zur Compile-Zeit erzwungen wird
 */
export interface SystemUsesRelation {
  readonly relationType: "uses";
  assetId: string;
  assetGroup: "system";
  qualifier: SystemUsesQualifier; // PFLICHTFELD bei uses
  notes?: string;
  safety?: SafetyAnnotation;
}

export interface SystemOtherRelation {
  readonly relationType: Exclude<SystemAssetRelationType, "is_an" | "uses">;
  assetId: string;
  assetGroup: "system";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type SystemAssetRelation =
  | IsAnRelation
  | SystemUsesRelation
  | SystemOtherRelation;

// ==================== INFRASTRUCTURE ASSET RELATION ====================

/**
 * "accesses"-Beziehung mit Pflicht-Qualifier
 * Bestimmt die Schutzziele: remote erfordert Authentication zusätzlich
 */
export interface InfraAccessesRelation {
  readonly relationType: "accesses";
  assetId: string;
  assetGroup: "infrastructure";
  qualifier: InfraAccessesQualifier; // PFLICHTFELD bei accesses
  notes?: string;
  safety?: SafetyAnnotation;
}

export interface InfraOtherRelation {
  readonly relationType: Exclude<InfraAssetRelationType, "is_an" | "accesses">;
  assetId: string;
  assetGroup: "infrastructure";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type InfraAssetRelation =
  | IsAnRelation
  | InfraAccessesRelation
  | InfraOtherRelation;

// ==================== HUMAN ASSET RELATION ====================

export interface HumanAssetInteractionRelation {
  readonly relationType: Exclude<HumanAssetRelationType, "is_an">;
  assetId: string;
  assetGroup: "human";
  notes?: string;
  safety?: SafetyAnnotation;
}

export type HumanAssetRelation = IsAnRelation | HumanAssetInteractionRelation;

// ==================== UNIFIED ASSET RELATION ====================

/**
 * Einheitlicher Typ für alle Asset-Relationen
 * Wird in DFDElement.assetRelations und DFDConnection.assetRelations verwendet
 *
 * Discriminated Union über assetGroup + relationType ermöglicht
 * typsichere Verarbeitung ohne Casts
 */
export type AssetRelation =
  | DataAssetRelation
  | ProcessAssetRelation
  | SystemAssetRelation
  | InfraAssetRelation
  | HumanAssetRelation;

// ==================== TYPE GUARDS ====================

export function isIsAnRelation(relation: AssetRelation): relation is IsAnRelation {
  return relation.relationType === "is_an";
}

export function isDataRelation(
  relation: AssetRelation
): relation is DataAssetRelation {
  return (relation as DataAssetInteractionRelation).assetGroup === "data"
    || (isIsAnRelation(relation));
}

export function isSystemUsesRelation(
  relation: AssetRelation
): relation is SystemUsesRelation {
  return relation.relationType === "uses";
}

export function isInfraAccessesRelation(
  relation: AssetRelation
): relation is InfraAccessesRelation {
  return relation.relationType === "accesses";
}

/**
 * Prüft ob eine Relation einen Qualifier hat
 * (SystemUsesRelation oder InfraAccessesRelation)
 */
export function hasQualifier(
  relation: AssetRelation
): relation is SystemUsesRelation | InfraAccessesRelation {
  return isSystemUsesRelation(relation) || isInfraAccessesRelation(relation);
}

/**
 * Prüft ob eine Gruppe von Relationen eine is_an Beziehung enthält
 * (is_an darf nicht mit anderen Relationen für dasselbe Asset kombiniert werden)
 */
export function hasIsAnConflict(relations: AssetRelation[], assetId: string): boolean {
  const forAsset = relations.filter((r) => r.assetId === assetId);
  const hasIsAn = forAsset.some(isIsAnRelation);
  return hasIsAn && forAsset.length > 1;
}
