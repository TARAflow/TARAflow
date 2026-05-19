// ==================== RISK CONFIG DIALOG ====================
// Configuration dialog for risk assessment method, scale, and factors.
// Likelihood × Impact method (OWASP / ETSI / EN 50742 / TARAflow)
//
// Phase 3 changes:
// - OWASP_IMPACT_FACTORS → ALL_PREDEFINED_FACTORS filtered by category "impact"
//   (includes new aligned factors: affected_users, operational, safety, etc.)
// - Safety factor shows "Auto" badge when autoEnabled === true
// - handleToggleFactor sets autoEnabled: false on manual toggle
// - useAssetImpact description updated to reflect per-criterion prefill

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
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from "@mui/icons-material";

import {
  RiskConfiguration,
  RiskScaleType,
  RiskRoundingMethod,
  ActiveFactor,
  RiskFactorDefinition,
  RiskFactorCategory,
  AssetImpactMapping,
  AssetImpactLevel,
  RISK_SCALES,
  OWASP_LIKELIHOOD_FACTORS,
  EN50742_FACTORS,
  ETSI_FACTORS,
  ALL_PREDEFINED_FACTORS,
  DEFAULT_ASSET_IMPACT_MAPPINGS,
} from "../models/risk-types";

// Derive impact factors directly from ALL_PREDEFINED_FACTORS — always in sync.
const ALL_IMPACT_FACTORS = ALL_PREDEFINED_FACTORS.filter(
  (f) => f.category === "impact",
);

