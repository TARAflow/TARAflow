// ==================== AUDIT SUMMARY ====================
// Summary view of all changes
// Shows high-level overview with commit message preview

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  Divider,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import type { PhaseChanges, CommitMessageData } from "../models/audit-types";
import { generateCommitMessage } from "../models/audit-types";

// ==================== PROPS ====================

interface AuditSummaryProps {
  changes: PhaseChanges[];
  commitMessageData: CommitMessageData | null;
  lastCommitDate?: string;
}

// ==================== COMPONENT ====================

export const AuditSummary: React.FC<AuditSummaryProps> = ({
  changes,
  commitMessageData,
  lastCommitDate,
}) => {
  const { t } = useTranslation();

  // ==================== COMPUTED ====================

  const totalChanges = changes.reduce((sum, p) => sum + p.changeCount, 0);

  const changeTypeStats = changes.reduce(
    (stats, phase) => {
      phase.changes.forEach((change) => {
        stats[change.type]++;
      });
      return stats;
    },
    { added: 0, modified: 0, deleted: 0 }
  );

  // ==================== RENDER ====================

  if (changes.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {t("audit.summary.noChanges", {
            defaultValue: "No changes detected",
          })}
        </Typography>
        {lastCommitDate && (
          <Typography variant="body2" color="text.secondary">
            {t("audit.summary.lastCommit", {
              defaultValue: "Last commit:",
            })}{" "}
            {new Date(lastCommitDate).toLocaleString()}
          </Typography>
        )}
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Overview Card */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t("audit.summary.title", { defaultValue: "Changes Overview" })}
        </Typography>

        {/* Statistics */}
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Chip
            label={`${totalChanges} ${t("audit.summary.totalChanges", {
              defaultValue: "Total",
            })}`}
            size="small"
            color="primary"
          />
          {changeTypeStats.added > 0 && (
            <Chip
              icon={<AddIcon />}
              label={`${changeTypeStats.added} ${t("audit.summary.added", {
                defaultValue: "Added",
              })}`}
              size="small"
              color="success"
            />
          )}
          {changeTypeStats.modified > 0 && (
            <Chip
              icon={<EditIcon />}
              label={`${changeTypeStats.modified} ${t(
                "audit.summary.modified",
                { defaultValue: "Modified" },
              )}`}
              size="small"
              color="warning"
            />
          )}
          {changeTypeStats.deleted > 0 && (
            <Chip
              icon={<DeleteIcon />}
              label={`${changeTypeStats.deleted} ${t("audit.summary.deleted", {
                defaultValue: "Deleted",
              })}`}
              size="small"
              color="error"
            />
          )}
        </Box>

        {/* Phase Summary */}
        <Typography variant="subtitle2" gutterBottom>
          {t("audit.summary.affectedPhases", {
            defaultValue: "Affected Phases:",
          })}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {changes.map((phase) => (
            <Box
              key={phase.phase}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1,
                backgroundColor: "action.hover",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" fontWeight="medium">
                {phase.phaseLabel}
              </Typography>
              <Chip
                label={`${phase.changeCount} ${t("audit.summary.items", {
                  defaultValue: "items",
                })}`}
                size="small"
                variant="outlined"
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Commit Message Preview */}
      {commitMessageData && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t("audit.summary.commitMessagePreview", {
              defaultValue: "Commit Message Preview",
            })}
          </Typography>
          <Box
            sx={{
              p: 2,
              backgroundColor: "action.hover",
              borderRadius: 1,
              fontFamily: "monospace",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
              maxHeight: 300,
              overflow: "auto",
            }}
          >
            <Typography component="pre" sx={{ m: 0, fontFamily: "inherit" }}>
              {generateCommitMessage(commitMessageData)}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Info Alert */}
      <Alert severity="info">
        {t("audit.summary.info", {
          defaultValue:
            "Click 'Detail' in the toolbar to see detailed changes per phase, or 'Commit' to create a Git commit.",
        })}
      </Alert>
    </Box>
  );
};

export default AuditSummary;
