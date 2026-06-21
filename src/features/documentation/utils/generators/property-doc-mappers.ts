// ==================== PROPERTY DOCUMENTATION MAPPERS ====================
// Helper functions to map DFD element properties to documentation fields
// Location: features/documentation/utils/generators/property-doc-mappers.ts

import type {
  DFDElement,
  DFDConnection,
  SecurityLevel,
  TrustLevel,
  AssetRelation,
} from "../../../dfd/models/dfd-types";
import type {
  DFDAsset,
  ElementRelation,
} from "../../../dfd/models/dfd-asset-types";
import type {
  ProcessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
} from "../../../dfd/models/element-properties";
import type { DocLanguage } from "../../models/doc-types";
// Configured i18next singleton — adjust path/alias to your project.
import {i18n} from "i18n"

// ==================== TYPES ====================

export interface PropertyGroup {
  groupName: string;
  properties: PropertyEntry[];
}

export interface PropertyEntry {
  label: string;
  value: string;
}

// ==================== LABEL TRANSLATIONS ====================

const PROPERTY_LABELS: Record<string, { en: string; de: string }> = {
  // Basic
  description: { en: "Description", de: "Beschreibung" },
  owner: { en: "Owner", de: "Verantwortlicher" },
  notes: { en: "Notes", de: "Hinweise" },

  // Process Properties
  runsAs: { en: "Runs As", de: "Läuft als" },
  privilegeLevel: { en: "Privilege Level", de: "Privilegienstufe" },
  authenticationRequired: {
    en: "Authentication Required",
    de: "Authentifizierung erforderlich",
  },
  authorizationModel: { en: "Authorization Model", de: "Autorisierungsmodell" },
  inputValidation: { en: "Input Validation", de: "Eingabevalidierung" },
  errorHandling: { en: "Error Handling", de: "Fehlerbehandlung" },
  securityControls: { en: "Security Controls", de: "Sicherheitskontrollen" },
  exposedToInternet: {
    en: "Exposed to Internet",
    de: "Im Internet erreichbar",
  },
  technology: { en: "Technology", de: "Technologie" },

  // External Entity Properties
  entityType: { en: "Entity Type", de: "Entitätstyp" },
  trustLevel: { en: "Trust Level", de: "Vertrauensstufe" },
  authenticationMethod: {
    en: "Authentication Method",
    de: "Authentifizierungsmethode",
  },
  authorizationScope: {
    en: "Authorization Scope",
    de: "Autorisierungsbereich",
  },
  ownership: { en: "Ownership", de: "Eigentümerschaft" },
  threatActor: { en: "Threat Actor", de: "Bedrohungsakteur" },
  contractExists: { en: "Contract Exists", de: "Vertrag vorhanden" },
  rateLimited: { en: "Rate Limited", de: "Rate Limiting" },

  // Data Store Properties
  storedDataTypes: { en: "Stored Data Types", de: "Gespeicherte Datentypen" },
  dataClassification: { en: "Data Classification", de: "Datenklassifizierung" },
  encryptionAtRest: {
    en: "Encryption at Rest",
    de: "Verschlüsselung im Ruhezustand",
  },
  accessControl: { en: "Access Control", de: "Zugriffskontrolle" },
  integrityProtection: { en: "Integrity Protection", de: "Integritätsschutz" },
  backupEnabled: { en: "Backup Enabled", de: "Backup aktiviert" },
  deletionPolicy: { en: "Deletion Policy", de: "Löschrichtlinie" },
  multiTenant: { en: "Multi-Tenant", de: "Mandantenfähig" },
  accessModel: { en: "Access Model", de: "Zugriffsmodell" },
  accessModelRationale: {
    en: "Access Model Rationale",
    de: "Begründung Zugriffsmodell",
  },

  // Data Flow Properties
  dataTypes: { en: "Data Types", de: "Datentypen" },
  protocol: { en: "Protocol", de: "Protokoll" },
  direction: { en: "Direction", de: "Richtung" },
  frequency: { en: "Frequency", de: "Häufigkeit" },
  volume: { en: "Volume", de: "Volumen" },
  encryptionInTransit: {
    en: "Encryption in Transit",
    de: "Verschlüsselung bei Übertragung",
  },
  endpointAuthentication: {
    en: "Endpoint Authentication",
    de: "Endpunkt-Authentifizierung",
  },

  // Interface Properties
  type: { en: "Interface Type", de: "Schnittstellentyp" },
  connectionSpeed: { en: "Connection Speed", de: "Verbindungsgeschwindigkeit" },
  isShieldedCable: { en: "Shielded Cable", de: "Abgeschirmtes Kabel" },
  location: { en: "Location", de: "Standort" },

  // Trust Boundary Properties
  boundaryId: { en: "Boundary ID", de: "Grenz-ID" },
  boundaryType: { en: "Boundary Type", de: "Grenztyp" },
  securityAssumptions: {
    en: "Security Assumptions",
    de: "Sicherheitsannahmen",
  },
  boundaryControls: { en: "Boundary Controls", de: "Grenzkontrollen" },
  monitoringEnabled: { en: "Monitoring Enabled", de: "Überwachung aktiviert" },
  complianceRelevance: {
    en: "Compliance Relevance",
    de: "Compliance-Relevanz",
  },

  // Asset Relations
  linkedAssets: { en: "Linked Assets", de: "Verknüpfte Assets" },
};

