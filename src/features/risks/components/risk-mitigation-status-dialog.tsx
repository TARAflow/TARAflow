// ==================== RISK MITIGATION STATUS DIALOG ====================
// Execution-layer dialog: tracks implementation status of selected mitigations.
//
// The status is set by hand; a linked ticket moves it when the ticket
// changes (adapters design §3.2). With a ticket, progress (open … implemented)
// comes from the ticket only — it is changed in the tracker; left to choose
// are "verified" once the ticket is done and "rejected" (IT-14). With a tracker connected, a done status
// without a ticket needs evidence or a reference (user 2026-11-10) — the
// dialog does not save without it. Evidence and reference are offered
// whenever no ticket is linked, connected or not.
//
//   Offline — manual status + evidence + reference
//   Tracker — per mitigation one ticket row (mitigation-ticket-row.tsx):
//             link / create in their own dialog
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
  FormControl,
  Select,
  MenuItem,
  TextField,
  Tooltip,
  IconButton,
  Paper,
} from "@mui/material";
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  ConfirmationNumber as TicketIcon,
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
  mitigationSelectionKey,
} from "../models/risk-mitigation-types";
import type { RiskIntegrationConnection } from "../models/risk-integration-types";
import type { TicketPort } from "shared/models/ticket-types";
import { differsFromTicket, hasRejectionReason, selectableWithTicket, statusFromTicket } from "../services/ticket-sync";
import { needsStatusEvidence } from "../services/mitigation-evidence";
import { MitigationTicketRow } from "./mitigation-ticket-row";
import type { TicketLink } from "../services/ticket-links";

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
  /** The stored connection (project key) — tickets need it and a port. */
  integrationConnection?: RiskIntegrationConnection | null;
  /** The issue tracker, through its adapter (adapters design §4.3). */
  ticketPort?: TicketPort | null;
  /** Issue types of the connected project (stored when it was chosen). */
  issueTypes?: Array<{ id: string; name: string; iconUrl?: string }>;
  /** Every ticket link of the project (link dialog: marked tickets, suggestions). */
  ticketLinks?: readonly TicketLink[];
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
}

// ==================== MAIN DIALOG ====================

export const RiskMitigationStatusDialog: React.FC<
  RiskMitigationStatusDialogProps
