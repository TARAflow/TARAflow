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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { connectionNoteText } from "../services/connection-note-text";
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

  // Disconnecting keeps the ticket mapping (0.20 manual test D7, 2026-11-26:
  // it went with the connection, and the next connect started from the
  // defaults again).
  const mapping = data.integration?.mapping ?? null;
  const update = (next: IntegrationConnection | null) =>
    onUpdate({
      integration: next
        ? { connection: next, mapping: mapping ?? defaultTicketMapping(next.tool), lastSync: data.integration?.lastSync }
        : mapping
          ? { connection: null, mapping }
          : null,
    });

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    const outcome = await connectTracker({ tool: tracker.id, host, user, secret });
    setTesting(false);
    const code = !outcome.success && "code" in outcome ? outcome.code : undefined;
    const note = "note" in outcome ? outcome.note : undefined;
    setResult({
      success: outcome.success,
      message: code
        ? t(`integration.error.${code}`, { defaultValue: CONNECT_FAILURE_TEXT[code], ...labels })
        : note
          ? connectionNoteText(note, t)
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

  // Disconnecting ends the connection on this machine — the token leaves the
  // keychain, the status goes. Tracker, address, project and ticket mapping
  // are the project's settings and stay (0.20 manual test D7, user decision
  // 2026-11-26: before, the whole integration went, the mapping with it).
  const handleDisconnect = async () => {
    if (ref) await deleteTrackerToken(ref);
    setProjects([]);
    setResult(null);
    setTokenStored(null);
    if (connection) update({ ...connection, status: "disconnected" });
  };

  // Tracker and address are project settings: saved when they are changed —
  // the tracker at once, the address when the field is left or Enter is
  // pressed, not with every keystroke (review 2026-11-27) — and listed by the
  // audit (user 2026-11-26). The project chosen on the old tracker / address
  // goes with it. The token stays in the keychain; the e-mail is kept in the
  // project state for the form, and prepareForDisk drops it on save, so it
  // stays on this machine.
  const saveSettings = (tool: string, baseUrl: string) => {
    if (connection?.tool === tool && connection?.credentials?.baseUrl === baseUrl) return;
    const authMethod = connection?.credentials?.authMethod;
    update({
      tool: tool as IntegrationConnection["tool"],
      status: "disconnected",
      credentials: { ...(authMethod ? { authMethod } : {}), baseUrl, ...(user ? { email: user } : {}) },
    });
  };

  const isConnected = connection?.status === "connected";
  const connected = isConnected && connection?.tool === tracker.id;

  // A change of tracker, address or user while connected: the token is bound
  // to them, so the connection cannot go on — ask, then disconnect and take
  // the value (user decision 2026-11-26).
  const [pendingChange, setPendingChange] = useState<(() => void) | null>(null);
  const change = (apply: () => void) => {
    if (isConnected) setPendingChange(() => apply);
    else apply();
  };
  const confirmChange = async () => {
    const apply = pendingChange;
    setPendingChange(null);
    await handleDisconnect();
    apply?.();
  };

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
              const value = e.target.value;
              change(() => {
                const next = issueTracker(value);
                setToolId(value);
                setHost(next?.defaultHost ?? "");
                setResult(null);
                setProjects([]);
                saveSettings(value, next?.defaultHost ?? "");
              });
            }}
            inputProps={{ "data-testid": "integration-tracker" }}
          >
            {ISSUE_TRACKERS.map((tr) => (
              <MenuItem key={tr.id} value={tr.id} disabled={!tr.available}>
                {tr.label}
                {tr.available && tr.preview && ` — ${t("integration.preview", { defaultValue: "preview" })}`}
                {!tr.available &&
                  (tr.availableFrom
                    ? ` — ${t("integration.from", { defaultValue: "from {{version}}", version: tr.availableFrom })}`
                    : ` — ${t("integration.planned", { defaultValue: "planned" })}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={labels.host}
            value={host}
            placeholder="https://…"
            onChange={(e) => {
              const value = e.target.value;
              change(() => setHost(value));
            }}
            onBlur={() => saveSettings(tracker.id, host)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveSettings(tracker.id, host);
            }}
            inputProps={{ "data-testid": "integration-host" }}
          />
          {tracker.userField && (
            <TextField
              label={labels.user}
              type={tracker.userField.kind === "email" ? "email" : "text"}
              value={user}
              onChange={(e) => {
                const value = e.target.value;
                change(() => setUser(value));
              }}
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
            {isConnected && (
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
      <Dialog open={pendingChange !== null} onClose={() => setPendingChange(null)} data-testid="integration-change-dialog">
        <DialogTitle>{t("integration.changeTitle", { defaultValue: "Change the tracker connection" })}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("integration.changeText", {
              host: connection?.credentials?.baseUrl ?? "",
              defaultValue:
                'The token is bound to {{host}}. Changing the tracker, the address or the user ends this connection; the ticket mapping is kept. Connect again afterwards with "Test connection".',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingChange(null)} data-testid="integration-change-keep">
            {t("integration.changeKeep", { defaultValue: "Keep connection" })}
          </Button>
          <Button color="error" onClick={() => void confirmChange()} data-testid="integration-change-disconnect">
            {t("integration.disconnect", { defaultValue: "Disconnect" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