const GROUP_NAMES: Record<string, { en: string; de: string }> = {
  basic: { en: "Context", de: "Kontext" },
  security: { en: "Security Controls", de: "Security Controls" },
  technical: { en: "Technical Properties", de: "Technische Eigenschaften" },
  assetRelations: { en: "Asset Relations", de: "Asset-Beziehungen" },
  additional: { en: "Meta", de: "Meta" },
};

const RELATION_TYPE_LABELS: Record<string, { en: string; de: string }> = {
  stores: { en: "stores", de: "speichert" },
  read: { en: "read", de: "liest" },
  modify: { en: "modify", de: "modifiziert" },
  creates: { en: "creates", de: "erstellt" },
  deletes: { en: "deletes", de: "löscht" },
  transports: { en: "transports", de: "transportiert" },
};

// ==================== HELPER FUNCTIONS ====================

function getPropertyLabel(key: string, lang: DocLanguage): string {
  return PROPERTY_LABELS[key]?.[lang] ?? key;
}

function getGroupName(groupKey: string, lang: DocLanguage): string {
  return GROUP_NAMES[groupKey]?.[lang] ?? groupKey;
}

export function getRelationTypeLabel(relationType: string, lang: DocLanguage): string {
  return RELATION_TYPE_LABELS[relationType]?.[lang] ?? relationType;
}

/** snake_case / camelCase → "Title Case" — fallback when an i18n key is missing. */
function humanizeValue(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Format a property value, resolving enum values via the DFD i18n namespace:
 *   tabs.dfd.element_description.{fieldPath}.options.{value}
 * fieldPath = "<elementType>.fields.<field>", e.g. "process.fields.privilegeLevel".
 * Uses getFixedT(lang) so the DOCUMENT language wins, not the UI language.
 * Free-text values (custom controls, names, notes) are left untouched.
 */
function formatValue(
  value: unknown,
  lang: DocLanguage,
  fieldPath?: string,
): string {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "not_specified"
  )
    return "N/A";

  // Skip nested objects (e.g. sessionControl, internalComponents).
  if (typeof value === "object" && !Array.isArray(value)) return "N/A";

  const t = i18n.getFixedT(lang, "dfd");
  const toLabel = (raw: string): string => {
    const token = raw.trim();
    if (token === "not_specified") return "N/A";
    // Only resolve enum-like tokens; leave free text alone.
    if (!fieldPath || !/^[a-z0-9]+(_[a-z0-9]+)*$/i.test(token)) return raw;
    return t(`tabs.dfd.element_description.${fieldPath}.options.${token}`, {
      defaultValue: humanizeValue(token),
    });
  };

  if (typeof value === "boolean") return toLabel(value ? "yes" : "no");
  if (Array.isArray(value))
    return value.length > 0
      ? value.map((v) => toLabel(String(v))).join(", ")
      : "N/A";
  return toLabel(String(value));
}

/** Builds a { label, value } entry; value resolved via i18n options for the element type. */
function makePropFactory(elementType: string, lang: DocLanguage) {
  const t = i18n.getFixedT(lang, "dfd");
  return (field: string, raw: unknown) => ({
    label: t(
      `tabs.dfd.element_description.${elementType}.fields.${field}.label`,
      { defaultValue: getPropertyLabel(field, lang) },
    ),
    value: formatValue(raw, lang, `${elementType}.fields.${field}`),
  });
}

// ==================== GROUPED PROPERTY EXTRACTION ====================

/**
 * Get all properties for an element grouped by category
 */
export function getElementPropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = (element.properties ?? {}) as Record<string, unknown>;
  const read = (field: string): unknown =>
    field === "description" ? element.description : props[field];
  return buildGroupsFromLayout(element.type, lang, read);
}

export function getConnectionPropertiesGrouped(
  connection: DFDConnection,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = (connection.properties ?? {}) as Record<string, unknown>;
  const read = (field: string): unknown =>
    field === "description"
      ? (connection as { description?: string }).description
      : props[field];
  return buildGroupsFromLayout("DataFlow", lang, read);
}

// ==================== FIELD LAYOUT (mirrors the editor forms) ====================
// Section -> field assignment taken 1:1 from the *-description-form.tsx files.
// context -> Context column; security/physical/safety -> Security Controls column;
// documentation -> Meta block. Keep in sync with the forms.

interface FieldLayout {
  segment: string; // i18n: tabs.dfd.element_description.<segment>.fields.*
  context: string[];
  security: string[];
  meta: string[];
}

const ELEMENT_FIELD_LAYOUT: Record<string, FieldLayout> = {
  Process: {
    segment: "process",
    context: ["technology", "processSemantic", "runsAs", "privilegeLevel"],
    security: [
      "authenticationRequired",
      "authorizationModel",
      "inputValidation",
      "errorHandling",
      "malwareProtection",
      "accountManagement",
      "authenticatorStorage",
      "nonRepudiation",
      "failSafeOutputState",
      "exposedToInternet",
    ],
    meta: ["owner", "notes", "description"],
  },
  Multiprocess: {
    segment: "multiprocess",
    context: [
      "systemClass",
      "operatingSystem",
      "certificationLevel",
      "updateMechanism",
      "exposedToInternet",
      "remoteAccessEnabled",
      "airGapped",
      "multiTenant",
    ],
    security: [
      "boundaryAuthentication",
      "authorizationModel",
      "safetyRelevant",
      "safetyRationale",
      "malwareProtection",
      "accountManagement",
      "authenticatorStorage",
      "backupMechanism",
      "nonRepudiation",
    ],
    meta: [
      "internalComponents",
      "securitySummary",
      "owner",
      "notes",
      "description",
    ],
  },
  ExternalEntity: {
    segment: "external_entity",
    context: ["entityType", "trustLevel", "ownership"],
    security: [
      "threatActor",
      "authenticationMethod",
      "rateLimited",
      "contractExists",
      "authorizationScope",
    ],
    meta: ["owner", "notes", "description"],
  },
  DataStore: {
    segment: "datastore",
    context: [
      "technology",
      "accessModel",
      "accessModelRationale",
      "dataClassification",
      "storedDataTypes",
    ],
    security: [
      "encryptionAtRest",
      "accessControlMechanism",
      "accessControl",
      "integrityProtection",
      "multiTenant",
      "backupEnabled",
      "containsSafetyRelevantData",
      "safetyRationale",
    ],
    meta: [
      "deletionMechanism",
      "deletionPolicy",
      "owner",
      "notes",
      "description",
    ],
  },
  Interface: {
    segment: "interface",
    context: ["type", "location", "operationalState", "connectorType"],
    security: [
      "physicalAccessProtection",
      "signalProtection",
      "logicalAccessControl",
      "serviceAccessPolicy",
      "debugProtection",
      "abuseProtection",
      "monitoringControl",
      "safetyRelevant",
      "safetyRationale",
    ],
    meta: ["notes", "description"],
  },
  TrustBoundary: {
    segment: "trustboundary",
    context: ["boundaryType"],
    security: [
      "boundaryControlTypes",
      "customBoundaryControls",
      "monitoringEnabled",
      "defaultDenyPolicy",
      "securityAssumptions",
    ],
    meta: ["complianceRelevance", "owner", "notes", "description"],
  },
  PhysicalBoundary: {
    segment: "physicalboundary",
    context: [
      "boundaryType",
      "physicalExposureLevel",
      "physicalMobility",
      "accessibility",
    ],
    security: [
      "physicalAccessControl",
      "tamperProtection",
      "monitoringType",
      "requiresToolAccess",
      "debugInterfaceAccessible",
      "removableMediaAccessible",
      "safetyRelevant",
      "safetyRationale",
    ],
    meta: ["owner", "notes", "description"],
  },
  DataFlow: {
    segment: "dataflow",
    context: [
      "protocol",
      "direction",
      "messageType",
      "dataClassification",
      "dataTypeNotes",
      "frequency",
      "location",
      "locationRationale",
      "redundancy",
    ],
    security: [
      "encryptionInTransit",
      "endpointAuthentication",
      "integrityProtection",
      "physicalPathProtection",
      "safetyFunction",
      "safetyRationale",
      "excludeFromThreatGen",
      "excludeFromThreatGenRationale",
    ],
    meta: ["notes", "description"],
  },
};

