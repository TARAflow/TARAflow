// ==================== RISKS TOOLBAR ====================
// Toolbar component for Risk Assessment tab
// Contains all controls and status indicators

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Button,
  Divider,
  Chip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Badge,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Sync as SyncIcon,
  SkipNext as NextIcon,
  Warning as WarningIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  GridOn as MatrixIcon,
  TableChart as TableIcon,
  GridView as PerElementIcon,
  AccountTree as PerInteractionIcon,
  DoNotDisturb as WontIcon,
  Search as SearchIcon,
} from "@mui/icons-material";

import type { StrideMethod } from "shared";
import { RiskMethodType } from "../models/risk-types";
import { MainView } from "../utils/risks-tab-helpers";

// ==================== PROPS ====================

export interface RisksToolbarProps {
  isDirty: boolean;
  isSyncing: boolean;
  riskMethod: RiskMethodType;
  activeStrideMethod: StrideMethod;
  riskCount: number;
  assessedRiskCount: number;
  completedRiskCount: number;
  wontCount: number;
  perElementCount: number;
  perInteractionCount: number;
  /** Tab switch only enabled when both methods have eligible threats */
  canSwitchStrideMethod: boolean;
  hasRisks: boolean;
  hasThreatsForMethod: boolean;
  hasAnyThreats: boolean;
  needsSync: boolean;
  showDfdPreview: boolean;
  mainView: MainView;
  showWontTable: boolean;
  showFilters: boolean;
  onToggleDfdPreview: () => void;
  onMainViewChange: (view: MainView) => void;
  onStrideMethodChange: (
    event: React.MouseEvent<HTMLElement>,
    method: StrideMethod | null,
  ) => void;
  onSync: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onToggleWontTable: () => void;
  onToggleFilters: () => void;
  onProceed: () => void;
}

// ==================== COMPONENT ====================

