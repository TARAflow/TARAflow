import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Alert,
  CircularProgress,
  Typography,
  Paper,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Avatar,
  Tooltip,
  Grid,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  BugReport as BugIcon,
  Task as TaskIcon,
  Assignment as AssignmentIcon,
} from "@mui/icons-material";
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
    credentials: JiraCredentials & { apiToken?: string },
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
    credentials?.authMethod || "oauth",
  );

  // Local state
  const [baseUrl, setBaseUrl] = useState(credentials?.baseUrl || "");
  const [email, setEmail] = useState(credentials?.email || "");
  const [apiToken, setApiToken] = useState(""); // never pre-fill from props — load from keychain
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Load saved token from OS keychain on mount
  useEffect(() => {
    const loadSavedToken = async () => {
      // Prefer accountId as keychain key, fall back to email
      const keychainKey = credentials?.accountId || credentials?.email || email;
      if (!keychainKey) return;
      try {
        const result = await (window as any).electronAPI.jira.getToken(
          keychainKey,
        );
        if (result.success && result.token) {
          setApiToken(result.token);
        }
      } catch {
        // Keychain not available in browser mode — silently ignore
      }
    };
    loadSavedToken();
  }, [credentials?.accountId, credentials?.email]);

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

    const testCredentials = {
      authMethod: authMethod,
      baseUrl,
      email,
      apiToken, // passed separately — not persisted in project JSON
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
                autoComplete="off"
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
                  You will be redirected to Atlassian login. After successful
                  authentication, you'll be redirected back to this app.
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
                onClick={() => {
                  /* Disconnect */
                }}
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
              autoComplete="off"
              helperText="Your Jira Cloud instance URL"
            />

            <TextField
              label="Email"
              type="email"
              placeholder="your.email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="off"
              helperText="Your Atlassian account email"
            />

            <TextField
              label="API Token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              fullWidth
              autoComplete="new-password"
              inputProps={{ autoComplete: "new-password" }}
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

      {/* Project Selection — shown after test OR when already connected */}
      {((testResult?.success && projects.length > 0) || selectedProject) && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Project Selection
          </Typography>

          {/* Already connected without re-testing */}
          {selectedProject && projects.length === 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Connected to project: <strong>{selectedProject}</strong>
              {" — "}Re-test connection to change project.
            </Alert>
          )}

          {/* Project Cards */}
          {projects.length > 0 && (
            <Grid container spacing={2}>
              {projects.map((project) => {
                const isSelected = selectedProject === project.key;
                return (
                  <Grid item xs={12} sm={6} key={project.id}>
                    <Card
                      elevation={0}
                      sx={{
                        border: isSelected ? "2px solid" : "1px solid #e0e0e0",
                        borderColor: isSelected ? "primary.main" : "#e0e0e0",
                        borderRadius: 2,
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "primary.light",
                          boxShadow: 2,
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleProjectSelect(project.key)}
                        sx={{ p: 0 }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          {/* Header row */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              mb: 1,
                            }}
                          >
                            {/* Project icon */}
                            {project.avatarUrl ? (
                              <Box
                                component="img"
                                src={project.avatarUrl}
                                alt={project.name}
                                sx={{ width: 32, height: 32, borderRadius: 1 }}
                              />
                            ) : (
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  fontSize: 14,
                                  bgcolor: "primary.main",
                                }}
                              >
                                {project.key.slice(0, 2)}
                              </Avatar>
                            )}

                            {/* Name + Key */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                                title={project.name}
                              >
                                {project.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {project.key} · {project.projectTypeKey}
                              </Typography>
                            </Box>

                            {/* Selected checkmark */}
                            {isSelected && (
                              <CheckCircleIcon
                                color="primary"
                                sx={{ fontSize: 20, flexShrink: 0 }}
                              />
                            )}
                          </Box>

                          {/* Description */}
                          {project.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                mb: 1,
                              }}
                            >
                              {project.description}
                            </Typography>
                          )}

                          {/* Footer row */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            {/* Issue count */}
                            {project.insight && (
                              <Chip
                                label={`${project.insight.totalIssueCount} issues`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: 11, height: 20 }}
                              />
                            )}

                            {/* Issue types */}
                            {project.issueTypes?.slice(0, 3).map((it) => (
                              <Tooltip
                                key={it.id}
                                title={it.name}
                                placement="top"
                              >
                                {it.iconUrl ? (
                                  <Box
                                    component="img"
                                    src={it.iconUrl}
                                    alt={it.name}
                                    sx={{ width: 16, height: 16 }}
                                  />
                                ) : (
                                  <AssignmentIcon
                                    sx={{
                                      fontSize: 16,
                                      color: "text.disabled",
                                    }}
                                  />
                                )}
                              </Tooltip>
                            ))}

                            {/* Lead */}
                            {project.lead && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  ml: "auto",
                                }}
                              >
                                {project.lead.avatarUrl ? (
                                  <Box
                                    component="img"
                                    src={project.lead.avatarUrl}
                                    alt={project.lead.displayName}
                                    sx={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: "50%",
                                    }}
                                  />
                                ) : (
                                  <Avatar
                                    sx={{ width: 16, height: 16, fontSize: 10 }}
                                  >
                                    {project.lead.displayName.slice(0, 1)}
                                  </Avatar>
                                )}
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                >
                                  {project.lead.displayName}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
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
