// ==================== THREAT EVAL DIALOG ====================
// Evaluation workspace for a group of threats (one accordion section).
// Opens on a specific threat, allows navigation through the full group.
// Three-level structure: Decision (required) → Annotation → Custom entries.

import { dismissalNeedsJustification } from "./threat-findings";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
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
  Autocomplete,
  ListSubheader,
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
  Delete as DeleteIcon,
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
import { CatalogEntryPicker, LinkToCatalogButton } from "./catalog-entry-picker";
import { ProjectMitigationForm } from "./project-mitigation-form";
import { useProjectMitigations } from "./project-mitigations-context";
import {
  isProjectMitigationId,
  type ProjectMitigationInput,
} from "../../services/project-mitigations";
import { useMitigationCatalogVersion } from "shared/hooks/use-mitigation-catalog-version";
import {
  addCatalogMitigation,
  addCatalogVerification,
  catalogMatchFor,
  linkDraftToCatalog,
} from "../../services/catalog-draft-ops";
import {
  MitigationCoverageBadge,
  STRIDE_COLORS,
  formatAssetLabel,
  isIrreversibleOrWorse,
} from "shared";
import { computeAllMitigationCoverage } from "shared/utils/mitigation-coverage";
import { ReviewBadge, SourceBadge, compareThreatsByLabel } from "../../components/shared/threat-table-utils";
import { releaseRetainedThreat } from "../../services/threat-generation-drift";
import { ElementInfoButton } from "shared/components/element-info-button";

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
      isIrreversibleOrWorse(a.physicalImpact),
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

// ── Shared styling for the mitigation/verification item container ─────────
// Idle: white fill, neutral divider border.
// When a field inside gets focus: border turns light blue.
const editableItemBoxSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  p: 1.5,
  bgcolor: "background.paper",
  transition: "border-color 0.15s ease",
  "&:focus-within": {
    borderColor: "primary.light",
  },
} as const;

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
  /** ISO 21434 mode: relevance is asset-derived; overrides need a note. */
  isoMode?: boolean;
  /**
   * EN 50742 (patch 28): the relevant interfaces and flows. Dismissing a
   * threat on one of them ("not relevant") needs a justification — the
   * safety side may only be let off with a reason. Absent = no EN 50742 project.
   */
  en50742RelevantAnchorIds?: ReadonlySet<string>;
  /**
   * Read-only (threats of an imported component, design §7.1): everything
   * is shown, nothing can be changed — no edit / add / delete controls, the
   * fields are disabled, the footer only navigates and closes; onSave is
   * never called.
   */
  readOnly?: boolean;
  /** Shown above the details in read-only mode, e.g. where the threat comes from. */
  readOnlyNote?: string;
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
  relevanceOverridden: boolean;
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
    relevanceOverridden: threat.relevanceOverridden ?? false,
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


// ==================== ORDER AND NAVIGATION (manual test 2026-11-16) ====================
// The dialog lists the threats of a trust-boundary table like the table
// groups them — per element / flow, in natural order (DF-1 … DF-8, DF-10),
// inside by STRIDE and id — with a heading per element / flow. "Confirm"
// (and dismiss / uncertain) goes to the next open threat of the same element
// first, then on through the list.

/** The element / flow a threat belongs to — its group in the dialog. */
export function threatOwnerOf(threat: Threat): { key: string; label: string } {
  if (threat.dataFlow) {
    const id = threat.dataFlow.dataFlowId ?? "";
    return { key: `flow|${threat.dataFlow.connectionId ?? id}`, label: [id, threat.dataFlow.dataFlowName].filter(Boolean).join(" ") };
  }
  const el = threat.linkedElement;
  return {
    key: `el|${el?.elementId ?? ""}`,
    label: [el?.displayId, el?.elementName].filter(Boolean).join(" ") || (el?.elementId ?? ""),
  };
}

/** The threats in the dialog's order: by element / flow, STRIDE and id. */
export function dialogThreatOrder(threats: readonly Threat[]): Threat[] {
  return [...threats].sort(compareThreatsByLabel);
}

const isOpen = (t: Threat) => t.relevance === "unrated" || t.relevance === "uncertain";

