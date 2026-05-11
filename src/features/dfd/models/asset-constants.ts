// ==================== ASSET CONSTANTS ====================
// UI configuration and allowed-relation matrices for all 8 asset groups.

import type { DFDElementType } from "./dfd-types";
import type {
  AssetGroup,
  SystemUsesQualifier,
  ServiceUsesQualifier,
  InfraAccessesQualifier,
  PhysicalContactQualifier,
  A2ARelationType,
} from "./asset-relation-types";
import {
  DataAssetRelationType,
  FunctionAssetRelationType,
  ProcessAssetRelationType,
  SystemAssetRelationType,
  InfraAssetRelationType,
  PhysicalAssetRelationType,
  ServiceAssetRelationType,
  HumanAssetRelationType,
} from "shared";

// ==================== UI DISPLAY CONFIGURATION ====================

export const ASSET_GROUP_CONFIG: Record<
  AssetGroup,
  { label: string; labelDE: string; color: string; colorLight: string }
> = {
  // ---- Vertical hierarchy ----
  data: {
    label: "Data",
    labelDE: "Daten",
    color: "#1976D2",
    colorLight: "#E3F2FD", // Blue
  },
  function: {
    label: "Function",
    labelDE: "Funktion",
    color: "#00796B",
    colorLight: "#E0F2F1", // Teal
  },
  system: {
    label: "Systems",
    labelDE: "Systeme",
    color: "#7B1FA2",
    colorLight: "#F3E5F5", // Purple
  },
  infrastructure: {
    label: "Infra",
    labelDE: "Infrastruktur",
    color: "#4E342E",
    colorLight: "#EFEBE9", // Brown
  },
  // ---- Orthogonal categories ----
  process: {
    label: "Process",
    labelDE: "Prozesse",
    color: "#E65100",
    colorLight: "#FFF3E0", // Orange
  },
  physical: {
    label: "Physical",
    labelDE: "Physische Assets",
    color: "#F57F17",
    colorLight: "#FFF8E1", // Amber
  },
  service: {
    label: "Service",
    labelDE: "Services",
    color: "#283593",
    colorLight: "#E8EAF6", // Deep Indigo
  },
  human: {
    label: "People",
    labelDE: "Personen",
    color: "#2E7D32",
    colorLight: "#E8F5E9", // Green
  },
};

// ==================== RELATION TYPE LABELS ====================

export const DATA_RELATION_LABELS: Record<
  DataAssetRelationType,
  { en: string; de: string }
> = {
  creates: { en: "Creates", de: "Erzeugt" },
  reads: { en: "Reads", de: "Liest" },
  modifies: { en: "Modifies", de: "Verändert" },
  deletes: { en: "Deletes", de: "Löscht" },
  stores: { en: "Stores", de: "Speichert" },
  transports: { en: "Transports", de: "Transportiert" },
  is_an: { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const FUNCTION_RELATION_LABELS: Record<
  FunctionAssetRelationType,
  { en: string; de: string }
> = {
  executes: { en: "Executes", de: "Führt aus" },
  invokes: { en: "Invokes", de: "Ruft auf" },
  implements: { en: "Implements", de: "Implementiert" },
  monitors: { en: "Monitors", de: "Überwacht" },
  depends_on: { en: "Depends on", de: "Abhängig von" },
  is_an: { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const PROCESS_RELATION_LABELS: Record<ProcessAssetRelationType, { en: string; de: string }> = {
  executes:   { en: "Executes",   de: "Führt aus" },
  invokes:    { en: "Invokes",    de: "Ruft auf" },
  terminates: { en: "Terminates", de: "Beendet" },
  suspends:   { en: "Suspends",   de: "Pausiert" },
  monitors:   { en: "Monitors",   de: "Überwacht" },
  is_an:      { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const SYSTEM_RELATION_LABELS: Record<SystemAssetRelationType, { en: string; de: string }> = {
  controls:   { en: "Controls",   de: "Kontrolliert" },
  configures: { en: "Configures", de: "Konfiguriert" },
  monitors:   { en: "Monitors",   de: "Überwacht" },
  uses:       { en: "Uses",       de: "Nutzt" },
  depends_on: { en: "Depends on", de: "Abhängig von" },
  is_an:      { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const INFRA_RELATION_LABELS: Record<InfraAssetRelationType, { en: string; de: string }> = {
  accesses: { en: "Accesses", de: "Greift zu auf" },
  secures:  { en: "Secures",  de: "Schützt" },
  damages:  { en: "Damages",  de: "Beschädigt" },
  powers:   { en: "Powers",   de: "Versorgt" },
  monitors: { en: "Monitors", de: "Überwacht" },
  is_an:    { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const PHYSICAL_RELATION_LABELS: Record<
  PhysicalAssetRelationType,
  { en: string; de: string }
> = {
  accesses: { en: "Accesses", de: "Greift physisch zu auf" },
  damages: { en: "Damages", de: "Beschädigt" },
  secures: { en: "Secures", de: "Sichert/Schützt" },
  monitors: { en: "Monitors", de: "Überwacht" },
  is_an: { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const SERVICE_RELATION_LABELS: Record<
  ServiceAssetRelationType,
  { en: string; de: string }
> = {
  uses: { en: "Uses", de: "Nutzt" },
  configures: { en: "Configures", de: "Konfiguriert" },
  monitors: { en: "Monitors", de: "Überwacht" },
  depends_on: { en: "Depends on", de: "Abhängig von" },
  is_an: { en: "Is an instance of", de: "Ist eine Instanz von" },
};

export const HUMAN_RELATION_LABELS: Record<HumanAssetRelationType, { en: string; de: string }> = {
  affects_safety:  { en: "Affects safety",  de: "Gefährdet physisch" },
  affects_privacy: { en: "Affects privacy", de: "Beeinträchtigt Privatsphäre" },
  identifies:      { en: "Identifies",      de: "Identifiziert" },
  tracks:          { en: "Tracks",          de: "Verfolgt" },
  exposes:         { en: "Exposes",         de: "Exponiert" },
  is_an:           { en: "Is an instance of", de: "Ist eine Instanz von" },
};

// ==================== QUALIFIER LABELS ====================

export const SYSTEM_USES_QUALIFIER_LABELS: Record<SystemUsesQualifier, { en: string; de: string }> = {
  hardware:       { en: "Hardware access",  de: "Hardware-Zugriff" },
  library:        { en: "Library/SDK",      de: "Bibliothek/SDK" },
  network:        { en: "Network access",   de: "Netzwerkzugriff" },
  local:          { en: "Local access",     de: "Lokaler Zugriff" },
  authentication: { en: "Authentication",   de: "Authentifizierung" },
  authorization:  { en: "Authorization",    de: "Autorisierung" },
  api:            { en: "API",              de: "API" },
  storage:        { en: "Storage",          de: "Speicher" },
  computation:    { en: "Computation",      de: "Berechnung" },
  messaging:      { en: "Messaging",        de: "Messaging" },
  configuration:  { en: "Configuration",    de: "Konfiguration" },
  monitoring:     { en: "Monitoring",       de: "Monitoring" },
  networking:     { en: "Networking",       de: "Netzwerk" },
};

export const SERVICE_USES_QUALIFIER_LABELS: Record<ServiceUsesQualifier, { en: string; de: string }> = {
  api:     { en: "API (REST/SOAP/gRPC)",         de: "API (REST/SOAP/gRPC)" },
  sdk:     { en: "SDK / Library",                de: "SDK / Bibliothek" },
  webhook: { en: "Webhook (event-based)",         de: "Webhook (ereignisbasiert)" },
  managed: { en: "Managed (no API access)",       de: "Managed (kein API-Zugriff)" },
};

export const INFRA_ACCESSES_QUALIFIER_LABELS: Record<InfraAccessesQualifier, { en: string; de: string }> = {
  "on-site":  { en: "On-site (premises/facility)", de: "Vor Ort (Gelände/Anlage)" },
  proximity:  { en: "Proximity (RFID/WiFi range)", de: "Nähe (RFID-/WLAN-Reichweite)" },
  internal:   { en: "Internal (enclosure interior)", de: "Intern (Gehäuse-Inneres)" },
};

export const PHYSICAL_CONTACT_QUALIFIER_LABELS: Record<PhysicalContactQualifier, { en: string; de: string }> = {
  direct:   { en: "Direct contact (hands-on)",   de: "Direkter Kontakt (physisch)" },
  indirect: { en: "Proximity / sensor",           de: "Nähe / Sensor" },
  remote:   { en: "Remote (networked component)", de: "Remote (vernetztes Bauteil)" },
};

// ==================== ALLOWED RELATIONS MATRIX ====================
// Defines which relation types are allowed per element type + asset group.

export const ALLOWED_DATA_RELATIONS: Record<DFDElementType, DataAssetRelationType[]> =
  {
    Process: ["creates", "reads", "modifies", "deletes", "is_an"],
    Multiprocess: ["creates", "reads", "modifies", "deletes", "is_an"],
    DataStore: ["stores", "deletes", "is_an"],
    DataFlow: ["transports"],
    ExternalEntity: ["creates", "reads", "is_an"],
    Interface: ["transports"],
    TrustBoundary: [],
    ChipBoundary: ["reads", "stores", "modifies"],
  };

export const ALLOWED_FUNCTION_RELATIONS: Record<
  DFDElementType,
  FunctionAssetRelationType[]
> = {
  Process: [
    "executes",
    "invokes",
    "implements",
    "monitors",
    "depends_on",
    "is_an",
  ],
  Multiprocess: [
    "executes",
    "invokes",
    "implements",
    "monitors",
    "depends_on",
    "is_an",
  ],
  DataStore: ["depends_on"],
  DataFlow: ["invokes"],
  ExternalEntity: ["invokes", "monitors", "depends_on", "is_an"],
  Interface: ["invokes", "monitors"],
  TrustBoundary: [],
  ChipBoundary: ["implements", "depends_on"],
};

export const ALLOWED_PROCESS_RELATIONS: Record<
  DFDElementType,
  ProcessAssetRelationType[]
> = {
  Process: [
    "executes",
    "invokes",
    "terminates",
    "suspends",
    "monitors",
    "is_an",
  ],
  Multiprocess: [
    "executes",
    "invokes",
    "terminates",
    "suspends",
    "monitors",
    "is_an",
  ],
  DataStore: [],
  DataFlow: ["invokes"],
  ExternalEntity: ["invokes", "terminates", "suspends", "monitors", "is_an"],
  Interface: ["invokes", "monitors"],
  TrustBoundary: [],
  ChipBoundary: [],
};

export const ALLOWED_SYSTEM_RELATIONS: Record<
  DFDElementType,
  SystemAssetRelationType[]
> = {
  Process: [
    "controls",
    "configures",
    "monitors",
    "uses",
    "depends_on",
    "is_an",
  ],
  Multiprocess: [
    "controls",
    "configures",
    "monitors",
    "uses",
    "depends_on",
    "is_an",
  ],
  DataStore: ["depends_on", "is_an"],
  DataFlow: ["uses"],
  ExternalEntity: [
    "controls",
    "configures",
    "monitors",
    "uses",
    "depends_on",
    "is_an",
  ],
  Interface: ["monitors", "uses", "depends_on", "is_an"],
  TrustBoundary: [],
  ChipBoundary: ["is_an", "uses", "depends_on"],
};

export const ALLOWED_INFRA_RELATIONS: Record<
  DFDElementType,
  InfraAssetRelationType[]
> = {
  Process: ["accesses", "monitors", "secures"],
  Multiprocess: ["accesses", "monitors", "secures"],
  DataStore: ["accesses", "is_an"],
  DataFlow: ["accesses"],
  ExternalEntity: [
    "accesses",
    "secures",
    "damages",
    "powers",
    "monitors",
    "is_an",
  ],
  Interface: ["accesses", "secures", "monitors", "is_an"],
  TrustBoundary: [],
  ChipBoundary: [],
};

export const ALLOWED_PHYSICAL_RELATIONS: Record<
  DFDElementType,
  PhysicalAssetRelationType[]
> = {
  Process: ["accesses", "monitors"],
  Multiprocess: ["accesses", "monitors"],
  DataStore: [],
  DataFlow: [],
  // ExternalEntity may use "damages" directly (sabotage exception — see markdown §Physical)
  ExternalEntity: ["accesses", "damages", "secures", "monitors", "is_an"],
  Interface: ["accesses", "monitors"],
  TrustBoundary: [],
  ChipBoundary: [],
};

export const ALLOWED_SERVICE_RELATIONS: Record<
  DFDElementType,
  ServiceAssetRelationType[]
> = {
  Process: ["uses", "configures", "monitors", "depends_on", "is_an"],
  Multiprocess: ["uses", "configures", "monitors", "depends_on", "is_an"],
  DataStore: ["depends_on"],
  DataFlow: ["uses"],
  ExternalEntity: ["uses", "configures", "monitors", "depends_on", "is_an"],
  Interface: ["uses", "monitors", "depends_on"],
  TrustBoundary: [],
  ChipBoundary: [],
};

export const ALLOWED_HUMAN_RELATIONS: Record<
  DFDElementType,
  HumanAssetRelationType[]
> = {
  Process: [
    "affects_safety",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
  ],
  Multiprocess: [
    "affects_safety",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
  ],
  DataStore: ["affects_privacy", "identifies", "tracks"],
  DataFlow: ["affects_privacy", "identifies", "tracks", "exposes"],
  ExternalEntity: [
    "affects_safety",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
    "is_an",
  ],
  Interface: ["affects_safety", "affects_privacy", "exposes"],
  TrustBoundary: [],
  ChipBoundary: [],
};

// ==================== LOOKUP HELPERS ====================

export function getAllowedRelations(
  elementType: DFDElementType,
  assetGroup: AssetGroup
): string[] {
  switch (assetGroup) {
    case "data":
      return ALLOWED_DATA_RELATIONS[elementType] ?? [];
    case "function":
      return ALLOWED_FUNCTION_RELATIONS[elementType] ?? [];
    case "process":
      return ALLOWED_PROCESS_RELATIONS[elementType] ?? [];
    case "system":
      return ALLOWED_SYSTEM_RELATIONS[elementType] ?? [];
    case "infrastructure":
      return ALLOWED_INFRA_RELATIONS[elementType] ?? [];
    case "physical":
      return ALLOWED_PHYSICAL_RELATIONS[elementType] ?? [];
    case "service":
      return ALLOWED_SERVICE_RELATIONS[elementType] ?? [];
    case "human":
      return ALLOWED_HUMAN_RELATIONS[elementType] ?? [];
  }
}

export function hasAnyAllowedRelations(
  elementType: DFDElementType,
  assetGroup: AssetGroup
): boolean {
  return getAllowedRelations(elementType, assetGroup).length > 0;
}

export function getQualifierLabel(
  qualifier:
    | SystemUsesQualifier
    | ServiceUsesQualifier
    | InfraAccessesQualifier
    | PhysicalContactQualifier,
  language: "en" | "de" = "en",
): string {
  if (qualifier in SYSTEM_USES_QUALIFIER_LABELS)
    return SYSTEM_USES_QUALIFIER_LABELS[qualifier as SystemUsesQualifier][
      language
    ];
  if (qualifier in SERVICE_USES_QUALIFIER_LABELS)
    return SERVICE_USES_QUALIFIER_LABELS[qualifier as ServiceUsesQualifier][
      language
    ];
  if (qualifier in INFRA_ACCESSES_QUALIFIER_LABELS)
    return INFRA_ACCESSES_QUALIFIER_LABELS[qualifier as InfraAccessesQualifier][
      language
    ];
  if (qualifier in PHYSICAL_CONTACT_QUALIFIER_LABELS)
    return PHYSICAL_CONTACT_QUALIFIER_LABELS[
      qualifier as PhysicalContactQualifier
    ][language];
  return qualifier;
}

/** Tab order: vertical hierarchy first, then orthogonal categories */
export const ASSET_GROUP_TAB_ORDER: AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
  "process",
  "physical",
  "service",
  "human",
];

// ==================== TRANSITIVE DERIVATION ALLOW-LIST ====================

/**
 * Defines which Element→Asset relation types may be transitively derived
 * via an is_an bridge (Element → is_an → Asset).
 *
 * Only relations that describe a direct content effect on the asset itself
 * are allowed to propagate. Relations describing operation, monitoring,
 * availability, or infrastructure are excluded — they affect the carrier,
 * not the asset content.
 *
 * Example (allowed):
 *   Process → reads → DataStore → is_an → DataAsset
 *   ⇒ Process → reads → DataAsset  [derived]
 *
 * Example (blocked):
 *   Process → monitors → DataStore → is_an → DataAsset
 *   ⇒ NO derivation  (monitors targets the store service, not the data)
 *
 * Used by the derivation engine (Phase 2) to prevent unsound transitive relations.
 * @see taraflow-asset-beziehungen.md §"Graph-Algorithmus"
 */
export const DERIVABLE_RELATIONS: Record<AssetGroup, ReadonlySet<string>> = {
  data:           new Set(["creates", "reads", "modifies", "deletes", "stores"]),
  function:       new Set(["executes", "invokes", "implements", "depends_on"]),
  process:        new Set(["executes", "invokes", "monitors"]),
  system:         new Set(["uses", "depends_on", "configures"]),
  infrastructure: new Set(["accesses", "powers"]),
  physical:       new Set(["accesses", "damages"]),
  service:        new Set(["uses", "depends_on"]),
  human:          new Set(["affects_safety", "affects_privacy", "identifies", "tracks", "exposes"]),
};
// ==================== ASSET-TO-ASSET ALLOWED RELATIONS ====================
// Core Rules matrix: sourceGroup × targetGroup → allowed A2ARelationType[]
//
// Derived from: taraflow-asset-zu-asset-beziehungen.md §3 Core Rules
// [KERN] relations are listed first in each array.
//
// Usage:
//   getAllowedA2ARelations(sourceGroup, targetGroup) → A2ARelationType[]
//
// Note: Empty array = no defined relation for this pair (not modelled in Core Rules)

type A2ARelMatrix = Partial<Record<AssetGroup, A2ARelationType[]>>;

export const ALLOWED_A2A_RELATIONS: Record<AssetGroup, A2ARelMatrix> = {
  data: {
    data:           ["derives_from", "aggregates", "supersedes"],
    process:        ["required_by", "consumed_by", "configures"],
    function:       ["required_by", "configures"],
    system:         ["configures"],
    human:          ["affects_privacy", "exposes"],
  },
  function: {
    function:       ["depends_on", "supersedes", "calls"],
    data:           ["creates", "reads", "modifies", "deletes"],
    process:        ["implemented_by", "triggers"],
    system:         ["implemented_by", "depends_on"],
    human:          ["affects_safety", "operated_by"],
  },
  process: {
    process:        ["triggers", "depends_on", "suspends"],
    function:       ["implements", "invokes"],
    system:         ["runs_on", "depends_on"],
    human:          ["affects_safety", "affects_privacy", "operated_by"],
    infrastructure: ["hosted_on"],
  },
  system: {
    system:         ["depends_on", "integrates"],
    function:       ["implements", "depends_on"],
    infrastructure: ["hosted_on", "powered_by"],
  },
  infrastructure: {
    infrastructure: ["powers", "houses"],
    physical:       ["houses"],
  },
  physical: {
    physical:       ["mechanically_linked", "powered_by"],
    function:       ["enables", "triggers"],
    system:         ["hosts", "controlled_by"],
    infrastructure: ["connected_to", "powered_by", "located_in"],
    human:          ["endangers", "exposes"],
  },
  service: {
    service:        ["depends_on", "delegates_to"],
    function:       ["provides", "depends_on"],
    data:           ["exposes", "consumes"],
    system:         ["integrates_with", "monitors"],
    human:          ["affects_privacy", "endangers"],
    infrastructure: ["hosted_on", "depends_on"],
  },
  human: {
    human:          ["manages", "reports_to"],
    process:        ["responsible_for", "authorized_for"],
    function:       ["authorized_for", "responsible_for"],
    physical:       ["owns", "responsible_for", "accesses"],
  },
};

/**
 * Returns the allowed A2A relation types for a given source → target group pair.
 * Returns empty array if no Core Rules are defined for this combination.
 */
export function getAllowedA2ARelations(
  sourceGroup: AssetGroup,
  targetGroup: AssetGroup,
): A2ARelationType[] {
  return ALLOWED_A2A_RELATIONS[sourceGroup]?.[targetGroup] ?? [];
}