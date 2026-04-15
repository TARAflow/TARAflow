// ==================== RISK DIALOG ====================
// 3-tab evaluation dialog with sidebar navigation.
// Same visual language as ThreatEvalDialog.
//
// Tab 1 — Risk Before:   Factor ratings, calculated score
// Tab 2 — Mitigations:   Checkbox selection, treatment, priority, status
// Tab 3 — Risk After:    Re-rate factors post-mitigation
//
// Sidebar: All risks in the current accordion group, sorted by risk score desc.
// Prev/Next navigation, auto-save on switch, uncertain warning.

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  SelectChangeEvent,
} from "@mui/material";
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  FactorRating,
  MoSCoWPriority,
  RiskStatus,
  RiskTreatment,
  MOSCOW_PRIORITIES,
  RISK_STATUSES,
  RISK_TREATMENTS,
  RISK_SCALES,
  getFactorDefinition,
} from "../models/risk-types";
import {
  calculateRiskValues,
  getRiskColor,
  getRiskLabel,
} from "../services/risk-calculation-service";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "../../threats/services/threat-catalog-service";
import type { StrideCategory } from "shared";
import type {
  AssetDataReference,
  AssetReference,
} from "../../threats/models/threat-types";
import {
  getWorstAssetImpactValue,
  applyAssetImpactToFactorRatings,
} from "../services/risk-calculation-service";

import { RiskScorePanel } from "./shared/risk-score-panel";

// ==================== CONSTANTS ====================

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

// ==================== PROPS ====================

export interface RiskDialogProps {
  open: boolean;
  /** All risks in the current accordion group */
  risks: Risk[];
  /** Index of the risk to open initially */
  initialIndex: number;
  configuration: RiskConfiguration;
  /** Threat references for display (optional — for uncertain warning) */
  threats?: ThreatReference[];
  /** Asset data for impact display and pre-fill */
  assetDataRef?: AssetDataReference;
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
}

// ==================== LOCAL STATE ====================

interface LocalRiskState {
  factorRatings: FactorRating[];
  mitigatedFactorRatings: FactorRating[];
  selectedMitigations: string[];
  selectedVerifications: string[];
  treatment: RiskTreatment;
  treatmentJustification: string;
  moscowPriority: MoSCoWPriority;
  wontJustification: string;
  status: RiskStatus;
}

function riskToLocal(risk: Risk): LocalRiskState {
  return {
    factorRatings: risk.factorRatings.map((r) => ({ ...r })),
    mitigatedFactorRatings: risk.mitigatedFactorRatings.map((r) => ({ ...r })),
    selectedMitigations: [...risk.selectedMitigations],
    selectedVerifications: [...(risk.selectedVerifications ?? [])],
    treatment: risk.treatment ?? "reduce",
    treatmentJustification: risk.treatmentJustification ?? "",
    moscowPriority: risk.moscowPriority,
    wontJustification: risk.wontJustification ?? "",
    status: risk.status,
  };
}

// ==================== COMPONENT ====================

