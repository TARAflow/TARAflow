// ==================== ELEMENT PROPERTIES ====================
// Property interfaces for DFD canvas elements (Describe View)
//
// Conceptual separation:
//   element-properties.ts  → DFD canvas descriptions (this file)
//   asset-types.ts         → Asset Tab impact analysis (AssetProperties, DFDAsset)
//
// NO dependencies on dfd-types to avoid circular imports

// ==================== EXPOSURE LEVEL (EN 50742 Annex B) ====================
// EL is assigned per interface / per connection by the analyst.
// Static metric: reflects the attack surface of a physical or logical boundary.
//
// Rule: if a DataFlow crosses multiple Trust Boundaries, the highest EL wins.
//
//   EL0 – Internal:  inside the machine enclosure, no external access possible
//   EL1 – Physical:  physical access required (USB, serial port, locked cabinet)
//   EL2 – Local:     local network segment (fieldbus, Ethernet, LAN)
//   EL3 – Adjacent:  industrial factory network, VPN, partner / OT network
//   EL4 – Public:    internet-exposed, untrusted public network

export type ExposureLevel = "EL0" | "EL1" | "EL2" | "EL3" | "EL4";

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
  endpointAuthentication?:
    | "none"
    | "token"
    | "certificate"
    | "apikey"
    | "oauth";

  // EN 50742 Annex B — Exposure Level per connection
  // Analyst assigns EL based on which trust boundaries this flow crosses.
  // If the flow crosses multiple trust boundaries, use the highest EL.
  // Feeds into Attack Potential: AP = (EL × WoO) + AC
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

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

  // EN 50742 Annex B — Exposure Level per interface
  // Primary EL carrier in the graph. Assigned per physical or logical interface.
  // Example: USB config port on cabinet exterior → EL1; internet-facing port → EL4
  // Feeds into Attack Potential: AP = (EL × WoO) + AC
  exposureLevel?: ExposureLevel;
  exposureLevelSource?: "derived" | "manual";
  exposureLevelRationale?: string;

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

  // EN 50742 Annex B — Exposure Level of this zone
  // Analogous to IEC 62443 Security Zone: defines the attack surface level
  // of everything inside this boundary.
  // DataFlows / Interfaces crossing this boundary inherit this EL (or higher
  // if they cross into a more exposed zone).
  // Displayed as zone label in the DFD diagram: e.g. "Maschinenraum · EL1"
  defaultExposureLevel?: ExposureLevel;

  // Security Context
  securityAssumptions?: string;
  boundaryControls?: string;
  monitoringEnabled?: boolean;

  // Compliance
  complianceRelevance?: string;

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

// ==================== RE-EXPORT (Backwards Compat) ====================
// AssetProperties was moved to asset-types.ts.
// Existing imports via element-properties.ts remain valid.

// export type { AssetProperties } from "./asset-types";