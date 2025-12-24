// ==================== THREAT DIALOG ====================
// Dialog for editing individual threats
// 
// LOCALIZATION:
// - For per-interaction threats (with interactionContext):
//   Uses getLocalizedThreatText() for dynamic localization
// - For per-element threats: Uses stored descriptions

import React, { useState, useEffect, useMemo } from "react";
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
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";

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
import {
  getLocalizedThreatText,
  shouldUseTemplateLocalization,
  getSuggestedMitigations,
  formatInteractionDirection,
  getDirectionColor,
} from "../services/interaction-templates";
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
  const locale = (i18n.language === "de" ? "de" : "en") as "en" | "de";

  // Form state
  const [threatDescription, setThreatDescription] = useState("");
  const [attackDescription, setAttackDescription] = useState("");
  const [threatActor, setThreatActor] = useState<ThreatActorType>("external");
  const [mitigation, setMitigation] = useState("");
  const [verification, setVerification] = useState("");

  // Track if user has modified the auto-generated text
  const [userModifiedDescription, setUserModifiedDescription] = useState(false);
  const [userModifiedAttack, setUserModifiedAttack] = useState(false);

  // Templates for autocomplete
  const [threatTemplates, setThreatTemplates] = useState<ThreatTemplate[]>([]);
  const [mitigationTemplates, setMitigationTemplates] = useState<
    MitigationTemplate[]
  >([]);
  const [verificationTemplates, setVerificationTemplates] = useState<
    VerificationTemplate[]
  >([]);

  // ==================== LOCALIZED TEXT ====================

  /**
   * Get localized text for per-interaction threats
   */
  const localizedText = useMemo(() => {
    if (!threat) return null;
    return getLocalizedThreatText(threat, locale);
  }, [threat, locale]);

  /**
   * Get suggested mitigations based on threat context
   */
  const suggestedMitigationsList = useMemo(() => {
    if (!threat) return [];
    return getSuggestedMitigations(threat, locale);
  }, [threat, locale]);

  /**
   * Check if this threat uses template localization
   */
  const usesTemplateLocalization = useMemo(() => {
    if (!threat) return false;
    return shouldUseTemplateLocalization(threat);
  }, [threat]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (threat) {
      // Reset modification flags
      setUserModifiedDescription(false);
      setUserModifiedAttack(false);

      // For per-interaction threats with auto-generated content:
      // Use localized text from templates
      if (usesTemplateLocalization && localizedText) {
        setThreatDescription(localizedText.threatDescription);
        setAttackDescription(localizedText.attackDescription);
      } else {
        // For per-element or manually edited threats: use stored values
        setThreatDescription(threat.threatDescription);
        setAttackDescription(threat.attackDescription);
      }

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
  }, [threat, configuration, usesTemplateLocalization, localizedText]);

  // ==================== HANDLERS ====================

  const handleSave = () => {
    // Determine what to save:
    // - If user modified the text, save their version and mark as "manual"
    // - If not modified and using template, save empty to keep using templates
    const saveData: Partial<Threat> = {
      threatActor,
      mitigation,
      verification,
    };

    if (usesTemplateLocalization && !userModifiedDescription) {
      // Keep empty to continue using template localization
      saveData.threatDescription = "";
      saveData.source = "auto";
    } else {
      saveData.threatDescription = threatDescription;
      saveData.source = "manual";
    }

    if (usesTemplateLocalization && !userModifiedAttack) {
      saveData.attackDescription = "";
    } else {
      saveData.attackDescription = attackDescription;
    }

    onSave(saveData);
  };

  const handleThreatDescriptionChange = (value: string) => {
    setThreatDescription(value);
    setUserModifiedDescription(true);
  };

  const handleAttackDescriptionChange = (value: string) => {
    setAttackDescription(value);
    setUserModifiedAttack(true);
  };

  const handleSelectThreatTemplate = (template: ThreatTemplate | null) => {
    if (template) {
      const text = locale === "de" ? template.threatDE : template.threat;
      setThreatDescription(text);
      setUserModifiedDescription(true);

      const attackText = locale === "de" ? template.attackDE : template.attack;
      setAttackDescription(attackText);
      setUserModifiedAttack(true);
    }
  };

  const handleSelectMitigationTemplate = (
    template: MitigationTemplate | null
  ) => {
    if (template) {
      const text =
        locale === "de" ? template.mitigationDE : template.mitigation;
      setMitigation((prev) => (prev ? `${prev}\n${text}` : text));
    }
  };

  const handleSelectVerificationTemplate = (
    template: VerificationTemplate | null
  ) => {
    if (template) {
      const text =
        locale === "de" ? template.verificationDE : template.verification;
      setVerification((prev) => (prev ? `${prev}\n${text}` : text));
    }
  };

  const handleAddSuggestedMitigation = (mitigationText: string) => {
    setMitigation((prev) =>
      prev ? `${prev}\n${mitigationText}` : mitigationText
    );
  };

  // ==================== RENDER HELPERS ====================

  const getStrideDef = (type: StrideCategory) =>
    STRIDE_DEFINITIONS.find((s) => s.type === type);

  if (!threat) return null;

  const strideDef = getStrideDef(threat.strideCategory);
  const hasInteractionContext = !!threat.interactionContext;

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
          {/* Direction badge for per-interaction threats */}
          {hasInteractionContext && threat.interactionContext && (
            <Chip
              icon={
                threat.interactionContext.direction === "incoming" ? (
                  <ArrowDownward fontSize="small" />
                ) : (
                  <ArrowUpward fontSize="small" />
                )
              }
              label={formatInteractionDirection(
                threat.interactionContext.direction,
                locale
              )}
              size="small"
              sx={{
                backgroundColor: getDirectionColor(
                  threat.interactionContext.direction
                ),
                color: "white",
                "& .MuiChip-icon": { color: "white" },
              }}
            />
          )}
          <Typography variant="h6">
            {t("tabs.threats.editThreat", { defaultValue: "Edit Threat" })}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            fontFamily="monospace"
          >
            {threat.id}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Info Section */}
          <Alert severity="info" icon={false}>
            <Typography variant="subtitle2" gutterBottom>
              {locale === "de" ? strideDef?.nameDE : strideDef?.name} -{" "}
              {locale === "de"
                ? strideDef?.securityPropertyDE
                : strideDef?.securityProperty}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {locale === "de"
                ? strideDef?.descriptionDE
                : strideDef?.description}
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
                  {threat.linkedElement.elementName} (
                  {threat.linkedElement.elementId})
                </Typography>
              </Stack>
            ) : threat.dataFlow ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    {t("tabs.threats.dataFlow", { defaultValue: "Data Flow" })}:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatDataFlowDisplay(threat.dataFlow)}
                  </Typography>
                </Stack>
                {/* Show direction context */}
                {hasInteractionContext && threat.interactionContext && (
                  <Typography variant="caption" color="text.secondary">
                    {threat.interactionContext.direction === "incoming"
                      ? locale === "de"
                        ? `Angriff aus Richtung ${threat.dataFlow.sourceName} auf ${threat.dataFlow.targetName}`
                        : `Attack from ${threat.dataFlow.sourceName} direction targeting ${threat.dataFlow.targetName}`
                      : locale === "de"
                      ? `Angriff aus Richtung ${threat.dataFlow.targetName} auf ${threat.dataFlow.sourceName}`
                      : `Attack from ${threat.dataFlow.targetName} direction targeting ${threat.dataFlow.sourceName}`}
                    {threat.interactionContext.crossesTrustBoundary && (
                      <Chip
                        label={
                          locale === "de"
                            ? "Kreuzt Trust Boundary"
                            : "Crosses Trust Boundary"
                        }
                        size="small"
                        color="warning"
                        sx={{ ml: 1, height: 20 }}
                      />
                    )}
                  </Typography>
                )}
              </Stack>
            ) : null}
          </Box>

          <Divider />

          {/* Threat Description */}
          <Box>
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.threatDescription", {
                  defaultValue: "Threat Description",
                })}
              </Typography>
              <Autocomplete
                size="small"
                options={threatTemplates}
                getOptionLabel={(option) =>
                  locale === "de" ? option.threatDE : option.threat
                }
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
                      {locale === "de" ? option.threatDE : option.threat}
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
              onChange={(e) => handleThreatDescriptionChange(e.target.value)}
              placeholder={t("tabs.threats.threatDescriptionPlaceholder", {
                defaultValue: "Describe the threat...",
              })}
            />
          </Box>

          {/* Attack Description */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.threats.attackDescription", {
                defaultValue: "Attack Scenario",
              })}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={attackDescription}
              onChange={(e) => handleAttackDescriptionChange(e.target.value)}
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
              label={t("tabs.threats.threatActor", {
                defaultValue: "Threat Actor",
              })}
              onChange={(e) =>
                setThreatActor(e.target.value as ThreatActorType)
              }
            >
              {THREAT_ACTORS.map((actor) => (
                <MenuItem key={actor.type} value={actor.type}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>
                      {locale === "de" ? actor.nameDE : actor.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      -{" "}
                      {locale === "de"
                        ? actor.descriptionDE
                        : actor.description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* Mitigation */}
          <Box>
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.mitigation", {
                  defaultValue: "Mitigation / Countermeasure",
                })}
              </Typography>
              <Autocomplete
                size="small"
                options={mitigationTemplates}
                getOptionLabel={(option) =>
                  locale === "de" ? option.mitigationDE : option.mitigation
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
                      {locale === "de"
                        ? option.mitigationDE
                        : option.mitigation}
                    </Typography>
                  </li>
                )}
              />
            </Stack>

            {/* Suggested Mitigations for per-interaction threats */}
            {suggestedMitigationsList.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  {locale === "de"
                    ? "Vorgeschlagene Maßnahmen:"
                    : "Suggested mitigations:"}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {suggestedMitigationsList.map((suggestion, index) => (
                    <Chip
                      key={index}
                      label={suggestion}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddSuggestedMitigation(suggestion)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": { backgroundColor: "primary.50" },
                        maxWidth: 300,
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

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
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {t("tabs.threats.verification", {
                  defaultValue: "Verification / Testing",
                })}
              </Typography>
              <Autocomplete
                size="small"
                options={verificationTemplates}
                getOptionLabel={(option) =>
                  locale === "de" ? option.verificationDE : option.verification
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
                      {locale === "de"
                        ? option.verificationDE
                        : option.verification}
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

export default ThreatDialog;