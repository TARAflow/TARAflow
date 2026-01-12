// ==================== AZURE DEVOPS SERVICE ====================
// Handles all interactions with Azure DevOps API

import type {
  AzureDevOpsCredentials,
  AzureDevOpsProject,
  ConnectionTestResult,
  TicketInfo,
  TicketStatus,
  TicketCreationResult,
} from "../models/integration-types";

// ==================== API HELPERS ====================

/**
 * Create authorization header for ADO API
 */
const createAuthHeader = (pat: string): Record<string, string> => {
  const encoded = btoa(`:${pat}`);
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
};

/**
 * Extract organization name from URL
 */
const extractOrgName = (url: string): string | null => {
  const match = url.match(/dev\.azure\.com\/([^/]+)/);
  return match ? match[1] : null;
};

/**
 * Map ADO work item state to our TicketStatus
 */
const mapWorkItemState = (state: string): TicketStatus => {
  const lowerState = state.toLowerCase();
  if (lowerState.includes("new") || lowerState.includes("open")) return "OPEN";
  if (lowerState.includes("active") || lowerState.includes("progress"))
    return "IN_PROGRESS";
  if (lowerState.includes("review") || lowerState.includes("resolved"))
    return "REVIEW";
  if (lowerState.includes("closed") || lowerState.includes("done"))
    return "CLOSED";
  return "UNKNOWN";
};

const getAuthToken = (credentials: AzureDevOpsCredentials): string | null => {
  return credentials.authMethod === "oauth"
    ? credentials.accessToken || null
    : credentials.personalAccessToken || null;
};

// ==================== PUBLIC API ====================

/**
 * Test connection to Azure DevOps and fetch available projects
 */
export const testAdoConnection = async (
  credentials: AzureDevOpsCredentials
): Promise<ConnectionTestResult> => {
  try {
    const orgName = extractOrgName(credentials.organizationUrl);
    if (!orgName) {
      return {
        success: false,
        message: "Invalid organization URL",
      };
    }

    const token = getAuthToken(credentials);
    if (!token) {
      return { success: false, message: "No authentication token available" };
    }

    const url = `${credentials.organizationUrl}/_apis/projects?api-version=7.0`;
    const response = await fetch(url, {
      method: "GET",
      headers: createAuthHeader(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Connection failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    const projects: AzureDevOpsProject[] = data.value.map((proj: any) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      url: proj.url,
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
 * Create a work item in Azure DevOps
 */
export const createAdoWorkItem = async (
  credentials: AzureDevOpsCredentials,
  projectName: string,
  workItemType: string,
  title: string,
  description: string,
  priority: string,
  tags?: string[]
): Promise<TicketCreationResult> => {
  try {

    const token = getAuthToken(credentials);
    if (!token) {
      return { success: false, error: "No authentication token available" };
    }

    if (!credentials.projectName) {
      return {
        success: false,
        error: "No project selected",
      };
    }

    const url = `${credentials.organizationUrl}/${projectName}/_apis/wit/workitems/$${workItemType}?api-version=7.0`;

    // Build the patch document for work item creation
    const patchDocument = [
      {
        op: "add",
        path: "/fields/System.Title",
        value: title,
      },
      {
        op: "add",
        path: "/fields/System.Description",
        value: description,
      },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: priority,
      },
    ];

    // Add tags if provided
    if (tags && tags.length > 0) {
      patchDocument.push({
        op: "add",
        path: "/fields/System.Tags",
        value: tags.join("; "),
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...createAuthHeader(token),
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(patchDocument),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to create work item: ${response.status} - ${errorText}`,
      };
    }

    const workItem = await response.json();

    const ticket: TicketInfo = {
      id: workItem.id.toString(),
      url: workItem._links.html.href,
      status: mapWorkItemState(workItem.fields["System.State"]),
      title: workItem.fields["System.Title"],
      createdAt: workItem.fields["System.CreatedDate"],
      updatedAt: workItem.fields["System.ChangedDate"],
    };

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error creating work item: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Get work item status from Azure DevOps
 */
export const getAdoWorkItemStatus = async (
  credentials: AzureDevOpsCredentials,
  workItemId: string
): Promise<TicketStatus> => {
  try {
    const url = `${credentials.organizationUrl}/_apis/wit/workitems/${workItemId}?api-version=7.0`;

    const token = getAuthToken(credentials);
    if (!token) {
      return  "UNKNOWN" ;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: createAuthHeader(token),
    });

    if (!response.ok) {
      return "UNKNOWN";
    }

    const workItem = await response.json();
    return mapWorkItemState(workItem.fields["System.State"]);
  } catch (error) {
    console.error("Error fetching work item status:", error);
    return "UNKNOWN";
  }
};

/**
 * Batch fetch work item statuses
 */
export const getAdoWorkItemStatuses = async (
  credentials: AzureDevOpsCredentials,
  workItemIds: string[]
): Promise<Map<string, TicketStatus>> => {
  const statusMap = new Map<string, TicketStatus>();

  if (workItemIds.length === 0) return statusMap;

  try {
    // ADO supports batch queries with comma-separated IDs
    const ids = workItemIds.join(",");
    const url = `${credentials.organizationUrl}/_apis/wit/workitems?ids=${ids}&api-version=7.0`;

    const token = getAuthToken(credentials);
    if (!token) {
      return statusMap;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: createAuthHeader(token),
    });

    if (!response.ok) {
      return statusMap;
    }

    const data = await response.json();
    data.value.forEach((workItem: any) => {
      statusMap.set(
        workItem.id.toString(),
        mapWorkItemState(workItem.fields["System.State"])
      );
    });
  } catch (error) {
    console.error("Error fetching work item statuses:", error);
  }

  return statusMap;
};