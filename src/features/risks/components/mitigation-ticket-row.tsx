// ==================== MITIGATION TICKET ROW ====================
// The ticket of one mitigation in the status dialog (adapters design §3).
// Linked: the ticket card (status, sync, open, unlink). Not linked: one
// compact row "No ticket — Link… / Create…"; linking and creating open their
// own dialog, so the status dialog stays short with several mitigations and
// the tracker is asked for tickets only when the analyst wants to link
// (user 2026-11-10). Split out of risk-mitigation-status-dialog.tsx. The
// link dialog (search, status filter, suggestions): ticket-link-dialog.tsx.

import React, { useState, useEffect } from "react";
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
  FormControl,
  Select,
  MenuItem,
  TextField,
  Tooltip,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  InputLabel,
} from "@mui/material";
import {
  OpenInNew as OpenInNewIcon,
  Sync as SyncIcon,
  Add as AddIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  ConfirmationNumber as TicketIcon,
} from "@mui/icons-material";

import type { Risk } from "../models/risk-assessment-types";
import type { SelectedMitigation } from "../models/risk-mitigation-types";
import type { TicketPort } from "shared/models/ticket-types";
import { buildTicketDescription, buildTicketSummary } from "../services/ticket-text";
import { useUncreditedResiduals } from "./credited-residual-context";
import { applyTicketState } from "../services/ticket-sync";
import type { TicketLink } from "../services/ticket-links";
import { TicketLinkDialog, type PickedTicket } from "./ticket-link-dialog";



export interface MitigationTicketRowProps {
  mitigation: SelectedMitigation;
  mitigationText: string;
  risk: Risk;
  port: TicketPort;
  projectKey: string;
  issueTypes: Array<{ id: string; name: string; iconUrl?: string }>;
  /** Every ticket link of the project — the link dialog marks and suggests from it. */
  links?: readonly TicketLink[];
  onLink: (m: Partial<SelectedMitigation>) => void;
}


