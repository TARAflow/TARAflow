// ==================== OAUTH INTEGRATION HOOK ====================
// React hook for handling OAuth flow in UI components

import { useState, useEffect, useCallback } from "react";
import * as adoOAuth from "../services/oauth-ado-service";
import * as jiraOAuth from "../services/oauth-jira-service";
import type {
  IntegrationTool,
  AzureDevOpsCredentials,
  JiraCredentials,
} from "../models/integration-types";
import type { OAuthCallbackData } from "../../../global";

// ==================== TYPES ====================
// TypeScript declaration for Electron API

interface UseOAuthFlowOptions {
  tool: IntegrationTool;
  onSuccess: (credentials: AzureDevOpsCredentials | JiraCredentials) => void;
  onError: (error: string) => void;
}

// ==================== HOOK ====================

export const useOAuthFlow = ({
  tool,
  onSuccess,
  onError,
}: UseOAuthFlowOptions) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Handle OAuth callback from Electron
  useEffect(() => {
    if (typeof window === "undefined" || !window.electron?.oauth) {
      return;
    }

    const oauth = window.electron.oauth; 

    const handleCallback = async (data: OAuthCallbackData) => {
      if (data.error) {
        const errorMsg = data.errorDescription || data.error;
        setAuthError(errorMsg);
        onError(errorMsg);
        setIsAuthenticating(false);
        return;
      }

      if (!data.code || !data.state) {
        setAuthError("Invalid OAuth callback");
        onError("Invalid OAuth callback");
        setIsAuthenticating(false);
        return;
      }

      try {
        let result;

        if (tool === "azure-devops") {
          result = await adoOAuth.completeOAuthFlow(data.code, data.state);
        } else {
          result = await jiraOAuth.completeOAuthFlow(data.code, data.state);
        }

        if (result.success && result.credentials) {
          onSuccess(result.credentials);
          setAuthError(null);
        } else {
          setAuthError(result.error || "OAuth flow failed");
          onError(result.error || "OAuth flow failed");
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "OAuth flow failed";
        setAuthError(errorMsg);
        onError(errorMsg);
      } finally {
        setIsAuthenticating(false);
      }
    };

    oauth.onCallback(handleCallback);

    return () => {
      oauth.removeCallback();
    };
  }, [tool, onSuccess, onError]);

  // Start OAuth flow
  const startOAuthFlow = useCallback(
    async (url: string) => {
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        let result;

        if (tool === "azure-devops") {
          result = await adoOAuth.startOAuthFlow(url);
        } else {
          result = await jiraOAuth.startOAuthFlow(url);
        }

        if (!result.success) {
          setAuthError(result.error || "Failed to start OAuth");
          onError(result.error || "Failed to start OAuth");
          setIsAuthenticating(false);
        }

        // Don't set isAuthenticating to false here
        // It will be set after callback is received
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to start OAuth";
        setAuthError(errorMsg);
        onError(errorMsg);
        setIsAuthenticating(false);
      }
    },
    [tool, onError]
  );

  // Disconnect (clear tokens)
  const disconnect = useCallback(() => {
    setAuthError(null);
    setIsAuthenticating(false);
  }, []);

  return {
    isAuthenticating,
    authError,
    startOAuthFlow,
    disconnect,
  };
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if OAuth is properly configured
 */
export const isOAuthConfigured = (tool: IntegrationTool): boolean => {
  // Check if Electron OAuth handlers are available
  if (typeof window === "undefined" || !window.electron?.oauth) {
    return false;
  }

  // Check if client IDs are configured (in production, read from env/config)
  // For now, we assume they will be configured
  return true;
};

/**
 * Get OAuth configuration status message
 */
export const getOAuthConfigMessage = (tool: IntegrationTool): string => {
  if (!isOAuthConfigured(tool)) {
    return "OAuth is not configured. Please set up OAuth credentials in settings.";
  }
  return "";
};

// ==================== TYPE DECLARATIONS ====================
