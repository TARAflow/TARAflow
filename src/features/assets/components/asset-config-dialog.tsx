// ==================== ASSET CONFIG DIALOG ====================
// Configuration dialog for impact criteria, scale, calculation method, and rounding

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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Chip,
  Stack,
  Tooltip,
  Grid,
} from "@mui/material";
import { Info as InfoIcon } from "@mui/icons-material";

import {
  AssetConfiguration,
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
} from "../models/asset-types";

// ==================== TYPES ====================

interface AssetConfigDialogProps {
  open: boolean;
  configuration: AssetConfiguration;
  onChange: (config: AssetConfiguration) => void; // NEU: Live-Updates
  onSave: () => void; // Kein Parameter mehr
  onClose: () => void;
}

// ==================== CONSTANTS ====================

const MIN_CRITERIA = 4;
const RECOMMENDED_MAX_CRITERIA = 6;

// ==================== COMPONENT ====================

export const AssetConfigDialog: React.FC<AssetConfigDialogProps> = ({
  open,
  configuration,
  onChange,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== HANDLERS ====================

  const handleToggleCriterion = (criterionId: string) => {
    const currentCriteria = configuration.impactCriteria;

    let newCriteria: string[];
    if (currentCriteria.includes(criterionId)) {
      // Remove (only if above minimum)
      if (currentCriteria.length > MIN_CRITERIA) {
        newCriteria = currentCriteria.filter((id) => id !== criterionId);
      } else {
        return; // Don't allow removal below minimum
      }
    } else {
      // Add
      newCriteria = [...currentCriteria, criterionId];
    }

    onChange({
      ...configuration,
      impactCriteria: newCriteria,
    });
  };

  const handleScaleChange = (scale: ImpactScaleType) => {
    onChange({
      ...configuration,
      impactScale: scale,
    });
  };

  const handleCalculationMethodChange = (method: ImpactCalculationMethod) => {
    onChange({
      ...configuration,
      calculationMethod: method,
    });
  };

  const handleRoundingMethodChange = (method: ImpactRoundingMethod) => {
    onChange({
      ...configuration,
      roundingMethod: method,
    });
  };

  // ==================== COMPUTED ====================

  const businessCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "business"
  );
  const physicalCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "physical"
  );

  const scale = IMPACT_SCALES[configuration.impactScale];

  // Criteria count for indicator
  const criteriaCount = configuration.impactCriteria.length;
  const isOverRecommended = criteriaCount > RECOMMENDED_MAX_CRITERIA;
  const isUnderMinimum = criteriaCount < MIN_CRITERIA;

  // ==================== RENDER CRITERIA LIST ====================

  const renderCriteriaList = (
    criteria: typeof PREDEFINED_IMPACT_CRITERIA,
    title: string
  ) => (
    <Box sx={{ flex: 1, minWidth: 280 }}>
      <Typography
        variant="subtitle2"
        sx={{ mb: 1, color: "text.secondary", fontWeight: 600 }}
      >
        {title}
      </Typography>
      <List dense disablePadding sx={{ bgcolor: "grey.50", borderRadius: 1 }}>
        {criteria.map((criterion) => {
          const isSelected = configuration.impactCriteria.includes(
            criterion.id
          );
          const canDeselect =
            configuration.impactCriteria.length > MIN_CRITERIA;

          return (
            <ListItem key={criterion.id} disablePadding>
              <ListItemButton
                onClick={() => handleToggleCriterion(criterion.id)}
                disabled={isSelected && !canDeselect}
                dense
                sx={{
                  borderRadius: 1,
                  my: 0.25,
                  mx: 0.5,
                  ...(isSelected && {
                    bgcolor: "primary.50",
                    "&:hover": { bgcolor: "primary.100" },
                  }),
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={isSelected}
                    tabIndex={-1}
                    disableRipple
                    disabled={isSelected && !canDeselect}
                    size="small"
                  />
                </ListItemIcon>
                <ListItemText
                  primary={isGerman ? criterion.nameDE : criterion.name}
                  secondary={
                    isGerman ? criterion.descriptionDE : criterion.description
                  }
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{
                    variant: "caption",
                    sx: { lineHeight: 1.3 },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {t("tabs.assets.config.title", {
          defaultValue: "Asset Impact Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Info */}
          <Alert severity="info">
            {t("tabs.assets.config.info", {
              defaultValue: `Select ${MIN_CRITERIA}-${RECOMMENDED_MAX_CRITERIA} impact criteria that are relevant for your project. This configuration affects all assets.`,
            })}
          </Alert>

          {/* Impact Scale */}
          <Box>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1.5 }}>
                {t("tabs.assets.config.impactScale", {
                  defaultValue: "Impact Scale",
                })}
              </FormLabel>
              <RadioGroup
                row
                value={configuration.impactScale}
                onChange={(e) =>
                  handleScaleChange(e.target.value as ImpactScaleType)
                }
              >
                <FormControlLabel
                  value="3-level"
                  control={<Radio />}
                  label={t("tabs.assets.config.scale3", {
                    defaultValue: "3-Level (Low, Medium, High)",
                  })}
                />
                <FormControlLabel
                  value="4-level"
                  control={<Radio />}
                  label={t("tabs.assets.config.scale4", {
                    defaultValue: "4-Level (+ Critical)",
                  })}
                />
                <FormControlLabel
                  value="5-level"
                  control={<Radio />}
                  label={t("tabs.assets.config.scale5", {
                    defaultValue: "5-Level (+ Very High)",
                  })}
                />
              </RadioGroup>
            </FormControl>

            {/* Scale Preview */}
            <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
              {scale.levels.map((level) => (
                <Chip
                  key={level.value}
                  label={`${level.value}: ${
                    isGerman ? level.labelDE : level.label
                  }`}
                  size="small"
                  sx={{
                    backgroundColor: getLevelColor(level.color),
                    color: "white",
                  }}
                />
              ))}
            </Box>
          </Box>

          <Divider />

          {/* Calculation + Rounding Method (Side by Side) */}
          <Grid container spacing={3}>
            {/* Overall Impact Calculation */}
            <Grid item xs={12} md={6}>
              <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend" sx={{ mb: 1.5 }}>
                  {t("tabs.assets.config.calculationMethod", {
                    defaultValue: "Overall Impact Calculation",
                  })}
                </FormLabel>
                <RadioGroup
                  value={configuration.calculationMethod}
                  onChange={(e) =>
                    handleCalculationMethodChange(
                      e.target.value as ImpactCalculationMethod
                    )
                  }
                >
                  <FormControlLabel
                    value="conservative"
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {t("tabs.assets.config.conservative", {
                            defaultValue: "Conservative (Maximum)",
                          })}
                        </Typography>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                gutterBottom
                              >
                                {t("tabs.assets.config.conservative", {
                                  defaultValue: "Conservative (Maximum)",
                                })}
                              </Typography>
                              <Typography variant="body2">
                                {t("tabs.assets.config.conservativeDesc", {
                                  defaultValue:
                                    "Uses the highest impact value across all criteria",
                                })}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="right"
                        >
                          <InfoIcon
                            fontSize="small"
                            color="action"
                            sx={{ cursor: "help" }}
                          />
                        </Tooltip>
                      </Stack>
                    }
                  />

                  <FormControlLabel
                    value="average"
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {t("tabs.assets.config.average", {
                            defaultValue: "Average (Arithmetic Mean)",
                          })}
                        </Typography>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                gutterBottom
                              >
                                {t("tabs.assets.config.average", {
                                  defaultValue: "Average (Arithmetic Mean)",
                                })}
                              </Typography>
                              <Typography variant="body2">
                                {t("tabs.assets.config.averageDesc", {
                                  defaultValue:
                                    "Calculates the average of all impact values",
                                })}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="right"
                        >
                          <InfoIcon
                            fontSize="small"
                            color="action"
                            sx={{ cursor: "help" }}
                          />
                        </Tooltip>
                      </Stack>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {/* Level Threshold Calculation */}
            <Grid item xs={12} md={6}>
              <FormControl component="fieldset" fullWidth>
                <FormLabel sx={{ mb: 1.5 }}>
                  {t("tabs.assets.config.roundingMethod", {
                    defaultValue: "Level Threshold Calculation",
                  })}
                </FormLabel>
                <RadioGroup
                  value={configuration.roundingMethod}
                  onChange={(e) =>
                    handleRoundingMethodChange(
                      e.target.value as ImpactRoundingMethod
                    )
                  }
                >
                  <FormControlLabel
                    value="round"
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {t("tabs.assets.config.roundingRound", {
                            defaultValue: "Standard",
                          })}
                        </Typography>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                gutterBottom
                              >
                                {t("tabs.assets.config.roundingRoundTitle", {
                                  defaultValue:
                                    "Standard Rounding (Math.round)",
                                })}
                              </Typography>
                              <Typography variant="body2">
                                {t("tabs.assets.config.roundingRoundDesc", {
                                  defaultValue:
                                    "Symmetric thresholds at .5 boundaries",
                                })}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="right"
                        >
                          <InfoIcon
                            fontSize="small"
                            color="action"
                            sx={{ cursor: "help" }}
                          />
                        </Tooltip>
                      </Stack>
                    }
                  />

                  <FormControlLabel
                    value="ceil"
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {t("tabs.assets.config.roundingCeil", {
                            defaultValue: "Conservative",
                          })}
                        </Typography>
                        <Tooltip
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight="bold"
                                gutterBottom
                              >
                                {t("tabs.assets.config.roundingCeilTitle", {
                                  defaultValue:
                                    "Conservative Rounding (Math.ceil)",
                                })}
                              </Typography>
                              <Typography variant="body2">
                                {t("tabs.assets.config.roundingCeilDesc", {
                                  defaultValue:
                                    "Always rounds up to higher impact level",
                                })}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="right"
                        >
                          <InfoIcon
                            fontSize="small"
                            color="action"
                            sx={{ cursor: "help" }}
                          />
                        </Tooltip>
                      </Stack>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
          </Grid>

          <Divider />

          {/* Impact Criteria Selection - Side by Side */}
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <FormLabel component="legend">
                {t("tabs.assets.config.impactCriteria", {
                  defaultValue: "Impact Criteria",
                })}
              </FormLabel>
              <Chip
                label={`${criteriaCount}/${RECOMMENDED_MAX_CRITERIA}`}
                size="small"
                color={
                  isUnderMinimum
                    ? "error"
                    : isOverRecommended
                    ? "warning"
                    : "success"
                }
                variant={
                  isOverRecommended || isUnderMinimum ? "filled" : "outlined"
                }
              />
            </Box>

            {isOverRecommended && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t("tabs.assets.config.tooManyCriteria", {
                  defaultValue: `You have selected more than ${RECOMMENDED_MAX_CRITERIA} criteria. This may make the assessment more complex.`,
                })}
              </Alert>
            )}

            {/* Two-column layout for Business and Physical criteria */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderCriteriaList(
                  businessCriteria,
                  t("tabs.assets.config.businessCriteria", {
                    defaultValue: "Business / Organizational",
                  })
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderCriteriaList(
                  physicalCriteria,
                  t("tabs.assets.config.physicalCriteria", {
                    defaultValue: "Physical",
                  })
                )}
              </Grid>
            </Grid>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={criteriaCount < MIN_CRITERIA}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== HELPERS ====================

function getLevelColor(colorName: string): string {
  const colors: Record<string, string> = {
    green: "#22c55e",
    yellow: "#eab308",
    orange: "#f97316",
    red: "#ef4444",
    purple: "#a855f7",
  };
  return colors[colorName] || "#6b7280";
}

export default AssetConfigDialog;