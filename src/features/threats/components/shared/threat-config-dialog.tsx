// ==================== THREAT CONFIG DIALOG ====================
// Configuration dialog for STRIDE method settings.
// Custom template tabs removed — MitigationEntry/VerificationEntry no longer
// carry inline text (resolved via i18n). Custom catalog extension will be
// redesigned in a later step.

import React, { useState } from "react";
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
  Switch,
  Divider,
  Alert,
} from "@mui/material";

import type {
  ThreatConfiguration,
  StrideMethod,
} from "../../models/threat-types";

// ==================== TYPES ====================

interface ThreatConfigDialogProps {
  open: boolean;
  configuration: ThreatConfiguration;
  hasExistingThreats: boolean;
  onSave: (config: ThreatConfiguration) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const ThreatConfigDialog: React.FC<ThreatConfigDialogProps> = ({
  open,
  configuration,
  hasExistingThreats,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const [activeMethod, setActiveMethod] = useState<StrideMethod>(
    configuration.activeMethod,
  );
  const [zeroTrustMode, setZeroTrustMode] = useState(
    configuration.zeroTrustMode ?? false,
  );
  const [showThreatActor, setShowThreatActor] = useState(
    configuration.showThreatActor ?? false,
  );

  const handleSave = () => {
    onSave({
      activeMethod,
      zeroTrustMode,
      showThreatActor,
      customElementTemplates: configuration.customElementTemplates,
      customInteractionTemplates: configuration.customInteractionTemplates,
      customMitigations: configuration.customMitigations,
      customVerifications: configuration.customVerifications,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("tabs.threats.config.title", {
          defaultValue: "Threat Analysis Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Method */}
          <FormControl>
            <FormLabel>
              {t("tabs.threats.config.method", {
                defaultValue: "Analysis Method",
              })}
            </FormLabel>
            <RadioGroup
              value={activeMethod}
              onChange={(e) => setActiveMethod(e.target.value as StrideMethod)}
            >
              <FormControlLabel
                value="per-element"
                control={<Radio />}
                label={t("tabs.threats.config.perElement", {
                  defaultValue: "STRIDE per Element",
                })}
              />
              <FormControlLabel
                value="per-interaction"
                control={<Radio />}
                label={t("tabs.threats.config.perInteraction", {
                  defaultValue: "STRIDE per Interaction",
                })}
              />
            </RadioGroup>
          </FormControl>

          {hasExistingThreats && (
            <Alert severity="warning">
              {t("tabs.threats.config.methodChangeWarning", {
                defaultValue:
                  "Changing the method will replace all existing threats.",
              })}
            </Alert>
          )}

          <Divider />

          {/* Zero Trust Mode */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography fontWeight="medium">
                {t("tabs.threats.config.zeroTrustMode", {
                  defaultValue: "Zero Trust Mode",
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("tabs.threats.config.zeroTrustModeDesc", {
                  defaultValue:
                    "Generate threats from both sender AND receiver perspective " +
                    "for every data flow. Default: sender only (+ receiver for cross-boundary flows).",
                })}
              </Typography>
            </Box>
            <Switch
              checked={zeroTrustMode}
              onChange={(e) => setZeroTrustMode(e.target.checked)}
            />
          </Box>

          <Divider />

          {/* Show Threat Actor */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography fontWeight="medium">
                {t("tabs.threats.config.showThreatActor", {
                  defaultValue: "Show Threat Actor",
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("tabs.threats.config.showThreatActorDesc", {
                  defaultValue:
                    "Display threat actor field in the threat evaluation dialog.",
                })}
              </Typography>
            </Box>
            <Switch
              checked={showThreatActor}
              onChange={(e) => setShowThreatActor(e.target.checked)}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreatConfigDialog;