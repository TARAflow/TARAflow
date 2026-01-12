import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Typography,
  Paper,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type {
  AuthMethod,
  JiraCredentials,
  JiraProject,
  ConnectionTestResult,
} from "../models/integration-types";

// ==================== JIRA CONFIG COMPONENT ====================

interface JiraConfigProps {
  credentials: JiraCredentials | null;
  selectedProject: string | null;
  onCredentialsChange: (credentials: JiraCredentials) => void;
  onProjectSelect: (projectKey: string) => void;
  onTestConnection: (
    credentials: JiraCredentials
  ) => Promise<ConnectionTestResult>;
}

export const JiraConfig: React.FC<JiraConfigProps> = ({
  credentials,
  selectedProject,
  onCredentialsChange,
  onProjectSelect,
  onTestConnection,
}) => {
  const { t } = useTranslation();

  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    credentials?.authMethod || "oauth"
  );

  // Local state
  const [baseUrl, setBaseUrl] = useState(credentials?.baseUrl || "");
  const [email, setEmail] = useState(credentials?.email || "");
  const [apiToken, setApiToken] = useState(credentials?.apiToken || "");
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Handle test connection
  const handleTestConnection = async () => {
    if (!baseUrl || !email || !apiToken) {
      setTestResult({
        success: false,
        message: "Please provide Jira URL, email, and API token",
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    const testCredentials: JiraCredentials = {
      authMethod: authMethod,
      baseUrl,
      email,
      apiToken,
    };

    const result = await onTestConnection(testCredentials);
    setTestResult(result);

    if (result.success && result.projects) {
      setProjects(result.projects as JiraProject[]);
      onCredentialsChange(testCredentials);
    }

    setIsLoading(false);
  };

  // Handle project selection
  const handleProjectSelect = (projectKey: string) => {
    onProjectSelect(projectKey);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
              onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
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
                label="Jira URL"
                placeholder="https://yourcompany.atlassian.net"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                fullWidth
                helperText="Your Jira Cloud instance URL"
              />

              <Button
                variant="contained"
                size="large"
                disabled={!baseUrl}
                startIcon={<span>🔐</span>}
                sx={{ alignSelf: "flex-start" }}
              >
                Sign in with Atlassian
              </Button>

              <Alert severity="info">
                <Typography variant="body2">
                  You will be redirected to Atlassian login. After successful authentication,
                  you'll be redirected back to this app.
                </Typography>
              </Alert>
            </Box>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                ✅ Authenticated with Jira
              </Alert>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => {/* Disconnect */}}
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
              label="Jira URL"
              placeholder="https://yourcompany.atlassian.net"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              fullWidth
              helperText="Your Jira Cloud instance URL"
            />

            <TextField
              label="Email"
              type="email"
              placeholder="your.email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              helperText="Your Atlassian account email"
            />

            <TextField
              label="API Token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              fullWidth
              helperText="Generate an API token from your Atlassian account settings"
            />

            <Button
              variant="contained"
              onClick={handleTestConnection}
              disabled={isLoading || !baseUrl || !email || !apiToken}
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
          >
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.key}>  {/* ← key als value! */}
                <Box>
                  <Typography variant="body1">
                    {project.key} - {project.name}  {/* ← key + name anzeigen */}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Type: {project.projectTypeKey}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedProject && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Work items will be created in project: <strong>{selectedProject}</strong>
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
          How to create a Jira API Token:
        </Typography>
        <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
          <li>
            Go to{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
            >
              Atlassian Account Settings
            </a>
          </li>
          <li>Click "Create API token"</li>
          <li>Give it a label (e.g., "Threat Modeling Tool")</li>
          <li>Click "Create" and copy the token immediately</li>
          <li>Store the token securely - you won't be able to see it again</li>
        </Typography>
      </Paper>
    </Box>
  );
};