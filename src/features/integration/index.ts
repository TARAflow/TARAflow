// ==================== INTEGRATION FEATURE ====================
// Public exports for external ticketing system integration

// Components
export { IntegrationTab } from "./components/integration-tab";
export { AdoConfig } from "./components/ado-config";
export { JiraConfig } from "./components/jira-config";

// Types
export type {
  IntegrationTool,
  ConnectionStatus,
  AuthMethod,
  AzureDevOpsCredentials,
  JiraCredentials,
  ToolCredentials,
  IntegrationConnection,
  AzureDevOpsProject,
  JiraProject,
  ExternalProject,
  TicketMapping,
  IntegrationData,
  TicketStatus,
  TicketInfo,
  ConnectionTestResult,
  TicketCreationResult,
  IntegrationTabData,
  IntegrationTabProps,
} from "./models/integration-types";

// Services
export * as integrationService from "./services/integration-service";
export * as adoService from "./services/ado-service";
export * as jiraService from "./services/jira-service";