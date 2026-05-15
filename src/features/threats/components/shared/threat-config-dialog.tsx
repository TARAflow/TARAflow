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
  Switch,
  Divider,
  Chip,
} from "@mui/material";

import type { ThreatConfiguration } from "../../models/threat-types";

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

  const [zeroTrustMode, setZeroTrustMode] = useState(
    configuration.zeroTrustMode ?? false,
  );
  const [showThreatActor, setShowThreatActor] = useState(
    configuration.showThreatActor ?? false,
  );
  const [forceClassicMode, setForceClassicMode] = useState(
    configuration.forceClassicMode ?? false,
  );

  const handleSave = () => {
    onSave({
      activeMethod: configuration.activeMethod,
      zeroTrustMode,
      showThreatActor,
      forceClassicMode,
      enrichment: configuration.enrichment ?? {
        mitreEnabled: false,
        llmEnabled: false,
      },
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
          <Divider />

          {/* Classic Mode */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography fontWeight="medium">
                {t("tabs.threats.config.classicMode", {
                  defaultValue: "Classic Mode",
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("tabs.threats.config.classicModeDesc", {
                  defaultValue:
                    "Disable all STRIDE modulation — generate generic base categories only. " +
                    "Useful for quick generation or debugging.",
                })}
              </Typography>
            </Box>
            <Switch
              checked={forceClassicMode}
              onChange={(e) => setForceClassicMode(e.target.checked)}
            />
          </Box>

          <Divider />

          {/* Enrichment — Phase E1 / E2 */}
          <Box>
            <Typography fontWeight="medium" sx={{ mb: 1 }}>
              {t("tabs.threats.config.enrichment", {
                defaultValue: "Threat Enrichment",
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t("tabs.threats.config.enrichmentDesc", {
                defaultValue:
                  "Additional enrichment sources that annotate generated threats " +
                  "with attack techniques and domain-specific descriptions.",
              })}
            </Typography>

            {/* Mitre ATT&CK — Phase E1 */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: 0.5,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {t("tabs.threats.config.mitreAttck", {
                    defaultValue: "Mitre ATT&CK",
                  })}{" "}
                  <Chip
                    label="Phase E1"
                    size="small"
                    variant="outlined"
                    sx={{ height: 16, fontSize: 9 }}
                  />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.threats.config.mitreAttckDesc", {
                    defaultValue:
                      "Map STRIDE threats to ATT&CK techniques and tactics.",
                  })}
                </Typography>
              </Box>
              <Switch disabled checked={false} />
            </Box>

            {/* LLM Enrichment — Phase E2 */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: 0.5,
                mt: 1,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {t("tabs.threats.config.llmEnrichment", {
                    defaultValue: "LLM Enrichment",
                  })}{" "}
                  <Chip
                    label="Phase E2"
                    size="small"
                    variant="outlined"
                    sx={{ height: 16, fontSize: 9 }}
                  />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.threats.config.llmEnrichmentDesc", {
                    defaultValue:
                      "Generate domain-specific threat descriptions using a specialized model.",
                  })}
                </Typography>
              </Box>
              <Switch disabled checked={false} />
            </Box>
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