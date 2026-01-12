// ==================== INTEGRATION TYPES ====================
// Types for external ticketing system integration (Azure DevOps, Jira)

// ==================== TOOL TYPES ====================

export type IntegrationTool = "azure-devops" | "jira";

export type ConnectionStatus = "disconnected" | "connected" | "error" | "testing";

export type AuthMethod = "pat" | "oauth";

// ==================== CREDENTIAL TYPES ====================

export interface AzureDevOpsCredentials {
  authMethod: AuthMethod;
  // OAuth
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  // PAT
  organizationUrl: string;
  personalAccessToken?: string;
  projectName?: string;
}

export interface JiraCredentials {
  authMethod: AuthMethod;
  // OAuth
  accessToken?: string;
  refreshToken?: string;
  cloudId?: string;
  // PAT
  baseUrl: string;
  email?: string;
  apiToken?: string;
  projectKey?: string;
  expiresAt?: string;
}

export type ToolCredentials = AzureDevOpsCredentials | JiraCredentials;

// ==================== CONNECTION TYPES ====================

export interface IntegrationConnection {
  tool: IntegrationTool;
  status: ConnectionStatus;
  credentials: ToolCredentials | null;
  lastTested?: string; // ISO timestamp
  lastError?: string;
  projectId?: string; // Selected project/board ID
  projectName?: string; // Selected project/board name
}

// ==================== PROJECT/BOARD TYPES ====================

export interface AzureDevOpsProject {
  id: string;
  name: string;
  description?: string;
  url: string;
}

export interface JiraProject {
  id: string;
  key: string; // e.g., "PROJ"
  name: string;
  projectTypeKey: string; // e.g., "software"
}

export type ExternalProject = AzureDevOpsProject | JiraProject;

// ==================== MAPPING CONFIGURATION ====================

export interface TicketMapping {
  // MoSCoW to Priority mapping
  mustPriority: string; // e.g., "1" (ADO) or "High" (Jira)
  shouldPriority: string;
  couldPriority: string;
  wontPriority: string;

  // Work item / issue type
  workItemType: string; // e.g., "Bug", "Task", "Story"

  // Default values
  defaultAssignee?: string;
  defaultLabels?: string[];
  defaultTags?: string[];
}

// ==================== INTEGRATION DATA ====================

export interface IntegrationData {
  connection: IntegrationConnection | null;
  mapping: TicketMapping | null;
  lastSync?: string; // ISO timestamp of last sync
}

// ==================== TICKET STATUS ====================

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "REVIEW" | "CLOSED" | "UNKNOWN";

export interface TicketInfo {
  id: string; // Work Item ID (ADO) or Issue Key (Jira)
  url: string; // Direct link to ticket
  status: TicketStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  projects?: ExternalProject[];
}

export interface TicketCreationResult {
  success: boolean;
  ticket?: TicketInfo;
  error?: string;
}

// ==================== COMPONENT PROPS ====================

export interface IntegrationTabData {
  integration: IntegrationData | null;
}

export interface IntegrationTabProps {
  data: IntegrationTabData;
  onUpdate: (data: IntegrationTabData) => void;
}