import { useState, useCallback } from "react";
import type {
  ConnectionTestResult,
  IntegrationTabData,
  IntegrationTool,
  IntegrationConnection,
  AzureDevOpsCredentials,
  JiraCredentials,
} from "../models/integration-types";
import * as integrationService from "../services/integration-service";

export const useIntegrationConnection = (
  data: IntegrationTabData,
  onUpdate: (data: IntegrationTabData) => void
) => {
  const [activeToolTab, setActiveToolTab] = useState<IntegrationTool>(
    data.integration?.connection?.tool || "azure-devops"
  );

  const currentConnection = data.integration?.connection;
  const isConnected =
    currentConnection?.status === "connected" &&
    currentConnection.tool === activeToolTab;

  const handleAdoCredentialsChange = useCallback(
    (credentials: AzureDevOpsCredentials) => {
      const newConnection: IntegrationConnection = {
        tool: "azure-devops",
        status: "disconnected",
        credentials,
        lastTested: new Date().toISOString(),
      };

      onUpdate({
        integration: {
          connection: newConnection,
          mapping: integrationService.getDefaultMapping("azure-devops"),
          lastSync: data.integration?.lastSync,
        },
      });
    },
    [data.integration, onUpdate]
  );

  const handleAdoProjectSelect = useCallback(
    (projectName: string) => {
      if (!currentConnection || currentConnection.tool !== "azure-devops") return;

      onUpdate({
        integration: {
          connection: { ...currentConnection, status: "connected", projectName },
          mapping: data.integration?.mapping ?? null,
          lastSync: data.integration?.lastSync,
        },
      });
    },
    [currentConnection, data.integration, onUpdate]
  );

  const handleAdoTestConnection = useCallback(
    async (credentials: AzureDevOpsCredentials) => {
      const result = await integrationService.testConnection("azure-devops", credentials);

      if (result.success) {
        onUpdate({
          integration: {
            connection: {
              tool: "azure-devops",
              status: "connected",
              credentials,
              lastTested: new Date().toISOString(),
            },
            mapping: integrationService.getDefaultMapping("azure-devops"),
            lastSync: data.integration?.lastSync,
          },
        });
      }

      return result;
    },
    [data.integration, onUpdate]
  );

  // Handle Jira credentials change
  const handleJiraCredentialsChange = useCallback(
    (credentials: JiraCredentials) => {
      const newConnection: IntegrationConnection = {
        tool: "jira",
        status: "disconnected",
        credentials,
        lastTested: new Date().toISOString(),
      };

      onUpdate({
        integration: {
          ...data.integration,
          connection: newConnection,
          mapping: integrationService.getDefaultMapping("jira"),
        },
      });
    },
    [data.integration, onUpdate]
  );

  // Handle Jira project selection
  const handleJiraProjectSelect = useCallback(
    (projectKey: string) => {
      if (!currentConnection || currentConnection.tool !== "jira") return;

      const updatedCredentials = {
        ...(currentConnection.credentials as JiraCredentials),
        projectKey,
      };

      const updatedConnection: IntegrationConnection = {
        ...currentConnection,
        status: "connected",
        credentials: updatedCredentials,
        projectName: projectKey,
      };

      onUpdate({
        integration: {
          connection: updatedConnection,
          mapping: data.integration?.mapping ?? null,
          lastSync: data.integration?.lastSync,
        },
      });
    },
    [currentConnection, data.integration, onUpdate]
  );

  // Handle Jira connection test
  const handleJiraTestConnection = useCallback(
    async (
      credentials: JiraCredentials & { apiToken?: string },
    ): Promise<ConnectionTestResult> => {
      const result = (await integrationService.testConnection(
        "jira",
        credentials,
      )) as any;

      if (result.success) {
        // Save token in OS keychain using accountId (preferred) or email as fallback
        const keychainKey = result.accountId || credentials.email;
        if (keychainKey && credentials.apiToken) {
          try {
            await (window as any).electronAPI.jira.saveToken(
              keychainKey,
              credentials.apiToken,
            );
          } catch {
            // Keychain not available in browser mode
          }
        }

        // Strip apiToken, store accountId in credentials
        const { apiToken: _token, ...safeCredentials } = credentials as any;
        const persistedCredentials: JiraCredentials = {
          ...safeCredentials,
          accountId: result.accountId,
        };

        const newConnection: IntegrationConnection = {
          tool: "jira",
          status: "connected",
          credentials: persistedCredentials,
          lastTested: new Date().toISOString(),
        };

        onUpdate({
          integration: {
            ...data.integration,
            connection: newConnection,
            mapping: integrationService.getDefaultMapping("jira"),
          },
        });
      }

      return result;
    },
    [data.integration, onUpdate],
  );

  return {
    activeToolTab,
    setActiveToolTab,
    currentConnection,
    isConnected,
    handleAdoCredentialsChange,
    handleAdoProjectSelect,
    handleAdoTestConnection,
    handleJiraCredentialsChange,
    handleJiraProjectSelect,
    handleJiraTestConnection,
  };
};