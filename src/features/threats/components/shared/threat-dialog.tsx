// ==================== THREAT EVAL DIALOG ====================
// Evaluation workspace for a group of threats (one accordion section).
// Opens on a specific threat, allows navigation through the full group.
// Three-level structure: Decision (required) → Annotation → Custom entries.

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  TextField,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from "@mui/material";
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  HelpOutline as UncertainIcon,
  ArrowBack as PrevIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  WarningAmber as CauseIcon,
} from "@mui/icons-material";

import type {
  Threat,
  ThreatConfiguration,
  ThreatRelevance,
  ThreatActorType,
  MitigationDraft,
  VerificationDraft,
} from "../../models/threat-types";
import type {
  AssetReference,
  AssetDataReference,
  DFDReference,
  StrideCategory,
} from "shared";
import { RELEVANCE_COLORS, THREAT_ACTORS } from "../../models/threat-types";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
  getAllMitigations,
} from "../../services/threat-catalog-service";
import { MitigationCoverageBadge, STRIDE_COLORS } from "shared";
import { computeAllMitigationCoverage } from "shared/utils/mitigation-coverage";
import { SourceBadge } from "../../components/shared/threat-table-utils";

// ==================== PROPS ====================

// ── Impact helpers ───────────────────────────────────────────────────────────
type ImpactLevel = "CRITICAL" | "HIGH+" | "HIGH" | "MED+" | "MED" | "LOW";
const IMPACT_ORDER: ImpactLevel[] = [
  "CRITICAL",
  "HIGH+",
  "HIGH",
  "MED+",
  "MED",
  "LOW",
];
const IMPACT_CHIP_COLORS: Record<
  ImpactLevel,
  { bg: string; border: string; color: string }
> = {
  CRITICAL: { bg: "#dc262618", border: "#dc2626", color: "#dc2626" },
  "HIGH+": { bg: "#ea580c18", border: "#ea580c", color: "#ea580c" },
  HIGH: { bg: "#f9731618", border: "#f97316", color: "#f97316" },
  "MED+": { bg: "#ca8a0418", border: "#ca8a04", color: "#ca8a04" },
  MED: { bg: "#eab30818", border: "#d97706", color: "#d97706" },
  LOW: { bg: "#16a34a18", border: "#16a34a", color: "#16a34a" },
};

function getThreatImpact(
  threat: Threat,
  assetDataRef: AssetDataReference | undefined,
): ImpactLevel | undefined {
  if (!assetDataRef || !threat.linkedAssetIds?.length) return undefined;
  const linked = threat.linkedAssetIds
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter((a): a is AssetReference => Boolean(a));
  if (!linked.length) return undefined;
  const hasSafety = linked.some(
    (a) =>
      a.physicalImpact === "fatality" ||
      a.physicalImpact === "irreversible_injury",
  );
  const worstBusiness = linked.reduce<ImpactLevel | undefined>((acc, a) => {
    const imp = a.aggregatedImpact as ImpactLevel | undefined;
    if (!imp) return acc;
    if (!acc) return imp;
    return IMPACT_ORDER.indexOf(imp) < IMPACT_ORDER.indexOf(acc) ? imp : acc;
  }, undefined);
  return hasSafety && worstBusiness === "CRITICAL"
    ? "CRITICAL"
    : hasSafety
      ? "HIGH"
      : worstBusiness;
}

export interface ThreatEvalDialogProps {
  open: boolean;
  threats: Threat[];
  initialIndex: number;
  configuration: ThreatConfiguration;
  assetDataRef?: AssetDataReference;
  /** Current DFD state — used to show coverage badges on mitigations */
  dfdData?: DFDReference | null;
  onSave: (threatId: string, updates: Partial<Threat>) => void;
  onClose: () => void;
}

// ==================== LOCAL TYPES ====================

interface LocalThreatState {
  threatDescription: string;
  attackDescription: string;
  isTextCustomized: boolean;
  proposedMitigations: MitigationDraft[];
  proposedVerifications: VerificationDraft[];
  relevance: ThreatRelevance;
  evalNote: string;
  threatActor: ThreatActorType;
}

// ==================== HELPERS ====================

function toLocalState(threat: Threat): LocalThreatState {
  return {
    threatDescription: threat.threatDescription,
    attackDescription: threat.attackDescription,
    isTextCustomized: threat.isTextCustomized,
    proposedMitigations: threat.proposedMitigations,
    proposedVerifications: threat.proposedVerifications,
    relevance: threat.relevance,
    evalNote: threat.evalNote ?? "",
    threatActor: threat.threatActor,
  };
}