export const RisksToolbar: React.FC<RisksToolbarProps> = ({
  isDirty,
  isSyncing,
  riskMethod,
  activeStrideMethod,
  riskCount,
  assessedRiskCount,
  completedRiskCount,
  wontCount,
  perElementCount,
  perInteractionCount,
  canSwitchStrideMethod,
  hasRisks,
  hasThreatsForMethod,
  hasAnyThreats,
  needsSync,
  showDfdPreview,
  mainView,
  showWontTable,
  showFilters,
  onToggleDfdPreview,
  onMainViewChange,
  onStrideMethodChange,
  onSync,
  onOpenConfig,
  onExport,
  onImport,
  onToggleWontTable,
  onToggleFilters,
  onProceed,
}) => {
  const { t } = useTranslation();

  const getStatusColor = (): "default" | "success" | "warning" | "error" => {
    if (riskCount === 0) return "default";
    // Complete: All risks have status !== "open"
    if (completedRiskCount === riskCount) return "success";
    // In progress: At least some risks assessed
    if (assessedRiskCount > 0) return "warning";
    // Not started
    return "default";
  };

  const getStatusText = () => {
    if (riskCount === 0) {
      return t("status.notStarted", { defaultValue: "Not Started" });
    }
    // Complete: All risks have status !== "open"
    if (completedRiskCount === riskCount) {
      return t("status.complete", { defaultValue: "Complete" });
    }
    // In progress
    return t("status.inProgress", { defaultValue: "In Progress" });
  };

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
      {/* DFD Preview Toggle */}
      <Tooltip
        title={
          showDfdPreview
            ? t("common.hideDFD", {
                defaultValue: "Hide DFD Preview",
              })
            : t("common.showDFD", {
                defaultValue: "Show DFD Preview",
              })
        }
      >
        <IconButton
          onClick={onToggleDfdPreview}
          size="small"
          color={showDfdPreview ? "primary" : "default"}
        >
          {showDfdPreview ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Main View Toggle (Table / Matrix) */}
      <ToggleButtonGroup
        value={mainView}
        exclusive
        onChange={(_, v) => v && onMainViewChange(v)}
        size="small"
      >
        <ToggleButton value="table">
          <Tooltip
            title={t("tabs.risks.showTable", { defaultValue: "Risk Table" })}
          >
            <TableIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="matrix">
          <Tooltip
            title={t("tabs.risks.showMatrix", { defaultValue: "Risk Matrix" })}
          >
            <MatrixIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* STRIDE Method Toggle */}
      <ToggleButtonGroup
        value={activeStrideMethod}
        exclusive
        onChange={onStrideMethodChange}
        size="small"
      >
        <ToggleButton
          value="per-element"
          disabled={!canSwitchStrideMethod || perElementCount === 0}
        >
          <Tooltip
            title={`${t("tabs.risks.perElement", {
              defaultValue: "Per-Element",
            })} (${perElementCount})`}
          >
            {/* Badge only on inactive button, only when count > 0 */}
            {activeStrideMethod !== "per-element" && perElementCount > 0 ? (
              <Badge badgeContent={perElementCount} color="primary" max={999}>
                <PerElementIcon fontSize="small" />
              </Badge>
            ) : (
              <PerElementIcon fontSize="small" />
            )}
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="per-interaction"
          disabled={!canSwitchStrideMethod || perInteractionCount === 0}
        >
          <Tooltip
            title={`${t("tabs.risks.perInteraction", {
              defaultValue: "Per-Interaction",
            })} (${perInteractionCount})`}
          >
            {/* Badge only on inactive button, only when count > 0 */}
            {activeStrideMethod !== "per-interaction" &&
            perInteractionCount > 0 ? (
              <Badge
                badgeContent={perInteractionCount}
                color="primary"
                max={999}
              >
                <PerInteractionIcon fontSize="small" />
              </Badge>
            ) : (
              <PerInteractionIcon fontSize="small" />
            )}
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Chip
        label={
          activeStrideMethod === "per-element"
            ? "Per-Element"
            : "Per-Interaction"
        }
        size="small"
        variant="outlined"
      />

      <Divider orientation="vertical" flexItem />

      {/* Sync */}
      <Tooltip
        title={t("tabs.risks.syncFromThreats", {
          defaultValue: "Sync from Threats",
        })}
      >
        <span>
          <IconButton
            onClick={onSync}
            size="small"
            color={needsSync ? "warning" : "default"}
            disabled={!hasAnyThreats || isSyncing}
          >
            {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Configuration */}
      <Tooltip
        title={t("tabs.risks.configuration", { defaultValue: "Configuration" })}
      >
        <IconButton onClick={onOpenConfig} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      {/* Export */}
      <Tooltip title={t("common.export", { defaultValue: "Export" })}>
        <span>
          <IconButton onClick={onExport} size="small" disabled={!hasRisks}>
            <ExportIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Import */}
      <Tooltip title={t("common.import", { defaultValue: "Import" })}>
        <IconButton onClick={onImport} size="small">
          <ImportIcon />
        </IconButton>
      </Tooltip>

      {/* Filters Toggle */}
      <Tooltip
        title={
          showFilters
            ? t("common.hideFilters", { defaultValue: "Hide Filters" })
            : t("common.showFilters", { defaultValue: "Show Filters" })
        }
      >
        <IconButton
          onClick={onToggleFilters}
          size="small"
          color={showFilters ? "primary" : "default"}
        >
          <SearchIcon />
        </IconButton>
      </Tooltip>

      {/* Won't Table Toggle */}
      {wontCount > 0 && (
        <Tooltip
          title={
            showWontTable
              ? t("tabs.risks.hideWont", { defaultValue: "Hide Won't Risks" })
              : t("tabs.risks.showWont", { defaultValue: "Show Won't Risks" })
          }
        >
          <IconButton
            onClick={onToggleWontTable}
            size="small"
            color={showWontTable ? "primary" : "default"}
          >
            <Badge badgeContent={wontCount} color="default">
              <WontIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {/* Sync Status */}
      {needsSync && (
        <Chip
          icon={<WarningIcon />}
          label={t("tabs.risks.outOfSync", { defaultValue: "Out of sync" })}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      {/* Stats - n/m format: assessed/total */}
      <Tooltip
        title={t("tabs.risks.assessedTooltip", {
          defaultValue: "Assessed risks / Total risks",
        })}
      >
        <Chip
          label={`${assessedRiskCount}/${riskCount} ${t("tabs.risks.risks", {
            defaultValue: "Risks",
          })}`}
          size="small"
          variant="outlined"
        />
      </Tooltip>

      <Chip label={getStatusText()} size="small" color={getStatusColor()} />

      {isDirty && (
        <Chip
          label={t("common.unsaved", { defaultValue: "Unsaved" })}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      <Divider orientation="vertical" flexItem />

      {/* Proceed */}
      <Button
        endIcon={<NextIcon />}
        onClick={onProceed}
        disabled={riskCount === 0 || completedRiskCount !== riskCount}
        size="small"
        variant="outlined"
        color="success"
      >
        {t("common.continue", { defaultValue: "Continue" })}
      </Button>
    </Box>
  );
};

export default RisksToolbar;