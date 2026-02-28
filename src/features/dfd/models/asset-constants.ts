// ==================== ASSET CONSTANTS ====================
// Konfiguration der erlaubten Asset-Relationen pro DFD-Element-Typ
//
// Ersetzt ALLOWED_ASSET_RELATIONS aus dfd-constants.ts
// Asset-zentrierte Sicht statt Element-zentrierter Sicht

import type { DFDElementType } from "./dfd-types";
import type {
  AssetGroup,
  DataAssetRelationType,
  ProcessAssetRelationType,
  SystemAssetRelationType,
  InfraAssetRelationType,
  HumanAssetRelationType,
  SystemUsesQualifier,
  InfraAccessesQualifier,
} from "./asset-relation-types";

// ==================== UI DISPLAY KONFIGURATION ====================

/**
 * Anzeige-Konfiguration pro Asset-Gruppe
 * Für Tab-Leiste [Data] [Systems] [Process] [Infra] [People]
 */
export const ASSET_GROUP_CONFIG: Record<
  AssetGroup,
  {
    label: string;
    labelDE: string;
    color: string;       // Hex-Farbe für DrawIO-Label und UI-Badge
    colorLight: string;  // Heller Hintergrund für Chips
  }
> = {
  data: {
    label: "Data",
    labelDE: "Daten",
    color: "#1976D2",      // Blau
    colorLight: "#E3F2FD",
  },
  system: {
    label: "Systems",
    labelDE: "Systeme",
    color: "#7B1FA2",      // Lila
    colorLight: "#F3E5F5",
  },
  process: {
    label: "Process",
    labelDE: "Prozesse",
    color: "#E65100",      // Orange
    colorLight: "#FFF3E0",
  },
  infrastructure: {
    label: "Infra",
    labelDE: "Infrastruktur",
    color: "#4E342E",      // Braun
    colorLight: "#EFEBE9",
  },
  human: {
    label: "People",
    labelDE: "Personen",
    color: "#2E7D32",      // Grün
    colorLight: "#E8F5E9",
  },
};

// ==================== RELATION TYPE LABELS ====================

/**
 * Anzeigetexte für Data Asset Relation Types
 */
export const DATA_RELATION_LABELS: Record<DataAssetRelationType, { en: string; de: string }> = {
  creates:   { en: "Creates",    de: "Erzeugt" },
  reads:     { en: "Reads",      de: "Liest" },
  modifies:  { en: "Modifies",   de: "Verändert" },
  deletes:   { en: "Deletes",    de: "Löscht" },
  stores:    { en: "Stores",     de: "Speichert" },
  transports:{ en: "Transports", de: "Transportiert" },
  is_an:     { en: "Is an instance of", de: "Ist eine Instanz von" },
};

/**
 * Anzeigetexte für Process Asset Relation Types
 */
export const PROCESS_RELATION_LABELS: Record<ProcessAssetRelationType, { en: string; de: string }> = {
  executes:   { en: "Executes",   de: "Führt aus" },
  invokes:    { en: "Invokes",    de: "Ruft auf" },
  terminates: { en: "Terminates", de: "Beendet" },
  suspends:   { en: "Suspends",   de: "Pausiert" },
  monitors:   { en: "Monitors",   de: "Überwacht" },
  is_an:      { en: "Is an instance of", de: "Ist eine Instanz von" },
};

/**
 * Anzeigetexte für System Asset Relation Types
 */
export const SYSTEM_RELATION_LABELS: Record<SystemAssetRelationType, { en: string; de: string }> = {
  controls:   { en: "Controls",   de: "Kontrolliert" },
  configures: { en: "Configures", de: "Konfiguriert" },
  monitors:   { en: "Monitors",   de: "Überwacht" },
  uses:       { en: "Uses",       de: "Nutzt" },
  depends_on: { en: "Depends on", de: "Abhängig von" },
  is_an:      { en: "Is an instance of", de: "Ist eine Instanz von" },
};

/**
 * Anzeigetexte für System Uses Qualifier
 */
