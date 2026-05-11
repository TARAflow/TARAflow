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
  authenticationRequired: { en: "Authentication Required", de: "Authentifizierung erforderlich" },
  authorizationModel: { en: "Authorization Model", de: "Autorisierungsmodell" },
  inputValidation: { en: "Input Validation", de: "Eingabevalidierung" },
  errorHandling: { en: "Error Handling", de: "Fehlerbehandlung" },
  securityControls: { en: "Security Controls", de: "Sicherheitskontrollen" },
  exposedToInternet: { en: "Exposed to Internet", de: "Im Internet erreichbar" },
  technology: { en: "Technology", de: "Technologie" },
  
  // External Entity Properties
  entityType: { en: "Entity Type", de: "Entitätstyp" },
  trustLevel: { en: "Trust Level", de: "Vertrauensstufe" },
  authenticationMethod: { en: "Authentication Method", de: "Authentifizierungsmethode" },
  authorizationScope: { en: "Authorization Scope", de: "Autorisierungsbereich" },
  ownership: { en: "Ownership", de: "Eigentümerschaft" },
  threatActor: { en: "Threat Actor", de: "Bedrohungsakteur" },
  contractExists: { en: "Contract Exists", de: "Vertrag vorhanden" },
  rateLimited: { en: "Rate Limited", de: "Rate Limiting" },
  
  // Data Store Properties
  storedDataTypes: { en: "Stored Data Types", de: "Gespeicherte Datentypen" },
  dataClassification: { en: "Data Classification", de: "Datenklassifizierung" },
  encryptionAtRest: { en: "Encryption at Rest", de: "Verschlüsselung im Ruhezustand" },
  accessControl: { en: "Access Control", de: "Zugriffskontrolle" },
  integrityProtection: { en: "Integrity Protection", de: "Integritätsschutz" },
  backupEnabled: { en: "Backup Enabled", de: "Backup aktiviert" },
  deletionPolicy: { en: "Deletion Policy", de: "Löschrichtlinie" },
  multiTenant: { en: "Multi-Tenant", de: "Mandantenfähig" },
  
  // Data Flow Properties
  dataTypes: { en: "Data Types", de: "Datentypen" },
  protocol: { en: "Protocol", de: "Protokoll" },
  direction: { en: "Direction", de: "Richtung" },
  frequency: { en: "Frequency", de: "Häufigkeit" },
  volume: { en: "Volume", de: "Volumen" },
  encryptionInTransit: { en: "Encryption in Transit", de: "Verschlüsselung bei Übertragung" },
  endpointAuthentication: { en: "Endpoint Authentication", de: "Endpunkt-Authentifizierung" },
  
  // Interface Properties
  type: { en: "Interface Type", de: "Schnittstellentyp" },
  connectionSpeed: { en: "Connection Speed", de: "Verbindungsgeschwindigkeit" },
  isShieldedCable: { en: "Shielded Cable", de: "Abgeschirmtes Kabel" },
  location: { en: "Location", de: "Standort" },
  
  // Trust Boundary Properties
  boundaryId: { en: "Boundary ID", de: "Grenz-ID" },
  boundaryType: { en: "Boundary Type", de: "Grenztyp" },
  securityAssumptions: { en: "Security Assumptions", de: "Sicherheitsannahmen" },
  boundaryControls: { en: "Boundary Controls", de: "Grenzkontrollen" },
  monitoringEnabled: { en: "Monitoring Enabled", de: "Überwachung aktiviert" },
  complianceRelevance: { en: "Compliance Relevance", de: "Compliance-Relevanz" },
  
  // Asset Relations
  linkedAssets: { en: "Linked Assets", de: "Verknüpfte Assets" },
};

const GROUP_NAMES: Record<string, { en: string; de: string }> = {
  basic: { en: "Basic Information", de: "Grundinformationen" },
  security: { en: "Security Properties", de: "Sicherheitseigenschaften" },
  technical: { en: "Technical Properties", de: "Technische Eigenschaften" },
  assetRelations: { en: "Asset Relations", de: "Asset-Beziehungen" },
  additional: { en: "Additional Information", de: "Zusätzliche Informationen" },
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

function formatValue(value: any): string {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "N/A";
  return String(value);
}

// ==================== GROUPED PROPERTY EXTRACTION ====================

/**
 * Get all properties for an element grouped by category
 */
export function getElementPropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  switch (element.type) {
    case "Process":
      return getProcessPropertiesGrouped(element, lang);
    case "Multiprocess":
      return getProcessPropertiesGrouped(element, lang); // Same as Process
    case "ExternalEntity":
      return getExternalEntityPropertiesGrouped(element, lang);
    case "DataStore":
      return getDataStorePropertiesGrouped(element, lang);
    case "Interface":
      return getInterfacePropertiesGrouped(element, lang);
    case "TrustBoundary":
      return getTrustBoundaryPropertiesGrouped(element, lang);
    default:
      return [];
  }
}

