// ==================== RISK MITIGATION STATUS DIALOG ====================
// Execution-layer dialog: tracks implementation status of selected mitigations.
//
// Modes:
//   Offline — manual status + evidence + reference (always available)
//   Jira    — link/create Jira tickets per mitigation; status synced automatically
//
// Opens from: clickable Implementation chip in risk table.
// Integration: JiraCredentials + project from IntegrationConnection via prop.

import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Chip,
  Divider,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  InputLabel,
} from "@mui/material";
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Sync as SyncIcon,
  Add as AddIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  ConfirmationNumber as TicketIcon,
  Check as CheckIcon,
} from "@mui/icons-material";

import type { Risk } from "../models/risk-assessment-types";
import type {
  SelectedMitigation,
  MitigationStatus,
  MitigationStatusConfig,
} from "../models/risk-mitigation-types";
import {
  MITIGATION_STATUS_CONFIGS,
  deriveImplementationProgress,
} from "../models/risk-mitigation-types";
import type {
  IntegrationConnection,
  JiraCredentials,
  JiraProject,
} from "../../integration/models/integration-types";
import type {
  RiskIntegrationConnection,
  TicketSummary,
} from "../models/risk-integration-types";
import {
  fetchJiraTickets,
  createJiraTicket,
  syncTicketStatus,
  buildTicketDescription,
  buildTicketSummary,
} from "../services/jira-mitigation-service";

import { MitigationDraftRef } from "shared";

// ==================== STATUS CONFIG ====================

