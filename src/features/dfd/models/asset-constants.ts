// ==================== ASSET CONSTANTS ====================
// UI configuration and allowed-relation matrices for all 8 asset groups.

import type { DFDElementType } from "./dfd-types";
import type {
  SystemUsesQualifier,
  ServiceUsesQualifier,
  InfraAccessesQualifier,
  PhysicalContactQualifier,
} from "./asset-relation-types";
import type {
  AssetGroup,
  A2ARelationType,
  DataAssetRelationType,
  FunctionAssetRelationType,
  ProcessAssetRelationType,
  SystemAssetRelationType,
  InfraAssetRelationType,
  PhysicalAssetRelationType,
  ServiceAssetRelationType,
  HumanAssetRelationType,
  EnvironmentAssetRelationType,
} from "shared";

/** Minimal translate signature — satisfied by i18next TFunction and the doc
 *  generator's TranslationFn. Resolve i18n keys without binding a language. */
type TranslateFn = (key: string, defaultValue?: string) => string;

// ==================== RELATION TYPE LABEL KEYS ====================
// Language-free. Each map holds the i18n key for the relation type; the text
// lives under assets.relations.element.<group>.<type> — the same keys resolved
// by getRelationTypeText() in dfd-formatters. Resolve with a translate fn.

export const DATA_RELATION_LABEL_KEYS: Record<DataAssetRelationType, string> = {
  creates: "assets.relations.element.data.creates",
  reads: "assets.relations.element.data.reads",
  modifies: "assets.relations.element.data.modifies",
  deletes: "assets.relations.element.data.deletes",
  stores: "assets.relations.element.data.stores",
  transports: "assets.relations.element.data.transports",
  is_an: "assets.relations.element.data.is_an",
};

export const FUNCTION_RELATION_LABEL_KEYS: Record<
  FunctionAssetRelationType,
  string
> = {
  executes: "assets.relations.element.function.executes",
  invokes: "assets.relations.element.function.invokes",
  implements: "assets.relations.element.function.implements",
  monitors: "assets.relations.element.function.monitors",
  depends_on: "assets.relations.element.function.depends_on",
  is_an: "assets.relations.element.function.is_an",
};

export const PROCESS_RELATION_LABEL_KEYS: Record<
  ProcessAssetRelationType,
  string
> = {
  executes: "assets.relations.element.process.executes",
  invokes: "assets.relations.element.process.invokes",
  terminates: "assets.relations.element.process.terminates",
  suspends: "assets.relations.element.process.suspends",
  monitors: "assets.relations.element.process.monitors",
  is_an: "assets.relations.element.process.is_an",
};

export const SYSTEM_RELATION_LABEL_KEYS: Record<
  SystemAssetRelationType,
  string
> = {
  controls: "assets.relations.element.system.controls",
  configures: "assets.relations.element.system.configures",
  monitors: "assets.relations.element.system.monitors",
  uses: "assets.relations.element.system.uses",
  depends_on: "assets.relations.element.system.depends_on",
  is_an: "assets.relations.element.system.is_an",
};

export const INFRA_RELATION_LABEL_KEYS: Record<InfraAssetRelationType, string> =
  {
    accesses: "assets.relations.element.infrastructure.accesses",
    secures: "assets.relations.element.infrastructure.secures",
    damages: "assets.relations.element.infrastructure.damages",
    powers: "assets.relations.element.infrastructure.powers",
    monitors: "assets.relations.element.infrastructure.monitors",
    is_an: "assets.relations.element.infrastructure.is_an",
  };

export const PHYSICAL_RELATION_LABEL_KEYS: Record<
  PhysicalAssetRelationType,
  string
> = {
  accesses: "assets.relations.element.physical.accesses",
  damages: "assets.relations.element.physical.damages",
  secures: "assets.relations.element.physical.secures",
  monitors: "assets.relations.element.physical.monitors",
  is_an: "assets.relations.element.physical.is_an",
};

export const SERVICE_RELATION_LABEL_KEYS: Record<
  ServiceAssetRelationType,
  string
> = {
  uses: "assets.relations.element.service.uses",
  configures: "assets.relations.element.service.configures",
  monitors: "assets.relations.element.service.monitors",
  depends_on: "assets.relations.element.service.depends_on",
  is_an: "assets.relations.element.service.is_an",
};

