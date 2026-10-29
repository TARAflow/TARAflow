// ==================== INTEGRATION FEATURE ====================
// Issue-tracker connection and adapters (design
// doc/InProgress/Integration/issue-tracker-adapters.md).

export { IntegrationTab } from "./components/integration-tab";

export type {
  IntegrationTool,
  ConnectionStatus,
  AuthMethod,
  TrackerCredentials,
  JiraCredentials,
  IntegrationConnection,
  IssueType,
  TrackerProject,
  JiraProject,
  TicketMapping,
  IntegrationData,
  TicketStatus,
  IntegrationTabData,
  IntegrationTabProps,
} from "./models/integration-types";
export { defaultTicketMapping } from "./models/integration-types";

export type { TicketAdapter, ConnectionTestOutcome } from "./adapters/ticket-adapter";
export type { TrackerRef } from "./adapters/tracker-channel";
export { createTicketAdapter, trackerRefOf } from "./adapters/create-ticket-adapter";