const ASSET_IMPACT_LEVELS: AssetImpactLevel[] = [
  "LOW",
  "MED",
  "MED+",
  "HIGH",
  "HIGH+",
  "CRITICAL",
];

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

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
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
  const { t } = useTranslation();

  // ── Local state ───────────────────────────────────────────────────────────
  const [tabValue, setTabValue] = useState(0);
  const [scale, setScale] = useState<RiskScaleType>(configuration.scale);
  const [roundingMethod, setRoundingMethod] = useState<RiskRoundingMethod>(
    configuration.roundingMethod || "round",
  );
  const [activeFactors, setActiveFactors] = useState<ActiveFactor[]>(
    configuration.activeFactors,
  );
  const [showIndividualFactors, setShowIndividualFactors] = useState(
    configuration.showIndividualFactors,
  );
  const [customFactors, setCustomFactors] = useState<RiskFactorDefinition[]>(
    configuration.customFactors,
  );
  const [useAssetImpact, setUseAssetImpact] = useState(
    configuration.useAssetImpact ?? true,
  );
  const [assetImpactMapping, setAssetImpactMapping] =
    useState<AssetImpactMapping>(
      configuration.assetImpactMapping ??
        DEFAULT_ASSET_IMPACT_MAPPINGS[configuration.scale],
    );
  const [severityThresholds, setSeverityThresholds] = useState<
    Record<number, number>
  >(
    configuration.severityThresholds ??
      Object.fromEntries(
        RISK_SCALES[configuration.scale].levels.map((l) => [
          l.value,
          l.threshold,
        ]),
      ),
  );

  // New custom factor form state
  const [newFactorName, setNewFactorName] = useState("");
  const [newFactorDescription, setNewFactorDescription] = useState("");
  const [newFactorCategory, setNewFactorCategory] =
    useState<RiskFactorCategory>("likelihood");

  // ── Factor groups ─────────────────────────────────────────────────────────

  const factorGroups = useMemo(
    () => ({
      likelihood: [
        ...OWASP_LIKELIHOOD_FACTORS,
        ...ETSI_FACTORS,
        ...EN50742_FACTORS,
      ],
      // Phase 3: derived from ALL_PREDEFINED_FACTORS — includes all aligned
      // impact factors (financial_damage, operational, affected_users, safety, etc.)
      impact: ALL_IMPACT_FACTORS,
    }),
    [],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleFactor = (factorId: string) => {
    setActiveFactors((prev) => {
      const existing = prev.find((f) => f.factorId === factorId);
      if (existing) {
        return prev.map((f) =>
          f.factorId === factorId
            ? {
                ...f,
                enabled: !f.enabled,
                // Analyst explicitly toggled → clear auto-enabled flag
                autoEnabled: false,
              }
            : f,
        );
      } else {
        const def = [...ALL_PREDEFINED_FACTORS, ...customFactors].find(
          (f) => f.id === factorId,
        );
        return [
          ...prev,
          {
            factorId,
            enabled: true,
            weight: def?.defaultWeight ?? 1.0,
            autoEnabled: false,
          },
        ];
      }
    });
  };

  const handleWeightChange = (factorId: string, weight: number) => {
    setActiveFactors((prev) =>
      prev.map((f) => (f.factorId === factorId ? { ...f, weight } : f)),
    );
  };

  const handleAddCustomFactor = () => {
    if (!newFactorName.trim()) return;
    const id = `custom-${Date.now()}`;
    const newFactor: RiskFactorDefinition = {
      id,
      category: newFactorCategory,
      name: newFactorName,
      description: newFactorDescription,
      defaultWeight: 1.0,
      source: "custom",
    };
    setCustomFactors((prev) => [...prev, newFactor]);
    setActiveFactors((prev) => [
      ...prev,
      { factorId: id, enabled: true, weight: 1.0, autoEnabled: false },
    ]);
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
      method: "complex",
      scale,
      roundingMethod,
      activeFactors,
      showIndividualFactors,
      customFactors,
      useAssetImpact,
      assetImpactMapping,
      severityThresholds,
    });
  };

  // ── Render factor list ────────────────────────────────────────────────────

  const renderFactorList = (factors: RiskFactorDefinition[], title: string) => {
    if (factors.length === 0) return null;
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <List dense disablePadding>
          {factors.map((factor) => {
            const activeFactor = activeFactors.find(
              (af) => af.factorId === factor.id,
            );
            const isEnabled = activeFactor?.enabled ?? false;
            const weight = activeFactor?.weight ?? factor.defaultWeight;
            const isAutoEnabled =
              factor.id === "safety" && activeFactor?.autoEnabled === true;

            return (
              <ListItem
                key={factor.id}
                disablePadding
                sx={{
                  mb: 1,
                  border: "1px solid",
                  borderColor: isEnabled ? "primary.light" : "divider",
                  borderRadius: 1,
                  backgroundColor: isEnabled
                    ? "action.selected"
                    : "transparent",
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
                          {t(`risks.factors.${factor.id}.name`, {
                            defaultValue: factor.name,
                          })}
                        </Typography>
                        <Chip
                          label={factor.source}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.6rem", height: 18 }}
                        />
                        {/* Safety auto-enabled badge */}
                        {isAutoEnabled && (
                          <Tooltip
                            title={t(
                              "tabs.risks.config.safetyAutoEnabledTooltip",
                              {
                                defaultValue:
                                  "Automatically enabled — safety annotations detected in DFD or Asset Tab. Disable manually to exclude safety impact from risk scoring.",
                              },
                            )}
                          >
                            <Chip
                              label={t("tabs.risks.config.autoEnabled", {
                                defaultValue: "Auto",
                              })}
                              size="small"
                              color="info"
                              sx={{ fontSize: "0.6rem", height: 18 }}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    }
                    secondary={t(`risks.factors.${factor.id}.description`, {
                      defaultValue: factor.description,
                    })}
                  />
                </ListItemButton>
                {isEnabled && (
                  <Box sx={{ px: 2, minWidth: 150 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.risks.config.weight", {
                          defaultValue: "Weight",
                        })}
                        :
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

  // ── Render custom factor list ─────────────────────────────────────────────

  const renderCustomFactorList = () => {
    const relevant = customFactors.filter(
      (f) => f.category === "likelihood" || f.category === "impact",
    );
    if (relevant.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("tabs.risks.config.customFactors", {
            defaultValue: "Custom Factors",
          })}
        </Typography>
        <List dense disablePadding>
          {relevant.map((factor) => {
            const activeFactor = activeFactors.find(
              (af) => af.factorId === factor.id,
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
                  backgroundColor: isEnabled
                    ? "action.selected"
                    : "transparent",
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
                          {t(`risks.factors.${factor.id}.name`, {
                            defaultValue: factor.name,
                          })}
                        </Typography>
                        <Chip
                          label={factor.category}
                          size="small"
                          variant="outlined"
                          color={
                            factor.category === "impact" ? "error" : "info"
                          }
                          sx={{ fontSize: "0.6rem", height: 18 }}
                        />
                      </Stack>
                    }
                    secondary={t(`risks.factors.${factor.id}.description`, {
                      defaultValue: factor.description,
                    })}
                  />
                </ListItemButton>
                {isEnabled && (
                  <Box sx={{ px: 2, minWidth: 150, mr: 4 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {t("tabs.risks.config.weight", {
                          defaultValue: "Weight",
                        })}
                        :
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

  // ── Derived stats ─────────────────────────────────────────────────────────

  const enabledCount = activeFactors.filter((f) => f.enabled).length;
  const minFactors = 3;
  const maxFactors = 10;
  const isValidCount = enabledCount >= minFactors && enabledCount <= maxFactors;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: 600, maxHeight: "90vh" } }}
    >
      <DialogTitle>
        {t("tabs.risks.config.title", {
          defaultValue: "Risk Assessment Configuration",
        })}
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column" }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            label={t("tabs.risks.config.methodTab", {
              defaultValue: "Method & Display",
            })}
          />
          <Tab
            label={t("tabs.risks.config.factorsTab", {
              defaultValue: "Factors",
            })}
          />
        </Tabs>

        {/* ══ TAB 0: Method & Display ══════════════════════════════════════ */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                onChange={(e) => {
                  const s = e.target.value as RiskScaleType;
                  setScale(s);
                  setSeverityThresholds(
                    Object.fromEntries(
                      RISK_SCALES[s].levels.map((l) => [l.value, l.threshold]),
                    ),
                  );
                }}
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
              <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                {RISK_SCALES[scale].levels.map((level) => (
                  <Chip
                    key={level.value}
                    label={`${level.value}: ${t(
                      `risks.scale.${level.label.toLowerCase().replace(/ /g, "_")}`,
                      { defaultValue: level.label },
                    )}`}
                    size="small"
                    sx={{ backgroundColor: level.color, color: "white" }}
                  />
                ))}
              </Box>
            </FormControl>

            <Divider />

            {/* Severity Thresholds + Matrix — two columns */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 3,
                alignItems: "start",
              }}
            >
              {/* LEFT: Severity Thresholds */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.risks.config.severityThresholds", {
                    defaultValue: "Severity Thresholds (R = I × L)",
                  })}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={1.5}
                >
                  {t("tabs.risks.config.severityThresholdsHint", {
                    defaultValue:
                      "Scores above the highest threshold always map to the last level.",
                  })}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {RISK_SCALES[scale].levels.map((level, idx) => {
                    const isLast = idx === RISK_SCALES[scale].levels.length - 1;
                    return (
                      <Stack
                        key={level.value}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                      >
                        <Chip
                          label={t(
                            `risks.scale.${level.label.toLowerCase().replace(/ /g, "_")}`,
                            { defaultValue: level.label },
                          )}
                          size="small"
                          sx={{
                            bgcolor: level.color,
                            color: "white",
                            minWidth: 80,
                          }}
                        />
                        {isLast ? (
                          <Typography variant="caption" color="text.secondary">
                            {"R > prev (no upper bound)"}
                          </Typography>
                        ) : (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {"R ≤"}
                            </Typography>
                            <TextField
                              type="number"
                              size="small"
                              value={
                                severityThresholds[level.value] ??
                                level.threshold
                              }
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v > 0)
                                  setSeverityThresholds((prev) => ({
                                    ...prev,
                                    [level.value]: v,
                                  }));
                              }}
                              inputProps={{
                                min: 1,
                                max:
                                  scale === "3-level"
                                    ? 9
                                    : scale === "4-level"
                                      ? 16
                                      : 25,
                                step: 1,
                              }}
                              sx={{ width: 72 }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {`(def: ${level.threshold})`}
                            </Typography>
                          </>
                        )}
                      </Stack>
                    );
                  })}
                </Box>
              </Box>

              {/* RIGHT: Severity Matrix */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.risks.config.severityMatrix", {
                    defaultValue: "Severity Matrix",
                  })}
                </Typography>
                {(() => {
                  const levels = RISK_SCALES[scale].levels;
                  const cellSize = Math.min(
                    40,
                    Math.floor(200 / levels.length),
                  );
                  const getColor = (i: number, l: number): string => {
                    const severity = i * l;
                    for (const lvl of levels) {
                      if (
                        severity <=
                        (severityThresholds[lvl.value] ?? lvl.threshold)
                      )
                        return lvl.color;
                    }
                    return levels[levels.length - 1].color;
                  };
                  return (
                    <Box sx={{ display: "flex", alignItems: "flex-end" }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          mr: 0.5,
                          alignSelf: "center",
                        }}
                      >
                        Impact →
                      </Typography>
                      <Box>
                        <Box sx={{ display: "flex", ml: `${cellSize}px` }}>
                          {levels.map((l) => (
                            <Box
                              key={l.value}
                              sx={{ width: cellSize, textAlign: "center" }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {l.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        {[...levels].reverse().map((impact) => (
                          <Box
                            key={impact.value}
                            sx={{ display: "flex", alignItems: "center" }}
                          >
                            <Box sx={{ width: cellSize, textAlign: "center" }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {impact.value}
                              </Typography>
                            </Box>
                            {levels.map((likelihood) => {
                              const severity = impact.value * likelihood.value;
                              const color = getColor(
                                impact.value,
                                likelihood.value,
                              );
                              return (
                                <Tooltip
                                  key={likelihood.value}
                                  title={`I=${impact.value} × L=${likelihood.value} = ${severity}`}
                                  arrow
                                >
                                  <Box
                                    sx={{
                                      width: cellSize,
                                      height: cellSize,
                                      bgcolor: color,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      border: "1px solid rgba(255,255,255,0.3)",
                                      cursor: "default",
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: "white",
                                        fontWeight: "bold",
                                        fontSize: 10,
                                      }}
                                    >
                                      {severity}
                                    </Typography>
                                  </Box>
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ))}
                        <Box
                          sx={{ display: "flex", ml: `${cellSize}px`, mt: 0.5 }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            Likelihood →
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })()}
              </Box>
            </Box>

            <Divider />

            {/* Rounding Method */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1.5 }}>
                {t("tabs.risks.config.roundingMethod", {
                  defaultValue: "Level Threshold Calculation",
                })}
              </FormLabel>
              <RadioGroup
                value={roundingMethod}
                onChange={(e) =>
                  setRoundingMethod(e.target.value as RiskRoundingMethod)
                }
              >
                <FormControlLabel
                  value="round"
                  control={<Radio />}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography>
                        {t("tabs.risks.config.roundingRound", {
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
                              {t("tabs.risks.config.roundingRoundTitle", {
                                defaultValue: "Standard Rounding (Math.round)",
                              })}
                            </Typography>
                            <Typography variant="body2">
                              {t("tabs.risks.config.roundingRoundDesc", {
                                defaultValue:
                                  "Symmetric thresholds at .5 boundaries",
                              })}
                            </Typography>
                            <Box
                              sx={{
                                mt: 1,
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                              }}
                            >
                              <div>0.5 - 1.49 → Low</div>
                              <div>1.5 - 2.49 → Medium</div>
                              <div>2.5 - 3.49 → High</div>
                              <div>3.5 - 4.00 → Critical</div>
                            </Box>
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
                        {t("tabs.risks.config.roundingCeil", {
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
                              {t("tabs.risks.config.roundingCeilTitle", {
                                defaultValue:
                                  "Conservative Rounding (Math.ceil)",
                              })}
                            </Typography>
                            <Typography variant="body2">
                              {t("tabs.risks.config.roundingCeilDesc", {
                                defaultValue:
                                  "Always rounds up to higher risk level",
                              })}
                            </Typography>
                            <Box
                              sx={{
                                mt: 1,
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                              }}
                            >
                              <div>0.01 - 1.00 → Low</div>
                              <div>1.01 - 2.00 → Medium</div>
                              <div>2.01 - 3.00 → High</div>
                              <div>3.01 - 4.00 → Critical</div>
                            </Box>
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
                          "When disabled, only aggregated Impact/Likelihood values are shown.",
                      })}
                    </Typography>
                  </Box>
                }
              />
            </FormControl>

            <Divider />

            {/* Asset Impact Prefill */}
            <FormControl component="fieldset">
              <FormLabel sx={{ mb: 1 }}>
                {t("tabs.risks.config.assetImpact", {
                  defaultValue: "Asset Impact",
                })}
              </FormLabel>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useAssetImpact}
                    onChange={(e) => {
                      setUseAssetImpact(e.target.checked);
                      if (e.target.checked) {
                        setAssetImpactMapping(
                          DEFAULT_ASSET_IMPACT_MAPPINGS[scale],
                        );
                      }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography>
                      {t("tabs.risks.config.useAssetImpact", {
                        defaultValue: "Pre-fill Impact from Asset Tab data",
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("tabs.risks.config.useAssetImpactDesc", {
                        defaultValue:
                          "Impact factors are pre-filled from linked asset criteria " +
                          "(1:1 match by ID). The analyst can override any value — " +
                          "an 'Overridden' chip marks values that differ from the derived value.",
                      })}
                    </Typography>
                  </Box>
                }
              />

              {useAssetImpact && (
                <Box sx={{ mt: 2, ml: 4 }}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t("tabs.risks.config.assetImpactMapping", {
                      defaultValue:
                        "Aggregated Asset Impact → Risk Scale (fallback)",
                    })}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mb={1}
                  >
                    {t("tabs.risks.config.assetImpactMappingDesc", {
                      defaultValue:
                        "Used when no per-criterion data is available for a factor.",
                    })}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    {ASSET_IMPACT_LEVELS.map((level) => (
                      <Box key={level} sx={{ textAlign: "center" }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          mb={0.5}
                        >
                          {level}
                        </Typography>
                        <Select
                          size="small"
                          value={
                            assetImpactMapping[level] ??
                            DEFAULT_ASSET_IMPACT_MAPPINGS[scale][level]
                          }
                          onChange={(e) =>
                            setAssetImpactMapping((prev) => ({
                              ...prev,
                              [level]: Number(e.target.value),
                            }))
                          }
                          sx={{ fontSize: "0.75rem", width: "100%" }}
                        >
                          {RISK_SCALES[scale].levels.map((lvl) => (
                            <MenuItem key={lvl.value} value={lvl.value}>
                              <Chip
                                label={lvl.label}
                                size="small"
                                sx={{
                                  bgcolor: lvl.color,
                                  color: "white",
                                  fontSize: "0.65rem",
                                  height: 18,
                                }}
                              />
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    ))}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
                    {t("tabs.risks.config.assetImpactMappingHint", {
                      defaultValue:
                        "Default mapping resets when scale changes.",
                    })}
                  </Typography>
                </Box>
              )}
            </FormControl>
          </Box>
        </TabPanel>

        {/* ══ TAB 1: Factors ═══════════════════════════════════════════════ */}
        <TabPanel value={tabValue} index={1}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              overflow: "auto",
              flexGrow: 1,
            }}
          >
            <Alert severity={isValidCount ? "info" : "warning"}>
              {t("tabs.risks.config.factorCountInfo", {
                count: enabledCount,
                min: minFactors,
                max: maxFactors,
                defaultValue: `${enabledCount} factors selected (recommended: ${minFactors}–${maxFactors})`,
              })}
            </Alert>

            {/* Predefined Factors — side by side */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 3,
                alignItems: "start",
              }}
            >
              {renderFactorList(
                factorGroups.likelihood,
                t("tabs.risks.config.likelihoodFactors", {
                  defaultValue: "Likelihood Factors",
                }),
              )}
              {renderFactorList(
                factorGroups.impact,
                t("tabs.risks.config.impactFactors", {
                  defaultValue: "Impact Factors",
                }),
              )}
            </Box>

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
                <TextField
                  size="small"
                  label={t("tabs.risks.config.factorName", {
                    defaultValue: "Factor Name",
                  })}
                  value={newFactorName}
                  onChange={(e) => setNewFactorName(e.target.value)}
                  fullWidth
                />
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
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>
                      {t("tabs.risks.config.category", {
                        defaultValue: "Category",
                      })}
                    </InputLabel>
                    <Select
                      value={newFactorCategory}
                      label={t("tabs.risks.config.category", {
                        defaultValue: "Category",
                      })}
                      onChange={(e) =>
                        setNewFactorCategory(
                          e.target.value as RiskFactorCategory,
                        )
                      }
                    >
                      <MenuItem value="likelihood">Likelihood</MenuItem>
                      <MenuItem value="impact">Impact</MenuItem>
                    </Select>
                  </FormControl>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddCustomFactor}
                    disabled={!newFactorName.trim()}
                  >
                    {t("tabs.risks.config.addFactor", {
                      defaultValue: "Add Factor",
                    })}
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