/**
 * Get Process-specific properties grouped
 */
function getProcessPropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = element.properties as ProcessProperties;
  const groups: PropertyGroup[] = [];

  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(element.description),
      },
      {
        label: getPropertyLabel("technology", lang),
        value: formatValue(props.technology),
      },
      {
        label: getPropertyLabel("owner", lang),
        value: formatValue(props.owner),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      { label: getPropertyLabel("runsAs", lang), value: formatValue(props.runsAs) },
      { label: getPropertyLabel("privilegeLevel", lang), value: formatValue(props.privilegeLevel) },
      { label: getPropertyLabel("authenticationRequired", lang), value: formatValue(props.authenticationRequired) },
      { label: getPropertyLabel("authorizationModel", lang), value: formatValue(props.authorizationModel) },
      { label: getPropertyLabel("inputValidation", lang), value: formatValue(props.inputValidation) },
      { label: getPropertyLabel("errorHandling", lang), value: formatValue(props.errorHandling) },
      { label: getPropertyLabel("securityControls", lang), value: formatValue(props.securityControls) },
      { label: getPropertyLabel("exposedToInternet", lang), value: formatValue(props.exposedToInternet) },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      { label: getPropertyLabel("notes", lang), value: formatValue(props.notes) },
    ],
  });

  return groups;
}

/**
 * Get ExternalEntity-specific properties grouped
 */
function getExternalEntityPropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = element.properties as ExternalEntityProperties;
  const groups: PropertyGroup[] = [];

  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(element.description),
      },
      {
        label: getPropertyLabel("entityType", lang),
        value: formatValue(props.entityType),
      },
      {
        label: getPropertyLabel("ownership", lang),
        value: formatValue(props.ownership),
      },
      {
        label: getPropertyLabel("owner", lang),
        value: formatValue(props.owner),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      { label: getPropertyLabel("trustLevel", lang), value: formatValue(props.trustLevel) },
      { label: getPropertyLabel("threatActor", lang), value: formatValue(props.threatActor) },
      { label: getPropertyLabel("authenticationMethod", lang), value: formatValue(props.authenticationMethod) },
      { label: getPropertyLabel("authorizationScope", lang), value: formatValue(props.authorizationScope) },
      { label: getPropertyLabel("contractExists", lang), value: formatValue(props.contractExists) },
      { label: getPropertyLabel("rateLimited", lang), value: formatValue(props.rateLimited) },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      { label: getPropertyLabel("notes", lang), value: formatValue(props.notes) },
    ],
  });

  return groups;
}

/**
 * Get DataStore-specific properties grouped
 */
function getDataStorePropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = element.properties as DataStoreProperties;
  const groups: PropertyGroup[] = [];

  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(element.description),
      },
      {
        label: getPropertyLabel("technology", lang),
        value: formatValue(props.technology),
      },
      {
        label: getPropertyLabel("storedDataTypes", lang),
        value: formatValue(props.storedDataTypes),
      },
      {
        label: getPropertyLabel("owner", lang),
        value: formatValue(props.owner),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      { label: getPropertyLabel("dataClassification", lang), value: formatValue(props.dataClassification) },
      { label: getPropertyLabel("encryptionAtRest", lang), value: formatValue(props.encryptionAtRest) },
      { label: getPropertyLabel("accessControl", lang), value: formatValue(props.accessControl) },
      { label: getPropertyLabel("integrityProtection", lang), value: formatValue(props.integrityProtection) },
    ],
  });

  // Technical Properties
  groups.push({
    groupName: getGroupName("technical", lang),
    properties: [
      { label: getPropertyLabel("multiTenant", lang), value: formatValue(props.multiTenant) },
      { label: getPropertyLabel("backupEnabled", lang), value: formatValue(props.backupEnabled) },
      { label: getPropertyLabel("deletionPolicy", lang), value: formatValue(props.deletionPolicy) },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      { label: getPropertyLabel("notes", lang), value: formatValue(props.notes) },
    ],
  });

  return groups;
}

/**
 * Get Interface-specific properties grouped
 */
function getInterfacePropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = element.properties as InterfaceProperties;
  const groups: PropertyGroup[] = [];

  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(element.description),
      },
      { label: getPropertyLabel("type", lang), value: formatValue(props.type) },
      {
        label: getPropertyLabel("location", lang),
        value: formatValue(props.location),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      { label: getPropertyLabel("accessControl", lang), value: formatValue(props.accessControl) },
    ],
  });

  // Technical Properties
  groups.push({
    groupName: getGroupName("technical", lang),
    properties: [
      { label: getPropertyLabel("connectionSpeed", lang), value: formatValue(props.connectionSpeed) },
      { label: getPropertyLabel("isShieldedCable", lang), value: formatValue(props.isShieldedCable) },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      { label: getPropertyLabel("notes", lang), value: formatValue(props.notes) },
    ],
  });

  return groups;
}

/**
 * Get TrustBoundary-specific properties grouped
 */
function getTrustBoundaryPropertiesGrouped(
  element: DFDElement,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = element.properties as TrustBoundaryProperties;
  const groups: PropertyGroup[] = [];

  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(element.description),
      },
      {
        label: getPropertyLabel("boundaryId", lang),
        value: formatValue(props.boundaryId),
      },
      {
        label: getPropertyLabel("boundaryType", lang),
        value: formatValue(props.boundaryType),
      },
      {
        label: getPropertyLabel("owner", lang),
        value: formatValue(props.owner),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      { label: getPropertyLabel("securityAssumptions", lang), value: formatValue(props.securityAssumptions) },
      { label: getPropertyLabel("boundaryControls", lang), value: formatValue(props.boundaryControls) },
      { label: getPropertyLabel("monitoringEnabled", lang), value: formatValue(props.monitoringEnabled) },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      { label: getPropertyLabel("complianceRelevance", lang), value: formatValue(props.complianceRelevance) },
      { label: getPropertyLabel("notes", lang), value: formatValue(props.notes) },
    ],
  });

  return groups;
}

// TODO(security-docs):
// DataFlowProperties became semantic/context-aware.
// Current export is only a compatibility build-fix.
// Future refactor should:
// - align report groups with UI sections
// - support applicability-aware rendering
// - support semantic coverage states
// - suppress non-applicable transport-security fields
// - integrate computeDataFlowCoverage()

/**
 * Get DataFlow-specific properties grouped
 */
export function getConnectionPropertiesGrouped(
  connection: DFDConnection,
  lang: DocLanguage,
): PropertyGroup[] {
  const props = connection.properties as DataFlowProperties | undefined;
  if (!props) return [];

  const groups: PropertyGroup[] = [];

  // Basic Information
  // Basic Information
  groups.push({
    groupName: getGroupName("basic", lang),
    properties: [
      {
        label: getPropertyLabel("description", lang),
        value: formatValue(connection.description),
      },
      {
        label: getPropertyLabel("messageType", lang),
        value: formatValue(props.messageType),
      },
      {
        label: getPropertyLabel("dataClassification", lang),
        value: formatValue(props.dataClassification),
      },
      {
        label: getPropertyLabel("dataTypeNotes", lang),
        value: formatValue(props.dataTypeNotes),
      },
      {
        label: getPropertyLabel("protocol", lang),
        value: formatValue(props.protocol),
      },
    ],
  });

  // Security Properties
  groups.push({
    groupName: getGroupName("security", lang),
    properties: [
      {
        label: getPropertyLabel("encryptionInTransit", lang),
        value: formatValue(props.encryptionInTransit),
      },
      {
        label: getPropertyLabel("endpointAuthentication", lang),
        value: formatValue(props.endpointAuthentication),
      },
      {
        label: getPropertyLabel("integrityProtection", lang),
        value: formatValue(props.integrityProtection),
      },
    ],
  });

  // Technical Properties
  groups.push({
    groupName: getGroupName("technical", lang),
    properties: [
      {
        label: getPropertyLabel("direction", lang),
        value: formatValue(props.direction),
      },
      {
        label: getPropertyLabel("frequency", lang),
        value: formatValue(props.frequency),
      },
      {
        label: getPropertyLabel("volume", lang),
        value: formatValue(props.volume),
      },
    ],
  });

  // Additional Information
  groups.push({
    groupName: getGroupName("additional", lang),
    properties: [
      {
        label: getPropertyLabel("notes", lang),
        value: formatValue(props.notes),
      },
    ],
  });

  return groups;
}

// ==================== ASSET RELATION FORMATTERS ====================

/**
 * Format asset relations for an element
 */
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
      return props.authenticationRequired !== undefined && 
             props.authenticationRequired !== "no";
    }
    case "ExternalEntity": {
      const props = element.properties as ExternalEntityProperties;
      // Check if authentication method is set and not "none"
      return props.authenticationMethod !== undefined && 
             props.authenticationMethod !== "none";
    }
    case "DataStore": {
      const props = element.properties as DataStoreProperties;
      // Check if access control is defined
      return props.accessControl !== undefined && 
             props.accessControl.trim() !== "";
    }
    case "Interface": {
      const props = element.properties as InterfaceProperties;
      // Check if access control is set and not "none"
      return props.accessControl !== undefined && 
             props.accessControl !== "none";
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