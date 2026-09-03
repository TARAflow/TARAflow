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
  Collapse,
} from "@mui/material";
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  Refresh as ResetIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoIcon,
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
import {
  applyExposureLevelToFactorRatings,
  calculateGatedRiskValues,
  resolveEN50742Severity,
  EN50742_EL_FACTOR,
} from "../services/en50742-risk-calculation";
import type {
  Severity,
  ExposureLevel,
  AttackerCapability,
} from "../models/en50742-approach-a-core";
import {
  en50742LevelFromRating,
  en50742LevelLabel,
  EN50742_FACTOR_LEVELS,
  EN50742_SRSL_FACTOR_IDS,
  EXPOSURE_LEVEL_SCORE,
  ATTACKER_CAPABILITY_SCORE,
} from "../models/en50742-approach-a-core";
import { WINDOW_OF_OPPORTUNITY_MULTIPLIERS } from "shared";
import { RiskScorePanel } from "./shared/risk-score-panel";
import { SrslBadge } from "./shared/srsl-badge";
import { SrslReferenceTables } from "./shared/srsl-reference-tables";

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
  const [showSrslTables, setShowSrslTables] = useState(false);
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

  // §11.2: WoO/AC/EL feed AP/SRSL, not the standard weighted mean — gates
  // both the severity lookup below and the factor-list split further down.
  const isEN50742 = configuration.likelihoodMethod === "en-50742-a";

  // ── Linked assets — fallback to threatRef if Risk has no linkedAssetIds ────
  // Moved above beforeValues: calculateGatedRiskValues (§11.2 gate) needs
  // linkedAssets to resolve EN 50742 severity (resolveEN50742Severity).
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

  const linkedAssets = useMemo(() => {
    if (!assetDataRef || !effectiveLinkedAssetIds.length) return [];
    const found = effectiveLinkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
    return found;
  }, [assetDataRef, effectiveLinkedAssetIds]);

  // Read-only display (§3.6/§3.7) — same worst-case resolution the gate
  // itself uses (resolveEN50742Severity), so the badge never disagrees with
  // what actually produced calculatedSrsl.
  const en50742Severity = useMemo(
    () => (isEN50742 ? resolveEN50742Severity(linkedAssets) : undefined),
    [isEN50742, linkedAssets],
  );

  // §11.3 gate — the SRSL section applies only to an EL-bearing anchor
  // (a crossing DataFlow or an Interface). An exposure_level rating > 0 means
  // an EL was resolved (EL0..EL4 map to 1..5; 0 = no anchor). Internal elements
  // (Process / DataStore) carry no EL → no SRSL, so the whole section is hidden
  // rather than shown as an eternal "not determined".
  const hasExposureAnchor = useMemo(
    () =>
      (local?.factorRatings.find((r) => r.factorId === "exposure_level")
        ?.value ?? 0) > 0,
    [local],
  );

  // Resolved multiplicands for the AP formula tooltip (AP box) — display
  // only, the actual apScore/apBand always come from beforeValues (the gate's
  // own computation). Looked up from the same tables computeAttackPotential
  // uses (en50742-approach-a-core.ts / shared), never re-derived.
  const srslFormula = useMemo(() => {
    if (!isEN50742 || !local) return undefined;
    const elValue =
      local.factorRatings.find((r) => r.factorId === "exposure_level")?.value ??
      0;
    const acValue =
      local.factorRatings.find((r) => r.factorId === "attacker_capability")
        ?.value ?? 0;
    const elLevel = en50742LevelFromRating("exposure_level", elValue) as
      | ExposureLevel
      | undefined;
    const acLevel = en50742LevelFromRating("attacker_capability", acValue) as
      | AttackerCapability
      | undefined;
    const woo = configuration.windowOfOpportunity;
    if (!elLevel || !acLevel || !woo) return undefined;
    return {
      elScore: EXPOSURE_LEVEL_SCORE[elLevel],
      wooMultiplier: WINDOW_OF_OPPORTUNITY_MULTIPLIERS[woo],
      acScore: ATTACKER_CAPABILITY_SCORE[acLevel],
    };
  }, [isEN50742, local?.factorRatings, configuration.windowOfOpportunity]);

  const beforeValues = useMemo(
    () =>
      local
        ? calculateGatedRiskValues(
            local.factorRatings,
            configuration,
            linkedAssets,
          )
        : { impact: 0, likelihood: 0, risk: 0 },
    [local?.factorRatings, configuration, linkedAssets],
  );
  // mitigatedFactorRatings NEVER go through the §11.2 gate — SRSL is a target
  // level satisfied by controls, not "mitigated down" (§3.8); the After lens
  // stays the plain generic R×L calc regardless of method.
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

  // §11.2: WoO/AC/EL feed AP/SRSL, not the standard weighted mean — they move
  // into their own section only for en-50742-a projects. Outside that method,
  // an analyst can still enable e.g. window_of_opportunity as an ordinary
  // rated factor, so nothing is filtered there.
  // EN50742_SRSL_FACTOR_IDS imported from the core (single source of truth).

  // ── Active factors ────────────────────────────────────────────────────────
  const { impactFactors, likelihoodFactors, elFactor, acFactor } =
    useMemo(() => {
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

      const likelihood = all.filter(
        (f) => f.definition!.category === "likelihood",
      );

      return {
        impactFactors: all.filter((f) => f.definition!.category === "impact"),
        likelihoodFactors: isEN50742
          ? likelihood.filter(
              (f) => !EN50742_SRSL_FACTOR_IDS.includes(f.factorId),
            )
          : likelihood,
        elFactor: likelihood.find((f) => f.factorId === "exposure_level"),
        acFactor: likelihood.find((f) => f.factorId === "attacker_capability"),
      };
    }, [configuration, isEN50742]);

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

  const effectiveCauseDescription =
    currentRisk?.causeDescription || currentThreatRef?.causeDescription;

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
      calculatedSrsl: beforeValues.srsl,
      calculatedApScore: beforeValues.apScore,
      calculatedApBand: beforeValues.apBand,
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

            // EL-specific: choosing "Not rated" means "I don't want to
            // override this — let the DFD derive it again", not "I insist
            // the value is exposed level zero forever". Every other derived
            // factor (impact, etc.) keeps the general rule below, where any
            // value the analyst picks — including 0 — is a deliberate manual
            // choice that freezes until reset. EL differs because its
            // "derived" source (the DFD) can change on its own at any time,
            // unprompted by the analyst, unlike Asset Tab data which the
            // analyst is actively editing when they'd want an override to
            // stick. Mirrors what the ↺ Reset button already does, just
            // reachable without a second click, and without requiring a
            // prior derivedValue to exist (works even if EL was never
            // derived yet).
            if (r.factorId === EN50742_EL_FACTOR && value === 0) {
              return {
                ...r,
                value: 0,
                derivedValue: undefined,
                source: undefined,
              };
            }

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
      calculatedSrsl: beforeValues.srsl,
      calculatedApScore: beforeValues.apScore,
      calculatedApBand: beforeValues.apBand,
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

    // §11.2: exposure_level is derived from the DFD (deriveExposureLevels →
    // applyExposureLevelToFactorRatings), not from the Asset Tab — everything
    // else that reaches "derived" status still comes from asset-criteria
    // prefill. The badge/tooltip text must say which, or it actively
    // misleads the analyst about where to go fix a wrong value.
    const isDfdDerived = factor.factorId === "exposure_level";
    const derivedLabel = isDfdDerived
      ? t("tabs.risks.dialog.factorDerivedDfd", { defaultValue: "DFD" })
      : t("tabs.risks.dialog.factorDerived", { defaultValue: "Assets" });
    const derivedTooltip = isDfdDerived
      ? t("tabs.risks.dialog.factorDerivedDfdTooltip", {
          defaultValue:
            "Derived from the linked DFD element/DataFlow's Exposure Level",
        })
      : t("tabs.risks.dialog.factorDerivedTooltip", {
          defaultValue: "Pre-filled from Asset Tab data",
        });
    const overriddenTooltip = isDfdDerived
      ? t("tabs.risks.dialog.factorOverriddenTooltipDfd", {
          value: rating?.derivedValue,
          defaultValue: `DFD-derived value: ${rating?.derivedValue}. Click ↺ to reset.`,
        })
      : t("tabs.risks.dialog.factorOverriddenTooltip", {
          value: rating?.derivedValue,
          defaultValue: `Asset-derived value: ${rating?.derivedValue}. Click ↺ to reset.`,
        });

    // EN 50742 rated level factors (exposure_level / attacker_capability) must
    // render as NORM LEVELS (EL0..EL4 / AC skill bands), not the 1-based
    // FactorRating.value: EL3 is stored as value 4 (index+1, so EL0=1 can be
    // told apart from "unrated"=0), and showing that raw 4 read as "EL4" — an
    // off-by-one against the exposure level the analyst set in the DFD. The
    // option value stays the 1-based rating index (what the gate/core decode
    // via en50742LevelFromRating); only the LABEL is the level.
    const en50742Levels =
      isEN50742 && EN50742_FACTOR_LEVELS[factor.factorId]
        ? EN50742_FACTOR_LEVELS[factor.factorId]
        : undefined;
    const factorOptions: { value: number; label: string; color?: string }[] =
      en50742Levels
        ? en50742Levels.map((key, i) => ({
            value: i + 1,
            // i18n label (en/de) with the norm English string from the core as
            // the fallback — keeps CLI/report and any unlocalised build correct.
            label: t(`risks.en50742Levels.${factor.factorId}.${key}`, {
              defaultValue: en50742LevelLabel(factor.factorId, key),
            }),
          }))
        : (def.category === "likelihood" ? LIKELIHOOD_SCALES : RISK_SCALES)[
            configuration.scale
          ].levels.map((level) => ({
            value: level.value,
            color: level.color,
            label: `${level.value} – ${t(
              `risks.scales.${
                def.category === "likelihood" ? "likelihood" : "impact"
              }.${level.label.toLowerCase().replace(/ /g, "_")}`,
              { defaultValue: level.label },
            )}`,
          }));

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

          {/* "From Assets"/"From DFD" badge — subtle, shown when value is derived and not overridden */}
          {isDerived && !isOverridden && (
            <Tooltip title={derivedTooltip}>
              <Chip
                label={derivedLabel}
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
            <Tooltip title={overriddenTooltip}>
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
          {factorOptions.map((opt) => {
            const isAssetValue =
              (isDerived || isOverridden) && opt.value === rating?.derivedValue;
            return (
              <MenuItem key={opt.value} value={opt.value}>
                <Tooltip
                  title={isAssetValue ? derivedTooltip : ""}
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
                    {opt.color && (
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          bgcolor: opt.color,
                        }}
                      />
                    )}
                    <span>
                      {opt.label}
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

                {isEN50742 &&
                  hasExposureAnchor &&
                  (() => {
                    const arrow = (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          px: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        <Typography variant="h6" color="text.disabled">
                          →
                        </Typography>
                      </Box>
                    );

                    const wooBox = (
                      <Tooltip
                        title={t("tabs.risks.dialog.wooTooltip", {
                          defaultValue:
                            "Global value — change it in the Overview tab (Security Context).",
                        })}
                        placement="top"
                        arrow
                      >
                        <Paper
                          variant="outlined"
                          sx={{ p: 1.5, height: "100%" }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            gutterBottom
                          >
                            {t("risks.factors.window_of_opportunity.name", {
                              defaultValue: "Window of Opportunity (WoO)",
                            })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {configuration.windowOfOpportunity
                              ? t(
                                  `risks.woo.${configuration.windowOfOpportunity}`,
                                  {
                                    defaultValue:
                                      configuration.windowOfOpportunity.replace(
                                        /_/g,
                                        " ",
                                      ),
                                  },
                                )
                              : t("tabs.risks.dialog.wooNotSet", {
                                  defaultValue:
                                    "Not set — configure in Overview",
                                })}
                          </Typography>
                        </Paper>
                      </Tooltip>
                    );

                    const severityBox = (
                      <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          gutterBottom
                        >
                          {t("tabs.risks.dialog.severity", {
                            defaultValue: "Severity",
                          })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {en50742Severity
                            ? t(`risks.severity.${en50742Severity}`, {
                                defaultValue: en50742Severity.replace(
                                  /_/g,
                                  " ",
                                ),
                              })
                            : t("tabs.risks.dialog.severityNone", {
                                defaultValue: "No linked safety-function asset",
                              })}
                        </Typography>
                      </Paper>
                    );

                    const apBox = (
                      <Tooltip
                        title={
                          srslFormula && beforeValues.apScore != null
                            ? t("tabs.risks.dialog.srslFormula", {
                                el: srslFormula.elScore,
                                woo: srslFormula.wooMultiplier,
                                ac: srslFormula.acScore,
                                result: beforeValues.apScore.toFixed(1),
                                band: beforeValues.apBand,
                                defaultValue:
                                  "AP = ({{el}} × {{woo}}) + {{ac}} = {{result}} → {{band}}",
                              })
                            : ""
                        }
                        placement="top"
                        arrow
                      >
                        <Paper
                          variant="outlined"
                          sx={{ p: 1.5, height: "100%" }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            gutterBottom
                          >
                            {t("tabs.risks.dialog.apLabel", {
                              defaultValue: "Attack Potential (AP)",
                            })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {beforeValues.apScore != null && beforeValues.apBand
                              ? `${beforeValues.apScore.toFixed(1)} (${beforeValues.apBand})`
                              : t("tabs.risks.dialog.apNotDetermined", {
                                  defaultValue: "Not yet determined",
                                })}
                          </Typography>
                        </Paper>
                      </Tooltip>
                    );

                    return (
                      <>
                        <Box>
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Typography variant="subtitle2" gutterBottom>
                              {t("tabs.risks.dialog.srslSectionTitle", {
                                defaultValue: "SRSL (EN 50742)",
                              })}
                            </Typography>
                            <Tooltip
                              title={t("tabs.risks.dialog.srslTablesToggle", {
                                defaultValue: "Show norm reference tables",
                              })}
                            >
                              <IconButton
                                size="small"
                                onClick={() => setShowSrslTables((v) => !v)}
                                sx={{
                                  transform: showSrslTables
                                    ? "rotate(180deg)"
                                    : "none",
                                  transition: "transform 0.2s",
                                }}
                              >
                                <ExpandMoreIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>

                          {/* Row 1: WoO, EL, AC → AP */}
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="stretch"
                            sx={{ mb: 1 }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>{wooBox}</Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {elFactor && renderFactorRow(elFactor, false)}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              {acFactor && renderFactorRow(acFactor, false)}
                            </Box>
                            {arrow}
                            <Box sx={{ flex: 1, minWidth: 0 }}>{apBox}</Box>
                          </Stack>

                          {/* Row 2: AP, Severity → SRSL — full only when a
                              safety-function asset provides a severity. Without
                              it, AP stays valid (shown in Row 1) but SRSL is not
                              computable, so this row collapses to a single note
                              instead of an empty severity box + a null badge. */}
                          {en50742Severity ? (
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="stretch"
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>{apBox}</Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                {severityBox}
                              </Box>
                              {arrow}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <SrslBadge
                                  srsl={beforeValues.srsl}
                                  apBand={beforeValues.apBand}
                                />
                              </Box>
                            </Stack>
                          ) : (
                            <Tooltip
                              placement="top"
                              arrow
                              title={
                                <Box
                                  sx={{
                                    whiteSpace: "pre-line",
                                    maxWidth: 340,
                                  }}
                                >
                                  {t(
                                    "tabs.risks.dialog.srslNoSeverityTooltip",
                                    {
                                      defaultValue:
                                        "SRSL needs a severity, which comes from a linked safety-function asset that carries a physical impact.\n\n1. In the Asset tab, add a safety-function asset and set its physical impact (Safety Impact Manual Override + rationale).\n2. Relate it to this threat's anchor: an Interface can \u201cinvokes\u201d or \u201cmonitors\u201d it; a DataFlow can \u201cinvokes\u201d it.\n\nSeverity then flows anchor \u2192 threat \u2192 risk and the SRSL is computed.",
                                    },
                                  )}
                                </Box>
                              }
                            >
                              <Paper
                                variant="outlined"
                                sx={{
                                  p: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                  cursor: "help",
                                }}
                              >
                                <InfoIcon fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t(
                                    "tabs.risks.dialog.srslNoSeverityCompact",
                                    {
                                      defaultValue:
                                        "No linked safety-function asset for Severity",
                                    },
                                  )}
                                </Typography>
                              </Paper>
                            </Tooltip>
                          )}

                          <Collapse in={showSrslTables}>
                            <SrslReferenceTables
                              currentApScore={beforeValues.apScore}
                              currentApBand={beforeValues.apBand}
                              currentSeverity={en50742Severity}
                            />
                          </Collapse>
                        </Box>

                        <Divider />
                      </>
                    );
                  })()}

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

                {/* ══ 1. RISK TREATMENT ═══════════════════════════════ */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.treatment", {
                      defaultValue: "Risk Treatment",
                    })}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {RISK_TREATMENTS.map((tr) => (
                      <Tooltip
                        key={tr.value}
                        title={t(`risks.treatment.${tr.value}.description`, {
                          defaultValue: tr.description,
                        })}
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
                              local.treatment === tr.value ? "white" : tr.color,
                            border: `2px solid ${tr.color}`,
                            fontWeight:
                              local.treatment === tr.value ? "bold" : "normal",
                            cursor: "pointer",
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Stack>

                  {/* Justification — contextual to Risk Treatment (accept/transfer/share) */}
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

                <Divider />

                {/* ══ 2. MITIGATION & VERIFICATION ═══════════════════ */}
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

                {/* ══ 3. MOSCOW PRIORITY — same visual language as Risk Treatment ══ */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.priority", {
                      defaultValue: "Priority",
                    })}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {MOSCOW_PRIORITIES.map((p) => (
                      <Chip
                        key={p.value}
                        label={t(`risks.moscow.${p.value}.label`, {
                          defaultValue: p.label,
                        })}
                        onClick={() =>
                          setLocal((prev) =>
                            prev ? { ...prev, moscowPriority: p.value } : prev,
                          )
                        }
                        sx={{
                          bgcolor:
                            local.moscowPriority === p.value
                              ? p.color
                              : "transparent",
                          color:
                            local.moscowPriority === p.value
                              ? "white"
                              : p.color,
                          border: `2px solid ${p.color}`,
                          fontWeight:
                            local.moscowPriority === p.value
                              ? "bold"
                              : "normal",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </Stack>

                  {/* Won't justification — contextual to MoSCoW "wont" */}
                  {local.moscowPriority === "wont" && (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      sx={{ mt: 1.5 }}
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
                </Box>
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
}

export default RiskDialog;