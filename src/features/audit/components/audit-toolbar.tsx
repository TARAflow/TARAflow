// ==================== AUDIT TOOLBAR ====================
// Top toolbar for Audit tab
// Features:
// - Git configuration button
// - Detail view toggle
// - Commit button
// - Status indicators

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Divider,
  Chip,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Visibility as DetailIcon,
  Commit as CommitIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";

// ==================== PROPS ====================

interface AuditToolbarProps {
  // Status
  hasChanges: boolean;
  changeCount: number;
  isConfigured: boolean;
  canCommit: boolean;
  
  // Actions
  onOpenConfig: () => void;
  onToggleDetail: () => void;
  onCommit: () => void;
  onRefresh: () => void;
  
  // State
  showDetail: boolean;
  currentBranch?: string;
}

// ==================== COMPONENT ====================

export const AuditToolbar: React.FC<AuditToolbarProps> = ({
  hasChanges,
  changeCount,
  isConfigured,
  canCommit,
  onOpenConfig,
  onToggleDetail,
  onCommit,
  onRefresh,
  showDetail,
  currentBranch,
}) => {
  const { t } = useTranslation();

  // ==================== STATUS ====================

  const getStatusColor = () => {
    if (!isConfigured) return "error";
    if (!hasChanges) return "success";
    return "warning";
  };

  const getStatusText = () => {
    if (!isConfigured) {
      return t("audit.status.notConfigured", {
        defaultValue: "Not Configured",
      });
    }
    if (!hasChanges) {
      return t("audit.status.noChanges", {
        defaultValue: "No Changes",
      });
    }
    return t("audit.status.hasChanges", {
      count: changeCount,
      defaultValue: `${changeCount} Change(s)`,
    });
  };

  const getStatusIcon = () => {
    if (!isConfigured) return <ErrorIcon fontSize="small" />;
    if (!hasChanges) return <CheckIcon fontSize="small" />;
    return <WarningIcon fontSize="small" />;
  };

  // ==================== RENDER ====================

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        flexWrap: "wrap",
      }}
    >
      {/* Git Configuration */}
      <Tooltip
        title={t("audit.toolbar.configure", {
          defaultValue: "Git Configuration",
        })}
      >
        <IconButton onClick={onOpenConfig} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Refresh */}
      <Tooltip
        title={t("audit.toolbar.refresh", {
          defaultValue: "Refresh Changes",
        })}
      >
        <IconButton onClick={onRefresh} size="small">
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Detail Toggle */}
      <Tooltip
        title={
          showDetail
            ? t("audit.toolbar.hideDetail", {
                defaultValue: "Hide Details",
              })
            : t("audit.toolbar.showDetail", {
                defaultValue: "Show Details",
              })
        }
      >
        <IconButton
          onClick={onToggleDetail}
          size="small"
          color={showDetail ? "primary" : "default"}
        >
          <DetailIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      {/* Current Branch */}
      {currentBranch && (
        <Chip
          label={currentBranch}
          size="small"
          variant="outlined"
          sx={{ fontFamily: "monospace" }}
        />
      )}

      {/* Status */}
      <Chip
        icon={getStatusIcon()}
        label={getStatusText()}
        size="small"
        color={getStatusColor()}
      />

      <Divider orientation="vertical" flexItem />

      {/* Commit Button */}
      <Button
        startIcon={<CommitIcon />}
        onClick={onCommit}
        disabled={!canCommit || !hasChanges}
        size="small"
        variant="contained"
        color="primary"
      >
        {t("audit.toolbar.commit", { defaultValue: "Commit" })}
      </Button>
    </Box>
  );
};

export default AuditToolbar;
