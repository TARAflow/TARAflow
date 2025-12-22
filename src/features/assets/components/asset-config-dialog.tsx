// ==================== ASSET CONFIG DIALOG ====================
// Configuration dialog for impact criteria, scale, and calculation method

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
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Chip,
} from "@mui/material";

import {
  AssetConfiguration,
  ImpactScaleType,
  ImpactCalculationMethod,
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
} from "../models/asset-types";

// ==================== TYPES ====================

interface AssetConfigDialogProps {
  open: boolean;
  configuration: AssetConfiguration;
  onSave: (config: AssetConfiguration) => void;
  onClose: () => void;
}

// ==================== CONSTANTS ====================

const MIN_CRITERIA = 4;
const RECOMMENDED_MAX_CRITERIA = 6;

// ==================== COMPONENT ====================

export const AssetConfigDialog: React.FC<AssetConfigDialogProps> = ({
  open,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Local state
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>(
    configuration.impactCriteria
  );
  const [impactScale, setImpactScale] = useState<ImpactScaleType>(
    configuration.impactScale
  );
  const [calculationMethod, setCalculationMethod] =
    useState<ImpactCalculationMethod>(configuration.calculationMethod);

  // ==================== HANDLERS ====================

  const handleToggleCriterion = (criterionId: string) => {
    setSelectedCriteria((prev) => {
      if (prev.includes(criterionId)) {
        // Remove (only if above minimum)
        if (prev.length > MIN_CRITERIA) {
          return prev.filter((id) => id !== criterionId);
        }
        return prev;
      } else {
        // Add (no hard maximum, but show warning)
        return [...prev, criterionId];
      }
    });
  };

  const handleSave = () => {
    onSave({
      impactCriteria: selectedCriteria,
      impactScale,
      calculationMethod,
    });
  };

  // ==================== COMPUTED ====================

  const businessCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "business"
  );
  const physicalCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "physical"
  );

  const scale = IMPACT_SCALES[impactScale];

  // Criteria count for indicator
  const criteriaCount = selectedCriteria.length;
  const isOverRecommended = criteriaCount > RECOMMENDED_MAX_CRITERIA;
  const isUnderMinimum = criteriaCount < MIN_CRITERIA;

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
                value={impactScale}
                onChange={(e) =>
                  setImpactScale(e.target.value as ImpactScaleType)
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
                  label={isGerman ? level.labelDE : level.label}
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

          {/* Calculation Method */}
          <Box>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1.5 }}>
                {t("tabs.assets.config.calculationMethod", {
                  defaultValue: "Overall Impact Calculation",
                })}
              </FormLabel>
              <RadioGroup
                value={calculationMethod}
                onChange={(e) =>
                  setCalculationMethod(
                    e.target.value as ImpactCalculationMethod
                  )
                }
              >
                <FormControlLabel
                  value="conservative"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">
                        {t("tabs.assets.config.conservative", {
                          defaultValue: "Conservative (Maximum)",
                        })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.assets.config.conservativeDesc", {
                          defaultValue:
                            "Uses the highest impact value across all criteria",
                        })}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="average"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">
                        {t("tabs.assets.config.average", {
                          defaultValue: "Average (Arithmetic Mean)",
                        })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.assets.config.averageDesc", {
                          defaultValue:
                            "Calculates the average of all impact values",
                        })}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>

          <Divider />

          {/* Impact Criteria Selection */}
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
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

            {/* Business Criteria */}
            <Typography
              variant="subtitle2"
              sx={{ mt: 1, mb: 0.5, color: "text.secondary" }}
            >
              {t("tabs.assets.config.businessCriteria", {
                defaultValue: "Business / Organizational",
              })}
            </Typography>
            <List dense disablePadding>
              {businessCriteria.map((criterion) => {
                const isSelected = selectedCriteria.includes(criterion.id);
                const canDeselect = selectedCriteria.length > MIN_CRITERIA;

                return (
                  <ListItem key={criterion.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleToggleCriterion(criterion.id)}
                      disabled={isSelected && !canDeselect}
                      dense
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox
                          edge="start"
                          checked={isSelected}
                          tabIndex={-1}
                          disableRipple
                          disabled={isSelected && !canDeselect}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={isGerman ? criterion.nameDE : criterion.name}
                        secondary={
                          isGerman
                            ? criterion.descriptionDE
                            : criterion.description
                        }
                        primaryTypographyProps={{ variant: "body2" }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {/* Physical Criteria */}
            <Typography
              variant="subtitle2"
              sx={{ mt: 2, mb: 0.5, color: "text.secondary" }}
            >
              {t("tabs.assets.config.physicalCriteria", {
                defaultValue: "Physical",
              })}
            </Typography>
            <List dense disablePadding>
              {physicalCriteria.map((criterion) => {
                const isSelected = selectedCriteria.includes(criterion.id);
                const canDeselect = selectedCriteria.length > MIN_CRITERIA;

                return (
                  <ListItem key={criterion.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleToggleCriterion(criterion.id)}
                      disabled={isSelected && !canDeselect}
                      dense
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Checkbox
                          edge="start"
                          checked={isSelected}
                          tabIndex={-1}
                          disableRipple
                          disabled={isSelected && !canDeselect}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={isGerman ? criterion.nameDE : criterion.name}
                        secondary={
                          isGerman
                            ? criterion.descriptionDE
                            : criterion.description
                        }
                        primaryTypographyProps={{ variant: "body2" }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSave}
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