function isDirtyState(local: LocalThreatState, threat: Threat): boolean {
  return (
    local.threatDescription !== threat.threatDescription ||
    local.attackDescription !== threat.attackDescription ||
    local.relevance !== threat.relevance ||
    local.evalNote !== (threat.evalNote ?? "") ||
    local.threatActor !== threat.threatActor ||
    JSON.stringify(local.proposedMitigations) !==
      JSON.stringify(threat.proposedMitigations) ||
    JSON.stringify(local.proposedVerifications) !==
      JSON.stringify(threat.proposedVerifications)
  );
}

// ==================== COMPONENT ====================

export const ThreatEvalDialog: React.FC<ThreatEvalDialogProps> = ({
  open,
  threats,
  initialIndex,
  configuration,
  assetDataRef,
  dfdData,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  // ── Navigation state ──────────────────────────────────────────────────────
  const sortedThreats = useMemo(() => {
    if (!assetDataRef) return threats;
    return [...threats].sort((a, b) => {
      const ia = getThreatImpact(a, assetDataRef);
      const ib = getThreatImpact(b, assetDataRef);
      const idxA = ia ? IMPACT_ORDER.indexOf(ia) : IMPACT_ORDER.length;
      const idxB = ib ? IMPACT_ORDER.indexOf(ib) : IMPACT_ORDER.length;
      return idxA - idxB;
    });
  }, [threats, assetDataRef]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!assetDataRef) return initialIndex;
    const sorted = [...threats].sort((a, b) => {
      const ia = getThreatImpact(a, assetDataRef);
      const ib = getThreatImpact(b, assetDataRef);
      const idxA = ia ? IMPACT_ORDER.indexOf(ia) : IMPACT_ORDER.length;
      const idxB = ib ? IMPACT_ORDER.indexOf(ib) : IMPACT_ORDER.length;
      return idxA - idxB;
    });
    const id = threats[initialIndex]?.id;
    const idx = sorted.findIndex((t) => t.id === id);
    return idx >= 0 ? idx : initialIndex;
  });
  const currentThreat = sortedThreats[currentIndex] ?? null;

  // Guard against rapid repeated clicks causing IPC queue overflow
  const isProcessing = useRef(false);

  // ── Local edit state for the current threat ───────────────────────────────
  const [local, setLocal] = useState<LocalThreatState | null>(null);

  // ── Edit mode toggles ─────────────────────────────────────────────────────
  const [editingThreat, setEditingThreat] = useState(false);
  const [editingAttack, setEditingAttack] = useState(false);

  // ── Add-entry forms ───────────────────────────────────────────────────────
  const [addingMitigation, setAddingMitigation] = useState(false);
  const [addingVerification, setAddingVerification] = useState(false);
  const [newMitigationText, setNewMitigationText] = useState("");
  const [newVerificationText, setNewVerificationText] = useState("");

  // ── Init / reset on open or threat change ────────────────────────────────
  useEffect(() => {
    if (open && currentThreat) {
      setLocal(toLocalState(currentThreat));
      setEditingThreat(false);
      setEditingAttack(false);
      setAddingMitigation(false);
      setAddingVerification(false);
      setNewMitigationText("");
      setNewVerificationText("");
    }
  }, [open, currentIndex]);

  useEffect(() => {
    if (!open) return;
    // initialIndex referenziert die unsortierte threats-Liste.
    // Über die ID in den Index der sortierten Liste übersetzen.
    const id = threats[initialIndex]?.id;
    if (!id) return;
    const sortedIdx = sortedThreats.findIndex((t) => t.id === id);
    setCurrentIndex(sortedIdx >= 0 ? sortedIdx : initialIndex);
  }, [open, initialIndex, threats, sortedThreats]);

  // ── Derived: reviewed count for progress display ─────────────────────────
  const reviewedCount = useMemo(
    () =>
      sortedThreats.filter(
        (t) => t.workflowStatus === "reviewed" || t.workflowStatus === "closed",
      ).length,
    [sortedThreats],
  );

  // ── Resolved catalog entries for display ─────────────────────────────────
  const resolvedMitigations = useMemo(
    () => (local ? resolveMitigationDrafts(local.proposedMitigations) : []),
    [local?.proposedMitigations],
  );
  const resolvedVerifications = useMemo(
    () => (local ? resolveVerificationDrafts(local.proposedVerifications) : []),
    [local?.proposedVerifications],
  );

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const patch = useCallback((updates: Partial<LocalThreatState>) => {
    setLocal((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const updateMitigationNote = (index: number, notes: string) => {
    if (!local) return;
    const updated = local.proposedMitigations.map((d, i) =>
      i === index ? { ...d, notes: notes || undefined } : d,
    );
    patch({ proposedMitigations: updated });
  };

  const updateVerificationNote = (index: number, notes: string) => {
    if (!local) return;
    const updated = local.proposedVerifications.map((d, i) =>
      i === index ? { ...d, notes: notes || undefined } : d,
    );
    patch({ proposedVerifications: updated });
  };

  const confirmAddMitigation = () => {
    if (!newMitigationText.trim() || !local) return;
    patch({
      proposedMitigations: [
        ...local.proposedMitigations,
        { notes: newMitigationText.trim() },
      ],
    });
    setNewMitigationText("");
    setAddingMitigation(false);
  };

  const confirmAddVerification = () => {
    if (!newVerificationText.trim() || !local) return;
    patch({
      proposedVerifications: [
        ...local.proposedVerifications,
        { notes: newVerificationText.trim() },
      ],
    });
    setNewVerificationText("");
    setAddingVerification(false);
  };

  // ── Save helpers ──────────────────────────────────────────────────────────

  const buildUpdates = (
    overrides?: Partial<LocalThreatState>,
  ): Partial<Threat> => {
    const s = { ...local!, ...overrides };
    return {
      threatDescription: s.threatDescription,
      attackDescription: s.attackDescription,
      isTextCustomized: s.isTextCustomized,
      proposedMitigations: s.proposedMitigations,
      proposedVerifications: s.proposedVerifications,
      relevance: s.relevance,
      workflowStatus:
        s.relevance !== "unrated" ? "reviewed" : currentThreat!.workflowStatus,
      evalNote: s.evalNote || undefined,
      threatActor: s.threatActor,
      lastModified: new Date().toISOString(),
    };
  };

  const saveCurrentThreat = useCallback(
    (overrides?: Partial<LocalThreatState>) => {
      if (!currentThreat || !local) return;
      onSave(currentThreat.id, buildUpdates(overrides));
    },
    [currentThreat, local, onSave],
  );

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = (index: number) => {
    // Auto-save current if dirty
    if (local && currentThreat && isDirtyState(local, currentThreat)) {
      onSave(currentThreat.id, buildUpdates());
    }
    setCurrentIndex(index);
  };

  const navigatePrev = () => {
    if (currentIndex > 0) navigateTo(currentIndex - 1);
  };

  // Advance to next unrated or uncertain; if none remain, close
  const navigateNextUnrated = () => {
    const next = sortedThreats.findIndex(
      (t, i) =>
        i > currentIndex &&
        (t.relevance === "unrated" || t.relevance === "uncertain"),
    );
    if (next !== -1) {
      navigateTo(next);
    } else {
      onClose();
    }
  };

  // ── Footer action handlers ────────────────────────────────────────────────

  const handleSave = () => saveCurrentThreat();

  const handleConfirm = () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    saveCurrentThreat({ relevance: "relevant" });
    navigateNextUnrated();
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  };

  const handleDismiss = () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    saveCurrentThreat({ relevance: "not_relevant" });
    navigateNextUnrated();
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  };

  const handleMarkUncertain = () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    saveCurrentThreat({ relevance: "uncertain" });
    navigateNextUnrated();
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  };

  // ── Mitigation coverage (Rules of Hooks: must be before early return) ───────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const threatCatalog = useMemo(() => getAllMitigations(), []);

  const mitigationCoverage = useMemo(() => {
    if (!currentThreat || !dfdData || !threatCatalog.length) return new Map();
    const ids = (currentThreat.proposedMitigations ?? [])
      .map((m) => m.id ?? "")
      .filter(Boolean);
    return computeAllMitigationCoverage(
      ids,
      currentThreat,
      dfdData,
      threatCatalog,
    );
  }, [currentThreat, dfdData, threatCatalog]);

  // ── Derived display values ────────────────────────────────────────────────

  const getStrideName = (type: StrideCategory) =>
    t(`stride.${type}.name`, { defaultValue: type });

  if (!currentThreat || !local) return null;

  const hasInteraction = !!currentThreat.interactionContext;
  const contextLabel = hasInteraction
    ? currentThreat.dataFlow
      ? `${currentThreat.dataFlow.sourceName} → ${currentThreat.dataFlow.targetName}`
      : currentThreat.id
    : (currentThreat.linkedElement?.elementName ?? currentThreat.id);

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: "90vh" } }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <DialogTitle sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* STRIDE chip */}
          <Chip
            label={currentThreat.strideCategory}
            size="small"
            sx={{
              bgcolor: STRIDE_COLORS[currentThreat.strideCategory],
              color: "white",
              fontWeight: "bold",
              minWidth: 28,
              flexShrink: 0,
            }}
          />
          {/* Threat ID */}
          <Typography
            variant="caption"
            fontWeight="bold"
            color="text.secondary"
            sx={{ flexShrink: 0, fontFamily: "monospace" }}
          >
            {currentThreat.id}
          </Typography>
          {/* Element / DataFlow — semantic context, fills available space */}
          <Typography
            variant="body2"
            fontWeight="medium"
            noWrap
            sx={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {contextLabel}
          </Typography>
          {/* Trust Boundary */}
          {currentThreat.trustBoundaryName && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0 }}
              noWrap
            >
              · {currentThreat.trustBoundaryName}
            </Typography>
          )}
          {/* Relevance chip */}
          <Chip
            label={t(`tabs.threats.eval.${local.relevance}`, {
              defaultValue: local.relevance,
            })}
            size="small"
            sx={{
              flexShrink: 0,
              height: 20,
              fontSize: 10,
              fontWeight: "medium",
              bgcolor: RELEVANCE_COLORS[local.relevance],
              color: "white",
            }}
          />
          {/* Source badge */}
          <SourceBadge
            source={currentThreat.source}
            initialImpact={currentThreat.initialImpact}
            chipStyle
          />
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", overflow: "hidden" }}>
        {/* ── Left: threat list sidebar ─────────────────────────────────── */}
        <Box
          sx={{
            width: 240,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.default",
          }}
        >
          {/* Sticky header */}
          <Box
            sx={{
              px: 2,
              pt: 1.5,
              pb: 1,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.default",
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" fontWeight="bold" display="block">
              {currentThreat.trustBoundaryName ??
                t("tabs.threats.dialog.threatList", {
                  defaultValue: "Threats in this group",
                })}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 0.25 }}
            >
              {t("tabs.threats.eval.progress", {
                reviewed: reviewedCount,
                total: sortedThreats.length,
                defaultValue: `${reviewedCount} / ${sortedThreats.length} reviewed`,
              })}
            </Typography>
          </Box>
          {/* Scrollable list */}
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <List dense disablePadding>
              {sortedThreats.map((threat, index) => {
                const relevanceColor =
                  RELEVANCE_COLORS[threat.relevance ?? "unrated"];
                const isActive = index === currentIndex;
                const impactLevel = getThreatImpact(threat, assetDataRef);
                const impactColors = impactLevel
                  ? IMPACT_CHIP_COLORS[impactLevel]
                  : null;
                return (
                  <ListItemButton
                    key={threat.id}
                    selected={isActive}
                    ref={(node) => {
                      if (node && isActive) {
                        requestAnimationFrame(() => {
                          node.scrollIntoView({
                            block: "nearest",
                            behavior: "auto",
                          });
                        });
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
                      "&.Mui-selected:hover": {
                        bgcolor: "primary.100",
                      },
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
                        label={t(`tabs.threats.eval.${threat.relevance}`, {
                          defaultValue: threat.relevance,
                        })}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: 10,
                          bgcolor: relevanceColor,
                          color: "white",
                        }}
                      />
                      {impactColors && impactLevel && (
                        <Chip
                          label={impactLevel}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 10,
                            bgcolor: impactColors.bg,
                            border: `1px solid ${impactColors.border}`,
                            color: impactColors.color,
                            fontWeight: "bold",
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
                            label={threat.strideCategory}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 10,
                              bgcolor: STRIDE_COLORS[threat.strideCategory],
                              color: "white",
                            }}
                          />
                          <Typography variant="caption" noWrap>
                            {threat.id}
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
                          {threat.threatDescription || "—"}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Box>

        {/* ── Right: threat detail ──────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
          <Stack spacing={2.5}>
            {/* CAUSE — read-only, amber */}
            {currentThreat.causeDescription && (
              <Box
                sx={{
                  bgcolor: "#fef3c7",
                  border: 1,
                  borderColor: "#f59e0b",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <CauseIcon
                    fontSize="small"
                    sx={{ color: "warning.700", mt: 0.25, flexShrink: 0 }}
                  />
                  <Box>
                    <Typography
                      variant="caption"
                      color="warning.800"
                      fontWeight="medium"
                      display="block"
                    >
                      {t("tabs.threats.dialog.cause", {
                        defaultValue: "Root Cause",
                      })}
                    </Typography>
                    <Typography variant="body2" color="warning.900">
                      {currentThreat.causeDescription}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* THREAT DESCRIPTION — blue callout: "What is threatened?" */}
            <Box
              sx={{
                bgcolor: "#eff6ff",
                border: 1,
                borderColor: "#3b82f6",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 0.75 }}
              >
                <Typography
                  variant="caption"
                  color="#1d4ed8"
                  fontWeight="bold"
                  sx={{
                    flexGrow: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t("tabs.threats.dialog.threat", { defaultValue: "Threat" })}
                </Typography>
                {local.isTextCustomized && (
                  <Chip
                    label={t("tabs.threats.dialog.customized", {
                      defaultValue: "customized",
                    })}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                )}
                <Tooltip
                  title={
                    editingThreat
                      ? t("tabs.threats.dialog.stopEdit", {
                          defaultValue: "Stop editing",
                        })
                      : t("tabs.threats.dialog.edit", { defaultValue: "Edit" })
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => setEditingThreat((v) => !v)}
                    color={editingThreat ? "primary" : "default"}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              {editingThreat ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  value={local.threatDescription}
                  onChange={(e) =>
                    patch({
                      threatDescription: e.target.value,
                      isTextCustomized: true,
                    })
                  }
                />
              ) : (
                <Typography variant="body2" color="#1e3a5f" fontWeight="medium">
                  {local.threatDescription || "—"}
                </Typography>
              )}
            </Box>

            {/* ATTACK DESCRIPTION — slate callout: "How is it attacked?" */}
            <Box
              sx={{
                bgcolor: "#f8fafc",
                borderLeft: "3px solid #94a3b8",
                borderRadius: "0 4px 4px 0",
                p: 1.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 0.75 }}
              >
                <Typography
                  variant="caption"
                  color="#475569"
                  fontWeight="bold"
                  sx={{
                    flexGrow: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t("tabs.threats.dialog.attack", {
                    defaultValue: "Attack Scenario",
                  })}
                </Typography>
                <Tooltip
                  title={
                    editingAttack
                      ? t("tabs.threats.dialog.stopEdit", {
                          defaultValue: "Stop editing",
                        })
                      : t("tabs.threats.dialog.edit", { defaultValue: "Edit" })
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => setEditingAttack((v) => !v)}
                    color={editingAttack ? "primary" : "default"}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              {editingAttack ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  value={local.attackDescription}
                  onChange={(e) =>
                    patch({
                      attackDescription: e.target.value,
                      isTextCustomized: true,
                    })
                  }
                />
              ) : (
                <Typography variant="body2" color="#334155" fontStyle="italic">
                  {local.attackDescription || "—"}
                </Typography>
              )}
            </Box>

            <Divider />

            {/* LINKED ASSETS */}
            {assetDataRef &&
              currentThreat.linkedAssetIds?.length > 0 &&
              (() => {
                const linkedAssets = currentThreat.linkedAssetIds
                  .map((id) => assetDataRef.assets.find((a) => a.id === id))
                  .filter((a): a is AssetReference => Boolean(a));
                const impactLevel = getThreatImpact(
                  currentThreat,
                  assetDataRef,
                );
                const impactColors = impactLevel
                  ? IMPACT_CHIP_COLORS[impactLevel]
                  : null;
                return (
                  <Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mb: 0.75 }}
                    >
                      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                        Assets
                      </Typography>
                      {impactColors && impactLevel && (
                        <Chip
                          label={impactLevel}
                          size="small"
                          sx={{
                            bgcolor: impactColors.bg,
                            border: `1px solid ${impactColors.border}`,
                            color: impactColors.color,
                            fontWeight: "bold",
                            height: 20,
                            fontSize: 11,
                          }}
                        />
                      )}
                    </Stack>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {linkedAssets.map((asset) => {
                        const aImpact = asset.aggregatedImpact as
                          | ImpactLevel
                          | undefined;
                        const aColors = aImpact
                          ? IMPACT_CHIP_COLORS[aImpact]
                          : null;
                        const hasSafety =
                          asset.physicalImpact === "fatality" ||
                          asset.physicalImpact === "irreversible_injury";
                        return (
                          <Chip
                            key={asset.id}
                            label={`${asset.name}${hasSafety ? " ⚠" : ""}`}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: 11,
                              height: 22,
                              ...(aColors
                                ? {
                                    borderColor: aColors.border,
                                    color: aColors.color,
                                  }
                                : {}),
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })()}

            <Divider />

            {/* PROPOSED MITIGATIONS */}
            <Box
              sx={{
                bgcolor: "grey.50",
                border: 1,
                borderColor: "grey.200",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                  {t("tabs.threats.dialog.proposedMitigations", {
                    defaultValue: "Proposed Mitigations",
                  })}
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAddingMitigation(true)}
                  disabled={addingMitigation}
                >
                  {t("tabs.threats.dialog.addMitigation", {
                    defaultValue: "Add custom mitigation",
                  })}
                </Button>
              </Stack>

              <Stack spacing={1}>
                {resolvedMitigations.map((m, index) => (
                  <Box
                    key={index}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                      bgcolor: "background.paper",
                    }}
                  >
                    {m.isCustom ? (
                      <Typography variant="body2" fontStyle="italic">
                        [custom] {m.notes}
                      </Typography>
                    ) : (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="body2" fontWeight="medium">
                            {m.text}
                          </Typography>
                          <MitigationCoverageBadge
                            coverage={mitigationCoverage.get(m.id ?? "")}
                          />
                        </Box>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder={t(
                            "tabs.threats.dialog.notePlaceholder",
                            {
                              defaultValue: "Optional note for audit trail...",
                            },
                          )}
                          value={m.notes ?? ""}
                          onChange={(e) =>
                            updateMitigationNote(index, e.target.value)
                          }
                          sx={{ mt: 0.25 }}
                          variant="standard"
                        />
                      </>
                    )}
                  </Box>
                ))}

                {addingMitigation && (
                  <Box
                    sx={{
                      border: 1,
                      borderColor: "primary.main",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <TextField
                      autoFocus
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      placeholder={t(
                        "tabs.threats.dialog.mitigationPlaceholder",
                        {
                          defaultValue: "Describe the mitigation...",
                        },
                      )}
                      value={newMitigationText}
                      onChange={(e) => setNewMitigationText(e.target.value)}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                      sx={{ mt: 1 }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          setAddingMitigation(false);
                          setNewMitigationText("");
                        }}
                      >
                        {t("common.cancel", { defaultValue: "Cancel" })}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!newMitigationText.trim()}
                        onClick={confirmAddMitigation}
                      >
                        {t("common.add", { defaultValue: "Add" })}
                      </Button>
                    </Stack>
                  </Box>
                )}

                {resolvedMitigations.length === 0 && !addingMitigation && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontStyle="italic"
                  >
                    —
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* PROPOSED VERIFICATIONS */}
            <Box
              sx={{
                bgcolor: "grey.50",
                border: 1,
                borderColor: "grey.200",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2" component="span">
                    {t("tabs.threats.dialog.proposedVerifications", {
                      defaultValue: "Proposed Verifications",
                    })}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    (
                    {t("tabs.threats.dialog.followsMitigations", {
                      defaultValue: "follow mitigations automatically",
                    })}
                    )
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAddingVerification(true)}
                  disabled={addingVerification}
                >
                  {t("tabs.threats.dialog.addVerification", {
                    defaultValue: "Add custom verification",
                  })}
                </Button>
              </Stack>

              <Stack spacing={1}>
                {resolvedVerifications.map((v, index) => (
                  <Box
                    key={index}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    {v.isCustom ? (
                      <Typography variant="body2" fontStyle="italic">
                        {v.notes}
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="body2" fontWeight="medium">
                          {v.text}
                        </Typography>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder={t(
                            "tabs.threats.dialog.notePlaceholder",
                            {
                              defaultValue: "Optional note for audit trail...",
                            },
                          )}
                          value={v.notes ?? ""}
                          onChange={(e) =>
                            updateVerificationNote(index, e.target.value)
                          }
                          sx={{ mt: 0.75 }}
                          variant="standard"
                        />
                      </>
                    )}
                  </Box>
                ))}

                {addingVerification && (
                  <Box
                    sx={{
                      border: 1,
                      borderColor: "primary.main",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <TextField
                      autoFocus
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      placeholder={t(
                        "tabs.threats.dialog.verificationPlaceholder",
                        {
                          defaultValue: "Describe the verification...",
                        },
                      )}
                      value={newVerificationText}
                      onChange={(e) => setNewVerificationText(e.target.value)}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                      sx={{ mt: 1 }}
                    >
                      <Button
                        size="small"
                        onClick={() => {
                          setAddingVerification(false);
                          setNewVerificationText("");
                        }}
                      >
                        {t("common.cancel", { defaultValue: "Cancel" })}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!newVerificationText.trim()}
                        onClick={confirmAddVerification}
                      >
                        {t("common.add", { defaultValue: "Add" })}
                      </Button>
                    </Stack>
                  </Box>
                )}

                {resolvedVerifications.length === 0 && !addingVerification && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontStyle="italic"
                  >
                    —
                  </Typography>
                )}
              </Stack>
            </Box>

            {/* EVAL NOTE */}
            <TextField
              size="small"
              fullWidth
              label={t("tabs.threats.dialog.noteLabel", {
                defaultValue: "Note",
              })}
              placeholder={t("tabs.threats.dialog.notePlaceholder", {
                defaultValue: "Optional note for audit trail...",
              })}
              value={local.evalNote}
              onChange={(e) => patch({ evalNote: e.target.value })}
              multiline
              minRows={3}
              maxRows={6}
            />

            {/* THREAT ACTOR — collapsed by default */}
            {configuration.showThreatActor && (
              <Accordion
                disableGutters
                elevation={0}
                sx={{ border: 1, borderColor: "divider" }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">
                    {t("tabs.threats.dialog.advancedSection", {
                      defaultValue: "Threat Actor",
                    })}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControl size="small" fullWidth>
                    <InputLabel>
                      {t("tabs.threats.threatActor", {
                        defaultValue: "Threat Actor",
                      })}
                    </InputLabel>
                    <Select
                      value={local.threatActor}
                      label={t("tabs.threats.threatActor", {
                        defaultValue: "Threat Actor",
                      })}
                      onChange={(e) =>
                        patch({
                          threatActor: e.target.value as ThreatActorType,
                        })
                      }
                    >
                      {THREAT_ACTORS.map((actor) => (
                        <MenuItem key={actor.type} value={actor.type}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Typography>
                              {t(
                                `tabs.threats.threatActors.${actor.type}.name`,
                                { defaultValue: actor.name },
                              )}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              —{" "}
                              {t(
                                `tabs.threats.threatActors.${actor.type}.description`,
                                { defaultValue: actor.description },
                              )}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        </Box>
      </DialogContent>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        {/* Left: navigation */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip
            title={t("tabs.threats.eval.prevThreat", {
              defaultValue: "Previous",
            })}
          >
            <span>
              <IconButton
                size="small"
                onClick={navigatePrev}
                disabled={currentIndex === 0}
              >
                <PrevIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 40, textAlign: "center" }}
          >
            {t("tabs.threats.eval.positionIndicator", {
              current: currentIndex + 1,
              total: sortedThreats.length,
              defaultValue: `${currentIndex + 1} / ${threats.length}`,
            })}
          </Typography>
        </Stack>

        {/* Right: actions */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<CloseIcon />}
            color="error"
            variant="outlined"
            onClick={handleDismiss}
          >
            {t("tabs.threats.eval.dismiss", { defaultValue: "Dismiss" })}
          </Button>
          <Button
            size="small"
            startIcon={<UncertainIcon />}
            color="warning"
            variant="outlined"
            onClick={handleMarkUncertain}
          >
            {t("tabs.threats.eval.markUncertain", {
              defaultValue: "Uncertain",
            })}
          </Button>
          <Button
            size="small"
            startIcon={<CheckIcon />}
            color="success"
            variant="outlined"
            endIcon={<NextIcon />}
            onClick={handleConfirm}
          >
            {t("tabs.threats.eval.confirmAndNext", { defaultValue: "Confirm" })}
          </Button>
          <Divider orientation="vertical" flexItem />
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              saveCurrentThreat();
              onClose();
            }}
          >
            {t("common.ok", { defaultValue: "OK" })}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};;

export default ThreatEvalDialog;