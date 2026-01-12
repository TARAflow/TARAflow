// ==================== JIRA OAUTH SERVICE ====================
// Handles OAuth 2.0 authentication flow for Jira (Atlassian)

import type { JiraCredentials } from "../models/integration-types";

// ==================== OAUTH CONFIGURATION ====================

const OAUTH_CONFIG = {
  clientId: "", // Set via environment or settings
  clientSecret: "", // Required for Jira OAuth
  redirectUri: "coretm://auth/callback",
  scopes: "read:jira-work write:jira-work offline_access",
  authorizeUrl: "https://auth.atlassian.com/authorize",
  tokenUrl: "https://auth.atlassian.com/oauth/token",
  cloudIdUrl: "https://api.atlassian.com/oauth/token/accessible-resources",
};

// ==================== TYPES ====================

export interface JiraOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface JiraCloudResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

export interface OAuthStartResult {
  success: boolean;
  authUrl?: string;
  error?: string;
}

export interface OAuthCompleteResult {
  success: boolean;
  credentials?: JiraCredentials;
  error?: string;
}

// ==================== PKCE HELPERS ====================

const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
};

const base64UrlEncode = (buffer: Uint8Array): string => {
  const binary = new TextDecoder("latin1").decode(buffer);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const generateState = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

// ==================== OAUTH FLOW ====================

/**
 * Start OAuth flow for Jira
 */
export const startOAuthFlow = async (
  baseUrl: string,
  clientId?: string
): Promise<OAuthStartResult> => {
  try {
    const actualClientId = clientId || OAUTH_CONFIG.clientId;
    if (!actualClientId) {
      return {
        success: false,
        error: "OAuth Client ID not configured",
      };
    }

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store for later verification
    sessionStorage.setItem("jira_oauth_code_verifier", codeVerifier);
    sessionStorage.setItem("jira_oauth_state", state);
    sessionStorage.setItem("jira_base_url", baseUrl);

    // Build authorization URL
    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: actualClientId,
      scope: OAUTH_CONFIG.scopes,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      state: state,
      response_type: "code",
      prompt: "consent",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${OAUTH_CONFIG.authorizeUrl}?${params.toString()}`;

    // Open browser
    if (typeof window !== "undefined" && window.electron) {
      await window.electron.shell.openExternal(authUrl);
    } else {
      window.open(authUrl, "_blank");
    }

    return {
      success: true,
      authUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to start OAuth flow: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Complete OAuth flow - exchange code for tokens and get cloud ID
 */
export const completeOAuthFlow = async (
  authorizationCode: string,
  state: string,
  clientId?: string,
  clientSecret?: string
): Promise<OAuthCompleteResult> => {
  try {
    // Verify state
    const storedState = sessionStorage.getItem("jira_oauth_state");
    if (state !== storedState) {
      return {
        success: false,
        error: "Invalid state parameter - possible CSRF attack",
      };
    }

    const actualClientId = clientId || OAUTH_CONFIG.clientId;
    const actualClientSecret = clientSecret || OAUTH_CONFIG.clientSecret;

    if (!actualClientId || !actualClientSecret) {
      return {
        success: false,
        error: "OAuth credentials not configured",
      };
    }

    const codeVerifier = sessionStorage.getItem("jira_oauth_code_verifier");
    const baseUrl = sessionStorage.getItem("jira_base_url");

    if (!codeVerifier || !baseUrl) {
      return {
        success: false,
        error: "OAuth session expired",
      };
    }

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: actualClientId,
      client_secret: actualClientSecret,
      code: authorizationCode,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return {
        success: false,
        error: `Token exchange failed: ${tokenResponse.status} - ${errorText}`,
      };
    }

    const tokenData: JiraOAuthTokenResponse = await tokenResponse.json();

    // Get cloud ID (required for Jira API calls)
    const cloudIdResult = await getCloudId(tokenData.access_token);
    if (!cloudIdResult.success || !cloudIdResult.cloudId) {
      return {
        success: false,
        error: cloudIdResult.error || "Failed to get cloud ID",
      };
    }

    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const credentials: JiraCredentials = {
      authMethod: "oauth",
      baseUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      cloudId: cloudIdResult.cloudId,
      expiresAt,
    };

    // Clean up
    sessionStorage.removeItem("jira_oauth_code_verifier");
    sessionStorage.removeItem("jira_oauth_state");
    sessionStorage.removeItem("jira_base_url");

    return {
      success: true,
      credentials,
    };
  } catch (error) {
    return {
      success: false,
      error: `OAuth completion failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Get Atlassian Cloud ID from access token
 */
const getCloudId = async (
  accessToken: string
): Promise<{ success: boolean; cloudId?: string; error?: string }> => {
  try {
    const response = await fetch(OAUTH_CONFIG.cloudIdUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to get cloud ID: ${response.status}`,
      };
    }

    const resources: JiraCloudResource[] = await response.json();

    if (resources.length === 0) {
      return {
        success: false,
        error: "No accessible Jira sites found",
      };
    }

    // Use first accessible resource
    // TODO: In future, let user select if multiple sites
    return {
      success: true,
      cloudId: resources[0].id,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get cloud ID: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Refresh Jira access token
 */
export const refreshAccessToken = async (
  credentials: JiraCredentials,
  clientId?: string,
  clientSecret?: string
): Promise<OAuthCompleteResult> => {
  try {
    if (!credentials.refreshToken) {
      return {
        success: false,
        error: "No refresh token available",
      };
    }

    const actualClientId = clientId || OAUTH_CONFIG.clientId;
    const actualClientSecret = clientSecret || OAUTH_CONFIG.clientSecret;

    if (!actualClientId || !actualClientSecret) {
      return {
        success: false,
        error: "OAuth credentials not configured",
      };
    }

    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: actualClientId,
      client_secret: actualClientSecret,
      refresh_token: credentials.refreshToken,
    });

    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Token refresh failed: ${response.status} - ${errorText}`,
      };
    }

    const tokenData: JiraOAuthTokenResponse = await response.json();

    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const updatedCredentials: JiraCredentials = {
      ...credentials,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || credentials.refreshToken,
      expiresAt,
    };

    return {
      success: true,
      credentials: updatedCredentials,
    };
  } catch (error) {
    return {
      success: false,
      error: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Check if token needs refresh
 */
export const needsTokenRefresh = (credentials: JiraCredentials): boolean => {
  if (!credentials.expiresAt) return false;

  const expiresAt = new Date(credentials.expiresAt).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return expiresAt - now < fiveMinutes;
};

/**
 * Revoke OAuth tokens
 */
export const revokeOAuthTokens = async (
  credentials: JiraCredentials
): Promise<{ success: boolean; error?: string }> => {
  // Atlassian doesn't provide a revoke endpoint in public docs
  // Just clear tokens locally
  return { success: true };
};