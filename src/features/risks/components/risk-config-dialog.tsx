// ==================== RISK CONFIG DIALOG ====================
// Configuration dialog for risk assessment method, scale, and factors
// Supports Simple (DREAD) and Complex (OWASP/ETSI) methods

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
  Tabs,
  Tab,
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
  IconButton,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Paper,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Functions as FormulaIcon,
} from "@mui/icons-material";

import {
  RiskConfiguration,
  RiskMethodType,
  RiskScaleType,
  ActiveFactor,
  RiskFactorDefinition,
  RiskFactorCategory,
  RISK_SCALES,
  DREAD_FACTORS,
  OWASP_LIKELIHOOD_FACTORS,
  OWASP_IMPACT_FACTORS,
  ETSI_FACTORS,
  ALL_PREDEFINED_FACTORS,
  DEFAULT_SIMPLE_CONFIGURATION,
  DEFAULT_COMPLEX_CONFIGURATION,
} from "../models/risk-types";

// ==================== TYPES ====================

interface RiskConfigDialogProps {
  open: boolean;
  configuration: RiskConfiguration;
  onSave: (config: RiskConfiguration) => void;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// ==================== COMPONENT ====================

export const RiskConfigDialog: React.FC<RiskConfigDialogProps> = ({
  open,
  configuration,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Local state
  const [tabValue, setTabValue] = useState(0);
  const [method, setMethod] = useState<RiskMethodType>(configuration.method);
  const [scale, setScale] = useState<RiskScaleType>(configuration.scale);
  const [activeFactors, setActiveFactors] = useState<ActiveFactor[]>(
    configuration.activeFactors
  );
  const [showIndividualFactors, setShowIndividualFactors] = useState(
    configuration.showIndividualFactors
  );
  const [customFactors, setCustomFactors] = useState<RiskFactorDefinition[]>(
    configuration.customFactors
  );

  // New custom factor state
  const [newFactorName, setNewFactorName] = useState("");
  const [newFactorDescription, setNewFactorDescription] = useState("");
  const [newFactorCategory, setNewFactorCategory] =
    useState<RiskFactorCategory>("combined");

  // ==================== FACTOR GROUPS ====================

  const factorGroups = useMemo(() => {
    if (method === "simple") {
      return {
        combined: DREAD_FACTORS,
        likelihood: [],
        impact: [],
      };
    } else {
      return {
        combined: [],
        likelihood: [...OWASP_LIKELIHOOD_FACTORS, ...ETSI_FACTORS],
        impact: OWASP_IMPACT_FACTORS,
      };
    }
  }, [method]);

  // ==================== HANDLERS ====================

  const handleMethodChange = (newMethod: RiskMethodType) => {
    setMethod(newMethod);

    // Reset to default factors for the method
    if (newMethod === "simple") {
      setActiveFactors(DEFAULT_SIMPLE_CONFIGURATION.activeFactors);
      setNewFactorCategory("combined");
    } else {
      setActiveFactors(DEFAULT_COMPLEX_CONFIGURATION.activeFactors);
      setNewFactorCategory("likelihood");
    }
  };

  const handleToggleFactor = (factorId: string) => {
    setActiveFactors((prev) => {
      const existing = prev.find((f) => f.factorId === factorId);
      if (existing) {
        return prev.map((f) =>
          f.factorId === factorId ? { ...f, enabled: !f.enabled } : f
        );
      } else {
        // Add new factor with default weight
        const def = [...ALL_PREDEFINED_FACTORS, ...customFactors].find(
          (f) => f.id === factorId
        );
        return [
          ...prev,
          {
            factorId,
            enabled: true,
            weight: def?.defaultWeight ?? 1.0,
          },
        ];
      }
    });
  };

  const handleWeightChange = (factorId: string, weight: number) => {
    setActiveFactors((prev) =>
      prev.map((f) => (f.factorId === factorId ? { ...f, weight } : f))
    );
  };

  const handleAddCustomFactor = () => {
    if (!newFactorName.trim()) return;

    const id = `custom-${Date.now()}`;
    const newFactor: RiskFactorDefinition = {
      id,
      category: method === "simple" ? "combined" : newFactorCategory,
      name: newFactorName,
      nameDE: newFactorName, // Use same value
      description: newFactorDescription,
      descriptionDE: newFactorDescription, // Use same value
      defaultWeight: 1.0,
      source: "custom",
    };

    setCustomFactors((prev) => [...prev, newFactor]);
    setActiveFactors((prev) => [
      ...prev,
      { factorId: id, enabled: true, weight: 1.0 },
    ]);

    // Reset form
    setNewFactorName("");
    setNewFactorDescription("");
  };

  const handleRemoveCustomFactor = (factorId: string) => {
    setCustomFactors((prev) => prev.filter((f) => f.id !== factorId));
    setActiveFactors((prev) => prev.filter((f) => f.factorId !== factorId));
  };

  const handleSave = () => {
    onSave({
      ...configuration,
      method,
      scale,
      activeFactors,
      showIndividualFactors,
      customFactors,
    });
  };

  // ==================== RENDER FACTOR LIST ====================

  const renderFactorList = (
    factors: RiskFactorDefinition[],
    title: string
  ) => {
    if (factors.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <List dense disablePadding>
          {factors.map((factor) => {
            const activeFactor = activeFactors.find(
              (af) => af.factorId === factor.id
            );
            const isEnabled = activeFactor?.enabled ?? false;
            const weight = activeFactor?.weight ?? factor.defaultWeight;

            return (
              <ListItem
                key={factor.id}
                disablePadding
                sx={{
                  mb: 1,
                  border: "1px solid",
                  borderColor: isEnabled ? "primary.light" : "divider",
                  borderRadius: 1,
                  backgroundColor: isEnabled ? "action.selected" : "transparent",
                }}
              >
                <ListItemButton
                  onClick={() => handleToggleFactor(factor.id)}
                  dense
                  sx={{ py: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Checkbox edge="start" checked={isEnabled} tabIndex={-1} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {isGerman ? factor.nameDE : factor.name}
                        </Typography>
                        <Chip
                          label={factor.source}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.6rem", height: 18 }}
                        />
                      </Stack>
                    }
                    secondary={isGerman ? factor.descriptionDE : factor.description}
                  />
                </ListItemButton>
                {isEnabled && (
                  <Box sx={{ px: 2, minWidth: 150 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.risks.config.weight", { defaultValue: "Weight" })}:
                      </Typography>
                      <Slider
                        value={weight}
                        onChange={(_, v) =>
                          handleWeightChange(factor.id, v as number)
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
  };

  // ==================== RENDER CUSTOM FACTOR LIST ====================

  const renderCustomFactorList = () => {
    const relevantCustomFactors = customFactors.filter((f) =>
      method === "simple"
        ? f.category === "combined"
        : f.category === "likelihood" || f.category === "impact"
    );

    if (relevantCustomFactors.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("tabs.risks.config.customFactors", { defaultValue: "Custom Factors" })}
        </Typography>
        <List dense disablePadding>
          {relevantCustomFactors.map((factor) => {
            const activeFactor = activeFactors.find(
              (af) => af.factorId === factor.id
            );
            const isEnabled = activeFactor?.enabled ?? false;
            const weight = activeFactor?.weight ?? factor.defaultWeight;

            return (
              <ListItem
                key={factor.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleRemoveCustomFactor(factor.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                sx={{
                  mb: 1,
                  border: "1px solid",
                  borderColor: isEnabled ? "primary.light" : "divider",
                  borderRadius: 1,
                  backgroundColor: isEnabled ? "action.selected" : "transparent",
                }}
              >
                <ListItemButton
                  onClick={() => handleToggleFactor(factor.id)}
                  dense
                  sx={{ py: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Checkbox edge="start" checked={isEnabled} tabIndex={-1} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {isGerman ? factor.nameDE : factor.name}
                        </Typography>
                        {method === "complex" && (
                          <Chip
                            label={factor.category}
                            size="small"
                            variant="outlined"
                            color={factor.category === "impact" ? "error" : "info"}
                            sx={{ fontSize: "0.6rem", height: 18 }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={isGerman ? factor.descriptionDE : factor.description}
                  />
                </ListItemButton>
                {isEnabled && (
                  <Box sx={{ px: 2, minWidth: 150, mr: 4 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.risks.config.weight", { defaultValue: "Weight" })}:
                      </Typography>
                      <Slider
                        value={weight}
                        onChange={(_, v) =>
                          handleWeightChange(factor.id, v as number)
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
  };

  // ==================== COUNT ENABLED FACTORS ====================

  const enabledCount = activeFactors.filter((f) => f.enabled).length;
  const minFactors = 3;
  const maxFactors = 10;
  const isValidCount = enabledCount >= minFactors && enabledCount <= maxFactors;

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: 600, maxHeight: "90vh" },
      }}
    >
      <DialogTitle>
        {t("tabs.risks.config.title", {
          defaultValue: "Risk Assessment Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column" }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            label={t("tabs.risks.config.methodTab", { defaultValue: "Method & Display" })}
          />
          <Tab
            label={t("tabs.risks.config.factorsTab", { defaultValue: "Factors" })}
          />
        </Tabs>

        {/* Method & Display Tab (combined) */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Method Selection */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 2 }}>
                {t("tabs.risks.config.assessmentMethod", {
                  defaultValue: "Risk Assessment Method",
                })}
              </FormLabel>
              <RadioGroup
                value={method}
                onChange={(e) =>
                  handleMethodChange(e.target.value as RiskMethodType)
                }
              >
                <FormControlLabel
                  value="simple"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography fontWeight="medium">
                        {t("tabs.risks.config.simpleMethod", {
                          defaultValue: "Simple (DREAD-like)",
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("tabs.risks.config.simpleDesc", {
                          defaultValue:
                            "Combined factors with single overall risk score. Simpler to use, good for quick assessments.",
                        })}
                      </Typography>
                      {/* Formula */}
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 1,
                          p: 1,
                          backgroundColor: "grey.50",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <FormulaIcon fontSize="small" color="action" />
                        <Typography variant="caption" fontFamily="monospace">
                          Risk = Σ(Factor × Weight) / Σ(Weight)
                        </Typography>
                      </Paper>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", mb: 2 }}
                />
                <FormControlLabel
                  value="complex"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography fontWeight="medium">
                        {t("tabs.risks.config.complexMethod", {
                          defaultValue: "Complex (OWASP/ETSI-like)",
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("tabs.risks.config.complexDesc", {
                          defaultValue:
                            "Separate Impact and Likelihood factors. More detailed analysis, industry standard methodologies.",
                        })}
                      </Typography>
                      {/* Formula */}
                      <Paper
                        variant="outlined"
                        sx={{
                          mt: 1,
                          p: 1,
                          backgroundColor: "grey.50",
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormulaIcon fontSize="small" color="action" />
                          <Typography variant="caption" fontFamily="monospace">
                            Likelihood = Σ(Likelihood Factors × Weight) / Σ(Weight)
                          </Typography>
                        </Stack>
                        <Typography variant="caption" fontFamily="monospace" sx={{ pl: 3.5 }}>
                          Impact = Σ(Impact Factors × Weight) / Σ(Weight)
                        </Typography>
                        <Typography variant="caption" fontFamily="monospace" sx={{ pl: 3.5 }}>
                          Risk = (Impact × Likelihood) / Scale
                        </Typography>
                      </Paper>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start" }}
                />
              </RadioGroup>
            </FormControl>

            <Divider />

            {/* Scale Selection */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1.5 }}>
                {t("tabs.risks.config.ratingScale", {
                  defaultValue: "Rating Scale",
                })}
              </FormLabel>
              <RadioGroup
                row
                value={scale}
                onChange={(e) => setScale(e.target.value as RiskScaleType)}
              >
                <FormControlLabel
                  value="3-level"
                  control={<Radio />}
                  label={t("tabs.risks.config.scale3", {
                    defaultValue: "3-Level (Low, Medium, High)",
                  })}
                />
                <FormControlLabel
                  value="4-level"
                  control={<Radio />}
                  label={t("tabs.risks.config.scale4", {
                    defaultValue: "4-Level (+ Critical)",
                  })}
                />
                <FormControlLabel
                  value="5-level"
                  control={<Radio />}
                  label={t("tabs.risks.config.scale5", {
                    defaultValue: "5-Level (+ Very High)",
                  })}
                />
              </RadioGroup>

              {/* Scale Preview */}
              <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                {RISK_SCALES[scale].levels.map((level) => (
                  <Chip
                    key={level.value}
                    label={`${level.value}: ${isGerman ? level.labelDE : level.label}`}
                    size="small"
                    sx={{
                      backgroundColor: level.color,
                      color: "white",
                    }}
                  />
                ))}
              </Box>
            </FormControl>

            <Divider />

            {/* Display Options */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1 }}>
                {t("tabs.risks.config.displayOptions", {
                  defaultValue: "Display Options",
                })}
              </FormLabel>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showIndividualFactors}
                    onChange={(e) => setShowIndividualFactors(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography>
                      {t("tabs.risks.config.showIndividualFactors", {
                        defaultValue: "Show Individual Factors in Table",
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("tabs.risks.config.showIndividualFactorsDesc", {
                        defaultValue:
                          "When disabled, only aggregated Impact/Likelihood values are shown. Hover shows details.",
                      })}
                    </Typography>
                  </Box>
                }
              />
            </FormControl>
          </Box>
        </TabPanel>

        {/* Factors Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, overflow: "auto", flexGrow: 1 }}>
            {/* Factor count indicator */}
            <Alert severity={isValidCount ? "info" : "warning"}>
              {t("tabs.risks.config.factorCountInfo", {
                count: enabledCount,
                min: minFactors,
                max: maxFactors,
                defaultValue: `${enabledCount} factors selected (recommended: ${minFactors}-${maxFactors})`,
              })}
            </Alert>

            {/* Predefined Factors based on method */}
            {method === "simple" ? (
              renderFactorList(
                factorGroups.combined,
                t("tabs.risks.config.dreadFactors", {
                  defaultValue: "DREAD Factors",
                })
              )
            ) : (
              <>
                {renderFactorList(
                  factorGroups.likelihood,
                  t("tabs.risks.config.likelihoodFactors", {
                    defaultValue: "Likelihood Factors",
                  })
                )}
                {renderFactorList(
                  factorGroups.impact,
                  t("tabs.risks.config.impactFactors", {
                    defaultValue: "Impact Factors",
                  })
                )}
              </>
            )}

            {/* Custom Factors */}
            <Divider />

            {renderCustomFactorList()}

            {/* Add Custom Factor Form */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("tabs.risks.config.addCustomFactor", {
                  defaultValue: "Add Custom Factor",
                })}
              </Typography>

              <Stack spacing={2}>
                {/* Name field */}
                <TextField
                  size="small"
                  label={t("tabs.risks.config.factorName", {
                    defaultValue: "Factor Name",
                  })}
                  value={newFactorName}
                  onChange={(e) => setNewFactorName(e.target.value)}
                  fullWidth
                />

                {/* Description field */}
                <TextField
                  size="small"
                  label={t("tabs.risks.config.factorDescription", {
                    defaultValue: "Description",
                  })}
                  value={newFactorDescription}
                  onChange={(e) => setNewFactorDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                />

                {/* Category (only for complex method) */}
                <Stack direction="row" spacing={2} alignItems="center">
                  {method === "complex" && (
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>
                        {t("tabs.risks.config.category", { defaultValue: "Category" })}
                      </InputLabel>
                      <Select
                        value={newFactorCategory}
                        label={t("tabs.risks.config.category", {
                          defaultValue: "Category",
                        })}
                        onChange={(e) =>
                          setNewFactorCategory(e.target.value as RiskFactorCategory)
                        }
                      >
                        <MenuItem value="likelihood">Likelihood</MenuItem>
                        <MenuItem value="impact">Impact</MenuItem>
                      </Select>
                    </FormControl>
                  )}

                  <Box sx={{ flexGrow: 1 }} />

                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddCustomFactor}
                    disabled={!newFactorName.trim()}
                  >
                    {t("tabs.risks.config.addFactor", { defaultValue: "Add Factor" })}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!isValidCount}
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RiskConfigDialog;