export const SYSTEM_USES_QUALIFIER_LABELS: Record<SystemUsesQualifier, { en: string; de: string }> = {
  network:        { en: "Network access",  de: "Netzwerkzugriff" },
  local:          { en: "Local access",    de: "Lokaler Zugriff" },
  authentication: { en: "Authentication",  de: "Authentifizierung" },
  authorization:  { en: "Authorization",   de: "Autorisierung" },
  api:            { en: "API",             de: "API" },
  storage:        { en: "Storage",         de: "Speicher" },
  computation:    { en: "Computation",     de: "Berechnung" },
  messaging:      { en: "Messaging",       de: "Messaging" },
  configuration:  { en: "Configuration",   de: "Konfiguration" },
  monitoring:     { en: "Monitoring",      de: "Monitoring" },
  networking:     { en: "Networking",      de: "Netzwerk" },
};

/**
 * Anzeigetexte für Infrastructure Accesses Qualifier
 */
export const INFRA_ACCESSES_QUALIFIER_LABELS: Record<InfraAccessesQualifier, { en: string; de: string }> = {
  local:    { en: "Local (on-site)",  de: "Lokal (vor Ort)" },
  internal: { en: "Internal (plant)", de: "Intern (Anlage)" },
  remote:   { en: "Remote (network)", de: "Remote (Netzwerk)" },
};

/**
 * Anzeigetexte für Infrastructure Asset Relation Types
 */
export const INFRA_RELATION_LABELS: Record<InfraAssetRelationType, { en: string; de: string }> = {
  accesses: { en: "Accesses", de: "Greift zu auf" },
  secures:  { en: "Secures",  de: "Schützt" },
  damages:  { en: "Damages",  de: "Beschädigt" },
  powers:   { en: "Powers",   de: "Versorgt" },
  monitors: { en: "Monitors", de: "Überwacht" },
  is_an:    { en: "Is an instance of", de: "Ist eine Instanz von" },
};

/**
 * Anzeigetexte für Human Asset Relation Types
 */
export const HUMAN_RELATION_LABELS: Record<HumanAssetRelationType, { en: string; de: string }> = {
  affects_safety:  { en: "Affects safety",  de: "Gefährdet physisch" },
  affects_privacy: { en: "Affects privacy", de: "Beeinträchtigt Privatsphäre" },
  identifies:      { en: "Identifies",      de: "Identifiziert" },
  tracks:          { en: "Tracks",          de: "Verfolgt" },
  exposes:         { en: "Exposes",         de: "Exponiert" },
  is_an:           { en: "Is an instance of", de: "Ist eine Instanz von" },
};

// ==================== ALLOWED RELATIONS MATRIX ====================
// Definiert welche Relationstypen pro Element-Typ + Asset-Gruppe erlaubt sind
// is_an ist bei den meisten Kombinationen erlaubt (sofern semantisch sinnvoll)

/**
 * Erlaubte Data Asset Relationen pro DFD-Element-Typ
 */
export const ALLOWED_DATA_RELATIONS: Record<DFDElementType, DataAssetRelationType[]> = {
  Process:        ["creates", "reads", "modifies", "deletes", "is_an"],
  Multiprocess:   ["creates", "reads", "modifies", "deletes", "is_an"],
  DataStore:      ["stores", "deletes", "is_an"],
  DataFlow:       ["transports"],
  ExternalEntity: ["creates", "reads", "is_an"],
  Interface:      ["transports"],
  TrustBoundary:  [],
};

/**
 * Erlaubte Process Asset Relationen pro DFD-Element-Typ
 */
export const ALLOWED_PROCESS_RELATIONS: Record<DFDElementType, ProcessAssetRelationType[]> = {
  Process:        ["executes", "invokes", "terminates", "suspends", "monitors", "is_an"],
  Multiprocess:   ["executes", "invokes", "terminates", "suspends", "monitors", "is_an"],
  DataStore:      [],
  DataFlow:       ["invokes"],
  ExternalEntity: ["invokes", "terminates", "suspends", "monitors", "is_an"],
  Interface:      ["invokes", "monitors"],
  TrustBoundary:  [],
};

/**
 * Erlaubte System Asset Relationen pro DFD-Element-Typ
 */
