// ==================== THREAT DIALOG ====================
// Dialog for editing individual threats

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
} from "@mui/material";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";

import {
  Threat,
  ThreatConfiguration,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
  ThreatActorType,
} from "../../models/threat-types";
import { formatDataFlowDisplay } from "../../models/per-interaction-types";
import type { InteractionDirection } from "../../models/per-interaction-types";
import { elementThreatService } from "../../services/per-element/element-threat-service";
import { interactionThreatService } from "../../services/per-interaction/interaction-threat-service";
import { resolveMitigations } from "../../services/threat-catalog-service";
import type { StrideCategory } from "shared";
import { STRIDE_COLORS } from "shared";

// ==================== CONSTANTS ====================

// Static list of actor types — labels come from i18n (tabs.threats.threatActors.*)
const THREAT_ACTOR_TYPES: ThreatActorType[] = [
  "external",
  "internal",
  "nation-state",
  "script-kiddie",
  "competitor",
  "other",
];

// ==================== LOCAL HELPERS ====================

function getDirectionColor(direction: InteractionDirection): string {
  return direction === "incoming" ? "#2196f3" : "#ff9800";
}

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
  const { t } = useTranslation();

  // Form state
  const [threatDescription, setThreatDescription] = useState("");
  const [attackDescription, setAttackDescription] = useState("");
  const [threatActor, setThreatActor] = useState<ThreatActorType>("external");
  const [mitigation, setMitigation] = useState("");
  const [verification, setVerification] = useState("");

  // Templates for autocomplete
  const [threatTemplates, setThreatTemplates] = useState<ThreatTemplate[]>([]);
  const [mitigationTemplates, setMitigationTemplates] = useState<
    MitigationTemplate[]
  >([]);
  const [verificationTemplates, setVerificationTemplates] = useState<
    VerificationTemplate[]
  >([]);

  // ── Proposed mitigations from catalog ──────────────────────────────────
  const proposedMitigations = useMemo(() => {
    if (!threat?.proposedMitigations?.length) return [];
    return resolveMitigations(threat.proposedMitigations);
  }, [threat?.proposedMitigations]);

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (threat) {
      setThreatDescription(threat.threatDescription);
      setAttackDescription(threat.attackDescription);
      setThreatActor(threat.threatActor);
      setMitigation(threat.mitigation);
      setVerification(threat.verification);

      const service = threat.interactionContext
        ? interactionThreatService
        : elementThreatService;

      const elementType = threat.linkedElement?.elementType || "DataFlow";

      setThreatTemplates(
        service.getThreatTemplates(
          threat.strideCategory,
          elementType,
          configuration.customThreatTemplates,
        ),
      );
      setMitigationTemplates(
        service.getMitigationTemplates(
          threat.strideCategory,
          elementType,
          configuration.customMitigationTemplates,
        ),
      );
      setVerificationTemplates(
        service.getVerificationTemplates(
          threat.strideCategory,
          elementType,
          configuration.customVerificationTemplates,
        ),
      );
    }
  }, [threat, configuration]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = () => {
    onSave({
      threatDescription,
      attackDescription,
      threatActor,
      mitigation,
      verification,
      isTextCustomized:
        threat?.threatDescription !== threatDescription ||
        threat?.attackDescription !== attackDescription,
      source: "manual",
    });
  };

  // Legacy templates from catalog service return localized text in
  // option.threat / option.mitigation / option.verification — no locale check needed.
  const handleSelectThreatTemplate = (template: ThreatTemplate | null) => {
    if (template) {
      setThreatDescription(template.threat);
      setAttackDescription(template.attack);
    }
  };

  const handleSelectMitigationTemplate = (
    template: MitigationTemplate | null,
  ) => {
    if (template) {
      setMitigation((prev) =>
        prev ? `${prev}\n${template.mitigation}` : template.mitigation,
      );
    }
  };

  const handleSelectVerificationTemplate = (
    template: VerificationTemplate | null,
  ) => {
    if (template) {
      setVerification((prev) =>
        prev ? `${prev}\n${template.verification}` : template.verification,
      );
    }
  };

  const handleAddProposedMitigation = (text: string) => {
    setMitigation((prev) => (prev ? `${prev}\n${text}` : text));
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStrideName = (type: StrideCategory): string =>
    t(`stride.${type}.name`, { defaultValue: type });

  const formatDirection = (direction: InteractionDirection): string =>
    t(`tabs.threats.direction.${direction}`, {
      defaultValue: direction === "incoming" ? "Incoming" : "Outgoing",
    });

  // ── Render ────────────────────────────────────────────────────────────────

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
              label={formatDirection(threat.interactionContext.direction)}
              size="small"
              sx={{
                bgcolor: getDirectionColor(threat.interactionContext.direction),
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
            {threat.linkedElement && (
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
            )}

            {threat.dataFlow && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.threats.dataFlow", { defaultValue: "Data Flow" })}
                </Typography>
                <Typography>
                  {formatDataFlowDisplay(threat.dataFlow)}
                </Typography>
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
                getOptionLabel={(option) => option.threat}
                onChange={(_, value) => handleSelectThreatTemplate(value)}
                freeSolo={false}
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
                      {option.threat}
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
              {t("tabs.threats.attackDescription", {
                defaultValue: "Attack Scenario",
              })}
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
              label={t("tabs.threats.threatActor", {
                defaultValue: "Threat Actor",
              })}
              onChange={(e) =>
                setThreatActor(e.target.value as ThreatActorType)
              }
            >
              {THREAT_ACTOR_TYPES.map((actorType) => (
                <MenuItem key={actorType} value={actorType}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>
                      {t(`tabs.threats.threatActors.${actorType}.name`, {
                        defaultValue: actorType,
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      -{" "}
                      {t(`tabs.threats.threatActors.${actorType}.description`, {
                        defaultValue: "",
                      })}
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
                getOptionLabel={(option) => option.mitigation}
                onChange={(_, value) => handleSelectMitigationTemplate(value)}
                freeSolo={false}
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
                      {option.mitigation}
                    </Typography>
                  </li>
                )}
              />
            </Stack>

            {/* Proposed mitigations from catalog */}
            {proposedMitigations.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  {t("tabs.threats.proposedMitigations", {
                    defaultValue: "Proposed mitigations:",
                  })}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {proposedMitigations.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.text}
                      size="small"
                      variant="outlined"
                      onClick={() => handleAddProposedMitigation(m.text)}
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
                getOptionLabel={(option) => option.verification}
                onChange={(_, value) => handleSelectVerificationTemplate(value)}
                freeSolo={false}
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
                      {option.verification}
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