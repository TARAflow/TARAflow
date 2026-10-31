// ==================== INTEGRATION TYPES ====================
// The issue-tracker connection as stored in the project (`project.integration`)
// — never a secret: the token lives in the OS keychain of the main process,
// bound to tool + host + account (adapters design
// doc/InProgress/Integration/issue-tracker-adapters.md §3.1). Tracker
// descriptions: shared/models/issue-trackers.ts.

import type { IssueTrackerId } from "shared/models/issue-trackers";

export type { TicketStatus } from "shared/models/ticket-types";

export type IntegrationTool = IssueTrackerId;

export type ConnectionStatus = "disconnected" | "connected" | "error" | "testing";

/** Only tokens / personal access tokens (OAuth removed, design §3.4). */
export type AuthMethod = "pat";

/** What the project stores about a connection — no secret (prepareForDisk strips any). */
export interface TrackerCredentials {
  /** Older files may carry "oauth"; such a connection needs a new connection test. */
  authMethod?: string;
  /** The tracker's https origin (the token is bound to it). */
  baseUrl: string;
  /** The user the token belongs to (Jira Cloud: e-mail); absent for token-only trackers. */
  email?: string;
  /** Tracker-side account id (Jira), for display. */
  accountId?: string;
  /** Selected project. */
  projectKey?: string;
}

/** Kept for the Risk tab until IT-3 moves it onto the adapter. */
export type JiraCredentials = TrackerCredentials;

export interface IntegrationConnection {
  tool: IntegrationTool;
  status: ConnectionStatus;
  credentials: TrackerCredentials | null;
  lastTested?: string; // ISO timestamp
  lastError?: string;
  projectId?: string;
  projectName?: string;
  /** Issue types of the chosen project, for creating tickets (no secret). */
  issueTypes?: IssueType[];
}

export interface IssueType {
  id: string;
  name: string;
  iconUrl?: string;
}

/** A tracker project as shown on the project cards. */
export interface TrackerProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
  description?: string;
  avatarUrl?: string;
  lead?: { displayName: string; avatarUrl?: string };
  insight?: { totalIssueCount: number; lastIssueUpdateTime?: string };
  issueTypes?: IssueType[];
}

/** Kept for the Risk tab until IT-3. */
export type JiraProject = TrackerProject;

export interface TicketMapping {
  mustPriority: string;
  shouldPriority: string;
  couldPriority: string;
  wontPriority: string;
  workItemType: string; // e.g. "Task", "Bug", "Story"
  defaultAssignee?: string;
  defaultLabels?: string[];
  defaultTags?: string[];
}

export interface IntegrationData {
  connection: IntegrationConnection | null;
  mapping: TicketMapping | null;
  lastSync?: string; // ISO timestamp of last sync
}

/** Default ticket mapping of a new connection. */
export function defaultTicketMapping(_tool: IntegrationTool): TicketMapping {
  return {
    mustPriority: "High",
    shouldPriority: "Medium",
    couldPriority: "Low",
    wontPriority: "Lowest",
    workItemType: "Task",
    defaultLabels: ["security", "threat-model"],
  };
}

// ==================== COMPONENT PROPS ====================

export interface IntegrationTabData {
  integration: IntegrationData | null;
}

export interface IntegrationTabProps {
  data: IntegrationTabData;
  onUpdate: (data: IntegrationTabData) => void;
}
