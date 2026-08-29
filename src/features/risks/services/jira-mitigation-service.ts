// ==================== JIRA MITIGATION SERVICE ====================
// Handles Jira ticket operations for Risk Mitigation tracking.
//
// Responsibilities:
//   - Fetch open tickets by issue type from Jira project
//   - Create new tickets with pre-filled threat/mitigation context
//   - Sync ticket status back into SelectedMitigation
//   - Build EARS-style description from Risk + Mitigation context
//
// Architecture:
//   All API calls go through the Electron IPC proxy (jira:request)
//   to avoid CORS. Token is always fetched from OS keychain.
//   This service is stateless — callers manage state.

import type {
  JiraCredentials,
} from "../../integration/models/integration-types";
import type {
  Risk,
} from "../models/risk-assessment-types";
import type {
  SelectedMitigation,
} from "../models/risk-mitigation-types";
import type {
  TicketSummary,
  CreateTicketInput,
  CreateTicketResult,
  TicketSyncResult,
} from "../models/risk-integration-types";
import {
  mapTicketStatusToMitigationStatus,
  mapRawStatusToTicketStatus,
} from "../models/risk-integration-types";

// Re-export for backward compatibility with dialog import
export type { TicketSummary as JiraTicketSummary };

// ==================== AUTH HELPER ====================

/**
 * Fetch token from OS keychain and build auth header.
 * Uses accountId as key (preferred) or email as fallback.
 */