export const MitigationTicketRow: React.FC<MitigationTicketRowProps> = ({
  mitigation,
  mitigationText,
  risk,
  port,
  projectKey,
  issueTypes: issueTypesProp,
  links = [],
  onLink,
}) => {
  const { t } = useTranslation();

  // Which ticket dialog is open: linking an existing one or creating one.
  const [mode, setMode] = useState<"link" | "create" | null>(null);

  // Issue types a ticket can be created with (no sub-tasks).
  const availableIssueTypes = issueTypesProp.filter((it) => !it.name.toLowerCase().includes("subtask"));
  // The ticket picked in the link dialog — its summary, type, assignee for the card.
  const [picked, setPicked] = useState<PickedTicket | null>(null);

  // Create new ticket state — default to first real type
  const [createIssueType, setCreateIssueType] = useState(
    issueTypesProp.find((it) => !it.name.toLowerCase().includes("subtask"))?.name ?? "Task",
  );
  const [summary, setSummary] = useState(() =>
    buildTicketSummary(risk, mitigationText),
  );
  // The residual may not count (I7 (4)) — the ticket says so next to the target value.
  const uncredited = useUncreditedResiduals();
  const [description, setDescription] = useState(() =>
    buildTicketDescription(risk, mitigation, mitigationText, uncredited?.get(risk.id) ?? []),
  );
  const [priority, setPriority] = useState("Medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  /**
   * Adopt the ticket's state (adapters design §3.2: only a change of the
   * ticket is applied, both directions). `base` is the mitigation the state
   * applies to — a newly linked ticket starts without a last seen status.
   */
  const adoptTicket = async (base: SelectedMitigation) => {
    if (!base.ticketId) return;
    const state = (await port.fetchTicketStates([base.ticketId])).get(base.ticketId);
    const next = applyTicketState(base, state, new Date().toISOString());
    if (next === mitigation) return;
    onLink({
      ticketId: next.ticketId,
      ticketUrl: next.ticketUrl,
      ticketStatus: next.ticketStatus,
      ticketSyncedAt: next.ticketSyncedAt,
      status: next.status,
      rejectedByTicket: next.rejectedByTicket,
    });
  };

  // Sync once when the dialog opens on a linked ticket — no polling (§3.3).
  useEffect(() => {
    if (mitigation.ticketId) void adoptTicket(mitigation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mitigation.ticketId, port]);

  const handleSyncStatus = async () => {
    if (!mitigation.ticketId) return;
    setSyncing(true);
    try {
      await adoptTicket(mitigation);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTicket = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await port.createTicket({
        projectKey,
        issueType: createIssueType,
        summary,
        description,
        priority,
        labels: ["security", "threat-model"],
      });
      if (result.success && result.ticketId) {
        // Link and adopt the new ticket's state.
        await adoptTicket({
          ...mitigation,
          ticketId: result.ticketId,
          ticketUrl: result.ticketUrl,
          ticketStatus: undefined,
        });
        setMode(null);
      } else {
        setCreateError(result.error ?? t("tabs.risks.ticketLink.createFailed", { defaultValue: "The ticket could not be created." }));
      }
    } finally {
      setCreating(false);
    }
  };

  // Already linked — show Jira-style card
  if (mitigation.ticketId) {
    // Details only of the ticket just picked; a stored link has key and status.
    const linkedTicket = picked?.key === mitigation.ticketId ? picked : undefined;

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
              <Tooltip title={t("tabs.risks.ticketLink.sync", { defaultValue: "Take over the ticket's status" })}>
                <IconButton size="small" onClick={handleSyncStatus} disabled={syncing} sx={{ p: 0.25 }}>
                  {syncing
                    ? <CircularProgress size={12} />
                    : <SyncIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
              {mitigation.ticketUrl && (
                <Tooltip title={t("tabs.risks.ticketLink.open", { defaultValue: "Open in the tracker" })}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.25 }}
                    onClick={() => window.open(mitigation.ticketUrl, "_blank")}
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t("tabs.risks.ticketLink.unlink", { defaultValue: "Unlink the ticket" })}>
                <IconButton
                  size="small"
                  color="error"
                  sx={{ p: 0.25 }}
                  onClick={() => {
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
                    : t("tabs.risks.ticketLink.unknown", { defaultValue: "Unknown" })
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
                {linkedTicket?.assignee ?? t("tabs.risks.ticketLink.unassigned", { defaultValue: "Unassigned" })}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>·</Typography>
              <Typography sx={{ fontSize: 12 }}>🏃</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {linkedTicket?.sprint ?? t("tabs.risks.ticketLink.backlog", { defaultValue: "Backlog" })}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  const label = mitigation.id ?? mitigationText;
  return (
    <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }} data-testid="ticket-row-none">
      <TicketIcon sx={{ fontSize: 14, color: "text.disabled" }} />
      <Typography variant="caption" color="text.secondary">
        {t("tabs.risks.mitigationStatusDialog.noTicket", { defaultValue: "No ticket" })}
      </Typography>
      <Button size="small" startIcon={<LinkIcon sx={{ fontSize: 14 }} />} onClick={() => setMode("link")} data-testid="ticket-link-open">
        {t("tabs.risks.mitigationStatusDialog.linkTicket", { defaultValue: "Link…" })}
      </Button>
      <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setMode("create")} data-testid="ticket-create-open">
        {t("tabs.risks.mitigationStatusDialog.createTicket", { defaultValue: "Create…" })}
      </Button>

      {/* Linking and creating in their own dialog: the status dialog stays short. */}
      <TicketLinkDialog
        open={mode === "link"}
        label={label}
        mitigationId={mitigation.id}
        riskId={risk.id}
        port={port}
        projectKey={projectKey}
        issueTypes={issueTypesProp}
        links={links}
        onLink={async (ticket) => {
          setPicked(ticket);
          // Link the ticket and adopt its state.
          await adoptTicket({ ...mitigation, ticketId: ticket.key, ticketUrl: ticket.url, ticketStatus: undefined });
          setMode(null);
        }}
        onCreateInstead={() => setMode("create")}
        onClose={() => setMode(null)}
      />
      <Dialog open={mode === "create"} onClose={() => setMode(null)} maxWidth="sm" fullWidth data-testid="ticket-dialog">
        <DialogTitle sx={{ pb: 1 }}>
          {t("tabs.risks.mitigationStatusDialog.createTicketTitle", { defaultValue: "New ticket for {{mitigation}}", mitigation: label })}
        </DialogTitle>
        <DialogContent dividers>
          {/* Create new ticket */}
          {mode === "create" && (
            <Stack spacing={1}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel sx={{ fontSize: 12 }}>{t("tabs.risks.ticketLink.type", { defaultValue: "Type" })}</InputLabel>
                  <Select
                    value={createIssueType}
                    onChange={(e) => setCreateIssueType(e.target.value)}
                    label={t("tabs.risks.ticketLink.type", { defaultValue: "Type" })}
                    sx={{ fontSize: 12 }}
                  >
                    {availableIssueTypes
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
                  <InputLabel sx={{ fontSize: 12 }}>{t("tabs.risks.ticketLink.priority", { defaultValue: "Priority" })}</InputLabel>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    label={t("tabs.risks.ticketLink.priority", { defaultValue: "Priority" })}
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
                label={t("tabs.risks.ticketLink.summary", { defaultValue: "Title" })}
                fullWidth
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                inputProps={{ style: { fontSize: 12 }, maxLength: 255 }}
              />

              <TextField
                size="small"
                label={t("tabs.risks.ticketLink.description", { defaultValue: "Description" })}
                fullWidth
                multiline
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                inputProps={{ style: { fontSize: 11 } }}
                helperText={t("tabs.risks.ticketLink.descriptionHint", { defaultValue: "Pre-filled from the risk (EARS style); edit as needed." })}
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
                {t("tabs.risks.ticketLink.create", { defaultValue: "Create ticket" })}
              </Button>
            </Stack>
          )}

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(null)}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
