// ==================== RISK INTEGRATION TYPES ====================
// Ticket-related types needed by the Risk Tab for Jira / ADO integration.
//
// Scope: only what the Risk feature needs to know about external tickets.
// Full integration configuration (credentials, connection) lives in:
//   src/features/integration/models/integration-types.ts
//
// Dependencies: risk-mitigation-types (MitigationStatus)

import type { MitigationStatus } from "./risk-mitigation-types";

// ==================== TICKET STATUS ====================

/**
 * Status of an external ticket (Jira / ADO).
 * Mirrored here to avoid cross-feature import from integration feature.
 */
export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "REVIEW"
  | "CLOSED"
  | "UNKNOWN";

// ==================== TICKET SUMMARY ====================

/**
 * Compact ticket info returned when listing existing tickets
 * (e.g. via fetchJiraTickets).
 */
export interface TicketSummary {
  key: string;
  summary: string;
  status: string;
  ticketStatus: TicketStatus;
  issueType: string;
  issueTypeIconUrl?: string;
  assignee?: string;
  assigneeAvatarUrl?: string;
  priority?: string;
  priorityIconUrl?: string;
  /** Sprint name — undefined means Backlog */
  sprint?: string;
  url: string;
}

// ==================== TICKET CREATION ====================

export interface CreateTicketInput {
  projectKey: string;
  issueType: string;
  summary: string;
  description: string;
  priority?: string;
  labels?: string[];
}

export interface CreateTicketResult {
  success: boolean;
  /** Created ticket key, e.g. "SCRUM-42" */
  ticketId?: string;
  /** Direct URL to the created ticket */
  ticketUrl?: string;
  error?: string;
}

// ==================== TICKET SYNC ====================

export interface TicketSyncResult {
  ticketId: string;
  ticketStatus: TicketStatus;
  /**
   * Mapped MitigationStatus — null if no mapping exists for this status.
   * Callers decide whether to apply the mapped status or keep existing.
   */
  mappedMitigationStatus: MitigationStatus | null;
  syncedAt: string;
}

// ==================== STATUS MAPPING ====================

/**
 * Maps raw Jira / ADO status name to internal TicketStatus.
 */
export function mapRawStatusToTicketStatus(statusName: string): TicketStatus {
  const lower = statusName.toLowerCase().trim();
  const mapping: Record<string, TicketStatus> = {
    "to do":       "OPEN",
    "backlog":     "OPEN",
    "open":        "OPEN",
    "new":         "OPEN",
    "in progress": "IN_PROGRESS",
    "doing":       "IN_PROGRESS",
    "active":      "IN_PROGRESS",
    "development": "IN_PROGRESS",
    "reopened":    "IN_PROGRESS",
    "in review":   "REVIEW",
    "review":      "REVIEW",
    "testing":     "REVIEW",
    "qa":          "REVIEW",
    "done":        "CLOSED",
    "closed":      "CLOSED",
    "resolved":    "CLOSED",
    "completed":   "CLOSED",
    "won't fix":   "CLOSED",
    "wont fix":    "CLOSED",
  };
  return mapping[lower] ?? "UNKNOWN";
}

/**
 * Maps TicketStatus to MitigationStatus.
 * Returns null if no sensible mapping exists (e.g. UNKNOWN).
 */
export function mapTicketStatusToMitigationStatus(
  ticketStatus: TicketStatus,
): MitigationStatus | null {
  const mapping: Record<TicketStatus, MitigationStatus | null> = {
    OPEN:        "open",
    IN_PROGRESS: "in_progress",
    REVIEW:      "in_review",
    CLOSED:      "implemented",
    UNKNOWN:     null,
  };
  return mapping[ticketStatus] ?? null;
}

// ==================== MINIMAL CONNECTION REFERENCE ====================

/**
 * Minimal connection info the Risk Tab needs to interact with Jira / ADO.
 * Full credentials live in integration-types.ts — not imported here.
 * Populated from IntegrationConnection when passed as prop to RiskMitigationStatusDialog.
 */
export interface RiskIntegrationConnection {
  tool: "jira" | "azure-devops";
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