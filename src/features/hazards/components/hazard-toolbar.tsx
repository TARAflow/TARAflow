// features/hazards/components/hazard-toolbar.tsx
//
// Toolbar for the Hazard tab — same layout idiom as AssetsToolbar.
// Add | Import | Settings | … | count chip | validation chip | unsaved | Continue.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, Tooltip, Divider, Chip, Typography } from "@mui/material";
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  SkipNext as NextIcon,
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
  onProceed: () => void;
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
    onProceed,
  }) => {
    const { t } = useTranslation();

    const getStatusColor = (): "default" | "success" | "error" | "warning" => {
      if (!validation) return "default";
      if (validation.isComplete) return "success";
      if (validation.errors.length > 0) return "error";
      return "warning";
    };

    const getStatusText = (): string => {
      if (!validation)
        return t("status.inProgress", { defaultValue: "In Progress" });
      if (validation.isComplete)
        return t("status.complete", { defaultValue: "Complete" });
      if (validation.errors.length > 0)
        return `${validation.errors.length} ${t("common.errors", { defaultValue: "Errors" })}`;
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

        <Divider orientation="vertical" flexItem />

        {/* Proceed */}
        <Button
          endIcon={<NextIcon />}
          onClick={onProceed}
          disabled={!validation?.isComplete}
          size="small"
          variant="outlined"
          color="success"
        >
          {t("common.continue", { defaultValue: "Continue" })}
        </Button>
      </Box>
    );
  },
);

HazardToolbar.displayName = "HazardToolbar";

export default HazardToolbar;