const buildAuthHeader = async (
  credentials: JiraCredentials,
): Promise<Record<string, string> | null> => {
  try {
    const key = credentials.accountId || credentials.email;
    if (!key) return null;
    const result = await (window as any).electronAPI.jira.getToken(key);
    const token = result?.token;
    if (!token) return null;

    if (credentials.authMethod === "oauth") {
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    }

    if (!credentials.email) return null;
    const encoded = btoa(`${credentials.email}:${token}`);
    return {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  } catch {
    return null;
  }
};

/**
 * Execute a Jira API request via Electron IPC proxy (avoids CORS).
 */
const jiraRequest = async (
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ ok: boolean; status: number; data: any }> => {
  return (window as any).electronAPI.jiraRequest({ url, options });
};

// ==================== FETCH TICKETS ====================

/**
 * Fetch open tickets from a Jira project, filtered by issue type.
 * Uses JQL: project = X AND issueType = Y AND statusCategory != Done
 *
 * @param maxResults - cap at 50 to avoid overloading the list
 */
export const fetchJiraTickets = async (
  credentials: JiraCredentials,
  projectKey: string,
  issueType: string,
): Promise<TicketSummary[]> => {
  const headers = await buildAuthHeader(credentials);
  if (!headers) return [];

  try {
    // Build JQL — omit issuetype filter when "All" selected
    const issueTypeClause = issueType && issueType !== "__all__"
      ? ` AND issuetype = "${issueType}"`
      : "";
    const jql = `project = "${projectKey}"${issueTypeClause} AND statusCategory != Done ORDER BY updated DESC`;

    // customfield_10020 = Sprint (Jira Cloud standard — try/catch if unavailable)
    const url = `${credentials.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,issuetype,assignee,priority,customfield_10020&maxResults=50`;

    const response = await jiraRequest(url, { method: "GET", headers });
    if (!response.ok) return [];

    return (response.data?.issues ?? []).map((issue: any) => {
      // Extract active sprint name from customfield_10020 (array of sprints)
      const sprints: any[] = issue.fields?.customfield_10020 ?? [];
      const activeSprint = sprints.find((s: any) => s.state === "active") ?? sprints[0];

      return {
        key: issue.key,
        summary: issue.fields?.summary ?? "",
        status: issue.fields?.status?.name ?? "",
        ticketStatus: mapJiraStatusToTicketStatus(issue.fields?.status?.name ?? ""),
        issueType: issue.fields?.issuetype?.name ?? "",
        issueTypeIconUrl: issue.fields?.issuetype?.iconUrl,
        assignee: issue.fields?.assignee?.displayName,
        assigneeAvatarUrl: issue.fields?.assignee?.avatarUrls?.["24x24"],
        priority: issue.fields?.priority?.name,
        priorityIconUrl: issue.fields?.priority?.iconUrl,
        sprint: activeSprint?.name,
        url: `${credentials.baseUrl}/browse/${issue.key}`,
      };
    });
  } catch {
    return [];
  }
};

// ==================== CREATE TICKET ====================

/**
 * Create a new Jira issue and return the created ticket key + URL.
 */
export const createJiraTicket = async (
  credentials: JiraCredentials,
  input: CreateTicketInput,
): Promise<CreateTicketResult> => {
  const headers = await buildAuthHeader(credentials);
  if (!headers) return { success: false, error: "No valid credentials in keychain" };

  try {
    // Minimal required fields — priority and labels are optional
    // as some Jira projects/screens have them disabled
    const fields: any = {
      project: { key: input.projectKey },
      summary: input.summary,
      issuetype: { name: input.issueType },
      description: buildAtlassianDoc(input.description),
    };

    // Only add priority if provided — avoids 400 on projects without priority field
    if (input.priority) {
      fields.priority = { name: input.priority };
    }

    // Only add labels if provided and non-empty
    if (input.labels?.length) {
      fields.labels = input.labels;
    }

    const body = { fields };

    const response = await jiraRequest(
      `${credentials.baseUrl}/rest/api/3/issue`,
      { method: "POST", headers, body: JSON.stringify(body) },
    );

    if (!response.ok) {
      // Log full response for debugging
      console.error("[createJiraTicket] Failed:", response.status, JSON.stringify(response.data));
      const errors = response.data?.errors
        ? Object.entries(response.data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : response.data?.errorMessages?.[0] ?? "Unknown error";
      return { success: false, error: `Jira error ${response.status}: ${errors}` };
    }

    const key = response.data?.key;
    return {
      success: true,
      ticketId: key,
      ticketUrl: `${credentials.baseUrl}/browse/${key}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Network error" };
  }
};

// ==================== SYNC TICKET STATUS ====================

/**
 * Fetch current status for a single ticket and map to MitigationStatus.
 */
export const syncTicketStatus = async (
  credentials: JiraCredentials,
  ticketId: string,
): Promise<TicketSyncResult | null> => {
  const headers = await buildAuthHeader(credentials);
  if (!headers) return null;

  try {
    const response = await jiraRequest(
      `${credentials.baseUrl}/rest/api/3/issue/${ticketId}?fields=status`,
      { method: "GET", headers },
    );

    if (!response.ok) return null;

    const statusName: string = response.data?.fields?.status?.name ?? "";
    const ticketStatus = mapJiraStatusToTicketStatus(statusName);
    return {
      ticketId,
      ticketStatus,
      mappedMitigationStatus: mapTicketStatusToMitigationStatus(ticketStatus),
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

/**
 * Batch sync all mitigations that have a linked ticketId.
 * Returns updated mitigations — caller merges into Risk state.
 */
export const syncAllMitigationTickets = async (
  credentials: JiraCredentials,
  mitigations: SelectedMitigation[],
): Promise<SelectedMitigation[]> => {
  const withTickets = mitigations.filter((m) => !!m.ticketId);
  if (!withTickets.length) return mitigations;

  const results = await Promise.allSettled(
    withTickets.map((m) => syncTicketStatus(credentials, m.ticketId!)),
  );

  return mitigations.map((m) => {
    if (!m.ticketId) return m;
    const idx = withTickets.findIndex((wt) => wt.ticketId === m.ticketId);
    const result = results[idx];
    if (result?.status !== "fulfilled" || !result.value) return m;

    const { ticketStatus, mappedMitigationStatus, syncedAt } = result.value;
    return {
      ...m,
      ticketStatus,
      status: mappedMitigationStatus ?? m.status,
      ticketSyncedAt: syncedAt,
    };
  });
};

// ==================== DESCRIPTION BUILDER ====================

/**
 * Build a structured EARS-style description for a Jira ticket.
 *
 * EARS pattern: WHEN <context>, the system SHALL <requirement>.
 * Extended with full threat/attack/cause/verification context for traceability.
 */
export const buildTicketDescription = (
  risk: Risk,
  mitigation: SelectedMitigation,
  mitigationText: string,
): string => {
  const lines: string[] = [];

  lines.push("*Security Threat Mitigation*");
  lines.push("----");
  lines.push("");

  // Threat context
  lines.push(`*Threat:* ${risk.threatDisplayId} — ${risk.threatDescription ?? ""}`);
  if (risk.attackDescription) {
    lines.push(`*Attack:* ${risk.attackDescription}`);
  }
  if (risk.causeDescription) {
    lines.push(`*Cause:* ${risk.causeDescription}`);
  }

  lines.push("");

  // Risk scores
  const before = risk.calculatedRiskBeforeMitigation?.toFixed(1) ?? "–";
  const after = risk.calculatedRiskAfterMitigation?.toFixed(1) ?? "–";
  lines.push(`*Risk Score:* Before: ${before} | After: ${after}`);

  lines.push("");
  lines.push("----");
  lines.push("");

  // EARS-style mitigation requirement
  lines.push("*Mitigation Required (EARS):*");
  lines.push("");
  if (mitigation.id) {
    // EARS: WHEN <attack>, the system SHALL <mitigation>
    const attackContext = risk.attackDescription
      ? `WHEN ${risk.attackDescription.toLowerCase()},`
      : "WHEN this threat scenario occurs,";
    lines.push(
      `${attackContext} the system SHALL ${mitigationText.toLowerCase()}.`,
    );
  } else {
    lines.push(mitigationText);
  }

  if (mitigation.notes) {
    lines.push("");
    lines.push(`_Note: ${mitigation.notes}_`);
  }

  // Verifications
  if (risk.proposedVerifications?.length) {
    lines.push("");
    lines.push("----");
    lines.push("");
    lines.push("*Verification Criteria:*");
    for (const v of risk.proposedVerifications) {
      const label = v.isCustom
        ? v.notes ?? ""
        : v.text
          ? `${v.id}: ${v.text}`
          : v.id ?? "";
      lines.push(`* ✓ ${label}`);
    }
  }

  lines.push("");
  lines.push("----");
  lines.push(`_Generated by TARAflow — Risk ID: ${risk.id}_`);

  return lines.join("\n");
};

/**
 * Build a default ticket summary (title) for a new Jira issue.
 */
export const buildTicketSummary = (
  risk: Risk,
  mitigationText: string,
): string => {
  const prefix = `Mitigation: ${mitigationText}`;
  const suffix = `[${risk.threatDisplayId}]`;
  // Jira summary max 255 chars
  const maxMid = 255 - suffix.length - 2;
  const truncated =
    prefix.length > maxMid ? `${prefix.slice(0, maxMid - 1)}…` : prefix;
  return `${truncated} ${suffix}`;
};

// ==================== HELPERS ====================

/**
 * Map raw Jira status name to internal TicketStatus.
 * Delegates to mapRawStatusToTicketStatus from risk-integration-types.
 */
const mapJiraStatusToTicketStatus = mapRawStatusToTicketStatus;

/**
 * Convert plain text description to Atlassian Document Format (ADF).
 * Preserves line breaks and *bold* markers.
 */
const buildAtlassianDoc = (text: string) => ({
  type: "doc",
  version: 1,
  content: text
    .split("\n")
    .map((line) => ({
      type: "paragraph",
      content: line.trim()
        ? [{ type: "text", text: line }]
        : [],
    })),
});