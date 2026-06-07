// features/hazards/components/hazard-config-dialog.tsx
//
// Project-level hazard settings (same dialog idiom as AssetConfigDialog, but a
// single form — hazards have no impact-criteria model). Edits a temp copy held
// by the tab; onChange streams edits, onSave commits, onClose discards.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Alert,
} from "@mui/material";

import type { HazardConfiguration } from "../models/hazard-data-types";
import type { HazardCombinationType } from "shared";

// ==================== TYPES ====================

interface HazardConfigDialogProps {
  open: boolean;
  configuration: HazardConfiguration;
  onChange: (config: HazardConfiguration) => void;
  onSave: () => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const HazardConfigDialog: React.FC<HazardConfigDialogProps> = ({
  open,
  configuration,
  onChange,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const setCombination = (value: HazardCombinationType | null) => {
    if (!value) return;
    onChange({ ...configuration, defaultCombinationType: value });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("tabs.hazards.config.title", { defaultValue: "Hazard Settings" })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          {/* Default combination type */}
          <FormControl>
            <FormLabel sx={{ mb: 1 }}>
              {t("tabs.hazards.config.defaultCombination", {
                defaultValue: "Default combination for new hazards",
              })}
            </FormLabel>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={configuration.defaultCombinationType}
              onChange={(_e, v) => setCombination(v as HazardCombinationType | null)}
            >
              <ToggleButton value="ANY" sx={{ textTransform: "none", px: 2 }}>
                {t("tabs.hazards.combination.any", { defaultValue: "ANY (independent causes)" })}
              </ToggleButton>
              <ToggleButton value="ALL" sx={{ textTransform: "none", px: 2 }}>
                {t("tabs.hazards.combination.all", { defaultValue: "ALL (combinatorial)" })}
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {t("tabs.hazards.config.combinationHint", {
                defaultValue:
                  "ANY: each cause alone triggers the hazard. ALL: only all contributions together arm it.",
              })}
            </Typography>
          </FormControl>

          <Divider />

          {/* Require ISO 12100 type */}
          <FormControlLabel
            control={
              <Checkbox
                checked={configuration.requireHazardType}
                onChange={(e) => onChange({ ...configuration, requireHazardType: e.target.checked })}
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  {t("tabs.hazards.config.requireType", {
                    defaultValue: "Require an ISO 12100 hazard type",
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.hazards.config.requireTypeHint", {
                    defaultValue: "When on, the Bowtie blocks saving a hazard without a type.",
                  })}
                </Typography>
              </Box>
            }
          />

          <Divider />

          {/* Hop limit (reserved for the future propagation engine) */}
          <FormControl>
            <FormLabel sx={{ mb: 1 }}>
              {t("tabs.hazards.config.maxHops", { defaultValue: "Propagation hop limit" })}
            </FormLabel>
            <RadioGroup
              row
              value={String(configuration.maxHops)}
              onChange={(e) =>
                onChange({ ...configuration, maxHops: Number(e.target.value) === 2 ? 2 : 1 })
              }
            >
              <FormControlLabel value="1" control={<Radio size="small" />} label="1" />
              <FormControlLabel value="2" control={<Radio size="small" />} label="2" />
            </RadioGroup>
            <Alert severity="info" sx={{ mt: 1 }}>
              {t("tabs.hazards.config.maxHopsHint", {
                defaultValue:
                  "Reserved for the upcoming safety derivation across asset-to-asset hops. No effect yet.",
              })}
            </Alert>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button onClick={onSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HazardConfigDialog;
