// ==================== JIRA SERVICE ====================
// Handles all interactions with Jira API

import type {
  JiraCredentials,
  JiraProject,
  ConnectionTestResult,
  TicketInfo,
  TicketStatus,
  TicketCreationResult,
} from "../models/integration-types";

// ==================== API HELPERS ====================

/**
 * Retrieve token from OS keychain via IPC bridge.
 * Uses accountId as key (stable Jira identifier).
 * Falls back to email if accountId not yet set.
 */
const getJiraTokenSecure = async (
  credentials: JiraCredentials,
): Promise<string | null> => {
  try {
    const key = credentials.accountId || credentials.email;
    if (!key) return null;
    const result = await (window as any).electronAPI.jira.getToken(key);
    return result?.token ?? null;
  } catch {
    return null;
  }
};

/**
 * Create authorization header for Jira API.
 * Token is always fetched from OS keychain — never from credentials object.
 */
const createAuthHeader = async (
  credentials: JiraCredentials,
): Promise<Record<string, string> | null> => {
  if (credentials.authMethod === "oauth") {
    const token = await getJiraTokenSecure(credentials);
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  // PAT: Basic Auth (email:token)
  const token = await getJiraTokenSecure(credentials);
  if (!credentials.email || !token) return null;
  const encoded = btoa(`${credentials.email}:${token}`);
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

/**
 * Map Jira issue status to our TicketStatus
 */
const mapIssueStatus = (statusName: string): TicketStatus => {
  const lowerStatus = statusName.toLowerCase();
  if (
    lowerStatus.includes("open") ||
    lowerStatus.includes("to do") ||
    lowerStatus.includes("backlog")
  )
    return "OPEN";
  if (
    lowerStatus.includes("progress") ||
    lowerStatus.includes("doing") ||
    lowerStatus.includes("development")
  )
    return "IN_PROGRESS";
  if (
    lowerStatus.includes("review") ||
    lowerStatus.includes("testing") ||
    lowerStatus.includes("qa")
  )
    return "REVIEW";
  if (lowerStatus.includes("done") || lowerStatus.includes("closed"))
    return "CLOSED";
  return "UNKNOWN";
};

/**
 * Map priority string to Jira priority ID
 */
const mapPriorityToId = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    Highest: "1",
    High: "2",
    Medium: "3",
    Low: "4",
    Lowest: "5",
  };
  return priorityMap[priority] || "3"; // Default to Medium
};

// ==================== PUBLIC API ====================

/**
 * Test connection to Jira and fetch available projects.
 * Also resolves accountId from /rest/api/3/myself for stable keychain key.
 */
