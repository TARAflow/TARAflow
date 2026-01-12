// ==================== AZURE DEVOPS OAUTH SERVICE ====================
// Handles OAuth 2.0 authentication flow for Azure DevOps

import type { AzureDevOpsCredentials } from "../models/integration-types";

// ==================== OAUTH CONFIGURATION ====================

const OAUTH_CONFIG = {
  clientId: "", // Set via environment or settings
  redirectUri: "coretm://auth/callback",
  scopes: "vso.work_write vso.project",
  authorizeUrl: "https://app.vssps.visualstudio.com/oauth2/authorize",
  tokenUrl: "https://app.vssps.visualstudio.com/oauth2/token",
};

// ==================== TYPES ====================

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface OAuthStartResult {
  success: boolean;
  authUrl?: string;
  error?: string;
}

export interface OAuthCompleteResult {
  success: boolean;
  credentials?: AzureDevOpsCredentials;
  error?: string;
}

// ==================== PKCE HELPERS ====================

/**
 * Generate random code verifier for PKCE
 */
const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

/**
 * Generate code challenge from verifier
 */
const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
};

/**
 * Base64 URL encode (RFC 4648)
 */
const base64UrlEncode = (buffer: Uint8Array): string => {
  const binary = new TextDecoder("latin1").decode(buffer);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

/**
 * Generate random state parameter
 */
const generateState = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

// ==================== OAUTH FLOW ====================

/**
 * Start OAuth flow - generates auth URL and opens browser
 */
export const startOAuthFlow = async (
  organizationUrl: string,
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

    // Store verifier and state for later verification
    sessionStorage.setItem("oauth_code_verifier", codeVerifier);
    sessionStorage.setItem("oauth_state", state);
    sessionStorage.setItem("oauth_org_url", organizationUrl);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: actualClientId,
      response_type: "code",
      redirect_uri: OAUTH_CONFIG.redirectUri,
      scope: OAUTH_CONFIG.scopes,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${OAUTH_CONFIG.authorizeUrl}?${params.toString()}`;

    // Open browser for authentication
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
 * Complete OAuth flow - exchange authorization code for tokens
 */
export const completeOAuthFlow = async (
  authorizationCode: string,
  state: string,
  clientId?: string,
  clientSecret?: string
): Promise<OAuthCompleteResult> => {
  try {
    // Verify state parameter
    const storedState = sessionStorage.getItem("oauth_state");
    if (state !== storedState) {
      return {
        success: false,
        error: "Invalid state parameter - possible CSRF attack",
      };
    }

    const actualClientId = clientId || OAUTH_CONFIG.clientId;
    if (!actualClientId) {
      return {
        success: false,
        error: "OAuth Client ID not configured",
      };
    }

    // Retrieve stored values
    const codeVerifier = sessionStorage.getItem("oauth_code_verifier");
    const organizationUrl = sessionStorage.getItem("oauth_org_url");

    if (!codeVerifier || !organizationUrl) {
      return {
        success: false,
        error: "OAuth session expired - please try again",
      };
    }

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      client_id: actualClientId,
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    });

    // Add client secret if provided (for confidential clients)
    if (clientSecret) {
      tokenParams.append("client_secret", clientSecret);
    }

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
        error: `Token exchange failed: ${response.status} - ${errorText}`,
      };
    }

    const tokenData: OAuthTokenResponse = await response.json();

    // Calculate expiration time
    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    // Create credentials object
    const credentials: AzureDevOpsCredentials = {
      authMethod: "oauth",
      organizationUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
    };

    // Clean up session storage
    sessionStorage.removeItem("oauth_code_verifier");
    sessionStorage.removeItem("oauth_state");
    sessionStorage.removeItem("oauth_org_url");

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
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
  credentials: AzureDevOpsCredentials,
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
    if (!actualClientId) {
      return {
        success: false,
        error: "OAuth Client ID not configured",
      };
    }

    const tokenParams = new URLSearchParams({
      client_id: actualClientId,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      redirect_uri: OAUTH_CONFIG.redirectUri,
    });

    if (clientSecret) {
      tokenParams.append("client_secret", clientSecret);
    }

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

    const tokenData: OAuthTokenResponse = await response.json();

    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const updatedCredentials: AzureDevOpsCredentials = {
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
 * Check if token needs refresh (expires in less than 5 minutes)
 */
export const needsTokenRefresh = (credentials: AzureDevOpsCredentials): boolean => {
  if (!credentials.expiresAt) return false;

  const expiresAt = new Date(credentials.expiresAt).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return expiresAt - now < fiveMinutes;
};

/**
 * Revoke OAuth tokens (logout)
 */
export const revokeOAuthTokens = async (
  credentials: AzureDevOpsCredentials
): Promise<{ success: boolean; error?: string }> => {
  // Azure DevOps doesn't have a revoke endpoint
  // Just clear the tokens locally
  return { success: true };
};