const MITIGATION_STATUS_OPTIONS: {
  value: MitigationStatus;
  label: string;
  color: string;
}[] = [
  { value: "open", label: "Open", color: "#9ca3af" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6" },
  { value: "in_review", label: "In Review", color: "#8b5cf6" },
  { value: "implemented", label: "Implemented", color: "#22c55e" },
  { value: "verified", label: "Verified", color: "#16a34a" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
];

// ==================== PROPS ====================

export interface RiskMitigationStatusDialogProps {
  open: boolean;
  risk: Risk;
  /** Pass the active IntegrationConnection if available — enables Jira mode */
  integrationConnection?: RiskIntegrationConnection | null;
  /** Selected Jira project (needed for issue type list and ticket creation) */
  jiraProject?: JiraProject | null;
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
}

// ==================== JIRA TICKET PANEL ====================

interface JiraTicketPanelProps {
  mitigation: SelectedMitigation;
  mitigationText: string;
  risk: Risk;
  credentials: JiraCredentials;
  projectKey: string;
  issueTypes: Array<{ id: string; name: string }>;
  onLink: (m: Partial<SelectedMitigation>) => void;
}

type JiraPanelTab = "link" | "create";

const JiraTicketPanel: React.FC<JiraTicketPanelProps> = ({
  mitigation,
  mitigationText,
  risk,
  credentials,
  projectKey,
  issueTypes: issueTypesProp,
  onLink,
}) => {
  const { t } = useTranslation();

  const [tab, setTab] = useState<JiraPanelTab>("link");

  // Merge prop issue types with a dynamic "All" option
  const [availableIssueTypes, setAvailableIssueTypes] = useState<
    Array<{ id: string; name: string }>
  >(() => [
    { id: "__all__", name: "All types" },
    ...issueTypesProp.filter((it) => !it.name.toLowerCase().includes("subtask")),
  ]);

  // Link existing ticket state
  const [selectedIssueType, setSelectedIssueType] = useState("__all__");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  // Create new ticket state — default to first real type
  const [createIssueType, setCreateIssueType] = useState(
    issueTypesProp.find((it) => !it.name.toLowerCase().includes("subtask"))?.name ?? "Task",
  );
  const [summary, setSummary] = useState(() =>
    buildTicketSummary(risk, mitigationText),
  );
  const [description, setDescription] = useState(() =>
    buildTicketDescription(risk, mitigation, mitigationText),
  );
  const [priority, setPriority] = useState("Medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  // Local sync interval — refreshes status every 5s when ticket is linked
  useEffect(() => {
    if (!mitigation.ticketId) return;
    const interval = setInterval(async () => {
      const syncResult = await syncTicketStatus(credentials, mitigation.ticketId!);
      if (syncResult) {
        onLink({
          ticketStatus: syncResult.ticketStatus,
          status: syncResult.mappedMitigationStatus ?? mitigation.status,
          ticketSyncedAt: syncResult.syncedAt,
        });
      }
    }, 5_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mitigation.ticketId, credentials]);

  // Load tickets when issueType or tab changes
  useEffect(() => {
    if (tab !== "link") return;
    const load = async () => {
      setLoadingTickets(true);
      setTicketsError(null);
      try {
        const result = await fetchJiraTickets(credentials, projectKey, selectedIssueType);
        setTickets(result);
        if (!result.length) setTicketsError("No open tickets found for this type.");
      } catch {
        setTicketsError("Failed to load tickets.");
      } finally {
        setLoadingTickets(false);
      }
    };
    load();
  }, [tab, selectedIssueType, credentials, projectKey]);

  // Internal sync — refreshes status and updates parent
  const handleSyncAndFetchDetails = async (ticketId: string) => {
    const syncResult = await syncTicketStatus(credentials, ticketId);
    if (syncResult) {
      onLink({
        ticketStatus: syncResult.ticketStatus,
        status: syncResult.mappedMitigationStatus ?? mitigation.status,
        ticketSyncedAt: syncResult.syncedAt,
      });
    }
  };

  const handleSyncStatus = async () => {
    if (!mitigation.ticketId) return;
    setSyncing(true);
    try {
      await handleSyncAndFetchDetails(mitigation.ticketId);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTicket = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createJiraTicket(credentials, {
        projectKey,
        issueType: createIssueType,
        summary,
        description,
        priority,
        labels: ["security", "threat-model"],
      });
      if (result.success && result.ticketId) {
        // Immediately sync status after creation
        const syncResult = await syncTicketStatus(credentials, result.ticketId);
        onLink({
          ticketId: result.ticketId,
          ticketUrl: result.ticketUrl,
          ticketStatus: syncResult?.ticketStatus ?? "OPEN",
          status: syncResult?.mappedMitigationStatus ?? "open",
          ticketSyncedAt: new Date().toISOString(),
        });
      } else {
        setCreateError(result.error ?? "Failed to create ticket.");
      }
    } finally {
      setCreating(false);
    }
  };

  // Already linked — show Jira-style card
  if (mitigation.ticketId) {
    // Find the ticket details from the loaded tickets list (if available)
    const linkedTicket = tickets.find((t) => t.key === mitigation.ticketId);

    const statusColor =
      mitigation.ticketStatus === "CLOSED"    ? { bg: "#dcfce7", fg: "#16a34a" } :
      mitigation.ticketStatus === "IN_PROGRESS"? { bg: "#dbeafe", fg: "#1d4ed8" } :
      mitigation.ticketStatus === "REVIEW"    ? { bg: "#ede9fe", fg: "#7c3aed" } :
                                                { bg: "#f3f4f6", fg: "#374151" };

    return (
      <Box sx={{ mt: 1 }}>
        <Paper
          variant="outlined"
          sx={{ borderRadius: 1.5, overflow: "hidden" }}
        >
          {/* Card header — key + actions */}
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              bgcolor: "#f8fafc",
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            {linkedTicket?.issueTypeIconUrl ? (
              <Box
                component="img"
                src={linkedTicket.issueTypeIconUrl}
                alt={linkedTicket.issueType}
                sx={{ width: 14, height: 14, flexShrink: 0 }}
              />
            ) : (
              <TicketIcon sx={{ fontSize: 14, color: "primary.main" }} />
            )}
            <Typography
              variant="caption"
              color="primary"
              fontWeight={700}
              sx={{ fontSize: 12 }}
            >
              {mitigation.ticketId}
            </Typography>
            {linkedTicket?.issueType && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {linkedTicket.issueType}
              </Typography>
            )}
            <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.25 }}>
              {mitigation.ticketSyncedAt && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, mr: 0.5 }}>
                  {new Date(mitigation.ticketSyncedAt).toLocaleTimeString()}
                </Typography>
              )}
              <Tooltip title="Sync status from Jira">
                <IconButton size="small" onClick={handleSyncStatus} disabled={syncing} sx={{ p: 0.25 }}>
                  {syncing
                    ? <CircularProgress size={12} />
                    : <SyncIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
              {mitigation.ticketUrl && (
                <Tooltip title="Open in Jira">
                  <IconButton
                    size="small"
                    sx={{ p: 0.25 }}
                    onClick={() => window.open(mitigation.ticketUrl, "_blank")}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Unlink ticket">
                <IconButton
                  size="small"
                  color="error"
                  sx={{ p: 0.25 }}
                  onClick={() => {
                    setTab("link");
                    onLink({
                      ticketId: undefined,
                      ticketUrl: undefined,
                      ticketStatus: undefined,
                      ticketSyncedAt: undefined,
                    });
                  }}
                >
                  <LinkOffIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Card body */}
          <Box sx={{ px: 1.5, py: 1 }}>
            {/* Summary */}
            <Typography
              variant="body2"
              sx={{ fontSize: 12, fontWeight: 500, mb: 0.75, lineHeight: 1.3 }}
            >
              {linkedTicket?.summary ?? mitigation.ticketId}
            </Typography>

            {/* Status + Priority row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Chip
                label={
                  mitigation.ticketStatus
                    ? mitigation.ticketStatus.replace("_", " ")
                    : "Unknown"
                }
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  bgcolor: statusColor.bg,
                  color: statusColor.fg,
                  fontWeight: 600,
                }}
              />
              {linkedTicket?.priorityIconUrl && (
                <Tooltip title={linkedTicket.priority ?? ""}>
                  <Box
                    component="img"
                    src={linkedTicket.priorityIconUrl}
                    alt={linkedTicket.priority}
                    sx={{ width: 14, height: 14 }}
                  />
                </Tooltip>
              )}
              {linkedTicket?.priority && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {linkedTicket.priority}
                </Typography>
              )}
            </Box>

            {/* Assignee + Sprint row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {linkedTicket?.assigneeAvatarUrl ? (
                <Box
                  component="img"
                  src={linkedTicket.assigneeAvatarUrl}
                  alt={linkedTicket.assignee}
                  sx={{ width: 14, height: 14, borderRadius: "50%" }}
                />
              ) : (
                <Typography sx={{ fontSize: 12 }}>👤</Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {linkedTicket?.assignee ?? "Unassigned"}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>·</Typography>
              <Typography sx={{ fontSize: 12 }}>🏃</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {linkedTicket?.sprint ?? "Backlog"}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 1, minHeight: 32 }}
        TabIndicatorProps={{ style: { height: 2 } }}
      >
        <Tab
          label="Link existing"
          value="link"
          icon={<LinkIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
          sx={{ minHeight: 32, py: 0.5, fontSize: 12 }}
        />
        <Tab
          label="Create new"
          value="create"
          icon={<AddIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
          sx={{ minHeight: 32, py: 0.5, fontSize: 12 }}
        />
      </Tabs>

      {/* Link existing ticket */}
      {tab === "link" && (
        <Box>
          <FormControl size="small" sx={{ mb: 1, minWidth: 160 }}>
            <InputLabel sx={{ fontSize: 12 }}>Issue Type</InputLabel>
            <Select
              value={selectedIssueType}
              onChange={(e) => setSelectedIssueType(e.target.value)}
              label="Issue Type"
              sx={{ fontSize: 12 }}
            >
              {availableIssueTypes.map((it) => (
                <MenuItem
                  key={it.id}
                  value={it.id === "__all__" ? "__all__" : it.name}
                  sx={{ fontSize: 12 }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {(it as any).iconUrl ? (
                      <Box
                        component="img"
                        src={(it as any).iconUrl}
                        alt={it.name}
                        sx={{ width: 14, height: 14 }}
                      />
                    ) : null}
                    {it.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {loadingTickets ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : ticketsError ? (
            <Typography variant="caption" color="text.secondary">{ticketsError}</Typography>
          ) : (
            <Paper
              variant="outlined"
              sx={{ maxHeight: 320, overflow: "auto", borderRadius: 1 }}
            >
              <Stack spacing={0} divider={<Divider />}>
                {tickets.map((ticket) => (
                  <Box
                    key={ticket.key}
                    onClick={async () => {
                      // Link ticket and immediately sync its status
                      const syncResult = await syncTicketStatus(credentials, ticket.key);
                      onLink({
                        ticketId: ticket.key,
                        ticketUrl: ticket.url,
                        ticketStatus: syncResult?.ticketStatus ?? ticket.ticketStatus,
                        status: syncResult?.mappedMitigationStatus ?? undefined,
                        ticketSyncedAt: new Date().toISOString(),
                      });
                    }}
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                      transition: "background-color 0.1s",
                    }}
                  >
                    {/* Row 1: Issue type icon + key + status chip + priority icon */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
                      {ticket.issueTypeIconUrl ? (
                        <Box
                          component="img"
                          src={ticket.issueTypeIconUrl}
                          alt={ticket.issueType}
                          sx={{ width: 14, height: 14, flexShrink: 0 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                          {ticket.issueType.slice(0, 1)}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="primary"
                        fontWeight={700}
                        sx={{ fontSize: 11, flexShrink: 0 }}
                      >
                        {ticket.key}
                      </Typography>
                      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
                        {ticket.priorityIconUrl && (
                          <Tooltip title={ticket.priority ?? ""} placement="top">
                            <Box
                              component="img"
                              src={ticket.priorityIconUrl}
                              alt={ticket.priority}
                              sx={{ width: 12, height: 12 }}
                            />
                          </Tooltip>
                        )}
                        <Chip
                          label={ticket.status}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 10,
                            bgcolor: ticket.ticketStatus === "IN_PROGRESS"
                              ? "#dbeafe"
                              : ticket.ticketStatus === "REVIEW"
                              ? "#ede9fe"
                              : "#f3f4f6",
                            color: ticket.ticketStatus === "IN_PROGRESS"
                              ? "#1d4ed8"
                              : ticket.ticketStatus === "REVIEW"
                              ? "#7c3aed"
                              : "#374151",
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Row 2: Summary */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        mb: 0.25,
                      }}
                    >
                      {ticket.summary}
                    </Typography>

                    {/* Row 3: Assignee + Sprint */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {ticket.assigneeAvatarUrl ? (
                          <Box
                            component="img"
                            src={ticket.assigneeAvatarUrl}
                            alt={ticket.assignee}
                            sx={{ width: 14, height: 14, borderRadius: "50%" }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: 10 }}>👤</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {ticket.assignee ?? "Unassigned"}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>·</Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                        <Typography variant="caption" sx={{ fontSize: 10 }}>🏃</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {ticket.sprint ?? "Backlog"}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}
        </Box>
      )}

      {/* Create new ticket */}
      {tab === "create" && (
        <Stack spacing={1}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={{ fontSize: 12 }}>Issue Type</InputLabel>
              <Select
                value={createIssueType}
                onChange={(e) => setCreateIssueType(e.target.value)}
                label="Issue Type"
                sx={{ fontSize: 12 }}
              >
                {availableIssueTypes
                  .filter((it) => it.id !== "__all__")
                  .map((it) => (
                    <MenuItem key={it.id} value={it.name} sx={{ fontSize: 12 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        {(it as any).iconUrl ? (
                          <Box
                            component="img"
                            src={(it as any).iconUrl}
                            alt={it.name}
                            sx={{ width: 14, height: 14 }}
                          />
                        ) : null}
                        {it.name}
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: 12 }}>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                label="Priority"
                sx={{ fontSize: 12 }}
              >
                {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => (
                  <MenuItem key={p} value={p} sx={{ fontSize: 12 }}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            size="small"
            label="Summary (title)"
            fullWidth
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            inputProps={{ style: { fontSize: 12 }, maxLength: 255 }}
          />

          <TextField
            size="small"
            label="Description"
            fullWidth
            multiline
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            inputProps={{ style: { fontSize: 11 } }}
            helperText="EARS-style template pre-filled. Edit as needed."
          />

          {createError && (
            <Alert severity="error" sx={{ fontSize: 12 }}>{createError}</Alert>
          )}

          <Button
            variant="contained"
            size="small"
            startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
            onClick={handleCreateTicket}
            disabled={creating || !summary.trim()}
            sx={{ alignSelf: "flex-start" }}
          >
            Create in Jira
          </Button>
        </Stack>
      )}
    </Box>
  );
};

// ==================== MAIN DIALOG ====================

export const RiskMitigationStatusDialog: React.FC<
  RiskMitigationStatusDialogProps
> = ({ open, risk, integrationConnection, jiraProject, onSave, onClose }) => {
  const { t } = useTranslation();

  // Local copy of mitigations for editing
  const [mitigations, setMitigations] = useState<SelectedMitigation[]>(() =>
    risk.selectedMitigations.map((m: SelectedMitigation) => ({ ...m })),
  );

  // Sync when risk changes
  useEffect(() => {
    setMitigations(
      risk.selectedMitigations.map((m: SelectedMitigation) => ({ ...m })),
    );
  }, [risk.id, risk.selectedMitigations]);

  // Jira connection
  const isJiraConnected =
    integrationConnection?.tool === "jira" &&
    integrationConnection?.status === "connected" &&
    !!integrationConnection?.projectName;

  const jiraCredentials = isJiraConnected
    ? (integrationConnection!.credentials as unknown as JiraCredentials)
    : null;
  const jiraProjectKey = integrationConnection?.projectName ?? "";
  const issueTypes = jiraProject?.issueTypes ?? [];

  const updateMitigation = useCallback(
    (id: string | undefined, updates: Partial<SelectedMitigation>) => {
      setMitigations((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                ...updates,
                ...(updates.status
                  ? { statusChangedAt: new Date().toISOString() }
                  : {}),
              }
            : m,
        ),
      );
    },
    [],
  );

  const handleSave = useCallback(() => {
    onSave(risk.id, { selectedMitigations: mitigations });
    onClose();
  }, [risk.id, mitigations, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setMitigations(
      risk.selectedMitigations.map((m: SelectedMitigation) => ({ ...m })),
    );
    onClose();
  }, [risk, onClose]);

  const impl = deriveImplementationProgress(mitigations);
  const implConfig = MITIGATION_STATUS_CONFIGS.find(
    (c: MitigationStatusConfig) => c.value === impl,
  ) ?? { value: "open", label: "Open", color: "#9ca3af", icon: "⚪" };

  const hasMitigations = mitigations.length > 0;

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("tabs.risks.mitigationStatusDialog.title", {
              defaultValue: "Implementation Status",
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {risk.threatId} — {risk.threatDescription?.slice(0, 80)}
            {(risk.threatDescription?.length ?? 0) > 80 ? "…" : ""}
          </Typography>
          {risk.attackDescription && (
            <Typography variant="caption" color="text.disabled" display="block">
              {risk.attackDescription.slice(0, 80)}
              {risk.attackDescription.length > 80 ? "…" : ""}
            </Typography>
          )}
        </Box>

        {/* Jira connection badge + overall implementation chip — stacked vertically */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0.5,
          }}
        >
          {isJiraConnected && (
            <Chip
              label={`Jira: ${jiraProjectKey}`}
              size="small"
              color="primary"
              variant="outlined"
              icon={<TicketIcon sx={{ fontSize: 12 }} />}
              sx={{ fontSize: 11 }}
            />
          )}
          <Chip
            label={`${implConfig.icon} ${t(
              `risks.implementation.${impl}.label`,
              {
                defaultValue: implConfig.label,
              },
            )}`}
            size="small"
            sx={{
              bgcolor: implConfig.color,
              color: "white",
              fontSize: "0.72rem",
            }}
          />
        </Box>

        <IconButton size="small" onClick={handleCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {!hasMitigations ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 2, textAlign: "center" }}
          >
            {t("tabs.risks.mitigationStatusDialog.noMitigations", {
              defaultValue:
                "No mitigations selected. Open the Risk Dialog to select mitigations.",
            })}
          </Typography>
        ) : (
          <>
            <Stack spacing={2} sx={{ pt: 2 }}>
              {mitigations.map((m, idx) => {
                const id = m.id ?? m.notes ?? "";
                const statusConfig = MITIGATION_STATUS_OPTIONS.find(
                  (s) => s.value === m.status,
                );

                // Resolve mitigation display text
                const draft = risk.proposedMitigations?.find(
                  (p: MitigationDraftRef) => p.id === m.id,
                );
                const mitigationText = draft?.isCustom
                  ? (draft.notes ?? "")
                  : (draft?.text ?? m.notes ?? m.id ?? "Custom mitigation");

                const title = draft?.isCustom
                  ? `[custom] ${draft.notes ?? ""}`
                  : draft?.text
                    ? `${m.id}: ${draft.text}`
                    : (m.id ?? m.notes ?? "Custom mitigation");

                return (
                  <Paper key={id || idx} variant="outlined" sx={{ p: 1.5 }}>
                    {/* Mitigation title — no divider below */}
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ mb: 1.5 }}
                    >
                      {title}
                    </Typography>

                    <Stack spacing={1.5}>
                      {/* Manual status — only in offline mode (no Jira ticket linked) */}
                      {!m.ticketId && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ minWidth: 60 }}
                          >
                            {t("tabs.risks.mitigationStatusDialog.status", {
                              defaultValue: "Status",
                            })}
                          </Typography>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select
                              value={m.status ?? "open"}
                              onChange={(e) =>
                                updateMitigation(m.id, {
                                  status: e.target.value as MitigationStatus,
                                })
                              }
                              size="small"
                              sx={{ fontSize: "0.8rem" }}
                              renderValue={(v) => {
                                const s = MITIGATION_STATUS_OPTIONS.find(
                                  (opt) => opt.value === v,
                                );
                                return (
                                  <Chip
                                    label={s?.label ?? v}
                                    size="small"
                                    sx={{
                                      bgcolor: s?.color,
                                      color: "#fff",
                                      fontSize: "0.65rem",
                                      height: 18,
                                    }}
                                  />
                                );
                              }}
                            >
                              {MITIGATION_STATUS_OPTIONS.map((s) => (
                                <MenuItem key={s.value} value={s.value}>
                                  <Chip
                                    label={s.label}
                                    size="small"
                                    sx={{
                                      bgcolor: s.color,
                                      color: "#fff",
                                      fontSize: "0.65rem",
                                      height: 18,
                                    }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {m.statusChangedAt && (
                            <Typography
                              variant="caption"
                              color="text.disabled"
                              sx={{ fontStyle: "italic" }}
                            >
                              {new Date(m.statusChangedAt).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Evidence note — only in offline mode */}
                      {!isJiraConnected && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ minWidth: 60, mt: 0.5 }}
                          >
                            {t("tabs.risks.mitigationStatusDialog.evidence", {
                              defaultValue: "Evidence",
                            })}
                          </Typography>
                          <TextField
                            size="small"
                            fullWidth
                            variant="outlined"
                            multiline
                            maxRows={3}
                            placeholder="Note, commit hash, test result, audit reference..."
                            value={m.evidenceNote ?? ""}
                            onChange={(e) =>
                              updateMitigation(m.id, {
                                evidenceNote: e.target.value,
                              })
                            }
                            inputProps={{ style: { fontSize: "0.8rem" } }}
                          />
                        </Box>
                      )}

                      {/* Reference — only in offline mode (no Jira connection, no linked ticket) */}
                      {!isJiraConnected && !m.ticketId && (
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ minWidth: 60 }}
                          >
                            {t("tabs.risks.mitigationStatusDialog.reference", {
                              defaultValue: "Reference",
                            })}
                          </Typography>
                          <TextField
                            size="small"
                            fullWidth
                            variant="outlined"
                            placeholder="Ticket ID, PR link, Jira/ADO reference..."
                            value={m.evidenceRef ?? ""}
                            onChange={(e) =>
                              updateMitigation(m.id, {
                                evidenceRef: e.target.value,
                              })
                            }
                            inputProps={{ style: { fontSize: "0.8rem" } }}
                            InputProps={{
                              endAdornment: m.evidenceRef?.startsWith(
                                "http",
                              ) ? (
                                <Tooltip title="Open link" placement="top">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      window.open(m.evidenceRef, "_blank")
                                    }
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : undefined,
                            }}
                          />
                        </Box>
                      )}

                      {/* Rejection reason */}
                      {m.status === "rejected" && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{ minWidth: 60, mt: 0.5 }}
                          >
                            {t(
                              "tabs.risks.mitigationStatusDialog.rejectionReason",
                              {
                                defaultValue: "Reason*",
                              },
                            )}
                          </Typography>
                          <TextField
                            size="small"
                            fullWidth
                            variant="outlined"
                            required
                            placeholder="Reason for not implementing this mitigation..."
                            value={m.rejectionReason ?? ""}
                            onChange={(e) =>
                              updateMitigation(m.id, {
                                rejectionReason: e.target.value,
                              })
                            }
                            error={!m.rejectionReason?.trim()}
                            helperText={
                              !m.rejectionReason?.trim()
                                ? "Required for audit trail"
                                : undefined
                            }
                            inputProps={{ style: { fontSize: "0.8rem" } }}
                          />
                        </Box>
                      )}

                      {/* Jira integration section */}
                      {isJiraConnected && jiraCredentials && (
                        <>
                          <JiraTicketPanel
                            mitigation={m}
                            mitigationText={mitigationText}
                            risk={risk}
                            credentials={jiraCredentials}
                            projectKey={jiraProjectKey}
                            issueTypes={
                              issueTypes.length
                                ? issueTypes
                                : [{ id: "task", name: "Task" }]
                            }
                            onLink={(updates) =>
                              updateMitigation(m.id, updates)
                            }
                          />
                        </>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>

            {/* Verifications reference */}
            {risk.proposedVerifications &&
              risk.proposedVerifications.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight="bold"
                    display="block"
                    sx={{ mb: 0.5 }}
                  >
                    {t("tabs.risks.mitigationStatusDialog.verifications", {
                      defaultValue: "Verifications (for testing reference)",
                    })}
                  </Typography>
                  <Stack spacing={0.5}>
                    {risk.proposedVerifications.map(
                      (v: MitigationDraftRef, idx: number) => {
                        const label = v.isCustom
                          ? `[custom] ${v.notes ?? ""}`
                          : v.text
                            ? `${v.id}: ${v.text}`
                            : (v.id ?? v.notes ?? "");
                        return (
                          <Typography
                            key={v.id ?? idx}
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "flex", gap: 0.5 }}
                          >
                            <span>✓</span>
                            <span>{label}</span>
                          </Typography>
                        );
                      },
                    )}
                  </Stack>
                </Box>
              )}
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: 3, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}
      >
        <Button onClick={handleCancel} size="small">
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={!hasMitigations}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RiskMitigationStatusDialog;