// ==================== RISK INTEGRATION TYPES ====================
// What the Risk tab knows about the issue tracker: the ticket types (shared)
// and the stored connection. Talking to the tracker goes through a TicketPort
// the app passes in (adapters design §4.3); the status rules are
// services/ticket-sync.ts.


// ==================== TICKET TYPES ====================
// In shared (adapters design §4.2) so that the integration feature and this
// one share them without importing each other; re-exported here.
import type { IssueTrackerId } from "shared/models/issue-trackers";
export type {
  TicketStatus,
  TicketSummary,
  CreateTicketInput,
  CreateTicketResult,
} from "shared/models/ticket-types";

/**
 * The stored connection as the Risk tab sees it (no secret) — the chosen
 * project and its issue types for creating tickets.
 */
export interface RiskIntegrationConnection {
  tool: IssueTrackerId;
  /** Issue types of the chosen project (stored when it was chosen). */
  issueTypes?: Array<{ id: string; name: string; iconUrl?: string }>;
  status: "connected" | "disconnected" | "error" | "testing";
  projectName?: string;
  credentials?: {
    baseUrl?: string;
    email?: string;
    accountId?: string;
    authMethod?: string;
    projectKey?: string;
  };
}