// ==================== RISK MITIGATION STATUS DIALOG ====================
// Execution-layer dialog: tracks implementation status of selected mitigations.
// Separated from risk-dialog to keep analyst workflow (assessment) and
// developer workflow (execution) distinct.
//
// Opens from: clickable Implementation chip in risk table.
// Used by: developers / implementers tracking mitigation rollout.
// Future: Jira / AzureDevOps sync via mapTicketStatusToMitigationStatus().
//
// Location: src/features/risks/components/risk-mitigation-status-dialog.tsx

import React, { useState, useCallback } from "react";
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
} from "@mui/material";
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { useTranslation as useT } from "react-i18next";

import type {
  Risk,
  SelectedMitigation,
  MitigationStatus,
} from "../models/risk-types";
import {
  MITIGATION_STATUS_CONFIGS,
  deriveImplementationProgress,
} from "../models/risk-types";

// ==================== STATUS CONFIG ====================

const MITIGATION_STATUS_OPTIONS: {
  value: MitigationStatus;
  label: string;
  color: string;
}[] = [
  { value: "open",         label: "Open",        color: "#9ca3af" },
  { value: "in_progress",  label: "In Progress", color: "#3b82f6" },
  { value: "in_review",    label: "In Review",   color: "#8b5cf6" },
  { value: "implemented",  label: "Implemented", color: "#22c55e" },
  { value: "verified",     label: "Verified",    color: "#16a34a" },
  { value: "rejected",     label: "Rejected",    color: "#ef4444" },
];

// ==================== PROPS ====================

export interface RiskMitigationStatusDialogProps {
  open: boolean;
  risk: Risk;
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const RiskMitigationStatusDialog: React.FC<
  RiskMitigationStatusDialogProps
> = ({ open, risk, onSave, onClose }) => {
  const { t } = useTranslation();

  // Local copy of mitigations for editing
  const [mitigations, setMitigations] = useState<SelectedMitigation[]>(
    () => risk.selectedMitigations.map((m) => ({ ...m })),
  );

  // Sync when risk changes (e.g. navigation between risks)
  React.useEffect(() => {
    setMitigations(risk.selectedMitigations.map((m) => ({ ...m })));
  }, [risk.id, risk.selectedMitigations]);

  const updateMitigation = useCallback(
    (id: string | undefined, updates: Partial<SelectedMitigation>) => {
      setMitigations((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                ...updates,
                // Track when status changed
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
    // Reset to original
    setMitigations(risk.selectedMitigations.map((m) => ({ ...m })));
    onClose();
  }, [risk, onClose]);

  const impl = deriveImplementationProgress(mitigations);
  const implConfig = MITIGATION_STATUS_CONFIGS.find(
    (c) => c.value === impl,
  ) ?? {
    value: "open",
    label: "Open",
    color: "#9ca3af",
    icon: "⚪",
  };

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
              {(risk.attackDescription.length) > 80 ? "…" : ""}
            </Typography>
          )}
        </Box>

        {/* Overall implementation chip */}
        <Chip
          label={`${implConfig.icon} ${t(
            `risks.implementation.${impl}.label`,
            { defaultValue: implConfig.label },
          )}`}
          size="small"
          sx={{ bgcolor: implConfig.color, color: "white", fontSize: "0.72rem" }}
        />

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
          <Stack spacing={2}>
            {mitigations.map((m, idx) => {
              const id = m.id ?? m.notes ?? "";
              const statusConfig = MITIGATION_STATUS_OPTIONS.find(
                (s) => s.value === m.status,
              );

              return (
                <Paper key={id || idx} variant="outlined" sx={{ p: 1.5 }}>
                  {/* Mitigation header */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    {(() => {
                      // Use pre-resolved text from proposedMitigations (synced from catalog)
                      const draft = risk.proposedMitigations?.find(
                        (p) => p.id === m.id,
                      );
                      const title = draft?.isCustom
                        ? `[custom] ${draft.notes ?? ""}`
                        : draft?.text
                          ? `${m.id}: ${draft.text}`
                          : m.id ?? m.notes ?? "Custom mitigation";
                      return (
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{ flexGrow: 1 }}
                        >
                          {title}
                        </Typography>
                      );
                    })()}
                  </Box>

                  <Stack spacing={1}>
                    {/* Status select */}
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
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
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select
                          value={m.status ?? "open"}
                          onChange={(e) =>
                            updateMitigation(m.id, {
                              status: e.target.value as MitigationStatus,
                            })
                          }
                          sx={{
                            fontSize: "0.8rem",
                            "& .MuiSelect-select": { py: 0.5 },
                          }}
                        >
                          {MITIGATION_STATUS_OPTIONS.map((s) => (
                            <MenuItem key={s.value} value={s.value}>
                              <Chip
                                label={t(
                                  `risks.mitigationStatus.${s.value}.label`,
                                  { defaultValue: s.label },
                                )}
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

                      {/* Status timestamp */}
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

                    {/* Evidence note */}
                    <Box
                      sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
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
                        placeholder={t(
                          "tabs.risks.mitigationStatusDialog.evidencePlaceholder",
                          {
                            defaultValue:
                              "Note, commit hash, test result, audit reference...",
                          },
                        )}
                        value={m.evidenceNote ?? ""}
                        onChange={(e) =>
                          updateMitigation(m.id, {
                            evidenceNote: e.target.value,
                          })
                        }
                        inputProps={{ style: { fontSize: "0.8rem" } }}
                      />
                    </Box>

                    {/* Reference / Ticket link */}
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
                        placeholder={t(
                          "tabs.risks.mitigationStatusDialog.referencePlaceholder",
                          {
                            defaultValue:
                              "Ticket ID, PR link, Jira/ADO reference...",
                          },
                        )}
                        value={m.evidenceRef ?? ""}
                        onChange={(e) =>
                          updateMitigation(m.id, {
                            evidenceRef: e.target.value,
                          })
                        }
                        inputProps={{ style: { fontSize: "0.8rem" } }}
                        InputProps={{
                          endAdornment: m.evidenceRef?.startsWith("http") ? (
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

                    {/* Rejection reason — only when rejected */}
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
                            { defaultValue: "Reason*" },
                          )}
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          variant="outlined"
                          required
                          placeholder={t(
                            "tabs.risks.mitigationStatusDialog.rejectionPlaceholder",
                            {
                              defaultValue:
                                "Reason for not implementing this mitigation...",
                            },
                          )}
                          value={m.rejectionReason ?? ""}
                          onChange={(e) =>
                            updateMitigation(m.id, {
                              rejectionReason: e.target.value,
                            })
                          }
                          error={!m.rejectionReason?.trim()}
                          helperText={
                            !m.rejectionReason?.trim()
                              ? t(
                                  "tabs.risks.mitigationStatusDialog.rejectionRequired",
                                  {
                                    defaultValue: "Required for audit trail",
                                  },
                                )
                              : undefined
                          }
                          inputProps={{ style: { fontSize: "0.8rem" } }}
                        />
                      </Box>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          {/* Verifications — shown as reference for testing/evidence */}
          {risk.proposedVerifications && risk.proposedVerifications.length > 0 && (
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
                {risk.proposedVerifications.map((v, idx) => {
                  const label = v.isCustom
                    ? `[custom] ${v.notes ?? ""}`
                    : v.text
                      ? `${v.id}: ${v.text}`
                      : v.id ?? v.notes ?? "";
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
                })}
              </Stack>
            </Box>
          )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
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