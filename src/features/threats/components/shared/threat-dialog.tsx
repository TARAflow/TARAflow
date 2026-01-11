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
} from "../../models/threat-types";
import { formatDataFlowDisplay } from "../../models/per-interaction-types";
import { elementThreatService } from "../../services/per-element/element-threat-service";
import { interactionThreatService } from "../../services/per-interaction/interaction-threat-service";
import {
  getLocalizedThreatText,
  shouldUseTemplateLocalization,
  getSuggestedMitigations,
  formatInteractionDirection,
  getDirectionColor,
} from "../../services/interaction-templates";
import type { StrideCategory } from "shared";
import { STRIDE_COLORS } from "shared";

// ==================== TYPES ====================

interface ThreatDialogProps {
  open: boolean;
  threat: Threat | null;
  configuration: ThreatConfiguration;
  onSave: (updatedThreat: Partial<Threat>) => void;
  onClose: () => void;
}

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

      // ✅ GEÄNDERT: Service Selection basierend auf Threat-Typ
      const service = threat.interactionContext
        ? interactionThreatService
        : elementThreatService;

      // Load templates for this STRIDE category
      const elementType = threat.linkedElement?.elementType || "DataFlow";

      setThreatTemplates(
        service.getThreatTemplates(
          threat.strideCategory,
          elementType,
          configuration.customThreatTemplates
        )
      );

      setMitigationTemplates(
        service.getMitigationTemplates(
          threat.strideCategory,
          elementType,
          configuration.customMitigationTemplates
        )
      );

      setVerificationTemplates(
        service.getVerificationTemplates(
          threat.strideCategory,
          elementType,
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

  const handleAddSuggestedMitigation = (suggestion: string) => {
    setMitigation((prev) => (prev ? `${prev}\n${suggestion}` : suggestion));
  };

  // ==================== HELPER ====================

  const getStrideName = (type: StrideCategory): string => {
    const def = STRIDE_DEFINITIONS.find((s) => s.type === type);
    return locale === "de" ? def?.nameDE || type : def?.name || type;
  };

  // ==================== RENDER ====================

  if (!threat) return null;

  const hasInteractionContext = !!threat.interactionContext;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip
            label={threat.strideCategory}
            size="medium"
            sx={{
              backgroundColor: STRIDE_COLORS[threat.strideCategory],
              color: "white",
              fontWeight: "bold",
            }}
          />
          <Typography variant="h6">
            {getStrideName(threat.strideCategory)} - {threat.id}
          </Typography>
          {hasInteractionContext && threat.interactionContext && (
            <Chip
              icon={
                threat.interactionContext.direction === "incoming" ? (
                  <ArrowDownward />
                ) : (
                  <ArrowUpward />
                )
              }
              label={formatInteractionDirection(
                threat.interactionContext.direction,
                locale
              )}
              size="small"
              sx={{
                bgcolor: getDirectionColor(
                  threat.interactionContext.direction
                ),
                color: "white",
              }}
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Context Information */}
          <Box
            sx={{
              p: 2,
              bgcolor: "background.default",
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
            }}
          >
            {threat.linkedElement ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.threats.element", { defaultValue: "Element" })}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={threat.linkedElement.elementType}
                    size="small"
                    variant="outlined"
                  />
                  <Typography>
                    {threat.linkedElement.elementName} (
                    {threat.linkedElement.elementId})
                  </Typography>
                </Stack>
              </Box>
            ) : null}

            {threat.dataFlow && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.threats.dataFlow", { defaultValue: "Data Flow" })}
                </Typography>
                <Typography>{formatDataFlowDisplay(threat.dataFlow)}</Typography>
                {hasInteractionContext && threat.interactionContext && (
                  <Typography variant="caption" color="text.secondary">
                    {threat.interactionContext.direction === "incoming"
                      ? "→ Into element"
                      : "→ From element"}
                    {threat.interactionContext.crossesTrustBoundary && (
                      <Chip
                        label={t("tabs.threats.crossesTB", {
                          defaultValue: "Crosses Trust Boundary",
                        })}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Template Localization Info */}
          {usesTemplateLocalization && (
            <Alert severity="info">
              {locale === "de"
                ? "Diese Bedrohung verwendet Template-Lokalisierung. Ihre Änderungen werden gespeichert und überschreiben den automatisch generierten Text."
                : "This threat uses template localization. Your changes will be saved and override the auto-generated text."}
            </Alert>
          )}

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
                value={null}
                getOptionLabel={(option) =>
                  locale === "de" ? option.threatDE : option.threat
                }
                onChange={(_, value) => handleSelectThreatTemplate(value)}
                freeSolo={false}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.selectTemplate", {
                      defaultValue: "Select template...",
                    })}
                    sx={{ width: 250 }}
                    InputProps={{
                      ...params.InputProps,
                      readOnly: false, // Allow typing for search
                    }}
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
                value={null}
                getOptionLabel={(option) =>
                  locale === "de" ? option.mitigationDE : option.mitigation
                }
                onChange={(_, value) => handleSelectMitigationTemplate(value)}
                freeSolo={false}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.addMitigation", {
                      defaultValue: "Add mitigation...",
                    })}
                    sx={{ width: 250 }}
                    InputProps={{
                      ...params.InputProps,
                      readOnly: false, // Allow typing for search
                    }}
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
                value={null}
                getOptionLabel={(option) =>
                  locale === "de" ? option.verificationDE : option.verification
                }
                onChange={(_, value) => handleSelectVerificationTemplate(value)}
                freeSolo={false}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t("tabs.threats.addVerification", {
                      defaultValue: "Add verification...",
                    })}
                    sx={{ width: 250 }}
                    InputProps={{
                      ...params.InputProps,
                      readOnly: false, // Allow typing for search
                    }}
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