export const testJiraConnection = async (
  credentials: JiraCredentials & { apiToken?: string },
): Promise<ConnectionTestResult & { accountId?: string }> => {
  try {
    // Build headers manually for test — token comes from param, not keychain yet
    let headers: Record<string, string> | null = null;
    if (credentials.authMethod === "oauth") {
      const token = credentials.accessToken;
      if (!token) return { success: false, message: "No OAuth token provided" };
      headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    } else {
      const { email, apiToken } = credentials;
      if (!email || !apiToken) {
        return {
          success: false,
          message: "Invalid credentials: Check your email and API token",
        };
      }
      const encoded = btoa(`${email}:${apiToken}`);
      headers = {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    }

    // Resolve accountId from /myself
    let accountId: string | undefined;
    try {
      const myselfResponse = await (window as any).electronAPI.jiraRequest({
        url: `${credentials.baseUrl}/rest/api/3/myself`,
        options: { method: "GET", headers },
      });
      if (myselfResponse.ok && myselfResponse.data?.accountId) {
        accountId = myselfResponse.data.accountId;
      }
    } catch {
      // Non-fatal — accountId stays undefined, fall back to email as keychain key
    }

    // Fetch projects with rich details
    const response = await (window as any).electronAPI.jiraRequest({
      url: `${credentials.baseUrl}/rest/api/3/project?expand=insight,description,lead,issueTypes`,
      options: { method: "GET", headers },
    });

    if (!response.ok) {
      const errorDetail = response.data?.errorMessages?.[0] || "Unknown Error";
      return {
        success: false,
        message: `Connection failed: ${response.status} - ${errorDetail}`,
      };
    }

    const data = response.data;
    if (!Array.isArray(data)) {
      return {
        success: false,
        message: "Unexpected response format from Jira",
      };
    }

    const projects: JiraProject[] = data.map((proj: any) => ({
      id: proj.id,
      key: proj.key,
      name: proj.name,
      projectTypeKey: proj.projectTypeKey,
      description: proj.description || undefined,
      avatarUrl: proj.avatarUrls?.["48x48"] || undefined,
      lead: proj.lead
        ? {
            displayName: proj.lead.displayName,
            avatarUrl: proj.lead.avatarUrls?.["24x24"] || undefined,
          }
        : undefined,
      insight: proj.insight
        ? {
            totalIssueCount: proj.insight.totalIssueCount ?? 0,
            lastIssueUpdateTime: proj.insight.lastIssueUpdateTime || undefined,
          }
        : undefined,
      issueTypes: proj.issueTypes
        ? proj.issueTypes
            .filter((it: any) => !it.subtask)
            .map((it: any) => ({
              id: it.id,
              name: it.name,
              iconUrl: it.iconUrl || undefined,
            }))
        : undefined,
    }));

    return {
      success: true,
      message: `Connected successfully. Found ${projects.length} project(s).`,
      projects,
      accountId,
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Create an issue in Jira
 */
export const createJiraIssue = async (
  credentials: JiraCredentials,
  projectKey: string,
  issueType: string,
  title: string,
  description: string,
  priority: string,
  labels?: string[],
): Promise<TicketCreationResult> => {
  try {
    const headers = await createAuthHeader(credentials);
    if (!headers) {
      return { success: false, error: "Invalid credentials — check keychain" };
    }

    const url = `${credentials.baseUrl}/rest/api/3/issue`;

    const issueData: any = {
      fields: {
        project: { key: projectKey },
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: description }],
            },
          ],
        },
        issuetype: { name: issueType },
        priority: { id: mapPriorityToId(priority) },
      },
    };

    if (labels && labels.length > 0) {
      issueData.fields.labels = labels;
    }

    const response = await (window as any).electronAPI.jiraRequest({
      url,
      options: { method: "POST", headers, body: JSON.stringify(issueData) },
    });

    if (!response.ok) {
      const errorDetail = response.data?.errorMessages?.[0] || "Unknown error";
      return {
        success: false,
        error: `Failed to create issue: ${response.status} - ${errorDetail}`,
      };
    }

    const issue = response.data;
    const ticket: TicketInfo = {
      id: issue.key,
      url: `${credentials.baseUrl}/browse/${issue.key}`,
      status: "OPEN",
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, ticket };
  } catch (error) {
    return {
      success: false,
      error: `Error creating issue: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Get issue details from Jira
 */
const getJiraIssueDetails = async (
  credentials: JiraCredentials,
  issueKey: string,
): Promise<{ status: TicketStatus } | null> => {
  try {
    const headers = await createAuthHeader(credentials);
    if (!headers) return null;

    const response = await (window as any).electronAPI.jiraRequest({
      url: `${credentials.baseUrl}/rest/api/3/issue/${issueKey}`,
      options: { method: "GET", headers },
    });

    if (!response.ok) return null;
    return {
      status: mapIssueStatus(response.data?.fields?.status?.name ?? ""),
    };
  } catch (error) {
    console.error("Error fetching issue details:", error);
    return null;
  }
};

/**
 * Get issue status from Jira
 */
export const getJiraIssueStatus = async (
  credentials: JiraCredentials,
  issueKey: string,
): Promise<TicketStatus> => {
  try {
    const details = await getJiraIssueDetails(credentials, issueKey);
    return details?.status || "UNKNOWN";
  } catch (error) {
    console.error("Error fetching issue status:", error);
    return "UNKNOWN";
  }
};

/**
 * Batch fetch issue statuses
 */
export const getJiraIssueStatuses = async (
  credentials: JiraCredentials,
  issueKeys: string[],
): Promise<Map<string, TicketStatus>> => {
  const statusMap = new Map<string, TicketStatus>();
  if (issueKeys.length === 0) return statusMap;

  try {
    const headers = await createAuthHeader(credentials);
    if (!headers) return statusMap;

    const jql = `key in (${issueKeys.join(",")})`;
    const response = await (window as any).electronAPI.jiraRequest({
      url: `${credentials.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=status`,
      options: { method: "GET", headers },
    });

    if (!response.ok) return statusMap;

    (response.data?.issues ?? []).forEach((issue: any) => {
      statusMap.set(issue.key, mapIssueStatus(issue.fields.status.name));
    });
  } catch (error) {
    console.error("Error fetching issue statuses:", error);
  }

  return statusMap;
};