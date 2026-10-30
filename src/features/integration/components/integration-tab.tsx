// features/integration/components/integration-tab.tsx
//
// One Integration tab, one form (adapters design §4.4, user 2026-10-29): the
// tracker is chosen from a list, the form is built from its description
// (shared/models/issue-trackers.ts). The secret goes to the main process's
// keychain, bound to tracker + host + account; the project stores the
// connection without it. 0.16: Jira Cloud; the others are listed as coming.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ISSUE_TRACKERS, issueTracker } from "shared/models/issue-trackers";
import {
  defaultTicketMapping,
  type IntegrationConnection,
  type IntegrationTabProps,
  type TrackerProject,
} from "../models/integration-types";
import { CONNECT_FAILURE_TEXT, connectTracker } from "../services/connect-tracker";
import { trackerLabels } from "../services/tracker-labels";
import { trackerRefOf } from "../adapters/create-ticket-adapter";
import { deleteTrackerToken, hasTrackerToken } from "../adapters/tracker-channel";
import { TrackerProjectCards } from "./tracker-project-cards";

export const IntegrationTab: React.FC<IntegrationTabProps> = ({ data, onUpdate }) => {
  const { t } = useTranslation();
  const connection = data.integration?.connection ?? null;
  const [toolId, setToolId] = useState<string>(connection?.tool ?? "jira");
  const tracker = issueTracker(toolId) ?? ISSUE_TRACKERS[0];
  const labels = trackerLabels(tracker, t);
  const [host, setHost] = useState(connection?.credentials?.baseUrl ?? tracker.defaultHost ?? "");
  const [user, setUser] = useState(connection?.credentials?.email ?? "");
  const [secret, setSecret] = useState(""); // never prefilled — the token stays in the keychain
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [projects, setProjects] = useState<TrackerProject[]>([]);
  const [tokenStored, setTokenStored] = useState<boolean | null>(null);

  const ref = useMemo(() => trackerRefOf(connection), [connection]);
  useEffect(() => {
    let alive = true;
    if (!ref) {
      setTokenStored(null);
      return;
    }
    void hasTrackerToken(ref).then((has) => alive && setTokenStored(has));
    return () => {
      alive = false;
    };
  }, [ref]);

  const update = (next: IntegrationConnection | null) =>
    onUpdate({
      integration: next
        ? { connection: next, mapping: data.integration?.mapping ?? defaultTicketMapping(next.tool), lastSync: data.integration?.lastSync }
        : null,
    });

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    const outcome = await connectTracker({ tool: tracker.id, host, user, secret });
    setTesting(false);
    const code = !outcome.success && "code" in outcome ? outcome.code : undefined;
    setResult({
      success: outcome.success,
      message: code
        ? t(`integration.error.${code}`, { defaultValue: CONNECT_FAILURE_TEXT[code], ...labels })
        : outcome.message,
    });
    if (!outcome.success || !("credentials" in outcome)) return;
    setSecret("");
    setProjects(outcome.projects);
    setTokenStored(true);
    const keepProject =
      connection?.credentials?.projectKey && outcome.projects.some((p) => p.key === connection.credentials?.projectKey)
        ? { projectKey: connection.credentials.projectKey }
        : {};
    update({
      tool: tracker.id,
      status: "connected",
      credentials: { ...outcome.credentials, ...keepProject },
      lastTested: new Date().toISOString(),
      ...(keepProject.projectKey ? { projectName: connection?.projectName } : {}),
    });
  };

  const handleSelect = (project: TrackerProject) => {
    if (!connection?.credentials) return;
    update({
      ...connection,
      credentials: { ...connection.credentials, projectKey: project.key },
      projectName: project.key,
      issueTypes: project.issueTypes ?? [],
    });
  };

  const handleDisconnect = async () => {
    if (ref) await deleteTrackerToken(ref);
    setProjects([]);
    setResult(null);
    setTokenStored(null);
    update(null);
  };

  const connected = connection?.status === "connected" && connection.tool === tracker.id;

  return (
    <Box sx={{ p: 3, maxWidth: 900 }} data-testid="integration-tab">
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
        {t("integration.title", { defaultValue: "Issue tracker" })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("integration.intro", {
          defaultValue:
            "Connect an issue tracker to create tickets for mitigations and follow their status. The token is kept in the OS keychain, bound to this tracker address — never in the project file.",
        })}
      </Typography>

      {connected && tokenStored === false && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="integration-retest">
          {t("integration.retest", {
            defaultValue:
              "Run the connection test once — the token is now bound to this tracker address and has to be entered again.",
          })}
        </Alert>
      )}
      {connected && connection?.projectName && tokenStored !== false && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("integration.connected", {
            defaultValue: "Connected to {{tracker}} — project {{project}} ({{host}}, {{account}})",
            tracker: tracker.label,
            project: connection.projectName,
            host: connection.credentials?.baseUrl ?? "",
            account: connection.credentials?.email ?? "",
          })}
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0", mb: 3 }}>
        <Stack spacing={2}>
          <TextField
            select
            label={t("integration.tracker", { defaultValue: "Tracker" })}
            value={tracker.id}
            onChange={(e) => {
              const next = issueTracker(e.target.value);
              setToolId(e.target.value);
              setHost(next?.defaultHost ?? "");
              setResult(null);
              setProjects([]);
            }}
            inputProps={{ "data-testid": "integration-tracker" }}
          >
            {ISSUE_TRACKERS.map((tr) => (
              <MenuItem key={tr.id} value={tr.id} disabled={!tr.available}>
                {tr.label}
                {!tr.available &&
                  ` — ${t("integration.from", { defaultValue: "from {{version}}", version: tr.availableFrom })}`}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={labels.host}
            value={host}
            placeholder="https://…"
            onChange={(e) => setHost(e.target.value)}
            inputProps={{ "data-testid": "integration-host" }}
          />
          {tracker.userField && (
            <TextField
              label={labels.user}
              type={tracker.userField.kind === "email" ? "email" : "text"}
              value={user}
              onChange={(e) => setUser(e.target.value)}
              inputProps={{ "data-testid": "integration-user" }}
            />
          )}
          <TextField
            label={labels.secret}
            type="password"
            value={secret}
            autoComplete="off"
            onChange={(e) => setSecret(e.target.value)}
            helperText={t("integration.secretHelp", {
              defaultValue: "Stored in the OS keychain for this address only.",
            })}
            inputProps={{ "data-testid": "integration-secret" }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              onClick={handleTest}
              disabled={testing || !tracker.available || !host.trim() || !secret.trim() || (!!tracker.userField && !user.trim())}
              data-testid="integration-test"
            >
              {testing ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              {t("integration.test", { defaultValue: "Test connection" })}
            </Button>
            {connection && (
              <Button color="error" onClick={handleDisconnect} data-testid="integration-disconnect">
                {t("integration.disconnect", { defaultValue: "Disconnect" })}
              </Button>
            )}
          </Stack>
          {result && (
            <Alert severity={result.success ? "success" : "error"} data-testid="integration-result">
              {result.message}
            </Alert>
          )}
        </Stack>
      </Paper>

      {projects.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid #e0e0e0" }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            {t("integration.project", { defaultValue: "Project" })}
          </Typography>
          <TrackerProjectCards
            projects={projects}
            selectedKey={connection?.credentials?.projectKey ?? null}
            onSelect={handleSelect}
          />
        </Paper>
      )}
      {projects.length === 0 && connected && connection?.projectName && (
        <Typography variant="body2" color="text.secondary">
          {t("integration.projectHint", { defaultValue: "Run the connection test again to choose another project." })}
        </Typography>
      )}
    </Box>
  );
};
