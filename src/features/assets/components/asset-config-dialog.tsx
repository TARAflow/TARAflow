// ==================== ASSET CONFIG DIALOG ====================
// Configuration dialog for impact criteria, scale, calculation method, and rounding.
// Matches risk-config-dialog look & feel: two tabs (Method & Display / Factors).
//
// Safety factor rules:
//   - If hasSafetyAnnotations === true, the "safety" criterion is locked ON.
//   - Locked criteria cannot be deselected (Checkbox disabled, no toggle).

import React, { useState, useMemo } from "react";
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
  Slider,
  Divider,
  Alert,
  Chip,
  Stack,
  Tooltip,
  Tabs,
  Tab,
} from "@mui/material";
import { Info as InfoIcon, Lock as LockIcon } from "@mui/icons-material";

import type { AssetConfiguration } from "../models/asset-types";
import {
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
  WeightedImpactCriterion,
  IMPACT_CRITERION_KEY_PREFIX,
} from "../models/asset-impact-types";

// ==================== TYPES ====================

interface AssetConfigDialogProps {
  open: boolean;
  configuration: AssetConfiguration;
  /** True if any DFD element has a SafetyAnnotation — locks the "safety" criterion */
  hasSafetyAnnotations?: boolean;
  onChange: (config: AssetConfiguration) => void;
  onSave: () => void;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ==================== CONSTANTS ====================

const MIN_CRITERIA = 4;
const RECOMMENDED_MAX_CRITERIA = 6;
const SAFETY_CRITERION_ID = "safety";

// ==================== COMPONENT ====================

export const AssetConfigDialog: React.FC<AssetConfigDialogProps> = ({
  open,
  configuration,
  hasSafetyAnnotations = false,
  onChange,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const [tabValue, setTabValue] = useState(0);

  // ==================== COMPUTED ====================

  const businessCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "business",
  );
  const physicalCriteria = PREDEFINED_IMPACT_CRITERIA.filter(
    (c) => c.category === "physical",
  );

  const criteriaCount = configuration.impactCriteria.length;
  const isOverRecommended = criteriaCount > RECOMMENDED_MAX_CRITERIA;
  const isUnderMinimum = criteriaCount < MIN_CRITERIA;
  const isValidCount = !isUnderMinimum;

  const scale = IMPACT_SCALES[configuration.impactScale];

  // ==================== HANDLERS ====================

  const handleToggleCriterion = (criterionId: string) => {
    // Safety criterion locked when graph has safety annotations
    if (criterionId === SAFETY_CRITERION_ID && hasSafetyAnnotations) return;

    const currentCriteria = configuration.impactCriteria;
    let newCriteria: WeightedImpactCriterion[];

    if (currentCriteria.some((c) => c.id === criterionId)) {
      if (currentCriteria.length <= MIN_CRITERIA) return;
      newCriteria = currentCriteria.filter((c) => c.id !== criterionId);
    } else {
      newCriteria = [...currentCriteria, { id: criterionId, weight: 1.0 }];
    }

    onChange({ ...configuration, impactCriteria: newCriteria });
  };;

  const handleWeightChange = (criterionId: string, weight: number) => {
    const newCriteria = configuration.impactCriteria.map((c) =>
      c.id === criterionId ? { ...c, weight } : c,
    );
    onChange({ ...configuration, impactCriteria: newCriteria });
  };

  const handleScaleChange = (scale: ImpactScaleType) => {
    onChange({ ...configuration, impactScale: scale });
  };

  const handleCalculationMethodChange = (method: ImpactCalculationMethod) => {
    onChange({ ...configuration, calculationMethod: method });
  };

  const handleRoundingMethodChange = (method: ImpactRoundingMethod) => {
    onChange({ ...configuration, roundingMethod: method });
  };

  const handleResetWeights = () => {
    const newCriteria = configuration.impactCriteria.map((c) => ({
      ...c,
      weight: 1.0,
    }));
    onChange({ ...configuration, impactCriteria: newCriteria });
  };

  // ==================== RENDER FACTOR LIST ====================

  const renderCriteriaList = (
    criteria: typeof PREDEFINED_IMPACT_CRITERIA,
    title: string,
  ) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <List dense disablePadding>
        {criteria.map((criterion) => {
          const isSelected = configuration.impactCriteria.some(
            (c) => c.id === criterion.id,
          );
          const isSafetyLocked =
            criterion.id === SAFETY_CRITERION_ID && hasSafetyAnnotations;
          const canDeselect =
            configuration.impactCriteria.length > MIN_CRITERIA &&
            !isSafetyLocked;
          const activeCriterion = configuration.impactCriteria.find(
            (c) => c.id === criterion.id,
          );
          const weight = activeCriterion?.weight ?? 1.0;

          return (
            <ListItem
              key={criterion.id}
              disablePadding
              sx={{
                mb: 1,
                border: "1px solid",
                borderColor: isSelected ? "primary.light" : "divider",
                borderRadius: 1,
                backgroundColor: isSelected ? "action.selected" : "transparent",
              }}
            >
              <ListItemButton
                onClick={() => handleToggleCriterion(criterion.id)}
                disabled={isSelected && !canDeselect}
                dense
                sx={{ py: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {isSafetyLocked ? (
                    <Tooltip
                      title={t("tabs.assets.config.safetyLocked", {
                        defaultValue:
                          "Safety criterion is locked — graph contains safety annotations",
                      })}
                      arrow
                    >
                      <LockIcon fontSize="small" color="warning" />
                    </Tooltip>
                  ) : (
                    <Checkbox
                      edge="start"
                      checked={isSelected}
                      tabIndex={-1}
                      disableRipple
                      disabled={isSelected && !canDeselect}
                      size="small"
                    />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">
                        {t(
                          `${IMPACT_CRITERION_KEY_PREFIX}.${criterion.id}.name`,
                        )}
                      </Typography>
                      {isSafetyLocked && (
                        <Chip
                          label={t("tabs.assets.config.derived", {
                            defaultValue: "Graph-derived",
                          })}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ fontSize: "0.6rem", height: 18 }}
                        />
                      )}
                    </Stack>
                  }
                  secondary={t(
                    `${IMPACT_CRITERION_KEY_PREFIX}.${criterion.id}.description`,
                  )}
                  secondaryTypographyProps={{
                    variant: "caption",
                    sx: { lineHeight: 1.3 },
                  }}
                />
              </ListItemButton>

              {/* Weight slider — only when selected */}
              {isSelected && (
                <Box sx={{ px: 2, minWidth: 160 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {t("tabs.assets.config.weight", {
                        defaultValue: "Weight",
                      })}
                      :
                    </Typography>
                    <Slider
                      value={weight}
                      onChange={(_, v) =>
                        handleWeightChange(criterion.id, v as number)
                      }
                      min={0}
                      max={1}
                      step={0.1}
                      size="small"
                      sx={{ width: 80 }}
                    />
                    <Typography variant="caption" sx={{ minWidth: 30 }}>
                      {weight.toFixed(1)}
                    </Typography>
                  </Stack>
                </Box>
              )}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: 640, maxHeight: "90vh" } }}
    >
      <DialogTitle>
        {t("tabs.assets.config.title", {
          defaultValue: "Asset Impact Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column" }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            label={t("tabs.assets.config.methodTab", {
              defaultValue: "Method & Display",
            })}
          />
          <Tab
            label={t("tabs.assets.config.factorsTab", {
              defaultValue: "Factors",
            })}
          />
        </Tabs>

        {/* ── Tab 0: Method & Display ─────────────────────────────────────── */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Impact Scale */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1.5 }}>
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

              {/* Scale preview chips */}
              <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {scale.levels.map((level) => (
                  <Chip
                    key={level.value}
                    label={`${level.value}: ${t(level.labelKey)}`}
                    size="small"
                    sx={{ backgroundColor: level.color, color: "white" }}
                  />
                ))}
              </Box>
            </FormControl>

            <Divider />

            {/* Calculation Method */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1.5 }}>
                {t("tabs.assets.config.calculationMethod", {
                  defaultValue: "Overall Impact Calculation",
                })}
              </FormLabel>
              <RadioGroup
                value={configuration.calculationMethod}
                onChange={(e) =>
                  handleCalculationMethodChange(
                    e.target.value as ImpactCalculationMethod,
                  )
                }
              >
                <FormControlLabel
                  value="conservative"
                  control={<Radio />}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box>
                        <Typography fontWeight="medium">
                          {t("tabs.assets.config.conservative", {
                            defaultValue: "Conservative (Maximum)",
                          })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("tabs.assets.config.conservativeDesc", {
                            defaultValue:
                              "Uses the highest impact value across all criteria. Weights have no effect.",
                          })}
                        </Typography>
                      </Box>
                      <Tooltip
                        title={
                          <Box
                            sx={{
                              p: 0.5,
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                            }}
                          >
                            Overall = MAX(all criteria)
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
                  sx={{ alignItems: "flex-start", mb: 1 }}
                />
                <FormControlLabel
                  value="average"
                  control={<Radio />}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box>
                        <Typography fontWeight="medium">
                          {t("tabs.assets.config.average", {
                            defaultValue: "Average (Weighted Mean)",
                          })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("tabs.assets.config.averageDesc", {
                            defaultValue:
                              "Calculates the weighted average of all impact values. Weights matter.",
                          })}
                        </Typography>
                      </Box>
                      <Tooltip
                        title={
                          <Box
                            sx={{
                              p: 0.5,
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                            }}
                          >
                            Overall = Σ(Value × Weight) / Σ(Weight)
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
                  sx={{ alignItems: "flex-start" }}
                />
              </RadioGroup>
            </FormControl>

            <Divider />

            {/* Rounding Method */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1.5 }}>
                {t("tabs.assets.config.roundingMethod", {
                  defaultValue: "Level Threshold Calculation",
                })}
              </FormLabel>
              <RadioGroup
                value={configuration.roundingMethod}
                onChange={(e) =>
                  handleRoundingMethodChange(
                    e.target.value as ImpactRoundingMethod,
                  )
                }
              >
                <FormControlLabel
                  value="round"
                  control={<Radio />}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography>
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
                                defaultValue: "Standard Rounding (Math.round)",
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
                      <Typography>
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
          </Box>
        </TabPanel>

        {/* ── Tab 1: Factors ──────────────────────────────────────────────── */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Criteria count indicator */}
            <Alert
              severity={
                isUnderMinimum
                  ? "error"
                  : isOverRecommended
                    ? "warning"
                    : "info"
              }
              action={
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleResetWeights}
                  sx={{
                    fontSize: "0.72rem",
                    py: 0.25,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("tabs.assets.config.resetWeights", {
                    defaultValue: "Reset weights to 1.0",
                  })}
                </Button>
              }
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <span>
                  {t("tabs.assets.config.criteriaCountInfo", {
                    count: criteriaCount,
                    min: MIN_CRITERIA,
                    max: RECOMMENDED_MAX_CRITERIA,
                    defaultValue: `${criteriaCount} criteria selected (recommended: ${MIN_CRITERIA}–${RECOMMENDED_MAX_CRITERIA})`,
                  })}
                </span>
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
              </Stack>
            </Alert>

            {hasSafetyAnnotations && (
              <Alert severity="warning" icon={<LockIcon fontSize="small" />}>
                {t("tabs.assets.config.safetyLockedInfo", {
                  defaultValue:
                    'The "Safety" criterion is locked ON because the DFD contains safety annotations.',
                })}
              </Alert>
            )}

            {/* Business criteria */}
            {renderCriteriaList(
              businessCriteria,
              t("tabs.assets.config.businessCriteria", {
                defaultValue: "Business / Organizational",
              }),
            )}

            {/* Physical criteria */}
            {renderCriteriaList(
              physicalCriteria,
              t("tabs.assets.config.physicalCriteria", {
                defaultValue: "Physical",
              }),
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button onClick={onSave} variant="contained" disabled={!isValidCount}>
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetConfigDialog;