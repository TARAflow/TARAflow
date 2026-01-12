// ==================== ADO CONFIG WITH OAUTH ====================
// Updated ado-config.tsx with OAuth integration

import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Typography,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type {
  AzureDevOpsCredentials,
  AzureDevOpsProject,
  ConnectionTestResult,
  AuthMethod,
} from "../models/integration-types";
import { useOAuthFlow } from "../hooks/use-oauth-flow";

// ==================== COMPONENT ====================

interface AdoConfigProps {
  credentials: AzureDevOpsCredentials | null;
  selectedProject: string | null;
  onCredentialsChange: (credentials: AzureDevOpsCredentials) => void;
  onProjectSelect: (projectName: string) => void;
  onTestConnection: (
    credentials: AzureDevOpsCredentials
  ) => Promise<ConnectionTestResult>;
}

export const AdoConfig: React.FC<AdoConfigProps> = ({
  credentials,
  selectedProject,
  onCredentialsChange,
  onProjectSelect,
  onTestConnection,
}) => {
  const { t } = useTranslation();

  // Auth method state
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    credentials?.authMethod || "oauth"
  );

  // Form state
  const [orgUrl, setOrgUrl] = useState(credentials?.organizationUrl || "");
  const [pat, setPat] = useState(credentials?.personalAccessToken || "");
  const [projects, setProjects] = useState<AzureDevOpsProject[]>([]);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  // OAuth hook
  const {
    isAuthenticating,
    authError,
    startOAuthFlow: startOAuth,
    disconnect: disconnectOAuth,
  } = useOAuthFlow({
    tool: "azure-devops",
    onSuccess: (creds) => {
      const adoCreds = creds as AzureDevOpsCredentials;
      onCredentialsChange(adoCreds);
      // Automatically test connection after OAuth
      handleTestConnection(adoCreds);
    },
    onError: (error) => {
      setTestResult({
        success: false,
        message: error,
      });
    },
  });

  // Handle auth method change
  const handleAuthMethodChange = (method: AuthMethod) => {
    setAuthMethod(method);
    setTestResult(null);
  };

  // Handle OAuth sign-in
  const handleOAuthSignIn = () => {
    if (!orgUrl) {
      setTestResult({
        success: false,
        message: "Please enter organization URL",
      });
      return;
    }
    startOAuth(orgUrl);
  };

  // Handle OAuth disconnect
  const handleOAuthDisconnect = () => {
    disconnectOAuth();
    onCredentialsChange({
      authMethod: "oauth",
      organizationUrl: orgUrl,
    });
    setProjects([]);
    setTestResult(null);
  };

  // Handle PAT connection test
  const handlePATTest = async () => {
    if (!orgUrl || !pat) {
      setTestResult({
        success: false,
        message: "Please provide organization URL and Personal Access Token",
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    const testCredentials: AzureDevOpsCredentials = {
      authMethod: "pat",
      organizationUrl: orgUrl,
      personalAccessToken: pat,
    };

    const result = await onTestConnection(testCredentials);
    setTestResult(result);

    if (result.success && result.projects) {
      setProjects(result.projects as AzureDevOpsProject[]);
      onCredentialsChange(testCredentials);
    }

    setIsLoading(false);
  };

  // Generic test connection (works for both OAuth and PAT)
  const handleTestConnection = async (creds: AzureDevOpsCredentials) => {
    setIsLoading(true);
    const result = await onTestConnection(creds);
    setTestResult(result);

    if (result.success && result.projects) {
      setProjects(result.projects as AzureDevOpsProject[]);
    }

    setIsLoading(false);
  };

  // Handle project selection
  const handleProjectSelect = (projectName: string) => {
    onProjectSelect(projectName);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Azure DevOps Configuration
      </Typography>

      {/* Auth Method Selection */}
      <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Authentication Method
        </Typography>

        <RadioGroup
          value={authMethod}
          onChange={(e) => handleAuthMethodChange(e.target.value as AuthMethod)}
        >
          <FormControlLabel
            value="oauth"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  OAuth / SSO (Recommended)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Secure login with automatic token refresh
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="pat"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Personal Access Token
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Manual token for advanced use cases
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </Paper>

      {/* OAuth Flow */}
      {authMethod === "oauth" && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            OAuth Connection
          </Typography>

          {!credentials?.accessToken ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Organization URL"
                placeholder="https://dev.azure.com/yourorg"
                value={orgUrl}
                onChange={(e) => setOrgUrl(e.target.value)}
                fullWidth
                helperText="Your Azure DevOps organization"
                disabled={isAuthenticating}
              />

              <Button
                variant="contained"
                size="large"
                disabled={!orgUrl || isAuthenticating}
                onClick={handleOAuthSignIn}
                startIcon={isAuthenticating ? <CircularProgress size={20} /> : <span>🔐</span>}
                sx={{ alignSelf: "flex-start" }}
              >
                {isAuthenticating ? "Waiting for authentication..." : "Sign in with Microsoft"}
              </Button>

              {authError && (
                <Alert severity="error">{authError}</Alert>
              )}

              {!isAuthenticating && (
                <Alert severity="info">
                  <Typography variant="body2">
                    You will be redirected to Microsoft login. After successful
                    authentication, you'll be redirected back to this app.
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ Authenticated with Azure DevOps
              </Alert>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleOAuthDisconnect}
              >
                Disconnect
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* PAT Flow */}
      {authMethod === "pat" && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Manual Token Configuration
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Organization URL"
              placeholder="https://dev.azure.com/yourorg"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
              fullWidth
              helperText="Your Azure DevOps organization URL"
            />

            <TextField
              label="Personal Access Token (PAT)"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              fullWidth
              helperText="Generate a PAT with 'Work Items - Read & Write' permissions"
            />

            <Button
              variant="contained"
              onClick={handlePATTest}
              disabled={isLoading || !orgUrl || !pat}
              sx={{ alignSelf: "flex-start" }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            {testResult && (
              <Alert severity={testResult.success ? "success" : "error"}>
                {testResult.message}
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* Project Selection */}
      {testResult?.success && projects.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Project Selection
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Select Project</InputLabel>
            <Select
              value={selectedProject || ""}
              onChange={(e) => handleProjectSelect(e.target.value)}
              label="Select Project"
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.name}>
                  {project.name}
                  {project.description && (
                    <Typography
                      variant="caption"
                      sx={{ display: "block", color: "text.secondary" }}
                    >
                      {project.description}
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedProject && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Work items will be created in project:{" "}
              <strong>{selectedProject}</strong>
            </Alert>
          )}
        </Paper>
      )}

      {/* Help Text */}
      <Paper
        elevation={0}
        sx={{ p: 2, backgroundColor: "#f5f5f5", border: "1px solid #e0e0e0" }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {authMethod === "oauth" ? "About OAuth:" : "How to create a PAT:"}
        </Typography>
        {authMethod === "oauth" ? (
          <Typography variant="body2">
            OAuth provides secure authentication with automatic token refresh.
            You'll need permission to create OAuth apps in your Azure AD tenant.
            See the OAuth Setup Guide for detailed instructions.
          </Typography>
        ) : (
          <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
            <li>Go to Azure DevOps → User Settings → Personal Access Tokens</li>
            <li>Click "New Token"</li>
            <li>Select organization and set expiration</li>
            <li>Under "Scopes", select "Work Items" → "Read & Write"</li>
            <li>Click "Create" and copy the token</li>
          </Typography>
        )}
      </Paper>
    </Box>
  );
};