export const ALLOWED_SYSTEM_RELATIONS: Record<DFDElementType, SystemAssetRelationType[]> = {
  Process:        ["controls", "configures", "monitors", "uses", "depends_on", "is_an"],
  Multiprocess:   ["controls", "configures", "monitors", "uses", "depends_on", "is_an"],
  DataStore:      ["depends_on", "is_an"],
  DataFlow:       ["uses"],
  ExternalEntity: ["controls", "configures", "monitors", "uses", "depends_on", "is_an"],
  Interface:      ["monitors", "uses", "depends_on", "is_an"],
  TrustBoundary:  [],
};

/**
 * Erlaubte Infrastructure Asset Relationen pro DFD-Element-Typ
 */
export const ALLOWED_INFRA_RELATIONS: Record<DFDElementType, InfraAssetRelationType[]> = {
  Process:        ["accesses", "monitors", "depends_on" as any],
  Multiprocess:   ["accesses", "monitors"],
  DataStore:      ["accesses", "depends_on" as any, "is_an"],
  DataFlow:       ["accesses"],
  ExternalEntity: ["accesses", "secures", "damages", "powers", "monitors", "is_an"],
  Interface:      ["accesses", "secures", "monitors", "is_an"],
  TrustBoundary:  [],
};

/**
 * Erlaubte Human Asset Relationen pro DFD-Element-Typ
 */
export const ALLOWED_HUMAN_RELATIONS: Record<DFDElementType, HumanAssetRelationType[]> = {
  Process:        ["affects_safety", "affects_privacy", "identifies", "tracks", "exposes"],
  Multiprocess:   ["affects_safety", "affects_privacy", "identifies", "tracks", "exposes"],
  DataStore:      ["affects_privacy", "identifies", "tracks"],
  DataFlow:       ["affects_privacy", "identifies", "tracks", "exposes"],
  ExternalEntity: ["affects_safety", "affects_privacy", "identifies", "tracks", "exposes", "is_an"],
  Interface:      ["affects_safety", "affects_privacy", "exposes"],
  TrustBoundary:  [],
};

// ==================== LOOKUP HELPER ====================

/**
 * Gibt alle erlaubten Relationstypen für eine Element-Typ + Asset-Gruppe Kombination zurück
 */
export function getAllowedRelations(
  elementType: DFDElementType,
  assetGroup: AssetGroup
): string[] {
  switch (assetGroup) {
    case "data":           return ALLOWED_DATA_RELATIONS[elementType] ?? [];
    case "process":        return ALLOWED_PROCESS_RELATIONS[elementType] ?? [];
    case "system":         return ALLOWED_SYSTEM_RELATIONS[elementType] ?? [];
    case "infrastructure": return ALLOWED_INFRA_RELATIONS[elementType] ?? [];
    case "human":          return ALLOWED_HUMAN_RELATIONS[elementType] ?? [];
  }
}

/**
 * Prüft ob eine Asset-Gruppe überhaupt Relationen für einen Element-Typ hat
 * Bestimmt ob ein Tab in der UI angezeigt wird
 */
export function hasAnyAllowedRelations(
  elementType: DFDElementType,
  assetGroup: AssetGroup
): boolean {
  return getAllowedRelations(elementType, assetGroup).length > 0;
}

/**
 * Gibt den Qualifier-Label-Text zurück
 * Unterstützt sowohl SystemUsesQualifier als auch InfraAccessesQualifier
 */
export function getQualifierLabel(
  qualifier: SystemUsesQualifier | InfraAccessesQualifier,
  language: "en" | "de" = "en"
): string {
  if (qualifier in SYSTEM_USES_QUALIFIER_LABELS) {
    return SYSTEM_USES_QUALIFIER_LABELS[qualifier as SystemUsesQualifier][language];
  }
  if (qualifier in INFRA_ACCESSES_QUALIFIER_LABELS) {
    return INFRA_ACCESSES_QUALIFIER_LABELS[qualifier as InfraAccessesQualifier][language];
  }
  return qualifier;
}

/**
 * Tab-Reihenfolge für die UI
 */
export const ASSET_GROUP_TAB_ORDER: AssetGroup[] = [
  "data",
  "system",
  "process",
  "infrastructure",
  "human",
];
