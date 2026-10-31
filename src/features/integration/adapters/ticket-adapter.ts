// ==================== TICKET ADAPTER ====================
// One interface per issue tracker (adapters design §4.2). Adapters run in the
// renderer and talk through the host-bound channel; they map the tracker's
// fields to the shared ticket types. Status semantics (what a ticket change
// does to a mitigation) are tracker-independent and live outside.

import type {
  CreateTicketInput,
  CreateTicketResult,
  TicketPort,
  TicketState,
  TicketSummary,
} from "shared/models/ticket-types";
import type { TrackerProject } from "../models/integration-types";
import type { TrackerRef } from "./tracker-channel";

export interface ConnectionTestOutcome {
  success: boolean;
  message: string;
  projects: TrackerProject[];
  /** Tracker-side account id, when the tracker reports one (Jira). */
  accountId?: string;
}

export interface TicketAdapter extends TicketPort {
  readonly ref: TrackerRef;
  testConnection(): Promise<ConnectionTestOutcome>;
  fetchTickets(projectKey: string, issueType: string): Promise<TicketSummary[]>;
  createTicket(input: CreateTicketInput): Promise<CreateTicketResult>;
  /** One batch request for all keys; keys the tracker does not know are absent. */
  fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>>;
  ticketUrl(key: string): string;
}
