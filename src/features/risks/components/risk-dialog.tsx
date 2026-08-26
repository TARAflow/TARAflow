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
  Checkbox,
  FormControlLabel,
  TextField,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  Refresh as ResetIcon,
} from "@mui/icons-material";
import {
  MitigationStatus,
  SelectedMitigation,
} from "../models/risk-mitigation-types";
import { FactorRating } from "../models/risk-factor-types";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../models/risk-factor-types";
import { RiskConfiguration } from "../models/risk-config-types";
import { Risk, getFactorDefinition } from "../models/risk-assessment-types";
import {
  MoSCoWPriority,
  RiskTreatment,
  MOSCOW_PRIORITIES,
  RISK_TREATMENTS,
  RISK_SCALES,
  LIKELIHOOD_SCALES,
} from "../models/risk-scale-types";
import {
  calculateRiskValues,
  getRiskColor,
  getRiskLabel,
} from "../services/risk-calculation-service";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
  getAllMitigations,
} from "../../threats/services/threat-catalog-service";
import { MitigationScopeSelector } from "./mitigation-scope-selector";
import type {
  StrideCategory,
  MitigationPropertyRole,
  AssetDataReference,
  AssetReference,
  DFDReference,
  ThreatReference,
} from "shared";
import {
  ASSET_GROUP_CONFIG,
  type AssetGroup,
  MitigationCoverageBadge,
  computeAllMitigationCoverage,
} from "shared";
import {
  applyAssetCriteriaToFactorRatings,
  applyAssetImpactToFactorRatings,
  resetFactorToDerived,
} from "../services/risk-calculation-service";
import { applyExposureLevelToFactorRatings } from "../services/en50742-risk-calculation";
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
  /** Current DFD state — used to show coverage badges on mitigations */
  dfdData?: DFDReference | null;
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
}

// ==================== LOCAL STATE ====================

interface LocalRiskState {
  factorRatings: FactorRating[];
  mitigatedFactorRatings: FactorRating[];
  selectedMitigations: SelectedMitigation[];
  selectedVerifications: string[];
  treatment: RiskTreatment;
  treatmentJustification: string;
  moscowPriority: MoSCoWPriority;
  wontJustification: string;
  riskBeforeRationale: string;
  riskAfterRationale: string;
}