export const HUMAN_RELATION_LABEL_KEYS: Record<HumanAssetRelationType, string> =
  {
    endangers: "assets.relations.element.human.endangers",
    affects_safety: "assets.relations.element.human.affects_safety",
    affects_privacy: "assets.relations.element.human.affects_privacy",
    identifies: "assets.relations.element.human.identifies",
    tracks: "assets.relations.element.human.tracks",
    exposes: "assets.relations.element.human.exposes",
    is_an: "assets.relations.element.human.is_an",
  };

export const ENVIRONMENT_RELATION_LABEL_KEYS: Record<
  EnvironmentAssetRelationType,
  string
> = {
  endangers: "assets.relations.element.environment.endangers",
  monitors: "assets.relations.element.environment.monitors",
  contaminates: "assets.relations.element.environment.contaminates",
  is_an: "assets.relations.element.environment.is_an",
};

// ==================== QUALIFIER LABEL KEYS ====================

export const SYSTEM_USES_QUALIFIER_LABEL_KEYS: Record<
  SystemUsesQualifier,
  string
> = {
  hardware: "assets.relations.qualifiers.system.hardware",
  library: "assets.relations.qualifiers.system.library",
  network: "assets.relations.qualifiers.system.network",
  local: "assets.relations.qualifiers.system.local",
  authentication: "assets.relations.qualifiers.system.authentication",
  authorization: "assets.relations.qualifiers.system.authorization",
  api: "assets.relations.qualifiers.system.api",
  storage: "assets.relations.qualifiers.system.storage",
  computation: "assets.relations.qualifiers.system.computation",
  messaging: "assets.relations.qualifiers.system.messaging",
  configuration: "assets.relations.qualifiers.system.configuration",
  monitoring: "assets.relations.qualifiers.system.monitoring",
  networking: "assets.relations.qualifiers.system.networking",
};

export const SERVICE_USES_QUALIFIER_LABEL_KEYS: Record<
  ServiceUsesQualifier,
  string
> = {
  api: "assets.relations.qualifiers.service.api",
  sdk: "assets.relations.qualifiers.service.sdk",
  webhook: "assets.relations.qualifiers.service.webhook",
  managed: "assets.relations.qualifiers.service.managed",
};

export const INFRA_ACCESSES_QUALIFIER_LABEL_KEYS: Record<
  InfraAccessesQualifier,
  string
> = {
  "on-site": "assets.relations.qualifiers.infrastructure.on-site",
  proximity: "assets.relations.qualifiers.infrastructure.proximity",
  internal: "assets.relations.qualifiers.infrastructure.internal",
};

export const PHYSICAL_CONTACT_QUALIFIER_LABEL_KEYS: Record<
  PhysicalContactQualifier,
  string
> = {
  direct: "assets.relations.qualifiers.physical.direct",
  indirect: "assets.relations.qualifiers.physical.indirect",
  remote: "assets.relations.qualifiers.physical.remote",
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
    PhysicalBoundary: [],
    Sensor: ["creates"],
    Actuator: ["reads"],
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
  PhysicalBoundary: [],
  Sensor: ["implements", "monitors"],
  Actuator: ["implements"],
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
  PhysicalBoundary: [],
  Sensor: [],
  Actuator: [],
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
  PhysicalBoundary: ["is_an", "depends_on"],
  Sensor: ["is_an", "depends_on"],
  Actuator: ["is_an", "depends_on"],
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
  PhysicalBoundary: ["is_an", "secures", "powers"],
  Sensor: ["monitors"],
  Actuator: ["damages"],
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
  PhysicalBoundary: ["is_an", "secures", "accesses", "damages"],
  Sensor: ["is_an", "accesses", "monitors"],
  Actuator: ["is_an", "accesses", "damages", "secures"],
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
  PhysicalBoundary: [],
  Sensor: [],
  Actuator: [],
};

export const ALLOWED_HUMAN_RELATIONS: Record<
  DFDElementType,
  HumanAssetRelationType[]
> = {
  Process: ["endangers", "affects_privacy", "identifies", "tracks", "exposes"],
  Multiprocess: [
    "endangers",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
  ],
  DataStore: ["affects_privacy", "identifies", "tracks"],
  DataFlow: ["affects_privacy", "identifies", "tracks", "exposes"],
  ExternalEntity: [
    "endangers",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
    "is_an",
  ],
  Interface: ["endangers", "affects_privacy", "exposes"],
  TrustBoundary: [],
  ChipBoundary: [],
  PhysicalBoundary: [],
  // Camera-as-Sensor etc.: privacy only — a sensor observes, it does not endanger.
  Sensor: ["affects_privacy", "identifies", "tracks", "exposes"],
  // Actuator drives the hazard (bowtie top event) — canonical safety relation.
  Actuator: ["endangers"],
};