function buildGroupsFromLayout(
  elementType: string,
  lang: DocLanguage,
  read: (field: string) => unknown,
): PropertyGroup[] {
  const layout = ELEMENT_FIELD_LAYOUT[elementType];
  if (!layout) return [];
  const prop = makePropFactory(layout.segment, lang);
  const grp = (key: string, fields: string[]): PropertyGroup => ({
    groupName: getGroupName(key, lang),
    properties: fields.map((f) => prop(f, read(f))),
  });
  // Order matters: the generator overrides bucket positionally
  // (first = Context, middle = Security Controls, last = Meta).
  return [
    grp("basic", layout.context),
    grp("security", layout.security),
    grp("additional", layout.meta),
  ];
}

// ==================== ASSET RELATION FORMATTING ====================

export function formatElementAssetRelations(
  element: DFDElement,
  lang: DocLanguage,
): string {
  if (!element.assetRelations || element.assetRelations.length === 0) {
    return "N/A";
  }

  return element.assetRelations
    .map((rel) => {
      const relationLabel = rel.relationType
        ? getRelationTypeLabel(rel.relationType, lang)
        : "";
      return `${rel.assetId} (${relationLabel})`;
    })
    .join("; ");
}

/**
 * Format asset relations for a connection
 */
export function formatConnectionAssetRelations(
  connection: DFDConnection,
  lang: DocLanguage,
): string {
  if (!connection.assetRelations || connection.assetRelations.length === 0) {
    return "N/A";
  }

  return connection.assetRelations
    .map((rel) => {
      const relationLabel = rel.relationType
        ? getRelationTypeLabel(rel.relationType, lang)
        : "";
      return `${rel.assetId} (${relationLabel})`;
    })
    .join("; ");
}

/**
 * Get asset IDs as comma-separated list for overview table
 */

export function getAssetIdList(element: DFDElement | DFDConnection): string {
  const relations = element.assetRelations;
  if (!relations || relations.length === 0) return "N/A";
  
  return relations.map((rel) => rel.assetId).join(", ");
}

// ==================== LEGACY COMPATIBILITY (for base-generator) ====================

/**
 * Extract security level from element properties
 * Maps dataClassification (DataStore) to SecurityLevel
 */
