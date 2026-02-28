// ==================== ELEMENT PROPERTIES ====================
// Property interfaces for DFD elements
// NO dependencies on dfd-types to avoid circular imports
//
// HINWEIS: AssetProperties.category verwendet jetzt AssetGroup
// aus asset-relation-types.ts statt einem lokalen String-Literal-Typ

import type { AssetGroup } from "./asset-relation-types";

// ==================== PROCESS PROPERTIES ====================

export interface ProcessProperties {
  // Execution Context
  runsAs?:
    | "not_specified"
    | "user"
    | "admin_user"
    | "root"
    | "system"
    | "service"
    | "guest"
    | "anonymous"
    | "contractor";
  privilegeLevel?: "not_specified" | "low" | "medium" | "high" | "root";

  // Authentication & Authorization
  authenticationRequired?:
    | "not_specified"
    | "no"
    | "yes"
    | "optional"
    | "oauth"
    | "saml"
    | "certificate"
    | "apikey"
    | "jwt"
    | "mtls";
  authorizationModel?: "not_specified" | "none" | "rbac" | "abac" | "acl" | "custom";

  // Input Validation & Error Handling
  inputValidation?: "not_specified" | "none" | "basic" | "strict" | "schema";
  errorHandling?: "not_specified" | "silent" | "verbose" | "sanitized";

  // Security Controls
  securityControls?: string;
  exposedToInternet?: boolean;

  // Technology & Ownership
  technology?:
    | "api"
    | "batch"
    | "ui"
    | "microservice"
    | "lambda"
    | "daemon"
    | "websocket"
    | "event"
    | "cli"
    | "database"
    | "cron"
    | "iot";
  owner?: string;
  notes?: string;
}

// ==================== EXTERNAL ENTITY PROPERTIES ====================

export interface ExternalEntityProperties {
  // Entity Classification
  entityType?:
    | "user"
    | "admin_user"
    | "partner"
    | "thirdparty"
    | "service"
    | "identity_provider"
    | "payment"
    | "contractor"
    | "bot"
    | "webhook"
    | "mobile_app"
    | "iot";

  // Trust & Access
  trustLevel?: "low" | "medium" | "high";
  authenticationMethod?:
    | "none"
    | "password"
    | "mfa"
    | "oauth"
    | "saml"
    | "certificate"
    | "apikey"
    | "mutual_tls"
    | "jwt";
  authorizationScope?: string;

  // Ownership & Threat Assessment
  ownership?: "internal" | "external" | "partner";
  threatActor?:
    | "benign"
    | "curious"
    | "malicious"
    | "advanced"
    | "insider"
    | "compromised";

  // Controls
  contractExists?: boolean;
  rateLimited?: boolean;

  owner?: string;
  notes?: string;
}

// ==================== DATA STORE PROPERTIES ====================

export interface DataStoreProperties {
  // Data Classification
  storedDataTypes?: string;
  dataClassification?: "public" | "internal" | "confidential" | "restricted" | "secret";

  // Encryption & Protection
  encryptionAtRest?: "none" | "yes" | "aes256" | "tde" | "kms" | "custom";
  accessControl?: string;
  integrityProtection?: boolean;

  // Backup & Retention
  backupEnabled?: boolean;
  deletionPolicy?: string;

  // Technology & Architecture
  technology?: "database" | "filesystem" | "cloud" | "cache" | "queue" | "blockchain";
  multiTenant?: boolean;

  owner?: string;
  notes?: string;
}

// ==================== DATA FLOW PROPERTIES ====================

export interface DataFlowProperties {
  // Data & Protocol
  dataTypes?: string;
  protocol?:
    | "http"
    | "https"
    | "grpc"
    | "mqtt"
    | "amqp"
    | "websocket"
    | "file"
    | "database"
    | "custom";

  // Flow Characteristics
  direction?: "unidirectional" | "bidirectional" | "requestresponse";
  frequency?: "continuous" | "periodic" | "ondemand" | "batch";
  volume?: string;

  // Security
  encryptionInTransit?: "none" | "tls" | "mtls" | "vpn" | "custom";
  integrityProtection?: boolean;
  endpointAuthentication?: "none" | "token" | "certificate" | "apikey" | "oauth";

  notes?: string;
}

// ==================== INTERFACE PROPERTIES ====================

export interface InterfaceProperties {
  // Interface Type
  type?:
    | "ethernet"
    | "serial"
    | "usb"
    | "gpio"
    | "bluetooth"
    | "wifi"
    | "nfc"
    | "fiber"
    | "custom";

  // Security & Access
  accessControl?:
    | "none"
    | "physical_lock"
    | "credentials"
    | "card"
    | "certificate";

  // Physical Characteristics
  connectionSpeed?: "low" | "medium" | "high";
  isShieldedCable?: boolean;
  location?: string;

  notes?: string;
}

// ==================== TRUST BOUNDARY PROPERTIES ====================

export interface TrustBoundaryProperties {
  boundaryId?: string;

  // Boundary Classification
  boundaryType?:
    | "network"
    | "privilege"
    | "organization"
    | "cloud"
    | "physical"
    | "legal"
    | "device";

  // Security Context
  securityAssumptions?: string;
  boundaryControls?: string;
  monitoringEnabled?: boolean;

  // Compliance
  complianceRelevance?: string;

  owner?: string;
  notes?: string;
}

// ==================== ASSET PROPERTIES ====================

/**
 * Detaillierte Asset-Eigenschaften für den Asset-Tab
 * (Impact-Analyse, CIA-Werte, Schutzziele)
 *
 * HINWEIS: AssetGroup und protectionNeed sind Top-Level-Attribute
 * auf DFDAsset — nicht hier. Diese properties enthalten nur die
 * vertieften, gruppenspezifischen Felder für den Asset-Tab.
 *
 * assetGroup hier dient als Redundanz für kategorieabhängige
 * Formularfelder — der kanonische Wert liegt auf DFDAsset.assetGroup.
 */
export interface AssetProperties {
  /**
   * Asset-Gruppe — gespiegelt von DFDAsset.assetGroup
   * Steuert welche gruppenspezifischen Felder angezeigt werden
   * Kanonischer Wert: DFDAsset.assetGroup (dort ändern, hier folgt)
   */
  category?: AssetGroup;

  /**
   * Schutzbedarf — gespiegelt von DFDAsset.protectionNeed
   * Kanonischer Wert: DFDAsset.protectionNeed
   */
  protectionNeed?: "low" | "medium" | "high" | "critical";

  // ---- Kategorie: Data ----
  /** Datentypen die in diesem Asset enthalten sind */
  dataType?: string[];
  /** Lebenszyklus der Daten */
  lifecycle?: "transient" | "stored" | "archived";

  // ---- Kategorie: System ----
  /** Kritikalität des Systems */
  criticality?: "supporting" | "essential" | "safety_critical";
  /** Netzwerk-Exposition */
  exposure?: "internal" | "dmz" | "internet";

  // ---- Kategorie: Infrastructure ----
  /** Physischer Zugriff möglich */
  physicalAccessPossible?: boolean;
  /** Physischer Standort */
  location?: "factory" | "datacenter" | "field" | "cloud";

  // ---- Kategorie: Process ----
  /** Prozess ist automatisiert */
  automated?: boolean;
  /** Änderungshäufigkeit */
  changeFrequency?: "rarely" | "regular" | "frequent";

  // ---- Kategorie: Human ----
  /** Rolle der Person */
  role?: "operator" | "admin" | "developer" | "external";
  /** Person ist sicherheitsrelevant */
  securityRelevant?: boolean;

  // ---- CIANAAA-Schutzziele ----
  // Werden aus Beziehungstypen abgeleitet — Analyst bestätigt oder überschreibt.

  /** Confidentiality — Vertraulichkeit */
  confidentialityImpact?: "low" | "medium" | "high" | "critical";

  /** Integrity — Unversehrtheit */
  integrityImpact?: "low" | "medium" | "high" | "critical";

  /** Availability — Verfügbarkeit */
  availabilityImpact?: "low" | "medium" | "high" | "critical";

  /**
   * Non-Repudiation — Nicht-Abstreitbarkeit (= R in STRIDE)
   * Relevant bei: modifies, creates, deletes, transports, executes, monitors
   */
  nonRepudiationRelevant?: boolean;

  /**
   * Authentication — Identitätsnachweis erforderlich
   * Relevant bei: reads (kritisch), uses[network], accesses[remote]
   */
  authenticationRelevant?: boolean;

  /**
   * Authorization — Berechtigungsprüfung erforderlich
   * Relevant bei: fast allen Beziehungstypen ausser is_an
   */
  authorizationRelevant?: boolean;

  /**
   * Accountability — DSGVO-Nachweispflicht / behördliche Verantwortlichkeit
   * Zusätzlich zu Non-Repudiation wenn personalData: true
   */
  accountabilityRelevant?: boolean;

  // ---- Conditional Confidentiality Flags ----

  /**
   * Asset in sicherem Speicher (TPM, HSM, OP-TEE)
   * → Confidentiality bei "stores"-Beziehung aktivieren
   */
  secureStorage?: boolean;

  /**
   * Asset hat Geschäftsgeheimnischarakter
   * → Confidentiality bei "is_an" auf Process Assets aktivieren
   */
  businessSecret?: boolean;

  // ---- Accountability Flag ----

  /**
   * Asset enthält personenbezogene Daten (DSGVO Art. 5 Abs. 2)
   * → Accountability wird zusätzlich zu Non-Repudiation abgeleitet
   */
  personalData?: boolean;

  // ---- Impact-Bewertung ----

  /** Business Impact — wirtschaftlicher/operationeller Schaden */
  businessImpact?: "low" | "medium" | "high" | "critical";
  businessImpactCategory?: "operational" | "financial" | "privacy" | "reputational";

  /**
   * Physical Impact — Safety-Impact auf Menschen
   * Automatisch aus asset.safety.impact gespiegelt — read-only im UI
   */
  physicalImpact?: "none" | "reversible_injury" | "irreversible_injury" | "fatality";

  // ---- Aggregierte Kritikalität (abgeleitet, read-only) ----

  /**
   * Aggregierte Asset-Kritikalität (Business + Physical Impact)
   * Safety Override Rule: fatality/irreversible_injury → immer CRITICAL
   */
  aggregatedCriticality?: "low" | "medium" | "high" | "critical";

  /**
   * STRIDE-Analysetiefe — aus aggregatedCriticality + Trust Boundary
   * Automatisch berechnet — nicht manuell setzen
   */
  strideDepth?: "vertieft" | "fokussiert" | "hochstufig";

  owner?: string;
  notes?: string;
}

// ==================== UNION TYPE ====================

export type ElementProperties =
  | ProcessProperties
  | ExternalEntityProperties
  | DataStoreProperties
  | InterfaceProperties
  | TrustBoundaryProperties;