/**
 * The index to go to after a decision on `current`: the next open threat of
 * the same element / flow (after it, then before it), then the next open one
 * after the group, then from the start; -1 when none is open.
 */
export function nextOpenIndex(list: readonly Threat[], current: number): number {
  const group = list[current] ? threatOwnerOf(list[current]).key : undefined;
  const inGroup = (i: number) => group !== undefined && threatOwnerOf(list[i]).key === group;
  const order = [
    ...list.map((_, i) => i).filter((i) => i > current && inGroup(i)),
    ...list.map((_, i) => i).filter((i) => i < current && inGroup(i)),
    ...list.map((_, i) => i).filter((i) => i > current && !inGroup(i)),
    ...list.map((_, i) => i).filter((i) => i < current && !inGroup(i)),
  ];
  return order.find((i) => isOpen(list[i])) ?? -1;
}

export const ThreatEvalDialog: React.FC<ThreatEvalDialogProps> = ({
  open,
  threats,
  initialIndex,
  configuration,
  assetDataRef,
  dfdData,
  onSave,
  onClose,
  isoMode = false,
  en50742RelevantAnchorIds,
  readOnly = false,
  readOnlyNote,
}) => {
  const { t } = useTranslation();

  // ── Navigation state ──────────────────────────────────────────────────────
  // In the table's grouping: per element / flow, natural order (manual test 2026-11-16).
  const sortedThreats = useMemo(() => dialogThreatOrder(threats), [threats]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const id = threats[initialIndex]?.id;
    const idx = dialogThreatOrder(threats).findIndex((t) => t.id === id);
    return idx >= 0 ? idx : 0;
  });
  const currentThreat = sortedThreats[currentIndex] ?? null;
  const [relevanceError, setRelevanceError] = useState<string | null>(null);

  // Guard against rapid repeated clicks causing IPC queue overflow
  const isProcessing = useRef(false);

  // ── Local edit state for the current threat ───────────────────────────────
  const [local, setLocal] = useState<LocalThreatState | null>(null);

  // ── Text edit: a draft while editing, taken over with ✓, dropped with ✗ ──
  // (0.20 manual test F2, 2026-11-26: the pen stayed a pen while editing and
  // every keystroke was taken over at once — no way to cancel). Only ✓ takes
  // a draft over; while one is open the footer's buttons are disabled until
  // ✓ or ✗ ends it (user decision).
  const [threatDraft, setThreatDraft] = useState<string | null>(null);
  const [attackDraft, setAttackDraft] = useState<string | null>(null);
  const editingText = threatDraft !== null || attackDraft !== null;

  // ── Add-entry forms ───────────────────────────────────────────────────────
  const [addingVerification, setAddingVerification] = useState(false);
  const [newVerificationText, setNewVerificationText] = useState("");

  // ── Init / reset on open or threat change ────────────────────────────────
  useEffect(() => {
    if (open && currentThreat) {
      setLocal(toLocalState(currentThreat));
      setThreatDraft(null);
      setAttackDraft(null);
      setAddingVerification(false);
      setNewVerificationText("");
    }
  }, [open, currentIndex]);

  // The threat the dialog was opened for — positioned on open and when another
  // threat is opened, NOT on every save: a save updates `threats`, and
  // re-positioning then sent "Confirm →" back to the opened threat (manual
  // test 2026-11-16).
  const openedId = threats[initialIndex]?.id;
  useEffect(() => {
    if (!open || !openedId) return;
    const sortedIdx = sortedThreats.findIndex((t) => t.id === openedId);
    if (sortedIdx >= 0) setCurrentIndex(sortedIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open / another opened threat only
  }, [open, openedId]);

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

  const deleteMitigation = (index: number) => {
    if (!local) return;
    const confirmed = window.confirm(
      t("tabs.threats.dialog.confirmDeleteMitigation", {
        defaultValue: "Delete this custom mitigation?",
      }),
    );
    if (!confirmed) return;
    patch({
      proposedMitigations: local.proposedMitigations.filter(
        (_, i) => i !== index,
      ),
    });
  };

  const deleteVerification = (index: number) => {
    if (!local) return;
    const confirmed = window.confirm(
      t("tabs.threats.dialog.confirmDeleteVerification", {
        defaultValue: "Delete this custom verification?",
      }),
    );
    if (!confirmed) return;
    patch({
      proposedVerifications: local.proposedVerifications.filter(
        (_, i) => i !== index,
      ),
    });
  };

  // ── Catalog entries on an analyst-authored threat (CM-1) ──────────────────
  // Stored as { id } so the closed loop sees them. Only manual threats: a
  // generated threat's catalog list is rebuilt by its template.
  const isManual = currentThreat?.source === "manual";

  // Project mitigations M-C-nnn (CM-3): new, convert free text, edit. On any
  // threat — they are the analyst's choice and survive regeneration.
  const projectMitigations = useProjectMitigations();
  const [pmForm, setPmForm] = useState<
    | null
    | { mode: "new" }
    | { mode: "convert"; index: number; text: string }
    | { mode: "edit"; id: string }
  >(null);
  const pmEntry = pmForm?.mode === "edit"
    ? projectMitigations?.entries.find((e) => e.id === pmForm.id)
    : undefined;
  const pmInitial: Partial<ProjectMitigationInput> | undefined =
    pmForm?.mode === "edit" && pmEntry
      ? pmEntry
      : pmForm?.mode === "convert"
        ? { text: pmForm.text, strideCategory: currentThreat?.strideCategory }
        : { strideCategory: currentThreat?.strideCategory };

  const savePmForm = (input: ProjectMitigationInput) => {
    if (!projectMitigations || !pmForm || !local) return;
    if (pmForm.mode === "edit") {
      projectMitigations.update(pmForm.id, input);
    } else {
      const id = projectMitigations.add(input);
      if (pmForm.mode === "convert") {
        linkMitigation(pmForm.index, id);
      } else {
        addMitigationFromCatalog(id);
      }
    }
    setPmForm(null);
  };

  const addMitigationFromCatalog = (id: string) => {
    if (!local) return;
    const next = addCatalogMitigation(local.proposedMitigations, local.proposedVerifications, id);
    patch({ proposedMitigations: next.mitigations, proposedVerifications: next.verifications });
  };

  const addVerificationFromCatalog = (id: string) => {
    if (!local) return;
    patch({ proposedVerifications: addCatalogVerification(local.proposedVerifications, id) });
  };

  const linkMitigation = (index: number, id: string) => {
    if (!local) return;
    patch({ proposedMitigations: linkDraftToCatalog(local.proposedMitigations, index, id) });
  };

  const linkVerification = (index: number, id: string) => {
    if (!local) return;
    patch({ proposedVerifications: linkDraftToCatalog(local.proposedVerifications, index, id) });
  };

  const removeCatalogEntry = (kind: "mitigation" | "verification", index: number) => {
    if (!local) return;
    if (kind === "mitigation") {
      patch({ proposedMitigations: local.proposedMitigations.filter((_, i) => i !== index) });
    } else {
      patch({ proposedVerifications: local.proposedVerifications.filter((_, i) => i !== index) });
    }
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
      relevanceOverridden: s.relevanceOverridden,
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
    if (!readOnly && local && currentThreat && isDirtyState(local, currentThreat)) {
      onSave(currentThreat.id, buildUpdates());
    }
    setCurrentIndex(index);
  };

  const navigatePrev = () => {
    if (currentIndex > 0) navigateTo(currentIndex - 1);
  };

  // Advance to the next open threat — this element / flow first, then on
  // through the list; if none remains, close.
  const navigateNextUnrated = () => {
    const next = nextOpenIndex(sortedThreats, currentIndex);
    if (next !== -1) {
      navigateTo(next);
    } else {
      onClose();
    }
  };

  // ── Footer action handlers ────────────────────────────────────────────────

  const handleSave = () => saveCurrentThreat();

  // Asset-derived relevance (ISO 21434): a threat scenario is relevant iff it
  // relates to an asset. Deviating from this needs a justification.
  const applyRelevance = (rel: ThreatRelevance) => {
    if (isProcessing.current) return;
    const assetDerived: ThreatRelevance =
      (currentThreat?.linkedAssetIds?.length ?? 0) > 0
        ? "relevant"
        : "not_relevant";
    // "uncertain" is a transient parking state — allowed without a note.
    const deviates = rel !== assetDerived && rel !== "uncertain";
    if (isoMode && deviates && !local?.evalNote.trim()) {
      setRelevanceError(
        t("tabs.threats.dialog.overrideNeedsNote", {
          defaultValue:
            "A justification is required to deviate from the asset-derived relevance.",
        }),
      );
      return;
    }
    // EN 50742: a threat on a relevant interface / flow is dismissed only
    // with a reason — "won't" in the risk no longer lifts its SRSL rows.
    if (
      rel === "not_relevant" &&
      currentThreat &&
      dismissalNeedsJustification(currentThreat, en50742RelevantAnchorIds) &&
      !local?.evalNote.trim()
    ) {
      setRelevanceError(
        t("tabs.threats.dialog.en50742DismissNeedsNote", {
          defaultValue:
            "This threat sits on an EN 50742 relevant interface or data flow — note why it does not apply before dismissing it.",
        }),
      );
      return;
    }
    setRelevanceError(null);
    isProcessing.current = true;
    saveCurrentThreat({
      relevance: rel,
      relevanceOverridden: isoMode && rel !== assetDerived,
    });
    navigateNextUnrated();
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  };

  const handleConfirm = () => applyRelevance("relevant");
  const handleDismiss = () => applyRelevance("not_relevant");
  const handleMarkUncertain = () => applyRelevance("uncertain");

  // ── Mitigation coverage (Rules of Hooks: must be before early return) ───────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogVersion = useMitigationCatalogVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const threatCatalog = useMemo(() => getAllMitigations(), [catalogVersion]);

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
  // With the element's / flow's own id ("DS-3 Config Store"), so the analyst
  // knows which one it is without switching to the DFD (manual test 2026-11-24).
  const flow = currentThreat.dataFlow;
  const element = currentThreat.linkedElement;
  const contextLabel = hasInteraction && flow
    ? [flow.displayId || flow.dataFlowId, `${flow.sourceName} → ${flow.targetName}`].filter(Boolean).join(" ")
    : element
      ? [element.displayId, element.elementName].filter(Boolean).join(" ") || currentThreat.displayId
      : currentThreat.displayId;

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
            {currentThreat.displayId}
          </Typography>
          {/* Element / DataFlow — semantic context, fills available space */}
          <Typography
            variant="body2"
            fontWeight="medium"
            noWrap
            sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {contextLabel}
          </Typography>
          {/* the info right after the name ("P-1 MyProcess ⓘ"), the rest pushed right */}
          <Box sx={{ flexShrink: 0 }}>
            <ElementInfoButton
              target={
                hasInteraction && flow
                  ? { connectionId: flow.connectionId, flowDisplayId: flow.displayId || flow.dataFlowId }
                  : { elementId: element?.elementId }
              }
            />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
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
            retainedAt={currentThreat.retainedAfterRuleChange?.at}
            chipStyle
          />
          <ReviewBadge review={currentThreat.review} />
          {/* Undo a drift-review Keep — the threat returns to its generated
              source and reappears in the drift review if still not produced */}
          {currentThreat.retainedAfterRuleChange && !readOnly && (
            <Tooltip
              title={t("tabs.threats.drift.undoKeep.tooltip", {
                defaultValue:
                  "Treat as generated again. If the current rules still do not produce it, it reappears in the drift review; a regeneration would remove it.",
              })}
            >
              <Button
                size="small"
                sx={{ flexShrink: 0, py: 0, minWidth: 0, fontSize: 11 }}
                onClick={() => {
                  const updates = releaseRetainedThreat(currentThreat);
                  if (updates) onSave(currentThreat.id, updates);
                }}
              >
                {t("tabs.threats.drift.undoKeep.action", {
                  defaultValue: "Undo keep",
                })}
              </Button>
            </Tooltip>
          )}
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
                // A heading per element / flow, like the table's accordions.
                const owner = threatOwnerOf(threat);
                const heading =
                  index === 0 || threatOwnerOf(sortedThreats[index - 1]).key !== owner.key ? (
                    <ListSubheader
                      key={`heading-${owner.key}`}
                      disableSticky
                      data-testid="threat-dialog-group"
                      sx={{ lineHeight: "28px", fontSize: 11, fontWeight: 600, bgcolor: "background.default", px: 1.5 }}
                    >
                      {owner.label}
                    </ListSubheader>
                  ) : null;
                const relevanceColor =
                  RELEVANCE_COLORS[threat.relevance ?? "unrated"];
                const isActive = index === currentIndex;
                const impactLevel = getThreatImpact(threat, assetDataRef);
                const impactColors = impactLevel
                  ? IMPACT_CHIP_COLORS[impactLevel]
                  : null;
                return (
                  <React.Fragment key={threat.id}>
                  {heading}
                  <ListItemButton
                    data-testid="threat-dialog-item"
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
                            {threat.displayId}
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
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        </Box>

        {/* ── Right: threat detail ──────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
          {readOnly && (
            <Alert severity="info" sx={{ mb: 2 }} data-testid="threat-dialog-read-only">
              {readOnlyNote ??
                t("tabs.threats.dialog.readOnly", { defaultValue: "Read-only" })}
            </Alert>
          )}
          {/* Read-only: a disabled fieldset turns every field below off. */}
          <Box
            component="fieldset"
            disabled={readOnly}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
          >
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
                {!readOnly && (
                  <TextEditActions
                    editing={threatDraft !== null}
                    testId="threat-text"
                    onEdit={() => setThreatDraft(local.threatDescription ?? "")}
                    onSave={() => {
                      if (threatDraft !== null && threatDraft !== local.threatDescription) {
                        patch({ threatDescription: threatDraft, isTextCustomized: true });
                      }
                      setThreatDraft(null);
                    }}
                    onCancel={() => setThreatDraft(null)}
                  />
                )}
              </Stack>
              {threatDraft !== null ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  autoFocus
                  value={threatDraft}
                  onChange={(e) => setThreatDraft(e.target.value)}
                  inputProps={{ "data-testid": "threat-text-input" }}
                />
              ) : (
                <Typography variant="body2" color="#1e3a5f" fontWeight="medium" data-testid="threat-text-value">
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
                {!readOnly && (
                  <TextEditActions
                    editing={attackDraft !== null}
                    testId="attack-text"
                    onEdit={() => setAttackDraft(local.attackDescription ?? "")}
                    onSave={() => {
                      if (attackDraft !== null && attackDraft !== local.attackDescription) {
                        patch({ attackDescription: attackDraft, isTextCustomized: true });
                      }
                      setAttackDraft(null);
                    }}
                    onCancel={() => setAttackDraft(null)}
                  />
                )}
              </Stack>
              {attackDraft !== null ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  autoFocus
                  value={attackDraft}
                  onChange={(e) => setAttackDraft(e.target.value)}
                  inputProps={{ "data-testid": "attack-text-input" }}
                />
              ) : (
                <Typography variant="body2" color="#334155" fontStyle="italic" data-testid="attack-text-value">
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
                          isIrreversibleOrWorse(asset.physicalImpact);
                        return (
                          <Chip
                            key={asset.id}
                            label={`${formatAssetLabel(asset)}${hasSafety ? " ⚠" : ""}`}
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
                {/* No free-text mitigation any more (user 2026-10-30): a new
                    one is a project mitigation — tracked by id (report,
                    tickets, merge), with a DFD effect in the closed loop.
                    Free text written earlier stays editable and convertible. */}
                {projectMitigations && !readOnly && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setPmForm({ mode: "new" })}
                    data-testid="new-project-mitigation"
                  >
                    {t("tabs.threats.dialog.newProjectMitigation", {
                      defaultValue: "New project mitigation",
                    })}
                  </Button>
                )}
              </Stack>
              {!readOnly && (isManual || (projectMitigations?.entries.length ?? 0) > 0) && (
                <CatalogEntryPicker
                  kind="mitigation"
                  strideCategory={currentThreat.strideCategory}
                  presentIds={local.proposedMitigations.map((m) => m.id)}
                  onPick={addMitigationFromCatalog}
                  scope={isManual ? "all" : "project"}
                />
              )}

              <Stack spacing={1}>
                {resolvedMitigations.map((m, index) => (
                  <Box key={index} sx={editableItemBoxSx}>
                    {m.isCustom ? (
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={1}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          value={m.notes ?? ""}
                          onChange={(e) =>
                            updateMitigationNote(index, e.target.value)
                          }
                          placeholder={t(
                            "tabs.threats.dialog.mitigationPlaceholder",
                            {
                              defaultValue: "Describe the mitigation...",
                            },
                          )}
                        />
                        {!readOnly && <LinkToCatalogButton
                          kind="mitigation"
                          text={m.notes}
                          onLink={(id) => linkMitigation(index, id)}
                        />}
                        {projectMitigations && !readOnly && !!m.notes?.trim() && (
                          <Button
                            size="small"
                            variant="text"
                            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                            onClick={() => setPmForm({ mode: "convert", index, text: m.notes ?? "" })}
                            data-testid={`convert-mitigation-${index}`}
                          >
                            {t("tabs.threats.dialog.convertToProjectMitigation", {
                              defaultValue: "Convert to project mitigation",
                            })}
                          </Button>
                        )}
                        {!readOnly && (
                        <Tooltip
                          title={t("common.delete", {
                            defaultValue: "Delete",
                          })}
                        >
                          <IconButton
                            size="small"
                            onClick={() => deleteMitigation(index)}
                            sx={{ mt: 0.25 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        )}
                      </Stack>
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
                          {projectMitigations && !readOnly && isProjectMitigationId(m.id) && (
                            <Button
                              size="small"
                              onClick={() => setPmForm({ mode: "edit", id: m.id! })}
                              data-testid={`edit-project-mitigation-${m.id}`}
                            >
                              {t("common.edit", { defaultValue: "Edit" })}
                            </Button>
                          )}
                          {!readOnly && (isManual || isProjectMitigationId(m.id)) && (
                            <IconButton
                              size="small"
                              sx={{ ml: "auto" }}
                              onClick={() => removeCatalogEntry("mitigation", index)}
                              data-testid={`remove-catalog-${m.id}`}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
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
                          InputProps={{ disableUnderline: true }}
                        />
                      </>
                    )}
                  </Box>
                ))}

                {resolvedMitigations.length === 0 && (
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
                {!readOnly && (
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
                )}
              </Stack>
              {isManual && !readOnly && (
                <CatalogEntryPicker
                  kind="verification"
                  strideCategory={currentThreat.strideCategory}
                  presentIds={local.proposedVerifications.map((v) => v.id)}
                  onPick={addVerificationFromCatalog}
                />
              )}

              <Stack spacing={1}>
                {resolvedVerifications.map((v, index) => (
                  <Box key={index} sx={editableItemBoxSx}>
                    {v.isCustom ? (
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={1}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          value={v.notes ?? ""}
                          onChange={(e) =>
                            updateVerificationNote(index, e.target.value)
                          }
                          placeholder={t(
                            "tabs.threats.dialog.verificationPlaceholder",
                            {
                              defaultValue: "Describe the verification...",
                            },
                          )}
                        />
                        {!readOnly && <LinkToCatalogButton
                          kind="verification"
                          text={v.notes}
                          onLink={(id) => linkVerification(index, id)}
                        />}
                        {!readOnly && (
                        <Tooltip
                          title={t("common.delete", {
                            defaultValue: "Delete",
                          })}
                        >
                          <IconButton
                            size="small"
                            onClick={() => deleteVerification(index)}
                            sx={{ mt: 0.25 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        )}
                      </Stack>
                    ) : (
                      <>
                        <Stack direction="row" alignItems="center">
                          <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
                            {v.text}
                          </Typography>
                          {isManual && !readOnly && (
                            <IconButton
                              size="small"
                              onClick={() => removeCatalogEntry("verification", index)}
                              data-testid={`remove-catalog-${v.id}`}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
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
                          InputProps={{ disableUnderline: true }}
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

            {/* EVAL NOTE — read-only (imported threat): the component's
                decision with its note and, if overridden, the machine's
                decision with its rationale (I3); no ISO hint — the
                relevance comes from the component, not from the assets. */}
            {readOnly ? (
              <Box
                sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
                data-testid="threat-dialog-decisions"
              >
                <Typography variant="body2" data-testid="threat-dialog-decision-component">
                  <strong>
                    {t("tabs.threats.dialog.componentDecision", { defaultValue: "Component" })}:
                  </strong>{" "}
                  {t(`tabs.threats.eval.${currentThreat.importedOverride?.componentRelevance ?? local.relevance}`, {
                    defaultValue: currentThreat.importedOverride?.componentRelevance ?? local.relevance,
                  })}
                  {" — "}
                  {local.evalNote.trim() || "—"}
                </Typography>
                {currentThreat.importedOverride && (
                  <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="threat-dialog-decision-machine">
                    <strong>
                      {t("tabs.threats.dialog.machineDecision", { defaultValue: "This machine" })}:
                    </strong>{" "}
                    {t(`tabs.threats.eval.${local.relevance}`, { defaultValue: local.relevance })}
                    {" — "}
                    {currentThreat.importedOverride.rationale}
                  </Typography>
                )}
              </Box>
            ) : (
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
              onChange={(e) => {
                patch({ evalNote: e.target.value });
                if (relevanceError) setRelevanceError(null);
              }}
              error={!!relevanceError}
              helperText={
                relevanceError ??
                (isoMode
                  ? t("tabs.threats.dialog.relevanceAutoDerived", {
                      defaultValue:
                        "Relevance is derived from the asset relationship; overriding it needs a justification.",
                    })
                  : undefined)
              }
              multiline
              minRows={3}
              maxRows={6}
            />
            )}

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
                      disabled={readOnly}
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
                disabled={currentIndex === 0 || editingText}
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
        {readOnly ? (
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              onClick={() => navigateTo(currentIndex + 1)}
              disabled={currentIndex >= sortedThreats.length - 1}
              data-testid="threat-dialog-next"
            >
              <NextIcon fontSize="small" />
            </IconButton>
            <Button size="small" variant="contained" onClick={onClose}>
              {t("common.close", { defaultValue: "Close" })}
            </Button>
          </Stack>
        ) : (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<CloseIcon />}
            color="error"
            variant="outlined"
            onClick={handleDismiss}
            disabled={editingText}
          >
            {t("tabs.threats.eval.dismiss", { defaultValue: "Dismiss" })}
          </Button>
          <Button
            size="small"
            startIcon={<UncertainIcon />}
            color="warning"
            variant="outlined"
            onClick={handleMarkUncertain}
            disabled={editingText}
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
            disabled={editingText}
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
            disabled={editingText}
            data-testid="threat-dialog-ok"
          >
            {t("common.ok", { defaultValue: "OK" })}
          </Button>
        </Stack>
        )}
      </DialogActions>
      {projectMitigations && (
        <ProjectMitigationForm
          open={pmForm !== null}
          id={pmForm?.mode === "edit" ? pmForm.id : undefined}
          initial={pmInitial}
          onSave={savePmForm}
          onClose={() => setPmForm(null)}
        />
      )}
    </Dialog>
  );
};

export default ThreatEvalDialog;
/**
 * Pen while reading; ✓ (take the text over) and ✗ (drop it) while editing
 * (0.20 manual test F2, 2026-11-26).
 */
const TextEditActions: React.FC<{ editing: boolean; testId: string; onEdit: () => void; onSave: () => void; onCancel: () => void }> = ({
  editing,
  testId,
  onEdit,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  if (!editing) {
    return (
      <Tooltip title={t("tabs.threats.dialog.edit", { defaultValue: "Edit" })}>
        <IconButton size="small" onClick={onEdit} data-testid={`${testId}-edit`}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <>
      <Tooltip title={t("tabs.threats.dialog.applyEdit", { defaultValue: "Apply" })}>
        <IconButton size="small" color="primary" onClick={onSave} data-testid={`${testId}-save`}>
          <CheckIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={t("tabs.threats.dialog.cancelEdit", { defaultValue: "Cancel" })}>
        <IconButton size="small" onClick={onCancel} data-testid={`${testId}-cancel`}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
};