function riskToLocal(risk: Risk): LocalRiskState {
  return {
    factorRatings: risk.factorRatings.map((r) => ({ ...r })),
    mitigatedFactorRatings: risk.mitigatedFactorRatings.map((r) => ({ ...r })),
    selectedMitigations: (
      risk.selectedMitigations as (string | SelectedMitigation)[]
    ).map((m) =>
      typeof m === "string"
        ? { id: m, status: "open" as MitigationStatus }
        : { ...m },
    ),
    selectedVerifications: [...(risk.selectedVerifications ?? [])],
    treatment: risk.treatment ?? "reduce",
    treatmentJustification: risk.treatmentJustification ?? "",
    moscowPriority: risk.moscowPriority,
    wontJustification: risk.wontJustification ?? "",
    riskBeforeRationale: risk.riskBeforeRationale ?? "",
    riskAfterRationale: risk.riskAfterRationale ?? "",
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
  dfdData,
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

    if (
      configuration.useAssetImpact &&
      currentRisk.linkedAssetIds?.length &&
      assetDataRef
    ) {
      const linkedAssets = currentRisk.linkedAssetIds
        .map((id) => assetDataRef.assets.find((a) => a.id === id))
        .filter((a): a is AssetReference => Boolean(a));

      if (linkedAssets.length > 0) {
        const hasPerCriterionData = linkedAssets.some(
          (a) => a.impactRatings && a.impactRatings.length > 0,
        );

        if (hasPerCriterionData) {
          // Phase 3: direct 1:1 criterion → factor mapping (non-destructive)
          state = {
            ...state,
            factorRatings: applyAssetCriteriaToFactorRatings(
              state.factorRatings,
              linkedAssets,
              assetDataRef,
              configuration,
            ),
          };
        } else {
          // Legacy fallback: aggregated impact → all impact factors
          const levels = linkedAssets
            .map((a) => a.aggregatedImpact)
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
      }
    }

    // EN 50742 EL prefill (§11.2, Variante A) — independent of asset linkage,
    // reads exposureLevel from the threat's DFD anchor (Interface / crossing
    // DataFlow). No-op when the risk has no exposure_level entry
    // (non-en-50742-a projects) or it's already rated/manual.
    const currentThreatForEL = threats?.find(
      (t) => t.id === currentRisk.threatId,
    );
    state = {
      ...state,
      factorRatings: applyExposureLevelToFactorRatings(
        state.factorRatings,
        currentThreatForEL ?? {},
        dfdData,
      ),
    };

    setLocal(state);
  }, [currentRisk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const matchingThreat = threats?.find((t) => t.id === currentRisk?.threatId);
    if (!assetDataRef || !effectiveLinkedAssetIds.length) return [];
    const found = effectiveLinkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
    return found;
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
      riskBeforeRationale: local.riskBeforeRationale,
      riskAfterRationale: local.riskAfterRationale,

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
        const existing = prev[key].find((r) => r.factorId === factorId);

        if (!existing) {
          // Factor missing from ratings (e.g. added after risk was created) — add it
          return {
            ...prev,
            [key]: [...prev[key], { factorId, value, weight: 1.0 }],
          };
        }

        return {
          ...prev,
          [key]: prev[key].map((r) => {
            if (r.factorId !== factorId) return r;
            const isReturningToDerived =
              r.derivedValue !== undefined && value === r.derivedValue;
            return {
              ...r,
              value,
              source: isReturningToDerived
                ? ("derived" as const)
                : r.derivedValue !== undefined
                  ? ("manual" as const)
                  : undefined,
            };
          }),
        };
      });
    },
    [],
  );

  /** Reset a factor back to its Asset-derived value. Clears the Overridden chip. */
  const handleResetFactor = useCallback(
    (factorId: string, mitigated: boolean) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const key = mitigated ? "mitigatedFactorRatings" : "factorRatings";
        return {
          ...prev,
          [key]: prev[key].map((r) =>
            r.factorId === factorId ? resetFactorToDerived(r) : r,
          ),
        };
      });
    },
    [],
  );

  const setScopeOverride = useCallback(
    (id: string, scopeOverride: MitigationPropertyRole[] | undefined) => {
      setLocal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedMitigations: prev.selectedMitigations.map((m) =>
            m.id === id ? { ...m, scopeOverride } : m,
          ),
        };
      });
    },
    [],
  );

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

  // Auto-save whenever local state changes
  useEffect(() => {
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
      riskBeforeRationale: local.riskBeforeRationale,
      riskAfterRationale: local.riskAfterRationale,

      calculatedImpact: beforeValues.impact,
      calculatedLikelihood: beforeValues.likelihood,
      calculatedRiskBeforeMitigation: beforeValues.risk,
      calculatedRiskAfterMitigation: afterValues.risk,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mitigationCatalog = useMemo(() => getAllMitigations(), []);

  const toggleMitigation = useCallback(
    (id: string) => {
      setLocal((prev) => {
        if (!prev) return prev;
        const has = prev.selectedMitigations.some((m) => m.id === id);
        const updatedMitigations = has
          ? prev.selectedMitigations.filter((m) => m.id !== id)
          : [
              ...prev.selectedMitigations,
              { id, status: "open" as MitigationStatus },
            ];

        // Auto-select / auto-deselect linked verifications from catalog
        const catalogEntry = mitigationCatalog.find((m) => m.id === id);
        const linkedVerifications = catalogEntry?.verifications ?? [];

        let updatedVerifications = prev.selectedVerifications;
        if (!has && linkedVerifications.length > 0) {
          // Selecting: add verifications not already present
          const toAdd = linkedVerifications.filter(
            (v) => !updatedVerifications.includes(v),
          );
          updatedVerifications = [...updatedVerifications, ...toAdd];
        } else if (has && linkedVerifications.length > 0) {
          // Deselecting: remove verifications that were auto-linked
          // Keep any that are also linked by another currently-selected mitigation
          const otherSelectedIds = updatedMitigations.map((m) => m.id ?? "");
          const stillNeeded = new Set(
            otherSelectedIds.flatMap(
              (otherId) =>
                mitigationCatalog.find((m) => m.id === otherId)
                  ?.verifications ?? [],
            ),
          );
          updatedVerifications = updatedVerifications.filter(
            (v) => !linkedVerifications.includes(v) || stillNeeded.has(v),
          );
        }

        return {
          ...prev,
          selectedMitigations: updatedMitigations,
          selectedVerifications: updatedVerifications,
        };
      });
    },
    [mitigationCatalog],
  );

  // Coverage: check which mitigations are already implemented in DFD
  const mitigationCoverage = useMemo(() => {
    if (!currentRisk || !dfdData || !mitigationCatalog.length) return new Map();
    // ThreatReference (with linkedElement + dataFlow) satisfies ThreatForCoverage structurally
    const threat = threats?.find((t) => t.id === currentRisk.threatId);
    if (!threat) return new Map();
    const ids = (currentRisk.proposedMitigations ?? [])
      .map((m) => m.id ?? "")
      .filter(Boolean);
    return computeAllMitigationCoverage(
      ids,
      threat,
      dfdData,
      mitigationCatalog,
    );
  }, [currentRisk, dfdData, mitigationCatalog, threats]);

  if (!currentRisk || !local) return null;

  const isUncertain = currentRisk.threatRelevance === "uncertain";
  const isPerInteraction = currentRisk.sourceStrideMethod === "per-interaction";
  // When treatment is "accept" or "transfer": no mitigations needed,
  // risk after = risk before (auto-synced on treatment change).
  const isAccepted =
    local.treatment === "accept" || local.treatment === "transfer";
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
    const rating = ratings.find((r) => r.factorId === factor.factorId);
    const value = rating?.value ?? 0;

    const isOverridden =
      rating?.source === "manual" &&
      rating.derivedValue !== undefined &&
      value !== rating.derivedValue;

    const isDerived = rating?.source === "derived";

    return (
      <Paper key={factor.factorId} variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
            {t(`risks.factors.${def.id}.shortName`, {
              defaultValue: t(`risks.factors.${def.id}.name`, {
                defaultValue: def.name,
              }),
            })}
          </Typography>

          {/* "From Assets" badge — subtle, shown when value is derived and not overridden */}
          {isDerived && !isOverridden && (
            <Tooltip
              title={t("tabs.risks.dialog.factorDerivedTooltip", {
                defaultValue: "Pre-filled from Asset Tab data",
              })}
            >
              <Chip
                label={t("tabs.risks.dialog.factorDerived", {
                  defaultValue: "Assets",
                })}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  bgcolor: "primary.50",
                  color: "primary.main",
                  border: "1px solid",
                  borderColor: "primary.200",
                }}
              />
            </Tooltip>
          )}

          {/* Overridden chip — analyst changed a derived value */}
          {isOverridden && (
            <Tooltip
              title={t("tabs.risks.dialog.factorOverriddenTooltip", {
                value: rating!.derivedValue,
                defaultValue: `Asset-derived value: ${rating!.derivedValue}. Click ↺ to reset.`,
              })}
            >
              <Chip
                label={t("tabs.risks.dialog.factorOverridden", {
                  defaultValue: "Overridden",
                })}
                size="small"
                color="warning"
                sx={{ height: 18, fontSize: 10 }}
              />
            </Tooltip>
          )}

          {/* Reset button — only when overridden */}
          {isOverridden && (
            <Tooltip
              title={t("tabs.risks.dialog.factorReset", {
                defaultValue: "Reset to derived value",
              })}
            >
              <IconButton
                size="small"
                onClick={() => handleResetFactor(factor.factorId, mitigated)}
                sx={{ p: 0.25, color: "warning.main" }}
              >
                <ResetIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Description tooltip */}
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
          sx={
            isOverridden
              ? {
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "warning.main",
                  },
                }
              : undefined
          }
        >
          <MenuItem value={0}>
            <em>
              {t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" })}
            </em>
          </MenuItem>
          {(def.category === "likelihood" ? LIKELIHOOD_SCALES : RISK_SCALES)[
            configuration.scale
          ].levels.map((level) => {
            const isAssetValue =
              (isDerived || isOverridden) &&
              level.value === rating?.derivedValue;
            return (
              <MenuItem key={level.value} value={level.value}>
                <Tooltip
                  title={
                    isAssetValue
                      ? t("tabs.risks.dialog.factorDerivedTooltip", {
                          defaultValue: "Pre-filled from Asset Tab data",
                        })
                      : ""
                  }
                  placement="right"
                  disableHoverListener={!isAssetValue}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    width="100%"
                    sx={{ fontWeight: isAssetValue ? "bold" : "normal" }}
                  >
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
                        `risks.scales.${
                          def.category === "likelihood"
                            ? "likelihood"
                            : "impact"
                        }.${level.label.toLowerCase().replace(/ /g, "_")}`,
                        { defaultValue: level.label },
                      )}
                      {isAssetValue && " *"}
                    </span>
                  </Stack>
                </Tooltip>
              </MenuItem>
            );
          })}
        </Select>
      </Paper>
    );
  };

  // ── Attack-tree likelihood contribution (Phase 6) ─────────────────────────
  // attack_tree_likelihood is deliberately NOT in configuration.activeFactors
  // (design doc 5b: data-driven, not analyst-configured), so it never shows up
  // via the normal likelihoodFactors iteration above. It has to be rendered
  // separately, driven by whether a rating/provenance is actually present —
  // not by a discriminator. Before-mitigation only; the tree never feeds the
  // residual, so this never renders in the "after" pass.
  const treeFactorRating = local.factorRatings.find(
    (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  );
  const treeFactorDef = getFactorDefinition(
    ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
    configuration.customFactors,
  );
  const treeAssessment = currentRisk.attackTreeAssessment;

  const renderTreeFactorRow = (mitigated: boolean) => {
    if (mitigated || !treeAssessment) return null;

    const provenanceTooltip = t(
      "tabs.risks.dialog.treeFactorProvenanceTooltip",
      {
        treeId: treeAssessment.treeId,
        pathKey: treeAssessment.pathKey,
        raw: treeAssessment.likelihoodComponent,
        defaultValue:
          `From Attack Tree ${treeAssessment.treeId}, path ${treeAssessment.pathKey} ` +
          `(raw likelihood component ${treeAssessment.likelihoodComponent}). ` +
          `Edited at the source (Attack Tree tab), not here.`,
      },
    );

    // "factor" mode — an active rating exists, averages in with the OWASP
    // factors like any other likelihood factor. Read-only: no Select, no
    // reset — the value lives at the source.
    if (treeFactorRating && treeFactorDef) {
      return (
        <Paper
          key="attack-tree-likelihood"
          variant="outlined"
          sx={{ p: 1.5, borderColor: "info.main", borderStyle: "dashed" }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography
              variant="body2"
              fontWeight="medium"
              sx={{ flexGrow: 1 }}
            >
              {t(`risks.factors.${treeFactorDef.id}.shortName`, {
                defaultValue: t(`risks.factors.${treeFactorDef.id}.name`, {
                  defaultValue: treeFactorDef.name,
                }),
              })}
            </Typography>
            <Tooltip title={provenanceTooltip}>
              <Chip
                label={t("tabs.risks.dialog.treeFactorBadge", {
                  defaultValue: "Attack Tree",
                })}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  bgcolor: "info.50",
                  color: "info.main",
                  border: "1px solid",
                  borderColor: "info.200",
                }}
              />
            </Tooltip>
          </Stack>
          <Chip
            label={`${treeFactorRating.value} — ${t(
              "tabs.risks.dialog.treeFactorReadOnly",
              { defaultValue: "read-only, edit at source" },
            )}`}
            size="small"
            variant="outlined"
            sx={{ width: "100%", justifyContent: "flex-start" }}
          />
        </Paper>
      );
    }

    // "advisory" mode — no active factor was written; shown for reference
    // only, never enters calculateRiskValues.
    return (
      <Paper
        key="attack-tree-likelihood-advisory"
        variant="outlined"
        sx={{ p: 1.5, borderStyle: "dotted", borderColor: "text.disabled" }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flexGrow: 1 }}
          >
            {t("tabs.risks.dialog.treeAdvisoryLabel", {
              defaultValue: "Attack Tree (advisory)",
            })}
          </Typography>
          <Tooltip title={provenanceTooltip}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: "help" }}
            >
              ⓘ
            </Typography>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t("tabs.risks.dialog.treeAdvisoryHint", {
            defaultValue:
              "Not included in the calculation — shown for reference only.",
          })}
        </Typography>
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
                // Live values for active risk, stored values for others
                const beforeScore = isActive
                  ? beforeValues.risk
                  : risk.calculatedRiskBeforeMitigation;
                const afterScore = isActive
                  ? afterValues.risk
                  : risk.calculatedRiskAfterMitigation;
                const riskColor = getRiskColor(
                  beforeScore,
                  configuration.scale,
                  configuration.roundingMethod,
                );
                const riskLabel =
                  beforeScore > 0 ? beforeScore.toFixed(1) : "–";
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
                      <Tooltip
                        title={
                          beforeScore > 0
                            ? getRiskLabel(beforeScore, configuration.scale)
                            : ""
                        }
                        placement="right"
                        arrow
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
                      </Tooltip>
                      {afterScore > 0 ? (
                        <Tooltip
                          title={`${t("tabs.risks.dialog.residualRisk", { defaultValue: "Residual Risk" })}: ${getRiskLabel(afterScore, configuration.scale)}`}
                          placement="right"
                        >
                          <Chip
                            label={afterScore.toFixed(1)}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 10,
                              bgcolor: getRiskColor(
                                afterScore,
                                configuration.scale,
                                configuration.roundingMethod,
                              ),
                              color: "white",
                              opacity: 0.85,
                              minWidth: 32,
                            }}
                          />
                        </Tooltip>
                      ) : uncertain ? (
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
                      ) : (
                        <Chip
                          label="–"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 10,
                            bgcolor: "grey.200",
                            color: "text.disabled",
                            minWidth: 32,
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
                        const groupCfg =
                          ASSET_GROUP_CONFIG[
                            asset.assetGroup as keyof typeof ASSET_GROUP_CONFIG
                          ];
                        return (
                          <Chip
                            key={asset.id}
                            label={`${asset.name}${hasSafety ? " ⚠" : ""}${aImpact ? ` · ${aImpact}` : ""}`}
                            size="small"
                            sx={{
                              fontSize: 11,
                              height: 22,
                              bgcolor: groupCfg?.colorLight ?? "grey.100",
                              color: groupCfg?.color ?? "text.primary",
                              border: `1px solid ${groupCfg?.color ?? "#ccc"}`,
                            }}
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

                {/* Assessment rationale — why these likelihood/impact factors */}
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ mt: 1.5 }}
                  label={t("tabs.risks.dialog.riskBeforeRationale", {
                    defaultValue:
                      "Assessment Rationale — reasoning behind the risk assessment",
                  })}
                  value={local.riskBeforeRationale}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev
                        ? { ...prev, riskBeforeRationale: e.target.value }
                        : prev,
                    )
                  }
                />

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
                      {renderTreeFactorRow(false)}
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
                {/* Accept / Transfer banner — mitigations not applicable */}
                {isAccepted && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "#fef3c7",
                      borderRadius: 1,
                      border: "1px solid #fcd34d",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {local.treatment === "accept"
                        ? t("tabs.risks.dialog.acceptedNote", {
                            defaultValue:
                              "Risk is accepted — no mitigations required. Risk After equals Risk Before.",
                          })
                        : t("tabs.risks.dialog.transferredNote", {
                            defaultValue:
                              "Risk is transferred — no internal mitigations required. Risk After equals Risk Before.",
                          })}
                    </Typography>
                  </Box>
                )}

                {/* Proposed Mitigations checkboxes */}
                {resolvedMitigations.length > 0 && (
                  <Box sx={{ opacity: isAccepted ? 0.5 : 1 }}>
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
                              disabled={isAccepted}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={local.selectedMitigations.some(
                                    (sel) => sel.id === id,
                                  )}
                                  onChange={() => toggleMitigation(id)}
                                  disabled={isAccepted}
                                />
                              }
                              label={
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <Typography variant="body2">
                                    {label}
                                  </Typography>
                                  <MitigationCoverageBadge
                                    coverage={mitigationCoverage.get(id)}
                                  />
                                </Box>
                              }
                              sx={{ m: 0, width: "100%" }}
                            />

                            {/* Scope selector — only for per-interaction risks */}
                            {isPerInteraction &&
                              local.selectedMitigations.some(
                                (sel) => sel.id === id,
                              ) && (
                                <MitigationScopeSelector
                                  mitigationId={id}
                                  selectedMitigation={
                                    local.selectedMitigations.find(
                                      (sel) => sel.id === id,
                                    )!
                                  }
                                  catalog={mitigationCatalog}
                                  onChange={(roles) =>
                                    setScopeOverride(id, roles)
                                  }
                                />
                              )}
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {/* Proposed Verifications checkboxes */}
                {resolvedVerifications.length > 0 && (
                  <Box sx={{ opacity: isAccepted ? 0.5 : 1 }}>
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
                              disabled={isAccepted}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={local.selectedVerifications.includes(
                                    id,
                                  )}
                                  onChange={() => toggleVerification(id)}
                                  disabled={isAccepted}
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
                  <Stack
                    direction="row"
                    spacing={8}
                    alignItems="flex-start"
                    flexWrap="wrap"
                  >
                    {/* LEFT: Risk Treatment */}
                    <Box sx={{ minWidth: 200 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {t("tabs.risks.dialog.treatment", {
                          defaultValue: "Risk Treatment",
                        })}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {RISK_TREATMENTS.map((tr) => (
                          <Tooltip
                            key={tr.value}
                            title={t(
                              `risks.treatment.${tr.value}.description`,
                              {
                                defaultValue: tr.description,
                              },
                            )}
                            placement="top"
                            arrow
                          >
                            <Chip
                              label={t(`risks.treatment.${tr.value}.label`, {
                                defaultValue: tr.label,
                              })}
                              onClick={() =>
                                setLocal((prev) => {
                                  if (!prev) return prev;

                                  const autoFixed =
                                    tr.value === "accept" ||
                                    tr.value === "transfer";

                                  const newMoscow = autoFixed
                                    ? ("wont" as MoSCoWPriority)
                                    : prev.moscowPriority === "wont"
                                      ? ("should" as MoSCoWPriority)
                                      : prev.moscowPriority;

                                  return {
                                    ...prev,
                                    treatment: tr.value,
                                    moscowPriority: newMoscow,
                                    ...(autoFixed
                                      ? {
                                          mitigatedFactorRatings:
                                            prev.factorRatings.map((r) => ({
                                              ...r,
                                            })),
                                        }
                                      : {}),
                                  };
                                })
                              }
                              sx={{
                                bgcolor:
                                  local.treatment === tr.value
                                    ? tr.color
                                    : "transparent",
                                color:
                                  local.treatment === tr.value
                                    ? "white"
                                    : tr.color,
                                border: `2px solid ${tr.color}`,
                                fontWeight:
                                  local.treatment === tr.value
                                    ? "bold"
                                    : "normal",
                                cursor: "pointer",
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>

                    {/* RIGHT: MoSCoW Priority */}
                    <Box sx={{ flexShrink: 0 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {t("tabs.risks.dialog.priority", {
                          defaultValue: "Priority",
                        })}
                      </Typography>

                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <Select
                          value={local.moscowPriority}
                          onChange={(e) =>
                            setLocal((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    moscowPriority: e.target
                                      .value as MoSCoWPriority,
                                  }
                                : prev,
                            )
                          }
                          size="small"
                          sx={{
                            fontSize: "0.75rem",
                            "& .MuiSelect-select": { py: 0.5 },
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
                    </Box>
                  </Stack>

                  {/* Justification bleibt unten */}
                  {passiveTreatment && local.moscowPriority !== "wont" && (
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
                        ? t("tabs.risks.validation.required", {
                            defaultValue: "Required",
                          })
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

                {/* Linked Assets — mirrored from Risk Before so the residual
                    tab is self-contained (same asset; mitigation changes the
                    risk, not which asset is affected). */}
                {linkedAssets.length > 0 && (
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
                        const groupCfg =
                          ASSET_GROUP_CONFIG[
                            asset.assetGroup as keyof typeof ASSET_GROUP_CONFIG
                          ];
                        return (
                          <Chip
                            key={asset.id}
                            label={`${asset.name}${hasSafety ? " ⚠" : ""}${aImpact ? ` · ${aImpact}` : ""}`}
                            size="small"
                            sx={{
                              fontSize: 11,
                              height: 22,
                              bgcolor: groupCfg?.colorLight ?? "grey.100",
                              color: groupCfg?.color ?? "text.primary",
                              border: `1px solid ${groupCfg?.color ?? "#ccc"}`,
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                <Divider />

                {/* Selected Mitigations — bullet list */}
                {local.selectedMitigations.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.selectedMitigations", {
                        defaultValue: "Selected Mitigations",
                      })}
                    </Typography>
                    <Stack spacing={0.5}>
                      {local.selectedMitigations.map((mitigation) => {
                        const id = mitigation.id ?? mitigation.notes ?? "";
                        const ref = resolvedMitigations.find(
                          (m) => (m.id ?? m.notes ?? "") === id,
                        );
                        const text = ref
                          ? ref.isCustom
                            ? `[custom] ${ref.notes ?? ""}`
                            : `${ref.id}: ${ref.text}`
                          : id;
                        return (
                          <Typography
                            key={id}
                            variant="body2"
                            component="div"
                            sx={{
                              display: "flex",
                              gap: 0.75,
                              alignItems: "center",
                            }}
                          >
                            <span style={{ flexShrink: 0, color: "#6b7280" }}>
                              •
                            </span>
                            <span style={{ flexGrow: 1 }}>{text}</span>
                            <MitigationCoverageBadge
                              coverage={mitigationCoverage.get(id)}
                            />
                          </Typography>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {local.selectedVerifications.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("tabs.risks.dialog.verifications", {
                        defaultValue: "Selected Verifications",
                      })}
                    </Typography>
                    <Stack spacing={0.5}>
                      {local.selectedVerifications.map((id) => {
                        const ref = resolvedVerifications.find(
                          (v) => (v.id ?? v.notes ?? "") === id,
                        );
                        const text = ref
                          ? ref.isCustom
                            ? `[custom] ${ref.notes ?? ""}`
                            : `${ref.id}: ${ref.text}`
                          : id;
                        return (
                          <Typography
                            key={id}
                            variant="body2"
                            sx={{ display: "flex", gap: 0.75 }}
                          >
                            <span style={{ flexShrink: 0, color: "#6b7280" }}>
                              •
                            </span>
                            <span>{text}</span>
                          </Typography>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

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
                    <span>
                      <Button
                        size="small"
                        startIcon={<CopyIcon />}
                        variant="outlined"
                        onClick={handleCopyToMitigated}
                        disabled={isAccepted}
                      >
                        {t("tabs.risks.dialog.copyFromBefore", {
                          defaultValue: "Copy from Before",
                        })}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                {/* Accept / Transfer: inform analyst risk after = risk before */}
                {isAccepted && (
                  <Box
                    sx={{
                      p: 1,
                      bgcolor: "#fef3c7",
                      borderRadius: 1,
                      border: "1px solid #fcd34d",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t("tabs.risks.dialog.riskAfterAutoSynced", {
                        defaultValue:
                          "Risk After is automatically set equal to Risk Before (no mitigation applied).",
                      })}
                    </Typography>
                  </Box>
                )}

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

                {/* Residual risk rationale — why L/I changed after mitigation */}
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ mt: 1.5 }}
                  label={t("tabs.risks.dialog.riskAfterRationale", {
                    defaultValue:
                      "Residual Risk Rationale — why likelihood/impact changed after mitigation",
                  })}
                  value={local.riskAfterRationale}
                  onChange={(e) =>
                    setLocal((prev) =>
                      prev
                        ? { ...prev, riskAfterRationale: e.target.value }
                        : prev,
                    )
                  }
                />

                {/* Factor ratings — disabled when accepted/transferred */}
                <Box
                  sx={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                    opacity: isAccepted ? 0.5 : 1,
                    pointerEvents: isAccepted ? "none" : "auto",
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
        <Button variant="contained" onClick={onClose}>
          {t("common.ok", { defaultValue: "OK" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RiskDialog;