// ==================== ELEMENT PROPERTIES ====================
// Property interfaces for DFD elements
// NO dependencies on dfd-types to avoid circular imports

// ==================== PROCESS PROPERTIES ====================

export interface ProcessProperties {
  description?: string;

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
  privilegeLevel?: "low" | "medium" | "high" | "root";

  // Authentication & Authorization
  authenticationRequired?:
    | "no"
    | "yes"
    | "optional"
    | "oauth"
    | "saml"
    | "certificate"
    | "apikey"
    | "jwt"
    | "mtls";
  authorizationModel?: "none" | "rbac" | "abac" | "acl" | "custom";

  // Input Validation & Error Handling
  inputValidation?: "none" | "basic" | "strict" | "schema";
  errorHandling?: "silent" | "verbose" | "sanitized";

  // Security Controls
  securityControls?: string;
  exposedToInternet?: boolean;

  // Technology & Ownership
  technology?:
    | "api" // Service for REST, GraphQL, or similar
    | "batch" // Batch processing
    | "ui" // Frontend/UI
    | "microservice" // Distributed units
    | "lambda" // Serverless function
    | "daemon" // Background process
    | "websocket" // Real-time communication
    | "event" // Message- or event-driven
    | "cli" // Command-line tools/scripts
    | "database" // Database services
    | "cron" // Scheduled tasks
    | "iot"; // Specialized IoT systems
  owner?: string;
  notes?: string;
}

// ==================== EXTERNAL ENTITY PROPERTIES ====================

export interface ExternalEntityProperties {
  description?: string;

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
  description?: string;
  
  // Data Classification
  storedDataTypes?: string; // Comma-separated
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
  description?: string;
  
  // Data & Protocol
  dataTypes?: string; // Comma-separated
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
  description?: string;
  
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
  description?: string;
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

export interface AssetProperties {
  description?: string;
  
  // Core Classification
  category?: "data" | "system" | "infrastructure" | "process" | "human";
  protectionNeed?: "low" | "medium" | "high" | "critical";
  
  // Category: Data
  dataType?: string[]; // Multiple types possible
  lifecycle?: "transient" | "stored" | "archived";
  
  // Category: System
  criticality?: "supporting" | "essential" | "safety_critical";
  exposure?: "internal" | "dmz" | "internet";
  
  // Category: Infrastructure
  physicalAccessPossible?: boolean;
  location?: "factory" | "datacenter" | "field" | "cloud";
  
  // Category: Process
  automated?: boolean;
  changeFrequency?: "rarely" | "regular" | "frequent";
  
  // Category: Human
  role?: "operator" | "admin" | "developer" | "external";
  securityRelevant?: boolean;
  
  owner?: string;
  notes?: string;
}

// ==================== UNION TYPE FOR ALL PROPERTIES ====================

export type ElementProperties =
  | ProcessProperties
  | ExternalEntityProperties
  | DataStoreProperties
  | InterfaceProperties
  | TrustBoundaryProperties;