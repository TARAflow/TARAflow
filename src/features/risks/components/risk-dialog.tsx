// ==================== RISK DIALOG ====================
// Modal dialog for editing a risk assessment
// Shows factor ratings, mitigation, and calculated values
// Supports both simple and complex methods

import React, { useState, useMemo, useCallback } from "react";
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
  Chip,
  Stack,
  Divider,
  Grid,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Paper,
  SelectChangeEvent,
} from "@mui/material";
import {
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentPaste as PasteIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  FactorRating,
  MoSCoWPriority,
  RiskStatus,
  MOSCOW_PRIORITIES,
  RISK_STATUSES,
  RISK_SCALES,
  calculateRiskValues,
  getFactorDefinition,
  getRiskColor,
  getRiskLabel,
} from "../models/risk-types";

// ==================== TYPES ====================

interface RiskDialogProps {
  open: boolean;
  risk: Risk;
  configuration: RiskConfiguration;
  /** Current threat reference - used to detect mitigation changes */
  threatReference?: ThreatReference;
  onSave: (risk: Risk) => void;
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

export const RiskDialog: React.FC<RiskDialogProps> = ({
  open,
  risk,
  configuration,
  threatReference,
  onSave,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // Local state
  const [editedRisk, setEditedRisk] = useState<Risk>(risk);
  const [tabValue, setTabValue] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMitigationSyncDialog, setShowMitigationSyncDialog] =
    useState(false);

  const scale = RISK_SCALES[configuration.scale];
  const isSimple = configuration.method === "simple";

  // Check if there's original mitigation data from threat
  const hasOriginalMitigation = Boolean(editedRisk.originalMitigation?.trim());

  // Check if threat mitigation has changed since last sync
  const threatMitigationChanged = useMemo(() => {
    if (!threatReference) return false;
    return threatReference.mitigation !== editedRisk.originalMitigation;
  }, [threatReference, editedRisk.originalMitigation]);

  // Check if threat description has changed
  const threatDescriptionChanged = useMemo(() => {
    if (!threatReference) return false;
    return threatReference.threatDescription !== editedRisk.threatDescription;
  }, [threatReference, editedRisk.threatDescription]);

  // ==================== CALCULATED VALUES ====================

  const beforeValues = useMemo(() => {
    return calculateRiskValues(editedRisk.factorRatings, configuration);
  }, [editedRisk.factorRatings, configuration]);

  const afterValues = useMemo(() => {
    return calculateRiskValues(
      editedRisk.mitigatedFactorRatings,
      configuration
    );
  }, [editedRisk.mitigatedFactorRatings, configuration]);

  // ==================== FACTOR GROUPS ====================

  const { impactFactors, likelihoodFactors, combinedFactors } = useMemo(() => {
    const allFactors = configuration.activeFactors
      .filter((af) => af.enabled)
      .map((af) => ({
        ...af,
        definition: getFactorDefinition(
          af.factorId,
          configuration.customFactors
        ),
      }))
      .filter((f) => f.definition !== undefined);

    return {
      impactFactors: allFactors.filter(
        (f) => f.definition!.category === "impact"
      ),
      likelihoodFactors: allFactors.filter(
        (f) => f.definition!.category === "likelihood"
      ),
      combinedFactors: allFactors.filter(
        (f) => f.definition!.category === "combined"
      ),
    };
  }, [configuration]);

  // ==================== HANDLERS ====================

  const handleFactorChange = useCallback(
    (factorId: string, value: number, isMitigated: boolean) => {
      setEditedRisk((prev) => {
        const ratings = isMitigated
          ? prev.mitigatedFactorRatings
          : prev.factorRatings;
        const updatedRatings = ratings.map((r) =>
          r.factorId === factorId ? { ...r, value } : r
        );
        return isMitigated
          ? { ...prev, mitigatedFactorRatings: updatedRatings }
          : { ...prev, factorRatings: updatedRatings };
      });
    },
    []
  );

  const handleCopyToMitigated = useCallback(() => {
    setEditedRisk((prev) => ({
      ...prev,
      mitigatedFactorRatings: prev.factorRatings.map((r) => ({ ...r })),
    }));
  }, []);

  const handlePriorityChange = useCallback(
    (e: SelectChangeEvent<MoSCoWPriority>) => {
      const priority = e.target.value as MoSCoWPriority;
      setEditedRisk((prev) => ({
        ...prev,
        moscowPriority: priority,
        status: priority === "wont" ? "wont-do" : prev.status,
      }));
    },
    []
  );

  const handleStatusChange = useCallback((e: SelectChangeEvent<RiskStatus>) => {
    const status = e.target.value as RiskStatus;
    setEditedRisk((prev) => ({
      ...prev,
      status,
      moscowPriority: status === "wont-do" ? "wont" : prev.moscowPriority,
    }));
  }, []);

  const handleMitigationChange = useCallback((index: number, value: string) => {
    setEditedRisk((prev) => {
      const updated = [...prev.selectedMitigations];
      updated[index] = value;
      return { ...prev, selectedMitigations: updated };
    });
  }, []);

  const handleAddMitigation = useCallback(() => {
    setEditedRisk((prev) => ({
      ...prev,
      selectedMitigations: [...prev.selectedMitigations, ""],
    }));
  }, []);

  const handleRemoveMitigation = useCallback((index: number) => {
    setEditedRisk((prev) => ({
      ...prev,
      selectedMitigations: prev.selectedMitigations.filter(
        (_, i) => i !== index
      ),
    }));
  }, []);

  // Copy original mitigation from threat
  const handleCopyOriginalMitigation = useCallback(() => {
    if (!editedRisk.originalMitigation) return;

    setEditedRisk((prev) => {
      // Check if already exists
      if (prev.selectedMitigations.includes(prev.originalMitigation)) {
        return prev;
      }
      // Add to list (replace empty or add new)
      const emptyIndex = prev.selectedMitigations.findIndex((m) => !m.trim());
      if (emptyIndex >= 0) {
        const updated = [...prev.selectedMitigations];
        updated[emptyIndex] = prev.originalMitigation;
        return { ...prev, selectedMitigations: updated };
      }
      return {
        ...prev,
        selectedMitigations: [
          ...prev.selectedMitigations,
          prev.originalMitigation,
        ],
      };
    });
  }, [editedRisk.originalMitigation]);

  // Sync mitigation from threat (when threat mitigation has changed)
  const handleSyncMitigationFromThreat = useCallback(() => {
    if (!threatReference) return;

    setEditedRisk((prev) => {
      const newMitigation = threatReference.mitigation || "";

      // Update originalMitigation
      // Replace selectedMitigations with new value (user confirmed)
      return {
        ...prev,
        originalMitigation: newMitigation,
        selectedMitigations: newMitigation ? [newMitigation] : [],
        threatDescription: threatReference.threatDescription,
      };
    });

    setShowMitigationSyncDialog(false);
  }, [threatReference]);

  const handleSave = useCallback(() => {
    const newErrors: Record<string, string> = {};

    // Validate Won't justification
    if (
      editedRisk.moscowPriority === "wont" &&
      !editedRisk.wontJustification.trim()
    ) {
      newErrors.wontJustification = t("validation.required", {
        defaultValue: "Justification required for Won't",
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      ...editedRisk,
      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
      lastModified: new Date().toISOString(),
    });
  }, [editedRisk, beforeValues, afterValues, onSave, t]);

  // ==================== RENDER FACTOR ROW ====================

  const renderFactorRow = useCallback(
    (
      factor: {
        factorId: string;
        weight: number;
        definition?: ReturnType<typeof getFactorDefinition>;
      },
      isMitigated: boolean
    ) => {
      const ratings = isMitigated
        ? editedRisk.mitigatedFactorRatings
        : editedRisk.factorRatings;
      const rating = ratings.find((r) => r.factorId === factor.factorId);
      const value = rating?.value ?? 0;
      const def = factor.definition;

      if (!def) return null;

      return (
        <Grid item xs={12} sm={6} md={4} key={factor.factorId}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ flexGrow: 1 }}
              >
                {isGerman ? def.nameDE : def.name}
              </Typography>
              <Tooltip title={isGerman ? def.descriptionDE : def.description}>
                <InfoIcon fontSize="small" color="action" />
              </Tooltip>
            </Stack>
            <Select
              value={value}
              onChange={(e) =>
                handleFactorChange(
                  factor.factorId,
                  e.target.value as number,
                  isMitigated
                )
              }
              size="small"
              fullWidth
            >
              <MenuItem value={0}>
                <em>
                  {t("tabs.risks.dialog.notRated", {
                    defaultValue: "Not rated",
                  })}
                </em>
              </MenuItem>
              {scale.levels.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: level.color,
                      }}
                    />
                    <span>
                      {level.value} - {isGerman ? level.labelDE : level.label}
                    </span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </Paper>
        </Grid>
      );
    },
    [
      editedRisk.factorRatings,
      editedRisk.mitigatedFactorRatings,
      scale,
      handleFactorChange,
      isGerman,
      t,
    ]
  );

  // ==================== RENDER ====================

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">
            {t("tabs.risks.dialog.title", {
              id: editedRisk.threatId,
              defaultValue: `Risk Assessment: ${editedRisk.threatId}`,
            })}
          </Typography>
          <Chip
            label={editedRisk.strideCategory}
            size="small"
            sx={{
              backgroundColor:
                editedRisk.strideCategory === "S"
                  ? "#ef4444"
                  : editedRisk.strideCategory === "T"
                  ? "#f97316"
                  : editedRisk.strideCategory === "R"
                  ? "#eab308"
                  : editedRisk.strideCategory === "I"
                  ? "#22c55e"
                  : editedRisk.strideCategory === "D"
                  ? "#3b82f6"
                  : "#a855f7",
              color: "white",
            }}
          />
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Threat Description */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t("tabs.risks.dialog.threatDescription", {
                defaultValue: "Threat Description",
              })}
            </Typography>
            <Typography variant="body1">
              {editedRisk.threatDescription}
            </Typography>

            {/* Original Mitigation from Threat */}
            {hasOriginalMitigation && (
              <Box
                sx={{
                  mt: 2,
                  pt: 2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexGrow: 1 }}
                  >
                    {t("tabs.risks.dialog.originalMitigation", {
                      defaultValue: "Original Mitigation (from Threat)",
                    })}
                  </Typography>
                  <Tooltip
                    title={t("tabs.risks.dialog.copyToMitigations", {
                      defaultValue: "Copy to Selected Mitigations",
                    })}
                  >
                    <IconButton
                      size="small"
                      onClick={handleCopyOriginalMitigation}
                      color="primary"
                    >
                      <PasteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    backgroundColor: "grey.50",
                    p: 1,
                    borderRadius: 1,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {editedRisk.originalMitigation}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Out-of-Sync Alert */}
          {(threatDescriptionChanged || threatMitigationChanged) && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="warning"
                  size="small"
                  startIcon={<SyncIcon />}
                  onClick={() => setShowMitigationSyncDialog(true)}
                >
                  {t("tabs.risks.dialog.syncFromThreat", {
                    defaultValue: "Sync from Threat",
                  })}
                </Button>
              }
            >
              {threatDescriptionChanged && threatMitigationChanged
                ? t("tabs.risks.dialog.threatAndMitigationChanged", {
                    defaultValue:
                      "Threat description and mitigation have changed in the Threats tab.",
                  })
                : threatDescriptionChanged
                ? t("tabs.risks.dialog.threatDescriptionChanged", {
                    defaultValue:
                      "Threat description has changed in the Threats tab.",
                  })
                : t("tabs.risks.dialog.mitigationChanged", {
                    defaultValue: "Mitigation has changed in the Threats tab.",
                  })}
            </Alert>
          )}

          {/* Tabs for Before/After Mitigation */}
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
              <Tab
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>
                      {t("tabs.risks.dialog.beforeMitigation", {
                        defaultValue: "Before Mitigation",
                      })}
                    </span>
                    <Chip
                      label={
                        beforeValues.risk > 0
                          ? beforeValues.risk.toFixed(1)
                          : "-"
                      }
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          beforeValues.risk,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
                        color: "white",
                      }}
                    />
                  </Stack>
                }
              />
              <Tab
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>
                      {t("tabs.risks.dialog.afterMitigation", {
                        defaultValue: "After Mitigation",
                      })}
                    </span>
                    <Chip
                      label={
                        afterValues.risk > 0 ? afterValues.risk.toFixed(1) : "-"
                      }
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          afterValues.risk,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
                        color: "white",
                      }}
                    />
                  </Stack>
                }
              />
            </Tabs>
          </Box>

          {/* Before Mitigation Tab */}
          <TabPanel value={tabValue} index={0}>
            {isSimple ? (
              // DREAD / Combined Factors
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.risks.dialog.riskFactors", {
                    defaultValue: "Risk Factors (DREAD)",
                  })}
                </Typography>
                <Grid container spacing={2}>
                  {combinedFactors.map((f) => renderFactorRow(f, false))}
                </Grid>
              </Box>
            ) : (
              // OWASP / Separate Impact & Likelihood
              <Stack spacing={3}>
                {/* Likelihood Factors */}
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="subtitle2">
                      {t("tabs.risks.dialog.likelihoodFactors", {
                        defaultValue: "Likelihood Factors",
                      })}
                    </Typography>
                    <Chip
                      label={`${t("tabs.risks.dialog.likelihood", {
                        defaultValue: "Likelihood",
                      })}: ${
                        beforeValues.likelihood > 0
                          ? beforeValues.likelihood.toFixed(1)
                          : "-"
                      }`}
                      size="small"
                      color="info"
                    />
                  </Stack>
                  <Grid container spacing={2}>
                    {likelihoodFactors.map((f) => renderFactorRow(f, false))}
                  </Grid>
                </Box>
                {/* Impact Factors */}
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="subtitle2">
                      {t("tabs.risks.dialog.impactFactors", {
                        defaultValue: "Impact Factors",
                      })}
                    </Typography>
                    <Chip
                      label={`${t("tabs.risks.dialog.impact", {
                        defaultValue: "Impact",
                      })}: ${
                        beforeValues.impact > 0
                          ? beforeValues.impact.toFixed(1)
                          : "-"
                      }`}
                      size="small"
                      color="error"
                    />
                  </Stack>
                  <Grid container spacing={2}>
                    {impactFactors.map((f) => renderFactorRow(f, false))}
                  </Grid>
                </Box>
              </Stack>
            )}

            {/* Overall Risk Display */}
            <Paper
              sx={{
                p: 2,
                mt: 3,
                backgroundColor: getRiskColor(
                  beforeValues.risk,
                  configuration.scale,
                  configuration.roundingMethod
                ),
                color: "white",
              }}
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">
                  {t("tabs.risks.dialog.overallRisk", {
                    defaultValue: "Overall Risk",
                  })}
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {beforeValues.risk > 0 ? beforeValues.risk.toFixed(1) : "-"}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {getRiskLabel(
                  beforeValues.risk,
                  configuration.scale,
                  isGerman,
                  configuration.roundingMethod
                )}
              </Typography>
            </Paper>
          </TabPanel>

          {/* After Mitigation Tab */}
          <TabPanel value={tabValue} index={1}>
            {/* Copy Button */}
            <Box sx={{ mb: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CopyIcon />}
                onClick={handleCopyToMitigated}
              >
                {t("tabs.risks.dialog.copyFromBefore", {
                  defaultValue: "Copy Ratings from Before",
                })}
              </Button>
              {hasOriginalMitigation && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PasteIcon />}
                  onClick={handleCopyOriginalMitigation}
                  color="secondary"
                >
                  {t("tabs.risks.dialog.addOriginalMitigation", {
                    defaultValue: "Add Original Mitigation",
                  })}
                </Button>
              )}
            </Box>

            {/* Mitigations */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("tabs.risks.dialog.selectedMitigations", {
                  defaultValue: "Selected Mitigations",
                })}
              </Typography>
              <Stack spacing={1}>
                {editedRisk.selectedMitigations.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {t("tabs.risks.dialog.noMitigations", {
                      defaultValue:
                        "No mitigations selected. Add mitigations to reduce the risk.",
                    })}
                  </Alert>
                ) : (
                  editedRisk.selectedMitigations.map((mitigation, index) => (
                    <Stack
                      key={index}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={mitigation}
                        onChange={(e) =>
                          handleMitigationChange(index, e.target.value)
                        }
                        placeholder={t(
                          "tabs.risks.dialog.mitigationPlaceholder",
                          {
                            defaultValue: "Describe the mitigation...",
                          }
                        )}
                        multiline
                        maxRows={3}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveMitigation(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  ))
                )}
                <Button
                  variant="text"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddMitigation}
                >
                  {t("tabs.risks.dialog.addMitigation", {
                    defaultValue: "Add Mitigation",
                  })}
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Re-rate factors */}
            {isSimple ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.risks.dialog.riskFactorsAfter", {
                    defaultValue: "Re-rate Factors After Mitigation",
                  })}
                </Typography>
                <Grid container spacing={2}>
                  {combinedFactors.map((f) => renderFactorRow(f, true))}
                </Grid>
              </Box>
            ) : (
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.likelihoodFactorsAfter", {
                      defaultValue: "Likelihood Factors (After)",
                    })}
                  </Typography>
                  <Grid container spacing={2}>
                    {likelihoodFactors.map((f) => renderFactorRow(f, true))}
                  </Grid>
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.impactFactorsAfter", {
                      defaultValue: "Impact Factors (After)",
                    })}
                  </Typography>
                  <Grid container spacing={2}>
                    {impactFactors.map((f) => renderFactorRow(f, true))}
                  </Grid>
                </Box>
              </Stack>
            )}

            {/* Residual Risk Display */}
            <Paper
              sx={{
                p: 2,
                mt: 3,
                backgroundColor: getRiskColor(
                  afterValues.risk,
                  configuration.scale,
                  configuration.roundingMethod
                ),
                color: "white",
              }}
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">
                  {t("tabs.risks.dialog.residualRisk", {
                    defaultValue: "Residual Risk",
                  })}
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {afterValues.risk > 0 ? afterValues.risk.toFixed(1) : "-"}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {getRiskLabel(
                  afterValues.risk,
                  configuration.scale,
                  isGerman,
                  configuration.roundingMethod
                )}
              </Typography>
            </Paper>
          </TabPanel>

          <Divider />

          {/* Priority & Status */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>
                {t("tabs.risks.dialog.priority", {
                  defaultValue: "MoSCoW Priority",
                })}
              </InputLabel>
              <Select
                value={editedRisk.moscowPriority}
                onChange={handlePriorityChange}
                label={t("tabs.risks.dialog.priority", {
                  defaultValue: "MoSCoW Priority",
                })}
              >
                {MOSCOW_PRIORITIES.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={p.value.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: p.color,
                          color: "white",
                          fontWeight: "bold",
                        }}
                      />
                      <span>{isGerman ? p.labelDE : p.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>
                {t("tabs.risks.dialog.status", { defaultValue: "Status" })}
              </InputLabel>
              <Select
                value={editedRisk.status}
                onChange={handleStatusChange}
                label={t("tabs.risks.dialog.status", {
                  defaultValue: "Status",
                })}
              >
                {RISK_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    <Chip
                      label={isGerman ? s.labelDE : s.label}
                      size="small"
                      sx={{
                        backgroundColor: s.color,
                        color: "white",
                      }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Won't Justification */}
          {editedRisk.moscowPriority === "wont" && (
            <TextField
              fullWidth
              multiline
              rows={2}
              label={t("tabs.risks.dialog.wontJustification", {
                defaultValue: "Justification for Won't",
              })}
              value={editedRisk.wontJustification}
              onChange={(e) =>
                setEditedRisk((prev) => ({
                  ...prev,
                  wontJustification: e.target.value,
                }))
              }
              error={Boolean(errors.wontJustification)}
              helperText={errors.wontJustification}
              required
            />
          )}
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

      {/* Sync Confirmation Dialog */}
      <Dialog
        open={showMitigationSyncDialog}
        onClose={() => setShowMitigationSyncDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SyncIcon color="warning" />
            <Typography variant="h6">
              {t("tabs.risks.dialog.syncConfirmTitle", {
                defaultValue: "Sync from Threat?",
              })}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {threatDescriptionChanged && (
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  {t("tabs.risks.dialog.currentDescription", {
                    defaultValue: "Current Description:",
                  })}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, mb: 2, backgroundColor: "grey.50" }}
                >
                  <Typography variant="body2">
                    {editedRisk.threatDescription || "(empty)"}
                  </Typography>
                </Paper>

                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {t("tabs.risks.dialog.newDescription", {
                    defaultValue: "New Description (from Threat):",
                  })}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderColor: "primary.main",
                    backgroundColor: "primary.50",
                  }}
                >
                  <Typography variant="body2">
                    {threatReference?.threatDescription || "(empty)"}
                  </Typography>
                </Paper>
              </Box>
            )}

            {threatMitigationChanged && (
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  {t("tabs.risks.dialog.currentMitigation", {
                    defaultValue: "Current Mitigation:",
                  })}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, mb: 2, backgroundColor: "grey.50" }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {editedRisk.originalMitigation || "(empty)"}
                  </Typography>
                </Paper>

                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {t("tabs.risks.dialog.newMitigation", {
                    defaultValue: "New Mitigation (from Threat):",
                  })}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderColor: "primary.main",
                    backgroundColor: "primary.50",
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {threatReference?.mitigation || "(empty)"}
                  </Typography>
                </Paper>
              </Box>
            )}

            <Alert severity="info">
              {t("tabs.risks.dialog.syncWarning", {
                defaultValue:
                  "This will replace your current selected mitigations with the new value from the Threat.",
              })}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMitigationSyncDialog(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={handleSyncMitigationFromThreat}
            variant="contained"
            color="warning"
            startIcon={<SyncIcon />}
          >
            {t("tabs.risks.dialog.syncConfirm", {
              defaultValue: "Sync",
            })}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default RiskDialog;