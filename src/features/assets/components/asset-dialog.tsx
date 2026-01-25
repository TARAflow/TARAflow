// ==================== ASSET DIALOG ====================
// Modal dialog for creating/editing an asset
// Uses Dropdowns for impact ratings (better UX than Sliders)

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  Chip,
  Stack,
  Divider,
  Grid,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  SelectChangeEvent,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
} from "@mui/icons-material";

import { Asset, AssetConfiguration } from "../models/asset-types";

import {
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
  calculateOverallImpact,
} from "../models/asset-impact-types";

import {
  SecurityGoalType,
  SECURITY_GOALS,
} from "../models/asset-security-goals-types";

// ==================== TYPES ====================

interface AssetDialogProps {
  open: boolean;
  asset: Asset;
  configuration: AssetConfiguration;
  onSave: (asset: Asset) => void;
  onClose: () => void;
}

// ==================== COMPONENT ====================

export const AssetDialog: React.FC<AssetDialogProps> = ({
  open,
  asset,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Local state for editing
  const [editedAsset, setEditedAsset] = useState<Asset>(asset);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scale = IMPACT_SCALES[configuration.impactScale];
  const isNew = asset.name === "";

  // ==================== VALIDATION ====================

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedAsset.name.trim()) {
      newErrors.name = t("validation.required", { defaultValue: "Required" });
    }

    const hasSecurityGoal = editedAsset.securityGoals.some((sg) => sg.enabled);
    if (!hasSecurityGoal) {
      newErrors.securityGoals = t("validation.atLeastOneSecurityGoal", {
        defaultValue: "At least one security goal required",
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==================== HANDLERS ====================

  const handleSave = () => {
    if (!validate()) return;

    const overallImpact = calculateOverallImpact(
      editedAsset.impactRatings,
      configuration.calculationMethod
    );

    onSave({
      ...editedAsset,
      overallImpact,
      lastModified: new Date().toISOString(),
    });
  };

  const handleImpactChange = (criterionId: string, event: SelectChangeEvent<number>) => {
    const value = event.target.value as number;
    setEditedAsset((prev) => ({
      ...prev,
      impactRatings: prev.impactRatings.map((r) =>
        r.criterionId === criterionId ? { ...r, value } : r
      ),
    }));
  };

  const handleSecurityGoalToggle = (type: SecurityGoalType) => {
    setEditedAsset((prev) => ({
      ...prev,
      securityGoals: prev.securityGoals.map((sg) =>
        sg.type === type ? { ...sg, enabled: !sg.enabled } : sg
      ),
    }));
    if (errors.securityGoals) {
      setErrors((prev) => ({ ...prev, securityGoals: "" }));
    }
  };

  const handleSecurityGoalDescription = (
    type: SecurityGoalType,
    description: string
  ) => {
    setEditedAsset((prev) => ({
      ...prev,
      securityGoals: prev.securityGoals.map((sg) =>
        sg.type === type ? { ...sg, formalDescription: description } : sg
      ),
    }));
  };

  const handleUseTemplate = (type: SecurityGoalType) => {
    const goalDef = SECURITY_GOALS.find((g) => g.type === type);
    if (goalDef) {
      const template = isGerman ? goalDef.templateDE : goalDef.templateEN;
      handleSecurityGoalDescription(type, template);
    }
  };

  // ==================== COMPUTED ====================

  const currentOverallImpact = useMemo(() => {
    return calculateOverallImpact(
      editedAsset.impactRatings,
      configuration.calculationMethod
    );
  }, [editedAsset.impactRatings, configuration.calculationMethod]);

  // Helper to get color for impact level
  const getImpactColor = (value: number): string => {
    const colors: Record<number, string[]> = {
      3: ["#22c55e", "#eab308", "#ef4444"],
      4: ["#22c55e", "#eab308", "#f97316", "#ef4444"],
      5: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"],
    };
    const palette = colors[scale.levels.length] || colors[5];
    return palette[Math.min(value - 1, palette.length - 1)] || "#6b7280";
  };

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: "90vh" } }}
    >
      <DialogTitle>
        {isNew
          ? t("tabs.assets.dialog.createTitle", {
              defaultValue: "Create Asset",
            })
          : t("tabs.assets.dialog.editTitle", {
              id: editedAsset.id,
              defaultValue: `Edit Asset ${editedAsset.id}`,
            })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Basic Info */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.assets.dialog.basicInfo", {
                defaultValue: "Basic Information",
              })}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={3}>
                <TextField
                  label={t("tabs.assets.columns.id", { defaultValue: "ID" })}
                  value={editedAsset.id}
                  disabled
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={9}>
                <TextField
                  label={t("tabs.assets.columns.name", {
                    defaultValue: "Name",
                  })}
                  value={editedAsset.name}
                  onChange={(e) =>
                    setEditedAsset({ ...editedAsset, name: e.target.value })
                  }
                  error={!!errors.name}
                  helperText={errors.name}
                  fullWidth
                  size="small"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t("tabs.assets.columns.description", {
                    defaultValue: "Description",
                  })}
                  value={editedAsset.description}
                  onChange={(e) =>
                    setEditedAsset({
                      ...editedAsset,
                      description: e.target.value,
                    })
                  }
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          {/* Linked DFD Elements (read-only display) */}
          {editedAsset.linkedDFDElements.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.assets.dialog.linkedElements", {
                    defaultValue: "Linked DFD Elements",
                  })}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {editedAsset.linkedDFDElements.map((link) => (
                    <Chip
                      key={link.elementId}
                      label={link.elementName}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Impact Ratings with Dropdowns */}
          <Divider />
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="subtitle2">
                {t("tabs.assets.dialog.impactRatings", {
                  defaultValue: "Impact Ratings",
                })}
              </Typography>
              <Chip
                label={`${t("tabs.assets.dialog.overall", {
                  defaultValue: "Overall",
                })}: ${
                  currentOverallImpact > 0
                    ? currentOverallImpact.toFixed(1)
                    : "-"
                }`}
                color={currentOverallImpact > 0 ? "primary" : "default"}
                size="small"
              />
            </Box>

            <Grid container spacing={2}>
              {editedAsset.impactRatings.map((rating) => {
                const criterion = PREDEFINED_IMPACT_CRITERIA.find(
                  (c) => c.id === rating.criterionId,
                );
                const name = isGerman ? criterion?.nameDE : criterion?.name;
                const description = isGerman
                  ? criterion?.descriptionDE
                  : criterion?.description;

                return (
                  <Grid item xs={12} sm={6} md={4} key={rating.criterionId}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`impact-${rating.criterionId}-label`}>
                        {name}
                      </InputLabel>
                      <Select
                        labelId={`impact-${rating.criterionId}-label`}
                        value={rating.value}
                        label={name}
                        onChange={(e) =>
                          handleImpactChange(rating.criterionId, e)
                        }
                        endAdornment={
                          <Tooltip title={description || ""} placement="top">
                            <IconButton size="small" sx={{ mr: 2 }}>
                              <InfoIcon fontSize="small" color="action" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <MenuItem value={0}>
                          <Typography color="text.disabled">-</Typography>
                        </MenuItem>
                        {scale.levels.map((level) => (
                          <MenuItem key={level.value} value={level.value}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor: getImpactColor(level.value),
                                }}
                              />
                              <Typography>
                                {level.value} -{" "}
                                {isGerman ? level.labelDE : level.label}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <Divider />

          {/* Security Goals */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.assets.dialog.securityGoals", {
                defaultValue: "Security Goals (CIANAAA)",
              })}
            </Typography>

            {errors.securityGoals && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.securityGoals}
              </Alert>
            )}

            {SECURITY_GOALS.map((goalDef) => {
              const goal = editedAsset.securityGoals.find(
                (sg) => sg.type === goalDef.type,
              );
              const isEnabled = goal?.enabled ?? false;

              return (
                <Accordion
                  key={goalDef.type}
                  defaultExpanded={isEnabled}
                  sx={{
                    mb: 1,
                    // Visual indicator when enabled
                    ...(isEnabled && {
                      borderLeft: 3,
                      borderColor: "primary.main",
                    }),
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      // Prevent accordion toggle when clicking checkbox area
                      "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                      },
                    }}
                  >
                    <Checkbox
                      checked={isEnabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSecurityGoalToggle(goalDef.type);
                      }}
                      sx={{ mr: 1 }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {goalDef.type} -{" "}
                        {isGerman ? goalDef.nameDE : goalDef.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isGerman ? goalDef.descriptionDE : goalDef.description}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "start" }}>
                      <TextField
                        label={t("tabs.assets.dialog.formalDescription", {
                          defaultValue: "Formal Security Requirement",
                        })}
                        value={goal?.formalDescription ?? ""}
                        onChange={(e) =>
                          handleSecurityGoalDescription(
                            goalDef.type,
                            e.target.value,
                          )
                        }
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                        placeholder={
                          isGerman ? goalDef.templateDE : goalDef.templateEN
                        }
                      />
                      <Tooltip
                        title={t("tabs.assets.dialog.useTemplate", {
                          defaultValue: "Use template",
                        })}
                      >
                        <IconButton
                          onClick={() => handleUseTemplate(goalDef.type)}
                          size="small"
                        >
                          <LightbulbIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
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

export default AssetDialog;