// Environment relations are exposed ONLY for transducers (Sensor/Actuator) — the
// deliberate exception to "environment is a hazard protection target". For all
// other element types environment stays a Schutzziel reached via the Hazard Item
// chain (see taraflow-asset-beziehungen.md §Transducer-Ausnahme).
export const ALLOWED_ENVIRONMENT_RELATIONS: Record<
  DFDElementType,
  EnvironmentAssetRelationType[]
> = {
  Process: [],
  Multiprocess: [],
  DataStore: [],
  DataFlow: [],
  ExternalEntity: [],
  Interface: [],
  TrustBoundary: [],
  ChipBoundary: [],
  PhysicalBoundary: [],
  Sensor: ["monitors"],
  Actuator: ["endangers", "contaminates"],
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
    case "environment":
      // Acted on directly only by transducers; all other types reach Environment
      // as a Schutzziel via the Hazard Item chain (see ALLOWED_ENVIRONMENT_RELATIONS).
      return ALLOWED_ENVIRONMENT_RELATIONS[elementType] ?? [];
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
  t: TranslateFn,
): string {
  // "api" exists in both system and service qualifier maps — system wins first,
  // preserving the previous lookup order.
  const key =
    SYSTEM_USES_QUALIFIER_LABEL_KEYS[qualifier as SystemUsesQualifier] ??
    SERVICE_USES_QUALIFIER_LABEL_KEYS[qualifier as ServiceUsesQualifier] ??
    INFRA_ACCESSES_QUALIFIER_LABEL_KEYS[qualifier as InfraAccessesQualifier] ??
    PHYSICAL_CONTACT_QUALIFIER_LABEL_KEYS[
      qualifier as PhysicalContactQualifier
    ];
  return key ? t(key, qualifier) : qualifier;
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
  "environment",
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
  data: new Set(["creates", "reads", "modifies", "deletes", "stores"]),
  function: new Set(["executes", "invokes", "implements", "depends_on"]),
  process: new Set(["executes", "invokes", "monitors"]),
  system: new Set(["uses", "depends_on", "configures"]),
  infrastructure: new Set(["accesses", "powers"]),
  physical: new Set(["accesses", "damages"]),
  service: new Set(["uses", "depends_on"]),
  human: new Set([
    "endangers",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
  ]),
  environment: new Set(["endangers", "monitors"]),
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
    data: ["derives_from", "aggregates", "supersedes"],
    process: ["required_by", "consumed_by", "configures"],
    function: ["required_by", "configures"],
    system: ["configures"],
    human: ["affects_privacy", "exposes"],
  },
  function: {
    function: ["depends_on", "supersedes", "calls"],
    data: ["creates", "reads", "modifies", "deletes"],
    process: ["implemented_by", "triggers"],
    system: ["implemented_by", "depends_on"],
    human: ["endangers", "operated_by"],
  },
  process: {
    process: ["triggers", "depends_on", "suspends"],
    function: ["implements", "invokes"],
    system: ["runs_on", "depends_on"],
    human: ["endangers", "affects_privacy", "operated_by"],
    infrastructure: ["hosted_on"],
    environment: ["endangers", "contaminates"],
  },
  system: {
    system: ["depends_on", "integrates"],
    function: ["implements", "depends_on"],
    infrastructure: ["hosted_on", "powered_by"],
  },
  infrastructure: {
    infrastructure: ["powers", "houses"],
    physical: ["houses"],
    environment: ["endangers"],
  },
  physical: {
    physical: ["mechanically_linked", "powered_by"],
    function: ["enables", "triggers"],
    system: ["hosts", "controlled_by"],
    infrastructure: ["connected_to", "powered_by", "located_in"],
    human: ["endangers", "exposes"],
    environment: ["endangers"],
  },
  service: {
    service: ["depends_on", "delegates_to"],
    function: ["provides", "depends_on"],
    data: ["exposes", "consumes"],
    system: ["integrates_with", "monitors"],
    human: ["affects_privacy", "endangers"],
    environment: ["endangers"],
    infrastructure: ["hosted_on", "depends_on"],
  },
  human: {
    human: ["manages", "reports_to"],
    process: ["responsible_for", "authorized_for"],
    function: ["authorized_for", "responsible_for"],
    physical: ["owns", "responsible_for", "accesses"],
  },
  // Environment is a protection target only — no outgoing A2A relations.
  environment: {},
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