export function getElementSecurityLevel(
  element: DFDElement,
): SecurityLevel | undefined {
  switch (element.type) {
    case "DataStore": {
      const props = element.properties as DataStoreProperties;
      // Map dataClassification to SecurityLevel
      const classification = props.dataClassification;
      if (!classification) return undefined;
      
      // Direct mapping where possible
      if (classification === "public" || 
          classification === "internal" || 
          classification === "confidential" || 
          classification === "secret") {
        return classification as SecurityLevel;
      }
      // Map "restricted" to "confidential"
      if (classification === "restricted") {
        return "confidential";
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Extract trust level from element properties
 * Only ExternalEntity has trustLevel
 */
export function getElementTrustLevel(
  element: DFDElement,
): TrustLevel | undefined {
  if (element.type === "ExternalEntity") {
    const props = element.properties as ExternalEntityProperties;
    // Map string trust level to TrustLevel enum
    const trust = props.trustLevel;
    if (trust === "low") return "untrusted";
    if (trust === "medium") return "unknown";
    if (trust === "high") return "trusted";
  }
  return undefined;
}

/**
 * Check if authentication is required for element
 * Maps various auth-related properties to boolean
 */
export function isElementAuthenticationRequired(
  element: DFDElement,
): boolean {
  switch (element.type) {
    case "Process": {
      const props = element.properties as ProcessProperties;
      // authenticationRequired can be "yes", "no", "optional", or specific methods
      return (
        props.authenticationRequired !== undefined &&
        props.authenticationRequired !== "no"
      );
    }
    case "ExternalEntity": {
      const props = element.properties as ExternalEntityProperties;
      // Check if authentication method is set and not "none"
      return (
        props.authenticationMethod !== undefined &&
        props.authenticationMethod !== "none"
      );
    }
    case "DataStore": {
      const props = element.properties as DataStoreProperties;
      // Check if access control is defined
      return (
        props.accessControl !== undefined && props.accessControl.trim() !== ""
      );
    }
    case "Interface": {
      const props = element.properties as InterfaceProperties;
      // logicalAccessControl replaces the former accessControl field
      const lac = props.implementedControls?.logicalAccessControl;
      return lac !== undefined && lac !== "none";
    }
    default:
      return false;
  }
}

/**
 * Check if encryption is required/enabled for element
 * Maps encryption-related properties to boolean
 */
export function isElementEncryptionRequired(
  element: DFDElement,
): boolean {
  switch (element.type) {
    case "DataStore": {
      const props = element.properties as DataStoreProperties;
      // Check if encryption at rest is enabled
      return props.encryptionAtRest !== undefined && 
             props.encryptionAtRest !== "none";
    }
    case "Process": {
      const props = element.properties as ProcessProperties;
      // Check if exposedToInternet requires encryption
      // Or check securityControls for encryption mentions
      if (props.exposedToInternet) return true;
      if (props.securityControls?.toLowerCase().includes("encrypt")) return true;
      return false;
    }
    default:
      return false;
  }
}

/**
 * Get security-related notes for element
 * Aggregates various security-related text fields
 */
export function getElementSecurityNotes(
  element: DFDElement,
): string | undefined {
  const parts: string[] = [];

  switch (element.type) {
    case "Process": {
      const props = element.properties as ProcessProperties;
      if (props.securityControls) parts.push(props.securityControls);
      if (props.notes) parts.push(props.notes);
      break;
    }
    case "ExternalEntity": {
      const props = element.properties as ExternalEntityProperties;
      if (props.notes) parts.push(props.notes);
      break;
    }
    case "DataStore": {
      const props = element.properties as DataStoreProperties;
      if (props.accessControl) parts.push(`Access Control: ${props.accessControl}`);
      if (props.notes) parts.push(props.notes);
      break;
    }
    case "Interface": {
      const props = element.properties as InterfaceProperties;
      if (props.notes) parts.push(props.notes);
      break;
    }
    case "TrustBoundary": {
      const props = element.properties as TrustBoundaryProperties;
      if (props.boundaryControls) parts.push(props.boundaryControls);
      if (props.securityAssumptions) parts.push(props.securityAssumptions);
      if (props.notes) parts.push(props.notes);
      break;
    }
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

// ==================== CONNECTION PROPERTY MAPPERS ====================

/**
 * Extract security level from connection properties
 * DataFlow doesn't have securityLevel, so we return undefined
 */
export function getConnectionSecurityLevel(
  connection: DFDConnection,
): SecurityLevel | undefined {
  // DataFlowProperties doesn't have securityLevel
  // Could potentially be derived from protocol or encryption, but not directly available
  return undefined;
}

/**
 * Check if authentication is required for connection
 * Maps endpointAuthentication to boolean
 */
export function isConnectionAuthenticationRequired(
  connection: DFDConnection,
): boolean {
  const props = connection.properties as DataFlowProperties | undefined;
  if (!props) return false;
  
  return props.endpointAuthentication !== undefined && 
         props.endpointAuthentication !== "none";
}

/**
 * Check if encryption is required for connection
 * Maps encryptionInTransit to boolean
 */
export function isConnectionEncryptionRequired(
  connection: DFDConnection,
): boolean {
  const props = connection.properties as DataFlowProperties | undefined;
  if (!props) return false;
  
  return props.encryptionInTransit !== undefined && 
         props.encryptionInTransit !== "none";
}

/**
 * Get security-related notes for connection
 * Aggregates security-related text fields
 */
export function getConnectionSecurityNotes(
  connection: DFDConnection,
): string | undefined {
  const props = connection.properties as DataFlowProperties | undefined;
  if (!props) return undefined;

  const parts: string[] = [];
  
  if (props.protocol) parts.push(`Protocol: ${props.protocol}`);
  if (props.encryptionInTransit && props.encryptionInTransit !== "none") {
    parts.push(`Encryption: ${props.encryptionInTransit}`);
  }
  if (props.endpointAuthentication && props.endpointAuthentication !== "none") {
    parts.push(`Auth: ${props.endpointAuthentication}`);
  }
  if (props.integrityProtection) {
    parts.push("Integrity protection enabled");
  }
  if (props.notes) parts.push(props.notes);

  return parts.length > 0 ? parts.join("; ") : undefined;
}