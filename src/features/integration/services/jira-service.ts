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

const getAuthToken = (credentials: JiraCredentials): string | null => {
  return credentials.authMethod === "oauth"
    ? credentials.accessToken || null
    : credentials.apiToken || null;
};

/**
 * Create authorization header for Jira API
 */
const createAuthHeader = (credentials: JiraCredentials): Record<string, string> | null => {
  if (credentials.authMethod === "oauth") {
    // OAuth: Bearer Token
    const token = credentials.accessToken;
    if (!token) return null;
    
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  } else {
    // PAT: Basic Auth (email:token)
    const { email, apiToken } = credentials;
    if (!email || !apiToken) return null;
    
    const encoded = btoa(`${email}:${apiToken}`);
    return {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }
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
 * Test connection to Jira and fetch available projects
 */
export const testJiraConnection = async (
  credentials: JiraCredentials
): Promise<ConnectionTestResult> => {
  try {
    const headers = createAuthHeader(credentials);
    if (!headers) {
      return {
        success: false,
        message: "Invalid credentials",
      };
    }

    const url = `${credentials.baseUrl}/rest/api/3/project`;
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Connection failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    const projects: JiraProject[] = data.map((proj: any) => ({
      id: proj.id,
      key: proj.key,
      name: proj.name,
      projectTypeKey: proj.projectTypeKey,
    }));

    return {
      success: true,
      message: `Connected successfully. Found ${projects.length} project(s).`,
      projects,
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
  labels?: string[]
): Promise<TicketCreationResult> => {
  try {
    if (!credentials.projectKey) {
      return {
        success: false,
        error: "No project selected",
      };
    }

    const url = `${credentials.baseUrl}/rest/api/3/issue`;

    // Build the issue creation payload
    const issueData = {
      fields: {
        project: {
          key: projectKey,
        },
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description,
                },
              ],
            },
          ],
        },
        issuetype: {
          name: issueType,
        },
        priority: {
          id: mapPriorityToId(priority),
        },
      },
    };

    // Add labels if provided
    if (labels && labels.length > 0) {
      (issueData.fields as any).labels = labels;
    }

    const headers = createAuthHeader(credentials);
    if (!headers) {
      return {
        success: false,
        error: "Invalid credentials",
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(issueData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to create issue: ${response.status} - ${errorText}`,
      };
    }

    const issue = await response.json();

    // Fetch full issue details to get status
    const issueDetails = await getJiraIssueDetails(credentials, issue.key);

    const ticket: TicketInfo = {
      id: issue.key,
      url: `${credentials.baseUrl}/browse/${issue.key}`,
      status: issueDetails?.status || "OPEN",
      title: title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      ticket,
    };
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
  issueKey: string
): Promise<{ status: TicketStatus } | null> => {
  try {
    const url = `${credentials.baseUrl}/rest/api/3/issue/${issueKey}`;

    const headers = createAuthHeader(credentials);
    if (!headers) {
      return {
        status: mapIssueStatus("Invalid credentials"),
      };
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const issue = await response.json();
    return {
      status: mapIssueStatus(issue.fields.status.name),
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
  issueKey: string
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
  issueKeys: string[]
): Promise<Map<string, TicketStatus>> => {
  const statusMap = new Map<string, TicketStatus>();

  if (issueKeys.length === 0) return statusMap;

  const headers = createAuthHeader(credentials);
  if (!headers) {
    return statusMap;
  }

  try {
    // Jira JQL search for multiple issues
    const jql = `key in (${issueKeys.join(",")})`;
    const url = `${credentials.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=status`;

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return statusMap;
    }

    const data = await response.json();
    data.issues.forEach((issue: any) => {
      statusMap.set(issue.key, mapIssueStatus(issue.fields.status.name));
    });
  } catch (error) {
    console.error("Error fetching issue statuses:", error);
  }

  return statusMap;
};