> = ({ open, risk, integrationConnection, ticketPort, issueTypes: projectIssueTypes, ticketLinks, onSave, onClose }) => {
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

  // Issue tracker: a port (adapter) and a chosen project.
  const isJiraConnected =
    !!ticketPort &&
    integrationConnection?.status === "connected" &&
    !!integrationConnection?.projectName;
  const jiraProjectKey = integrationConnection?.projectName ?? "";
  const issueTypes = projectIssueTypes ?? [];

  // Keyed by the selection key: custom mitigations have no id, and keying by
  // id changed all of them at once (e.g. a ticket linked to every one).
  const updateMitigation = useCallback(
    (key: string, updates: Partial<SelectedMitigation>) => {
      setMitigations((prev) =>
        prev.map((m) =>
          mitigationSelectionKey(m) === key
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
  // A done status without ticket needs evidence while a tracker is connected.
  const missingEvidence = mitigations.some((m) => needsStatusEvidence(m, isJiraConnected));

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
            {risk.threatDisplayId} — {risk.threatDescription?.slice(0, 80)}
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
                      {/* Status — also with a linked ticket: the status follows the
                          ticket when the ticket changes; in between the analyst
                          sets it (verified, rejected …), adapters design §3.2. */}
                      {(
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
                                updateMitigation(mitigationSelectionKey(m), {
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
                                <MenuItem
                                  key={s.value}
                                  value={s.value}
                                  // With a ticket, progress comes from the ticket (IT-14).
                                  disabled={!!m.ticketId && !selectableWithTicket(m).has(s.value)}
                                  data-testid={`status-option-${s.value}`}
                                >
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
                          {m.ticketId && (
                            <Typography variant="caption" color="text.secondary" data-testid="status-follows-ticket">
                              {t("tabs.risks.mitigationStatusDialog.followsTicket", {
                                defaultValue: "progress comes from {{ticket}} — change it in the tracker; verified once it is done",
                                ticket: m.ticketId,
                              })}
                            </Typography>
                          )}
                          {m.ticketId && differsFromTicket(m) && (
                            <Button
                              size="small"
                              onClick={() =>
                                updateMitigation(mitigationSelectionKey(m), {
                                  status: statusFromTicket(m.ticketStatus)!,
                                })
                              }
                              data-testid="status-follow-ticket"
                            >
                              {t("tabs.risks.mitigationStatusDialog.followTicketAgain", {
                                defaultValue: "Follow {{ticket}} again",
                                ticket: m.ticketId,
                              })}
                            </Button>
                          )}
                          {!m.ticketId && isJiraConnected && (
                            <Typography variant="caption" color="text.secondary" data-testid="status-set-by-hand">
                              {t("tabs.risks.mitigationStatusDialog.setByHand", {
                                defaultValue: "set by hand",
                              })}
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Evidence note — whenever no ticket is linked */}
                      {(!m.ticketId || !!m.evidenceNote) && (
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
                            placeholder={t("tabs.risks.mitigationStatusDialog.evidencePlaceholder", {
                              defaultValue: "Note, commit hash, test result, audit reference...",
                            })}
                            value={m.evidenceNote ?? ""}
                            onChange={(e) =>
                              updateMitigation(mitigationSelectionKey(m), {
                                evidenceNote: e.target.value,
                              })
                            }
                            error={needsStatusEvidence(m, isJiraConnected)}
                            helperText={
                              needsStatusEvidence(m, isJiraConnected)
                                ? t("tabs.risks.mitigationStatusDialog.evidenceRequired", {
                                    defaultValue: "Without a linked ticket this status needs evidence or a reference",
                                  })
                                : undefined
                            }
                            inputProps={{ style: { fontSize: "0.8rem" }, "data-testid": "status-evidence" }}
                          />
                        </Box>
                      )}

                      {/* Reference — whenever no ticket is linked */}
                      {!m.ticketId && (
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
                            placeholder={t("tabs.risks.mitigationStatusDialog.referencePlaceholder", {
                              defaultValue: "Ticket ID, PR link, Jira/ADO reference...",
                            })}
                            error={needsStatusEvidence(m, isJiraConnected)}
                            value={m.evidenceRef ?? ""}
                            onChange={(e) =>
                              updateMitigation(mitigationSelectionKey(m), {
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
                            placeholder={t("tabs.risks.mitigationStatusDialog.rejectionPlaceholder", {
                              defaultValue: "Reason for not implementing this mitigation...",
                            })}
                            value={m.rejectionReason ?? ""}
                            onChange={(e) =>
                              updateMitigation(mitigationSelectionKey(m), {
                                rejectionReason: e.target.value,
                              })
                            }
                            error={!hasRejectionReason(m)}
                            helperText={
                              m.rejectedByTicket
                                ? t("tabs.risks.mitigationStatusDialog.rejectedByTicket", {
                                    defaultValue: "Ticket {{key}} closed as {{resolution}}",
                                    key: m.rejectedByTicket.key,
                                    resolution: m.rejectedByTicket.resolution,
                                  })
                                : !hasRejectionReason(m)
                                  ? t("tabs.risks.mitigationStatusDialog.rejectionRequired", {
                                      defaultValue: "Required for audit trail",
                                    })
                                  : undefined
                            }
                            inputProps={{ style: { fontSize: "0.8rem" } }}
                          />
                        </Box>
                      )}

                      {/* Jira integration section */}
                      {isJiraConnected && ticketPort && (
                        <>
                          <MitigationTicketRow
                            mitigation={m}
                            mitigationText={mitigationText}
                            risk={risk}
                            port={ticketPort}
                            projectKey={jiraProjectKey}
                            issueTypes={
                              issueTypes.length
                                ? issueTypes
                                : [{ id: "task", name: "Task" }]
                            }
                            links={ticketLinks}
                            onLink={(updates) =>
                              updateMitigation(mitigationSelectionKey(m), updates)
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
          disabled={!hasMitigations || missingEvidence}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RiskMitigationStatusDialog;