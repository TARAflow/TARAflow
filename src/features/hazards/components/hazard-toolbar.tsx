// features/hazards/components/hazard-toolbar.tsx
//
// Toolbar for the Hazard tab — same layout idiom as AssetsToolbar.
// Add | Import | Settings | … | count chip | validation chip | unsaved.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, Tooltip, Divider, Chip, Typography } from "@mui/material";
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  FileDownload as ImportIcon,
} from "@mui/icons-material";

import type { HazardValidation } from "../services/hazard-validator";

// ==================== TYPES ====================

export interface HazardToolbarProps {
  isDirty: boolean;
  validation: HazardValidation | null;
  hazardCount: number;
  onAdd: () => void;
  onImport: () => void;
  onOpenConfig: () => void;
}

// ==================== COMPONENT ====================

export const HazardToolbar = React.memo<HazardToolbarProps>(
  ({
    isDirty,
    validation,
    hazardCount,
    onAdd,
    onImport,
    onOpenConfig,
  }) => {
    const { t } = useTranslation();

    // Warnings show on the chip too — a complete graph with gaps in the
    // hazard texts is not "all green" (user 2026-10-30).
    const getStatusColor = (): "default" | "success" | "error" | "warning" => {
      if (!validation) return "default";
      if (validation.errors.length > 0) return "error";
      if (validation.warnings.length > 0) return "warning";
      if (validation.isComplete) return "success";
      return "warning";
    };

    const getStatusText = (): string => {
      if (!validation)
        return t("status.inProgress", { defaultValue: "In Progress" });
      if (validation.errors.length > 0)
        return `${validation.errors.length} ${t("common.errors", { defaultValue: "Errors" })}`;
      if (validation.warnings.length > 0)
        return `${validation.warnings.length} ${t("common.warnings", { defaultValue: "Warnings" })}`;
      if (validation.isComplete)
        return t("status.complete", { defaultValue: "Complete" });
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
        {/* Add hazard */}
        <Button
          startIcon={<AddIcon />}
          onClick={onAdd}
          size="small"
          variant="contained"
        >
          {t("tabs.hazards.addHazard", { defaultValue: "Add Hazard" })}
        </Button>

        {/* Import (between Add and Settings, divider on both sides) */}
        <Divider orientation="vertical" flexItem />
        <Tooltip
          title={t("tabs.hazards.import.title", {
            defaultValue: "Import Hazards",
          })}
        >
          <IconButton onClick={onImport} size="small">
            <ImportIcon />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem />

        {/* Settings */}
        <Tooltip
          title={t("tabs.hazards.configuration", {
            defaultValue: "Hazard Settings",
          })}
        >
          <IconButton onClick={onOpenConfig} size="small">
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        {/* Hazard count */}
        <Chip
          label={`${hazardCount} ${t("tabs.hazards.hazards", { defaultValue: "Hazards" })}`}
          size="small"
          variant="outlined"
        />

        {/* Validation status */}
        <Tooltip
          arrow
          placement="top"
          componentsProps={{ tooltip: { sx: { maxWidth: 360 } } }}
          title={
            validation &&
            (validation.errors.length > 0 || validation.warnings.length > 0) ? (
              <Box sx={{ p: 0.5 }}>
                {validation.errors.map((err, i) => (
                  <Typography
                    key={`e${i}`}
                    variant="caption"
                    display="block"
                    color="rgba(255,180,180,1)"
                  >
                    • {err}
                  </Typography>
                ))}
                {validation.warnings.map((warn, i) => (
                  <Typography
                    key={`w${i}`}
                    variant="caption"
                    display="block"
                    color="rgba(255,220,100,1)"
                  >
                    • {warn}
                  </Typography>
                ))}
              </Box>
            ) : (
              t("validation.noMessages", {
                defaultValue: "No validation messages",
              })
            )
          }
        >
          <Box component="span" sx={{ display: "inline-block" }}>
            <Chip
              label={getStatusText()}
              size="small"
              color={getStatusColor()}
            />
          </Box>
        </Tooltip>

        {/* Unsaved indicator */}
        {isDirty && (
          <Chip
            label={t("common.unsaved", { defaultValue: "Unsaved" })}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

      </Box>
    );
  },
);

HazardToolbar.displayName = "HazardToolbar";

export default HazardToolbar;