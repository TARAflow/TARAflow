// ==================== INTEGRATION SERVICE ====================
// Facade service for external ticketing system integration

import type {
  IntegrationTool,
  IntegrationConnection,
  ToolCredentials,
  AzureDevOpsCredentials,
  JiraCredentials,
  ConnectionTestResult,
  TicketCreationResult,
  TicketStatus,
  ExternalProject,
} from "../models/integration-types";

import * as adoService from "./ado-service";
import * as jiraService from "./jira-service";

// ==================== CONNECTION MANAGEMENT ====================

/**
 * Test connection to the specified tool
 */
export const testConnection = async (
  tool: IntegrationTool,
  credentials: ToolCredentials
): Promise<ConnectionTestResult> => {
  switch (tool) {
    case "azure-devops":
      return adoService.testAdoConnection(credentials as AzureDevOpsCredentials);
    case "jira":
      return jiraService.testJiraConnection(credentials as JiraCredentials);
    default:
      return {
        success: false,
        message: `Unknown tool: ${tool}`,
      };
  }
};

/**
 * Validate connection status
 */
export const validateConnection = (
  connection: IntegrationConnection | null
): boolean => {
  if (!connection) return false;
  if (connection.status !== "connected") return false;
  if (!connection.credentials) return false;
  return true;
};

// ==================== TICKET OPERATIONS ====================

/**
 * Create a ticket in the external system
 */
export const createTicket = async (
  connection: IntegrationConnection,
  title: string,
  description: string,
  priority: string,
  workItemType: string,
  tags?: string[]
): Promise<TicketCreationResult> => {
  if (!validateConnection(connection)) {
    return {
      success: false,
      error: "No valid connection established",
    };
  }

  const projectName = connection.projectName || "";

  switch (connection.tool) {
    case "azure-devops":
      return adoService.createAdoWorkItem(
        connection.credentials as AzureDevOpsCredentials,
        projectName,
        workItemType,
        title,
        description,
        priority,
        tags
      );

    case "jira":
      return jiraService.createJiraIssue(
        connection.credentials as JiraCredentials,
        projectName,
        workItemType,
        title,
        description,
        priority,
        tags
      );

    default:
      return {
        success: false,
        error: `Unknown tool: ${connection.tool}`,
      };
  }
};

/**
 * Get ticket status
 */
export const getTicketStatus = async (
  connection: IntegrationConnection,
  ticketId: string
): Promise<TicketStatus> => {
  if (!validateConnection(connection)) {
    return "UNKNOWN";
  }

  switch (connection.tool) {
    case "azure-devops":
      return adoService.getAdoWorkItemStatus(
        connection.credentials as AzureDevOpsCredentials,
        ticketId
      );

    case "jira":
      return jiraService.getJiraIssueStatus(
        connection.credentials as JiraCredentials,
        ticketId
      );

    default:
      return "UNKNOWN";
  }
};

/**
 * Batch get ticket statuses
 */
export const getTicketStatuses = async (
  connection: IntegrationConnection,
  ticketIds: string[]
): Promise<Map<string, TicketStatus>> => {
  if (!validateConnection(connection)) {
    return new Map();
  }

  switch (connection.tool) {
    case "azure-devops":
      return adoService.getAdoWorkItemStatuses(
        connection.credentials as AzureDevOpsCredentials,
        ticketIds
      );

    case "jira":
      return jiraService.getJiraIssueStatuses(
        connection.credentials as JiraCredentials,
        ticketIds
      );

    default:
      return new Map();
  }
};

// ==================== PROJECT HELPERS ====================

/**
 * Format project display name
 */
export const formatProjectName = (project: ExternalProject): string => {
  if ("key" in project) {
    // Jira project
    return `${project.key} - ${project.name}`;
  }
  // ADO project
  return project.name;
};

/**
 * Get project identifier (ID or Key)
 */
export const getProjectIdentifier = (project: ExternalProject): string => {
  if ("key" in project) {
    return project.key; // Jira uses project key
  }
  return project.name; // ADO uses project name
};

// ==================== URL HELPERS ====================

/**
 * Get ticket URL based on tool and ticket ID
 */
export const getTicketUrl = (
  connection: IntegrationConnection,
  ticketId: string
): string => {
  if (!connection.credentials) return "";

  switch (connection.tool) {
    case "azure-devops": {
      const creds = connection.credentials as AzureDevOpsCredentials;
      const projectName = connection.projectName || "";
      return `${creds.organizationUrl}/${projectName}/_workitems/edit/${ticketId}`;
    }

    case "jira": {
      const creds = connection.credentials as JiraCredentials;
      return `${creds.baseUrl}/browse/${ticketId}`;
    }

    default:
      return "";
  }
};

/**
 * Open ticket in browser
 */
export const openTicketInBrowser = (url: string): void => {
  if (typeof window !== "undefined" && window.electron) {
    // Use Electron's shell to open URL
    window.electron.shell.openExternal(url);
  } else {
    // Fallback for web
    window.open(url, "_blank");
  }
};

// ==================== DEFAULT VALUES ====================

/**
 * Get default ticket mapping for a tool
 */
export const getDefaultMapping = (tool: IntegrationTool) => {
  switch (tool) {
    case "azure-devops":
      return {
        mustPriority: "1",
        shouldPriority: "2",
        couldPriority: "3",
        wontPriority: "4",
        workItemType: "Bug",
        defaultLabels: ["security", "threat-model"],
      };

    case "jira":
      return {
        mustPriority: "High",
        shouldPriority: "Medium",
        couldPriority: "Low",
        wontPriority: "Lowest",
        workItemType: "Task",
        defaultLabels: ["security", "threat-model"],
      };

    default:
      return null;
  }
};