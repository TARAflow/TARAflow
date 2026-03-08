// ==================== ASSET CONSTANTS ====================
// Configuration of allowed asset relations per DFD element type
//
// Replaces ALLOWED_ASSET_RELATIONS from dfd-constants.ts
// Asset-centric view instead of element-centric view

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

// ==================== UI DISPLAY CONFIGURATION ====================

/**
 * Display configuration per asset group
 * For the tab bar [Data] [Systems] [Process] [Infra] [People]
 */
export const ASSET_GROUP_CONFIG: Record<
  AssetGroup,
  {
    label: string;
    labelDE: string;
    color: string;       // Hex colour for DrawIO label and UI badge
    colorLight: string;  // Light background for chips
  }
> = {
  data: {
    label: "Data",
    labelDE: "Daten",
    color: "#1976D2",      // Blue
    colorLight: "#E3F2FD",
  },
  system: {
    label: "Systems",
    labelDE: "Systeme",
    color: "#7B1FA2",      // Purple
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
    color: "#4E342E",      // Brown
    colorLight: "#EFEBE9",
  },
  human: {
    label: "People",
    labelDE: "Personen",
    color: "#2E7D32",      // Green
    colorLight: "#E8F5E9",
  },
};

// ==================== RELATION TYPE LABELS ====================

/**
 * Display labels for Data Asset relation types
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
 * Display labels for Process Asset relation types
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
 * Display labels for System Asset relation types
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
 * Display labels for System Uses qualifiers
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
 * Display labels for Infrastructure Accesses qualifiers
 */
export const INFRA_ACCESSES_QUALIFIER_LABELS: Record<InfraAccessesQualifier, { en: string; de: string }> = {
  local:    { en: "Local (on-site)",  de: "Lokal (vor Ort)" },
  internal: { en: "Internal (plant)", de: "Intern (Anlage)" },
  remote:   { en: "Remote (network)", de: "Remote (Netzwerk)" },
};

/**
 * Display labels for Infrastructure Asset relation types
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
 * Display labels for Human Asset relation types
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
// Defines which relation types are allowed per element type + asset group
// is_an is allowed for most combinations (where semantically meaningful)

/**
 * Allowed Data Asset relations per DFD element type
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
 * Allowed Process Asset relations per DFD element type
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
 * Allowed System Asset relations per DFD element type
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
 * Allowed Infrastructure Asset relations per DFD element type
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
 * Allowed Human Asset relations per DFD element type
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

// ==================== LOOKUP HELPERS ====================

/**
 * Returns all allowed relation types for an element type + asset group combination
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
 * Returns true if an asset group has any allowed relations for an element type
 * Determines whether a tab is shown in the UI
 */
export function hasAnyAllowedRelations(
  elementType: DFDElementType,
  assetGroup: AssetGroup
): boolean {
  return getAllowedRelations(elementType, assetGroup).length > 0;
}

/**
 * Returns the display label for a qualifier
 * Supports both SystemUsesQualifier and InfraAccessesQualifier
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
 * Tab order for the UI
 */
export const ASSET_GROUP_TAB_ORDER: AssetGroup[] = [
  "data",
  "system",
  "process",
  "infrastructure",
  "human",
];