export const RiskDialog: React.FC<RiskDialogProps> = ({
  open,
  risks,
  initialIndex,
  configuration,
  threats,
  assetDataRef,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  // ── Sidebar sort: highest risk score first ───────────────────────────────
  const sortedRisks = useMemo(
    () =>
      [...risks].sort(
        (a, b) =>
          b.calculatedRiskBeforeMitigation - a.calculatedRiskBeforeMitigation,
      ),
    [risks],
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(() => {
    const id = risks[initialIndex]?.id;
    const idx = sortedRisks.findIndex((r) => r.id === id);
    return idx >= 0 ? idx : initialIndex;
  });
  const currentRisk = sortedRisks[currentIndex] ?? null;

  const [tabValue, setTabValue] = useState(0);
  const [local, setLocal] = useState<LocalRiskState | null>(null);
  const isProcessing = useRef(false);

  // ── Init local state when risk changes (with optional asset-impact pre-fill) ─
  useEffect(() => {
    if (!currentRisk) return;
    let state = riskToLocal(currentRisk);
    // Pre-fill impact factors from asset severity if enabled and not yet rated
    if (configuration.useAssetImpact && currentRisk.linkedAssetIds?.length) {
      const assets = assetDataRef?.assets ?? [];
      const levels = currentRisk.linkedAssetIds
        .map((id) => assets.find((a) => a.id === id)?.aggregatedImpact)
        .filter(Boolean) as string[];
      if (levels.length > 0) {
        state = {
          ...state,
          factorRatings: applyAssetImpactToFactorRatings(
            state.factorRatings,
            levels as any,
            configuration,
          ),
        };
      }
    }
    setLocal(state);
  }, [currentRisk?.id]);

  useEffect(() => {
    if (open) {
      const id = risks[initialIndex]?.id;
      const idx = sortedRisks.findIndex((r) => r.id === id);
      setCurrentIndex(idx >= 0 ? idx : initialIndex);
      setTabValue(0);
    }
  }, [open, initialIndex]);

  // ── Computed values ───────────────────────────────────────────────────────
  const scale = RISK_SCALES[configuration.scale];

  const beforeValues = useMemo(
    () =>
      local
        ? calculateRiskValues(local.factorRatings, configuration)
        : { impact: 0, likelihood: 0, risk: 0 },
    [local?.factorRatings, configuration],
  );
  const afterValues = useMemo(
    () =>
      local
        ? calculateRiskValues(local.mitigatedFactorRatings, configuration)
        : { impact: 0, likelihood: 0, risk: 0 },
    [local?.mitigatedFactorRatings, configuration],
  );

  const assessedCount = useMemo(
    () =>
      sortedRisks.filter((r) => r.calculatedRiskBeforeMitigation > 0).length,
    [sortedRisks],
  );

  // Trust boundary name from first threat reference
  const trustBoundaryName = useMemo(() => {
    if (!threats?.length) return "";
    const threat = threats.find((t) => t.id === currentRisk?.threatId);
    return threat?.trustBoundaryName ?? "";
  }, [threats, currentRisk?.id]);

  // ── Active factors ────────────────────────────────────────────────────────
  const { impactFactors, likelihoodFactors } = useMemo(() => {
    const all = configuration.activeFactors
      .filter((af) => af.enabled)
      .map((af) => ({
        ...af,
        definition: getFactorDefinition(
          af.factorId,
          configuration.customFactors,
        ),
      }))
      .filter((f) => f.definition !== undefined);
    return {
      impactFactors: all.filter((f) => f.definition!.category === "impact"),
      likelihoodFactors: all.filter(
        (f) => f.definition!.category === "likelihood",
      ),
    };
  }, [configuration]);

  // ── Resolved mitigations/verifications for checkboxes ────────────────────
  const resolvedMitigations = useMemo(
    () =>
      currentRisk
        ? resolveMitigationDrafts(currentRisk.proposedMitigations ?? [])
        : [],
    [currentRisk],
  );
  const resolvedVerifications = useMemo(
    () =>
      currentRisk
        ? resolveVerificationDrafts(currentRisk.proposedVerifications ?? [])
        : [],
    [currentRisk],
  );

  // ── Linked assets — fallback to threatRef if Risk has no linkedAssetIds ────
  const currentThreatRef = useMemo(
    () => threats?.find((t) => t.id === currentRisk?.threatId),
    [threats, currentRisk?.threatId],
  );

  const effectiveLinkedAssetIds = useMemo(
    () =>
      currentRisk?.linkedAssetIds?.length
        ? currentRisk.linkedAssetIds
        : (currentThreatRef?.linkedAssetIds ?? []),
    [currentRisk?.linkedAssetIds, currentThreatRef?.linkedAssetIds],
  );

  const effectiveCauseDescription =
    currentRisk?.causeDescription || currentThreatRef?.causeDescription;

  const linkedAssets = useMemo(() => {
    if (!assetDataRef || !effectiveLinkedAssetIds.length) return [];
    return effectiveLinkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
  }, [assetDataRef, effectiveLinkedAssetIds]);

  const assetImpactLevels = useMemo(
    () =>
      linkedAssets.map((a) => a.aggregatedImpact).filter(Boolean) as string[],
    [linkedAssets],
  );

  // ── Save current risk ─────────────────────────────────────────────────────
  const saveCurrentRisk = useCallback(() => {
    if (!currentRisk || !local) return;
    onSave(currentRisk.id, {
      factorRatings: local.factorRatings,
      mitigatedFactorRatings: local.mitigatedFactorRatings,
      selectedMitigations: local.selectedMitigations,
      selectedVerifications: local.selectedVerifications,
      treatment: local.treatment,
      treatmentJustification: local.treatmentJustification,
      moscowPriority: local.moscowPriority,
      wontJustification: local.wontJustification,
      status: local.status,
      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
    });
  }, [currentRisk, local, beforeValues, afterValues, onSave]);

  // ── Navigate ──────────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (index: number) => {
      saveCurrentRisk();
      setCurrentIndex(index);
      setTabValue(0);
    },
    [saveCurrentRisk],
  );

  const handlePrev = useCallback(() => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    navigateTo(Math.max(0, currentIndex - 1));
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  }, [currentIndex, navigateTo]);

  const handleNext = useCallback(() => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    navigateTo(Math.min(sortedRisks.length - 1, currentIndex + 1));
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  }, [currentIndex, sortedRisks.length, navigateTo]);

  const handleSave = useCallback(() => {
    saveCurrentRisk();
    onClose();
  }, [saveCurrentRisk, onClose]);

  // ── Local state updaters ──────────────────────────────────────────────────
  const updateFactor = useCallback(
    (factorId: string, value: number, mitigated: boolean) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const key = mitigated ? "mitigatedFactorRatings" : "factorRatings";
        return {
          ...prev,
          [key]: prev[key].map((r) =>
            r.factorId === factorId ? { ...r, value } : r,
          ),
        };
      });
    },
    [],
  );

  const toggleMitigation = useCallback((id: string) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const has = prev.selectedMitigations.includes(id);
      return {
        ...prev,
        selectedMitigations: has
          ? prev.selectedMitigations.filter((m) => m !== id)
          : [...prev.selectedMitigations, id],
      };
    });
  }, []);

  const toggleVerification = useCallback((id: string) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const has = prev.selectedVerifications.includes(id);
      return {
        ...prev,
        selectedVerifications: has
          ? prev.selectedVerifications.filter((v) => v !== id)
          : [...prev.selectedVerifications, id],
      };
    });
  }, []);

  const handleCopyToMitigated = useCallback(() => {
    setLocal((prev) =>
      prev
        ? {
            ...prev,
            mitigatedFactorRatings: prev.factorRatings.map((r) => ({ ...r })),
          }
        : prev,
    );
  }, []);

  // ── Linked assets (must be before early return — Rules of Hooks) ───────────
  // These are safe because we guard with ?. inside

  if (!currentRisk || !local) return null;

  const isUncertain = currentRisk.threatRelevance === "uncertain";
  const treatment = RISK_TREATMENTS.find((tr) => tr.value === local.treatment);
  const passiveTreatment = ["accept", "transfer", "share"].includes(
    local.treatment,
  );

  // ── Factor row renderer ───────────────────────────────────────────────────
  const renderFactorRow = (
    factor: {
      factorId: string;
      weight: number;
      definition?: ReturnType<typeof getFactorDefinition>;
    },
    mitigated: boolean,
  ) => {
    const def = factor.definition;
    if (!def) return null;
    const ratings = mitigated
      ? local.mitigatedFactorRatings
      : local.factorRatings;
    const value =
      ratings.find((r) => r.factorId === factor.factorId)?.value ?? 0;

    return (
      <Paper key={factor.factorId} variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
            {t(`risks.factors.${def.id}.name`, { defaultValue: def.name })}
          </Typography>
          <Tooltip
            title={t(`risks.factors.${def.id}.description`, {
              defaultValue: def.description,
            })}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: "help" }}
            >
              ⓘ
            </Typography>
          </Tooltip>
        </Stack>
        <Select
          value={value}
          onChange={(e) =>
            updateFactor(factor.factorId, e.target.value as number, mitigated)
          }
          size="small"
          fullWidth
        >
          <MenuItem value={0}>
            <em>
              {t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" })}
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
                    bgcolor: level.color,
                  }}
                />
                <span>
                  {level.value} –{" "}
                  {t(
                    `risks.scale.${level.label.toLowerCase().replace(/ /g, "_")}`,
                    { defaultValue: level.label },
                  )}
                </span>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </Paper>
    );
  };

  // ── Risk score chip ───────────────────────────────────────────────────────
  const RiskScoreChip = ({
    value,
    label,
  }: {
    value: number;
    label: string;
  }) => (
    <Box sx={{ textAlign: "center" }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Chip
        label={value > 0 ? value.toFixed(1) : "–"}
        size="small"
        sx={{
          bgcolor: getRiskColor(
            value,
            configuration.scale,
            configuration.roundingMethod,
          ),
          color: "white",
          fontWeight: "bold",
          minWidth: 48,
          mt: 0.25,
        }}
      />
    </Box>
  );

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: "85vh",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{ py: 1.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            label={currentRisk.strideCategory}
            size="small"
            sx={{
              bgcolor: STRIDE_COLORS[currentRisk.strideCategory],
              color: "white",
              fontWeight: "bold",
            }}
          />
          <Typography
            variant="body2"
            fontFamily="monospace"
            color="text.secondary"
          >
            {currentRisk.id}
          </Typography>
          <Typography
            variant="subtitle1"
            fontWeight="medium"
            sx={{ flexGrow: 1 }}
            noWrap
          >
            {currentRisk.threatDescription}
          </Typography>
          {isUncertain && (
            <Chip
              icon={<WarningIcon />}
              label={t("tabs.risks.uncertain", { defaultValue: "Uncertain" })}
              size="small"
              color="warning"
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
          flexGrow: 1,
        }}
      >
        {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.default",
          }}
        >
          {/* Sidebar header */}
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              fontWeight="medium"
            >
              {trustBoundaryName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {assessedCount}/{sortedRisks.length}{" "}
              {t("tabs.risks.assessed", { defaultValue: "assessed" })}
            </Typography>
          </Box>

          {/* Sidebar list */}
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <List dense disablePadding>
              {sortedRisks.map((risk, index) => {
                const isActive = index === currentIndex;
                const riskColor = getRiskColor(
                  risk.calculatedRiskBeforeMitigation,
                  configuration.scale,
                  configuration.roundingMethod,
                );
                const riskLabel =
                  risk.calculatedRiskBeforeMitigation > 0
                    ? risk.calculatedRiskBeforeMitigation.toFixed(1)
                    : "–";
                const uncertain = risk.threatRelevance === "uncertain";
                return (
                  <ListItemButton
                    key={risk.id}
                    selected={isActive}
                    ref={(node) => {
                      if (node && isActive) {
                        requestAnimationFrame(() =>
                          node.scrollIntoView({
                            block: "nearest",
                            behavior: "auto",
                          }),
                        );
                      }
                    }}
                    onClick={() => navigateTo(index)}
                    sx={{
                      py: 0.75,
                      px: 1.5,
                      borderLeft: "3px solid transparent",
                      "&.Mui-selected": {
                        bgcolor: "primary.50",
                        borderLeftColor: "primary.main",
                      },
                      "&.Mui-selected:hover": { bgcolor: "primary.100" },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.25,
                        mr: 0.75,
                        flexShrink: 0,
                      }}
                    >
                      <Chip
                        label={riskLabel}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: 10,
                          bgcolor: riskColor,
                          color: "white",
                          fontWeight: "bold",
                          minWidth: 32,
                        }}
                      />
                      {uncertain && (
                        <Chip
                          label="?"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 10,
                            bgcolor: "#fffbeb",
                            color: "#d97706",
                            border: "1px solid #d97706",
                          }}
                        />
                      )}
                    </Box>
                    <ListItemText
                      primary={
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Chip
                            label={risk.strideCategory}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 10,
                              bgcolor: STRIDE_COLORS[risk.strideCategory],
                              color: "white",
                            }}
                          />
                          <Typography variant="caption" noWrap>
                            {risk.id}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ display: "block" }}
                        >
                          {risk.threatDescription || "—"}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Box>

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Uncertain warning */}
          {isUncertain && (
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{ mx: 2, mt: 1.5, flexShrink: 0 }}
            >
              {t("tabs.risks.uncertainRiskWarning", {
                defaultValue:
                  "This risk is based on an uncertain threat. Please confirm its relevance in the Threat Eval tab before finalizing the risk assessment.",
              })}
            </Alert>
          )}

          {/* Tabs */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
              px: 2,
            }}
          >
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
              <Tab
                label={t("tabs.risks.dialog.tabBefore", {
                  defaultValue: "Risk Before",
                })}
              />
              <Tab
                label={t("tabs.risks.dialog.tabMitigations", {
                  defaultValue: "Mitigations",
                })}
              />
              <Tab
                label={t("tabs.risks.dialog.tabAfter", {
                  defaultValue: "Risk After",
                })}
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1.5 }}>
            {/* ══ TAB 1: RISK BEFORE ══════════════════════════════════════ */}
            {tabValue === 0 && (
              <Stack spacing={2.5}>
                {/* Threat description read-only */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.threatDescription", {
                      defaultValue: "Threat",
                    })}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                    <Typography variant="body2">
                      {currentRisk.threatDescription}
                    </Typography>
                    {currentRisk.attackDescription && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          {currentRisk.attackDescription}
                        </Typography>
                      </>
                    )}
                  </Paper>
                </Box>

                {/* Cause — amber, read-only */}
                {effectiveCauseDescription && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "#fef3c7",
                      borderRadius: 1,
                      border: "1px solid #fcd34d",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight="medium"
                      display="block"
                      mb={0.5}
                    >
                      {t("tabs.risks.dialog.cause", {
                        defaultValue: "Root Cause",
                      })}
                    </Typography>
                    <Typography variant="body2">
                      {effectiveCauseDescription}
                    </Typography>
                  </Box>
                )}

                <Divider />

                {/* Linked Assets */}
                {
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Assets
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {linkedAssets.map((asset) => {
                        const aImpact = asset.aggregatedImpact;
                        const hasSafety =
                          asset.physicalImpact === "fatality" ||
                          asset.physicalImpact === "irreversible_injury";
                        return (
                          <Chip
                            key={asset.id}
                            label={`${asset.name}${hasSafety ? " ⚠" : ""}${aImpact ? ` · ${aImpact}` : ""}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 11, height: 22 }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                }

                <Divider />

                {/* Calculated score */}
                <Typography variant="subtitle2" gutterBottom>
                  {t("tabs.risks.dialog.tabBefore", {
                    defaultValue: "Risk Before",
                  })}
                </Typography>
                <Stack
                  direction="row"
                  spacing={3}
                  sx={{ width: "100%" }}
                  justifyContent="stretch"
                >
                  <RiskScorePanel
                    impact={beforeValues.impact}
                    likelihood={beforeValues.likelihood}
                    risk={beforeValues.risk}
                    configuration={configuration}
                  />
                </Stack>

                {/* Factor ratings */}
                <Box
                  sx={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.likelihoodFactors", {
                        defaultValue: "Likelihood Factors",
                      })}
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 1,
                      }}
                    >
                      {likelihoodFactors.map((f) => renderFactorRow(f, false))}
                    </Box>
                  </Box>

                  {impactFactors.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {t("tabs.risks.dialog.impactFactors", {
                          defaultValue: "Impact Factors",
                        })}
                      </Typography>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: 1,
                        }}
                      >
                        {impactFactors.map((f) => renderFactorRow(f, false))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Stack>
            )}

            {/* ══ TAB 2: MITIGATIONS ══════════════════════════════════════ */}
            {tabValue === 1 && (
              <Stack spacing={2.5}>
                {/* Proposed Mitigations checkboxes */}
                {resolvedMitigations.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.selectedMitigations", {
                        defaultValue: "Proposed Mitigations",
                      })}
                    </Typography>
                    <Stack spacing={0.5}>
                      {resolvedMitigations.map((m) => {
                        const id = m.id ?? m.notes ?? "";
                        const label = m.isCustom
                          ? `[custom] ${m.notes ?? ""}`
                          : `${m.id}: ${m.text}`;
                        return (
                          <Paper
                            key={id}
                            variant="outlined"
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              bgcolor: "background.paper",
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={local.selectedMitigations.includes(
                                    id,
                                  )}
                                  onChange={() => toggleMitigation(id)}
                                />
                              }
                              label={
                                <Typography variant="body2">{label}</Typography>
                              }
                              sx={{ m: 0, width: "100%" }}
                            />
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {/* Proposed Verifications checkboxes */}
                {resolvedVerifications.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.verifications", {
                        defaultValue: "Proposed Verifications",
                      })}
                    </Typography>
                    <Stack spacing={0.5}>
                      {resolvedVerifications.map((v) => {
                        const id = v.id ?? v.notes ?? "";
                        const label = v.isCustom
                          ? `[custom] ${v.notes ?? ""}`
                          : `${v.id}: ${v.text}`;
                        return (
                          <Paper
                            key={id}
                            variant="outlined"
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              bgcolor: "background.paper",
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={local.selectedVerifications.includes(
                                    id,
                                  )}
                                  onChange={() => toggleVerification(id)}
                                />
                              }
                              label={
                                <Typography variant="body2">{label}</Typography>
                              }
                              sx={{ m: 0, width: "100%" }}
                            />
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                <Divider />

                {/* Treatment */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.treatment", {
                      defaultValue: "Risk Treatment",
                    })}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {RISK_TREATMENTS.map((tr) => (
                      <Chip
                        key={tr.value}
                        label={t(`risks.treatment.${tr.value}.label`, {
                          defaultValue: tr.label,
                        })}
                        onClick={() =>
                          setLocal((prev) =>
                            prev ? { ...prev, treatment: tr.value } : prev,
                          )
                        }
                        sx={{
                          bgcolor:
                            local.treatment === tr.value
                              ? tr.color
                              : "transparent",
                          color:
                            local.treatment === tr.value ? "white" : tr.color,
                          border: `2px solid ${tr.color}`,
                          fontWeight:
                            local.treatment === tr.value ? "bold" : "normal",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </Stack>
                  {passiveTreatment && (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      sx={{ mt: 1.5 }}
                      label={t("tabs.risks.dialog.treatmentJustification", {
                        defaultValue: "Treatment Justification (required)",
                      })}
                      value={local.treatmentJustification}
                      onChange={(e) =>
                        setLocal((prev) =>
                          prev
                            ? {
                                ...prev,
                                treatmentJustification: e.target.value,
                              }
                            : prev,
                        )
                      }
                      error={
                        passiveTreatment && !local.treatmentJustification.trim()
                      }
                      helperText={
                        passiveTreatment && !local.treatmentJustification.trim()
                          ? t(
                              "tabs.risks.dialog.treatmentJustificationRequired",
                              {
                                defaultValue:
                                  "Required for accept / transfer / share",
                              },
                            )
                          : undefined
                      }
                    />
                  )}
                </Box>

                <Divider />

                {/* Priority + Status */}
                <Stack direction="row" spacing={2}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>
                      {t("tabs.risks.dialog.priority", {
                        defaultValue: "Priority",
                      })}
                    </InputLabel>
                    <Select
                      value={local.moscowPriority}
                      label={t("tabs.risks.dialog.priority", {
                        defaultValue: "Priority",
                      })}
                      onChange={(e) => {
                        const p = e.target.value as MoSCoWPriority;
                        setLocal((prev) =>
                          prev
                            ? {
                                ...prev,
                                moscowPriority: p,
                                status:
                                  p === "wont"
                                    ? "wont-do"
                                    : prev.status === "wont-do"
                                      ? "open"
                                      : prev.status,
                              }
                            : prev,
                        );
                      }}
                    >
                      {MOSCOW_PRIORITIES.map((p) => (
                        <MenuItem key={p.value} value={p.value}>
                          <Chip
                            label={t(`risks.moscow.${p.value}.label`, {
                              defaultValue: p.label,
                            })}
                            size="small"
                            sx={{
                              bgcolor: p.color,
                              color: "white",
                              fontSize: "0.65rem",
                            }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>
                      {t("tabs.risks.dialog.status", {
                        defaultValue: "Status",
                      })}
                    </InputLabel>
                    <Select
                      value={local.status}
                      label={t("tabs.risks.dialog.status", {
                        defaultValue: "Status",
                      })}
                      onChange={(e) => {
                        const s = e.target.value as RiskStatus;
                        setLocal((prev) =>
                          prev
                            ? {
                                ...prev,
                                status: s,
                                moscowPriority:
                                  s === "wont-do"
                                    ? "wont"
                                    : prev.moscowPriority === "wont"
                                      ? "should"
                                      : prev.moscowPriority,
                              }
                            : prev,
                        );
                      }}
                    >
                      {RISK_STATUSES.map((s) => (
                        <MenuItem key={s.value} value={s.value}>
                          <Chip
                            label={t(`tabs.risks.status.${s.value}.label`, {
                              defaultValue: s.label,
                            })}
                            size="small"
                            sx={{
                              bgcolor: s.color,
                              color: "white",
                              fontSize: "0.65rem",
                            }}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                {/* Won't justification */}
                {local.moscowPriority === "wont" && (
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    label={t("tabs.risks.dialog.wontJustification", {
                      defaultValue: "Justification for Won't (required)",
                    })}
                    value={local.wontJustification}
                    onChange={(e) =>
                      setLocal((prev) =>
                        prev
                          ? { ...prev, wontJustification: e.target.value }
                          : prev,
                      )
                    }
                    error={!local.wontJustification.trim()}
                    helperText={
                      !local.wontJustification.trim()
                        ? t("validation.required", { defaultValue: "Required" })
                        : undefined
                    }
                  />
                )}
              </Stack>
            )}

            {/* ══ TAB 3: RISK AFTER ═══════════════════════════════════════ */}
            {tabValue === 2 && (
              <Stack spacing={2.5}>
                {/* Threat description read-only */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.threatDescription", {
                      defaultValue: "Threat",
                    })}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                    <Typography variant="body2">
                      {currentRisk.threatDescription}
                    </Typography>
                    {currentRisk.attackDescription && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          {currentRisk.attackDescription}
                        </Typography>
                      </>
                    )}
                  </Paper>
                </Box>

                {/* Cause — amber, read-only */}
                {effectiveCauseDescription && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "#fef3c7",
                      borderRadius: 1,
                      border: "1px solid #fcd34d",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight="medium"
                      display="block"
                      mb={0.5}
                    >
                      {t("tabs.risks.dialog.cause", {
                        defaultValue: "Root Cause",
                      })}
                    </Typography>
                    <Typography variant="body2">
                      {effectiveCauseDescription}
                    </Typography>
                  </Box>
                )}

                <Divider />

                {/* Effective mitigation */}
                <Box>
                  <Typography variant="subtitle2">
                    {t("tabs.risks.dialog.currentMitigation", {
                      defaultValue: "Current Mitigation",
                    })}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
                    <Typography variant="body2">
                      {currentRisk.selectedMitigations}
                    </Typography>

                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        {currentRisk.selectedVerifications}
                      </Typography>
                    </>
                  </Paper>
                </Box>

                <Divider />

                {/* After score */}
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="subtitle2">
                    {t("tabs.risks.dialog.tabAfter", {
                      defaultValue: "Risk After",
                    })}
                  </Typography>

                  <Tooltip
                    title={t("tabs.risks.dialog.copyFromBefore", {
                      defaultValue: "Copy ratings from Before",
                    })}
                  >
                    <Button
                      size="small"
                      startIcon={<CopyIcon />}
                      variant="outlined"
                      onClick={handleCopyToMitigated}
                    >
                      {t("tabs.risks.dialog.copyFromBefore", {
                        defaultValue: "Copy from Before",
                      })}
                    </Button>
                  </Tooltip>
                </Stack>
                <Stack
                  direction="row"
                  spacing={3}
                  sx={{ width: "100%" }}
                  justifyContent="stretch"
                >
                  <RiskScorePanel
                    impact={afterValues.impact}
                    likelihood={afterValues.likelihood}
                    risk={afterValues.risk}
                    configuration={configuration}
                  />
                </Stack>

                {/* Factor ratings */}
                <Box
                  sx={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.likelihoodFactors", {
                        defaultValue: "Likelihood Factors (After)",
                      })}
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 1,
                      }}
                    >
                      {likelihoodFactors.map((f) => renderFactorRow(f, true))}
                    </Box>
                  </Box>

                  {impactFactors.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {t("tabs.risks.dialog.impactFactorsAfter", {
                          defaultValue: "Impact Factors (After)",
                        })}
                      </Typography>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: 1,
                        }}
                      >
                        {impactFactors.map((f) => renderFactorRow(f, true))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Stack>
            )}
          </Box>
        </Box>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <PrevIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {currentIndex + 1}/{sortedRisks.length}
          </Typography>
          <IconButton
            size="small"
            onClick={handleNext}
            disabled={currentIndex === sortedRisks.length - 1}
          >
            <NextIcon />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={handleSave} variant="contained">
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};;;;;;;;;;

export default RiskDialog;