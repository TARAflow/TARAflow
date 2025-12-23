// ==================== THREAT DIALOG ====================
// Dialog for editing individual threats

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Autocomplete,
  Stack,
  Alert,
} from "@mui/material";

import {
  Threat,
  ThreatConfiguration,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
  ThreatActorType,
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
  formatDataFlowDisplay,
} from "../models/threat-types";
import { threatService } from "../services/threat-service";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

interface ThreatDialogProps {
  open: boolean;
  threat: Threat | null;
  configuration: ThreatConfiguration;
  onSave: (updatedThreat: Partial<Threat>) => void;
  onClose: () => void;
}

// ==================== STRIDE COLORS ====================

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

// ==================== COMPONENT ====================

export const ThreatDialog: React.FC<ThreatDialogProps> = ({
  open,
  threat,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Form state
  const [threatDescription, setThreatDescription] = useState("");
  const [attackDescription, setAttackDescription] = useState("");
  const [threatActor, setThreatActor] = useState<ThreatActorType>("external");
  const [mitigation, setMitigation] = useState("");
  const [verification, setVerification] = useState("");

  // Templates for autocomplete
  const [threatTemplates, setThreatTemplates] = useState<ThreatTemplate[]>([]);
  const [mitigationTemplates, setMitigationTemplates] = useState<MitigationTemplate[]>([]);
  const [verificationTemplates, setVerificationTemplates] = useState<VerificationTemplate[]>([]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (threat) {
      setThreatDescription(threat.threatDescription);
      setAttackDescription(threat.attackDescription);
      setThreatActor(threat.threatActor);
      setMitigation(threat.mitigation);
      setVerification(threat.verification);

      // Load templates for this STRIDE category
      const elementType = threat.linkedElement?.elementType || "DataFlow";
      setThreatTemplates(
        threatService.getThreatTemplates(
          threat.strideCategory,
          elementType,
          configuration.customThreatTemplates
        )
      );
      setMitigationTemplates(
        threatService.getMitigationTemplates(
          threat.strideCategory,
          configuration.customMitigationTemplates
        )
      );
      setVerificationTemplates(
        threatService.getVerificationTemplates(
          threat.strideCategory,
          configuration.customVerificationTemplates
        )
      );
    }
  }, [threat, configuration]);

  // ==================== HANDLERS ====================

  const handleSave = () => {
    onSave({
      threatDescription,
      attackDescription,
      threatActor,
      mitigation,
      verification,
    });
  };

  const handleSelectThreatTemplate = (template: ThreatTemplate | null) => {
    if (template) {
      setThreatDescription(isGerman ? template.threatDE : template.threat);
      setAttackDescription(isGerman ? template.attackDE : template.attack);
    }
  };

  const handleSelectMitigationTemplate = (template: MitigationTemplate | null) => {
    if (template) {
      const text = isGerman ? template.mitigationDE : template.mitigation;
      setMitigation((prev) => (prev ? `${prev}\n${text}` : text));
    }
  };

  const handleSelectVerificationTemplate = (template: VerificationTemplate | null) => {
    if (template) {
      const text = isGerman ? template.verificationDE : template.verification;
      setVerification((prev) => (prev ? `${prev}\n${text}` : text));
    }
  };

  // ==================== RENDER HELPERS ====================

  const getStrideDef = (type: StrideCategory) =>
    STRIDE_DEFINITIONS.find((s) => s.type === type);

  if (!threat) return null;

  const strideDef = getStrideDef(threat.strideCategory);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip
            label={threat.strideCategory}
            sx={{
              backgroundColor: STRIDE_COLORS[threat.strideCategory],
              color: "white",
              fontWeight: "bold",
            }}
          />
          <Typography variant="h6">
            {t("tabs.threats.editThreat", { defaultValue: "Edit Threat" })}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontFamily="monospace">
            {threat.id}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Info Section */}
          <Alert severity="info" icon={false}>
            <Typography variant="subtitle2" gutterBottom>
              {isGerman ? strideDef?.nameDE : strideDef?.name} -{" "}
              {isGerman ? strideDef?.securityPropertyDE : strideDef?.securityProperty}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isGerman ? strideDef?.descriptionDE : strideDef?.description}
            </Typography>
          </Alert>

          {/* Element/DataFlow Reference */}
          <Box sx={{ backgroundColor: "grey.50", p: 2, borderRadius: 1 }}>
            {threat.linkedElement ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {t("tabs.threats.element", { defaultValue: "Element" })}:
                </Typography>
                <Chip
                  label={threat.linkedElement.elementType}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="body2" fontWeight="medium">
                  {threat.linkedElement.elementName} ({threat.linkedElement.elementId})
                </Typography>
              </Stack>
            ) : threat.dataFlow ? (
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {t("tabs.threats.dataFlow", { defaultValue: "Data Flow" })}:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatDataFlowDisplay(threat.dataFlow)}
                </Typography>
              </Stack>
            ) : null}
          </Box>

          <Divider />

          {/* Threat Description */}
          <Box>
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.threatDescription", { defaultValue: "Threat Description" })}
              </Typography>
              <Autocomplete
                size="small"
                options={threatTemplates}
                getOptionLabel={(option) => (isGerman ? option.threatDE : option.threat)}
                onChange={(_, value) => handleSelectThreatTemplate(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.selectTemplate", {
                      defaultValue: "Select template...",
                    })}
                    sx={{ width: 250 }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Typography variant="body2" sx={{ maxWidth: 400 }} noWrap>
                      {isGerman ? option.threatDE : option.threat}
                    </Typography>
                  </li>
                )}
              />
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={threatDescription}
              onChange={(e) => setThreatDescription(e.target.value)}
              placeholder={t("tabs.threats.threatDescriptionPlaceholder", {
                defaultValue: "Describe the threat...",
              })}
            />
          </Box>

          {/* Attack Description */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.threats.attackDescription", { defaultValue: "Attack Scenario" })}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={attackDescription}
              onChange={(e) => setAttackDescription(e.target.value)}
              placeholder={t("tabs.threats.attackDescriptionPlaceholder", {
                defaultValue: "Describe how an attacker might exploit this...",
              })}
            />
          </Box>

          {/* Threat Actor */}
          <FormControl fullWidth>
            <InputLabel>
              {t("tabs.threats.threatActor", { defaultValue: "Threat Actor" })}
            </InputLabel>
            <Select
              value={threatActor}
              label={t("tabs.threats.threatActor", { defaultValue: "Threat Actor" })}
              onChange={(e) => setThreatActor(e.target.value as ThreatActorType)}
            >
              {THREAT_ACTORS.map((actor) => (
                <MenuItem key={actor.type} value={actor.type}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>{isGerman ? actor.nameDE : actor.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      - {isGerman ? actor.descriptionDE : actor.description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* Mitigation */}
          <Box>
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.mitigation", { defaultValue: "Mitigation / Countermeasure" })}
              </Typography>
              <Autocomplete
                size="small"
                options={mitigationTemplates}
                getOptionLabel={(option) =>
                  isGerman ? option.mitigationDE : option.mitigation
                }
                onChange={(_, value) => handleSelectMitigationTemplate(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.addMitigation", {
                      defaultValue: "Add mitigation...",
                    })}
                    sx={{ width: 250 }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Typography variant="body2" sx={{ maxWidth: 400 }} noWrap>
                      {isGerman ? option.mitigationDE : option.mitigation}
                    </Typography>
                  </li>
                )}
              />
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={mitigation}
              onChange={(e) => setMitigation(e.target.value)}
              placeholder={t("tabs.threats.mitigationPlaceholder", {
                defaultValue: "Describe countermeasures...",
              })}
            />
          </Box>

          {/* Verification */}
          <Box>
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.verification", { defaultValue: "Verification / Testing" })}
              </Typography>
              <Autocomplete
                size="small"
                options={verificationTemplates}
                getOptionLabel={(option) =>
                  isGerman ? option.verificationDE : option.verification
                }
                onChange={(_, value) => handleSelectVerificationTemplate(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.addVerification", {
                      defaultValue: "Add verification...",
                    })}
                    sx={{ width: 250 }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Typography variant="body2" sx={{ maxWidth: 400 }} noWrap>
                      {isGerman ? option.verificationDE : option.verification}
                    </Typography>
                  </li>
                )}
              />
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              placeholder={t("tabs.threats.verificationPlaceholder", {
                defaultValue: "Describe how to verify the mitigation works...",
              })}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button onClick={handleSave} variant="contained">
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreatDialog;