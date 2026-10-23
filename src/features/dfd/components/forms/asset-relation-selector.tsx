// ==================== ASSET RELATION SELECTOR ====================
// Asset-centric UI for managing DFD-element → Asset relations.
//
// Chip layout per asset row:
//   [DA-001 · Name]  [reads]  [modifies ⚠]  [+]
//
// Clicking the asset chip OR any relation chip → opens the dialog for
// that asset where all relation types are toggled at once.
//
// Data model:
//   - Notes: once per asset (not per relation)
//   - Safety annotation: per relation
//   - is_an: exclusive — shown in its own section above

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "../shared/confirm-dialog";
import type {
  AssetRelation,
  InfraAccessesQualifier,
  PhysicalContactQualifier,
  ServiceUsesQualifier,
  SystemUsesQualifier,
} from "../../models/asset-relation-types";
import {
  getAssetGroupColor,
  getRelationTypeText,
} from "../../models/dfd-formatters";
import {
  hasQualifier,
  isIsAnRelation,
} from "../../models/asset-relation-types";
import {
  AnyAssetRelationType,
  AssetGroup,
  SAFETY_IMPACTS,
  SafetyAnnotation,
  safetyImpactI18nKey,
  worstSafetySeverity,
} from "shared";
import { getAllowedRelations } from "../../models/asset-constants";
import type { DFDElementType } from "../../models/dfd-types";

// ==================== PUBLIC TYPES ====================

export interface AvailableAsset {
  id: string;
  displayId: string;
  name: string;
  assetGroup: AssetGroup;
  protectionNeed?: string;
}

interface AssetRelationSelectorProps {
  assetRelations: AssetRelation[];
  elementType?: string;
  availableAssets: AvailableAsset[];
  onChange: (relations: AssetRelation[]) => void;
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== CONSTANTS ====================

const GROUP_LABEL: Record<AssetGroup, string> = {
  data: "Data Asset",
  function: "Function Asset",
  system: "System Asset",
  infrastructure: "Infrastructure Asset",
  process: "Process Asset",
  physical: "Physical Asset",
  service: "Service Asset",
  human: "Human Asset",
  environment: "Environment Asset",
};

const RELATIONS_BY_GROUP: Record<AssetGroup, AnyAssetRelationType[]> = {
  data: ["creates", "reads", "modifies", "deletes", "stores", "transports"],
  function: ["executes", "invokes", "implements", "monitors", "depends_on"],
  process: ["executes", "invokes", "terminates", "suspends", "monitors"],
  system: ["controls", "configures", "monitors", "uses", "depends_on"],
  infrastructure: ["accesses", "secures", "damages", "powers", "monitors"],
  physical: ["accesses", "damages", "secures", "monitors"],
  service: ["uses", "configures", "monitors", "depends_on"],
  human: [
    "endangers",
    "affects_safety",
    "affects_privacy",
    "identifies",
    "tracks",
    "exposes",
  ],
  environment: ["endangers"],
};


/**
 * Relation types an element may have to an asset of `group` (B15): the
 * element rules (getAllowedRelations) — the same rules the validator checks,
 * so the dialog cannot create a relation that is reported as invalid right
 * after saving. Without an element type: the group's list, as before.
 */
export function relationTypesFor(
  elementType: string | undefined,
  group: AssetGroup,
): AnyAssetRelationType[] {
  if (elementType) {
    try {
      return getAllowedRelations(elementType as DFDElementType, group) as AnyAssetRelationType[];
    } catch {
      return [];
    }
  }
  return ["is_an", ...RELATIONS_BY_GROUP[group]];
}

/** Groups an element may relate to at all (all groups without element type). */
export function groupsAllowedFor(elementType: string | undefined): AssetGroup[] {
  return [...ASSET_GROUPS, "environment" as AssetGroup].filter(
    (g) => relationTypesFor(elementType, g).length > 0,
  );
}

const SYSTEM_QUALIFIERS: { value: SystemUsesQualifier; label: string }[] = [
  { value: "api", label: "API / REST / RPC" },
  { value: "network", label: "Network" },
  { value: "local", label: "Local (in-process)" },
  { value: "authentication", label: "Authentication service" },
  { value: "authorization", label: "Authorization service" },
  { value: "storage", label: "Storage (DB / cache)" },
  { value: "computation", label: "Computation (ML, crypto)" },
  { value: "messaging", label: "Messaging / Queue" },
  { value: "configuration", label: "Configuration service" },
  { value: "monitoring", label: "Monitoring / Logging" },
  { value: "networking", label: "Networking (DNS, proxy)" },
];

const INFRA_QUALIFIERS: { value: InfraAccessesQualifier; label: string }[] = [
  { value: "on-site", label: "On-site — premises / facility access" },
  { value: "proximity", label: "Proximity — RFID / WiFi range" },
  { value: "internal", label: "Internal — inside enclosure / panel" },
];

const PHYSICAL_QUALIFIERS: {
  value: PhysicalContactQualifier;
  label: string;
}[] = [
  { value: "direct", label: "Direct — hands-on contact" },
  { value: "indirect", label: "Indirect — proximity / sensor" },
  { value: "remote", label: "Remote — networked component" },
];

const SERVICE_QUALIFIERS: { value: ServiceUsesQualifier; label: string }[] = [
  { value: "api", label: "API (REST / SOAP / gRPC)" },
  { value: "sdk", label: "SDK / Library" },
  { value: "webhook", label: "Webhook (event-based)" },
  { value: "managed", label: "Managed (no API access)" },
];

const EMPTY_SAFETY: SafetyAnnotation = { relevance: "none" };
const CREATE_NEW_ID = "__create_new__";
const ASSET_GROUPS: AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
  "process",
  "physical",
  "service",
  "human",
];

// ==================== DATA MODEL ====================
// Notes: per asset. Safety: per relation.

interface RelationConfig {
  qualifier: string;
  safety: SafetyAnnotation;
}

const DEFAULT_RELATION_CONFIG = (): RelationConfig => ({
  qualifier: "",
  safety: { ...EMPTY_SAFETY },
});

/** Map relationType → config (qualifier + safety) */
type RelationMap = Map<AnyAssetRelationType, RelationConfig>;

// ==================== HELPERS ====================

function extractRelationMap(
  relations: AssetRelation[],
  assetId: string,
): RelationMap {
  const map: RelationMap = new Map();
  for (const r of relations) {
    if (r.assetId !== assetId) continue;
    map.set(r.relationType, {
      qualifier: hasQualifier(r) ? r.qualifier : "",
      safety: r.safety ? { ...r.safety } : { ...EMPTY_SAFETY },
    });
  }
  return map;
}

function extractAssetNotes(
  relations: AssetRelation[],
  assetId: string,
): string {
  // Notes are stored on the first relation for this asset (all share the same notes)
  return relations.find((r) => r.assetId === assetId)?.notes ?? "";
}

function buildRelations(
  asset: AvailableAsset,
  map: RelationMap,
  notes: string,
): AssetRelation[] {
  const result: AssetRelation[] = [];
  const notesVal = notes.trim() || undefined;
  for (const [relationType, cfg] of map.entries()) {
    const shared = {
      assetId: asset.id,
      notes: notesVal,
      safety: cfg.safety.relevance !== "none" ? cfg.safety : undefined,
    };
    if (relationType === "is_an") {
      result.push({
        ...shared,
        relationType: "is_an",
        assetGroup: asset.assetGroup,
      });
    } else if (relationType === "uses" || relationType === "accesses") {
      // The group is the asset's (B15): service "uses" and physical
      // "accesses" were stored as system / infrastructure before.
      result.push({
        ...shared,
        relationType,
        assetGroup: asset.assetGroup,
        qualifier: cfg.qualifier,
      } as AssetRelation);
    } else {
      result.push({
        ...shared,
        relationType,
        assetGroup: asset.assetGroup,
      } as AssetRelation);
    }
  }
  return result;
}

/** Qualifier choices of a relation type for the asset's group (B15). */
export function qualifierOptionsFor(
  type: string,
  group: AssetGroup,
): { value: string; label: string }[] {
  if (type === "uses") return group === "service" ? SERVICE_QUALIFIERS : group === "system" ? SYSTEM_QUALIFIERS : [];
  if (type === "accesses")
    return group === "physical" ? PHYSICAL_QUALIFIERS : group === "infrastructure" ? INFRA_QUALIFIERS : [];
  return [];
}

function isMapValid(map: RelationMap, group: AssetGroup): boolean {
  if (map.size === 0) return false;
  for (const [type, cfg] of map.entries()) {
    // A qualifier is required where the group has choices, and must be one
    // of them (a system qualifier on a service "uses" counts as missing).
    const options = qualifierOptionsFor(type, group);
    if (options.length > 0 && !options.some((o) => o.value === cfg.qualifier))
      return false;
    if (
      type !== "is_an" &&
      cfg.safety.relevance === "direct" &&
      !cfg.safety.rationale
    )
      return false;
  }
  return true;
}

/** Highest safety severity for a set of relations */
function worstSafety(rels: AssetRelation[]): SafetyAnnotation["relevance"] {
  let worst: SafetyAnnotation["relevance"] = "none";
  for (const r of rels) {
    if (r.safety?.relevance === "direct")   return "direct";
    if (r.safety?.relevance === "indirect") worst = "indirect";
  }
  return worst;
}

function worstImpact(rels: AssetRelation[]): SafetyAnnotation["impact"] | undefined {
  if (!rels.some((r) => r.safety?.impact)) return undefined;
  return worstSafetySeverity(rels.map((r) => r.safety?.impact)) ?? "none";
}

// ==================== MAIN COMPONENT ====================

export const AssetRelationSelector: React.FC<AssetRelationSelectorProps> = ({
  assetRelations,
  elementType,
  availableAssets,
  onChange,
  onCreateAsset,
}) => {
  const { t } = useTranslation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAssetId, setDialogAssetId] = useState("");

  // Group relations by assetId, preserve insertion order
  const byAsset = useMemo(() => {
    const map = new Map<string, AssetRelation[]>();
    for (const r of assetRelations) {
      map.set(r.assetId, [...(map.get(r.assetId) ?? []), r]);
    }
    return map;
  }, [assetRelations]);

  const isAnAssetIds = useMemo(
    () => new Set(assetRelations.filter(isIsAnRelation).map((r) => r.assetId)),
    [assetRelations],
  );

  const usedAssetIds = useMemo(
    () => new Set(assetRelations.map((r) => r.assetId)),
    [assetRelations],
  );

  const openForAsset = useCallback((assetId: string) => {
    setDialogAssetId(assetId);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    (asset: AvailableAsset, map: RelationMap, notes: string) => {
      const others = assetRelations.filter((r) => r.assetId !== asset.id);
      onChange([...others, ...buildRelations(asset, map, notes)]);
      setDialogOpen(false);
    },
    [assetRelations, onChange],
  );

  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      onChange(assetRelations.filter((r) => r.assetId !== assetId));
      setDialogOpen(false);
    },
    [assetRelations, onChange],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // is_an rows
  const isAnRows = [...isAnAssetIds].map((assetId) => {
    const asset = availableAssets.find((a) => a.id === assetId);
    const rels = byAsset.get(assetId) ?? [];
    const colors = getAssetGroupColor(rels[0]?.assetGroup ?? "data");

    return (
      <Stack
        key={assetId}
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          py: 0.75,
          px: 1,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
          borderRadius: 1,
        }}
        onClick={() => openForAsset(assetId)}
      >
        {/* Asset name */}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontStyle: "italic" }}
        >
          [{asset?.displayId ?? assetId}] {asset?.name ?? assetId}
        </Typography>

        {/* is_an chip */}
        <Chip
          label="is_an"
          size="small"
          sx={{
            fontFamily: "monospace",
            fontStyle: "italic",
            fontSize: 10,
            bgcolor: colors.colorLight,
            color: colors.color,
            border: `1px solid ${colors.color}`,
          }}
        />
      </Stack>
    );
  });

  // Other asset rows: [AssetChip] [rel1] [rel2] …
  const otherRows = [...byAsset.entries()]
    .filter(([id]) => !isAnAssetIds.has(id))
    .map(([assetId, rels]) => {
      const asset = availableAssets.find((a) => a.id === assetId);
      const colors = getAssetGroupColor(rels[0]?.assetGroup ?? "data");
      const severity = worstSafety(rels);
      const impact = worstImpact(rels);
      const hasWarn = severity !== "none";

      return (
        <Stack
          key={assetId}
          spacing={0.5}
          sx={{
            py: 0.75,
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
            borderRadius: 1,
            px: 1,
          }}
          onClick={() => openForAsset(assetId)}
        >
          {/* Asset name with warning icon */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              [{asset?.displayId ?? assetId}] {asset?.name ?? assetId}
            </Typography>
            {hasWarn && (
              <WarningAmberIcon
                sx={{
                  fontSize: 14,
                  color: severity === "direct" ? "error.main" : "warning.main",
                }}
              />
            )}
          </Stack>

          {/* Relation chips below */}
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            sx={{ gap: 0.5 }}
          >
            {rels.map((r) => {
              const qualifier = hasQualifier(r) ? `[${r.qualifier}]` : "";
              const relSafety = r.safety?.relevance ?? "none";
              const isDirect = relSafety === "direct";
              const isIndirect = relSafety === "indirect";
              // B15: a stored relation the rules do not allow is marked.
              const notAllowed =
                !!asset &&
                !relationTypesFor(elementType, asset.assetGroup).includes(r.relationType);
              const tip = notAllowed
                ? t("tabs.dfd.element_description.assetRelations.notAllowedChip", {
                    defaultValue: "Not allowed for this element type — open to remove",
                  })
                : relSafety !== "none"
                  ? `Safety: ${relSafety}${r.safety?.impact ? ` · ${t(safetyImpactI18nKey(r.safety.impact))}` : ""}`
                  : "";
              return (
                <Tooltip
                  key={r.relationType}
                  title={tip}
                  disableHoverListener={!tip}
                  arrow
                >
                  <Chip
                    label={`${notAllowed ? "⚠ " : ""}${r.relationType}${qualifier}`}
                    size="small"
                    data-testid={notAllowed ? `asset-relation-not-allowed-${assetId}-${r.relationType}` : undefined}
                    sx={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      bgcolor: colors.colorLight,
                      color: colors.color,
                      border: `1px ${notAllowed ? "dashed" : "solid"} ${notAllowed || isDirect ? "red" : isIndirect ? "orange" : colors.color}`,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        </Stack>
      );
    });

  return (
    <Box>
      {/* is_an section */}
      {isAnAssetIds.size > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography
            variant="overline"
            sx={{ fontSize: 9, letterSpacing: 1.2, color: "text.secondary" }}
          >
            {t("tabs.dfd.element_description.assetRelations.isAnSection", {
              defaultValue: "Identity (is_an)",
            })}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 0.25 }}>
            {isAnRows}
          </Stack>
        </Box>
      )}

      {isAnAssetIds.size > 0 && byAsset.size > isAnAssetIds.size && (
        <Divider sx={{ my: 1 }} />
      )}

      {/* Asset Relations Section — always visible so user can add more */}
      <Stack spacing={0.75}>
        {otherRows}

        {/* Add button row */}
        <Box>
          {assetRelations.length === 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: "italic", mr: 1 }}
            >
              {t("tabs.dfd.element_description.assetRelations.empty", {
                defaultValue: "No asset relations defined.",
              })}
            </Typography>
          )}
          {groupsAllowedFor(elementType).length === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
              data-testid="asset-relation-none-allowed"
            >
              {t("tabs.dfd.element_description.assetRelations.noneAllowed", {
                defaultValue: "This element type cannot relate to assets.",
              })}
            </Typography>
          ) : (
          <Tooltip
            title={t(
              "tabs.dfd.element_description.assetRelations.addRelation",
              {
                defaultValue: "Add asset relation",
              },
            )}
          >
            <IconButton
              size="small"
              onClick={() => {
                setDialogAssetId("");
                setDialogOpen(true);
              }}
              sx={{
                width: 24,
                height: 24,
                border: "1px dashed",
                borderColor: "divider",
                color: "text.secondary",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                },
              }}
            >
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          )}
        </Box>
      </Stack>

      <AssetRelationDialog
        open={dialogOpen}
        initialAssetId={dialogAssetId}
        existingRelations={assetRelations}
        availableAssets={availableAssets}
        usedAssetIds={usedAssetIds}
        elementType={elementType}
        onCreateAsset={onCreateAsset}
        onSave={handleSave}
        onRemoveAsset={handleRemoveAsset}
        onClose={() => setDialogOpen(false)}
      />
    </Box>
  );
};

// ==================== DIALOG FOR ONE ELEMENT–ASSET PAIR ====================
// The same dialog as above, opened from outside for one asset (the asset
// graph, FR-E7): the result is the element's complete new relation list,
// computed exactly as the selector does it.

export interface ElementAssetRelationDialogProps {
  readonly open: boolean;
  readonly assetId: string;
  readonly elementType?: string;
  /** The element's current relations (all assets). */
  readonly relations: readonly AssetRelation[];
  readonly availableAssets: readonly AvailableAsset[];
  readonly onChange: (relations: AssetRelation[]) => void;
  readonly onClose: () => void;
}

export const ElementAssetRelationDialog: React.FC<ElementAssetRelationDialogProps> = ({
  open,
  assetId,
  elementType,
  relations,
  availableAssets,
  onChange,
  onClose,
}) => {
  const used = useMemo(() => new Set(relations.map((r) => r.assetId)), [relations]);
  return (
    <AssetRelationDialog
      open={open}
      initialAssetId={assetId}
      existingRelations={relations as AssetRelation[]}
      availableAssets={availableAssets as AvailableAsset[]}
      usedAssetIds={used}
      elementType={elementType}
      onSave={(asset, map, notes) => {
        const others = relations.filter((r) => r.assetId !== asset.id);
        onChange([...others, ...buildRelations(asset, map, notes)]);
        onClose();
      }}
      onRemoveAsset={(id) => {
        onChange(relations.filter((r) => r.assetId !== id));
        onClose();
      }}
      onClose={onClose}
    />
  );
};

// ==================== DIALOG ====================

interface AssetRelationDialogProps {
  open: boolean;
  initialAssetId: string;
  existingRelations: AssetRelation[];
  availableAssets: AvailableAsset[];
  usedAssetIds: Set<string>;
  /** Element type — the offered relation types follow its rules (B15). */
  elementType?: string;
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  onSave: (asset: AvailableAsset, map: RelationMap, notes: string) => void;
  onRemoveAsset: (assetId: string) => void;
  onClose: () => void;
}

const AssetRelationDialog: React.FC<AssetRelationDialogProps> = ({
  open,
  initialAssetId,
  existingRelations,
  availableAssets,
  usedAssetIds,
  elementType,
  onCreateAsset,
  onSave,
  onRemoveAsset,
  onClose,
}) => {
  const { t } = useTranslation();

  const [assetId, setAssetId] = useState(initialAssetId);
  const [relationMap, setRelationMap] = useState<RelationMap>(new Map());
  const [assetNotes, setAssetNotes] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<AnyAssetRelationType>>(
    new Set(),
  );
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetGroup, setNewAssetGroup] = useState<AssetGroup>("data");

  // Group-change warning: pending group the user wants to switch to
  const [pendingGroup, setPendingGroup] = useState<AssetGroup | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<AssetGroup>("data");

  const isCreatingNew = assetId === CREATE_NEW_ID;
  const isEditMode = !!initialAssetId;

  useEffect(() => {
    if (!open) return;
    setAssetId(initialAssetId);
    setRelationMap(extractRelationMap(existingRelations, initialAssetId));
    setAssetNotes(extractAssetNotes(existingRelations, initialAssetId));
    setExpandedTypes(new Set());
    setNewAssetName("");
    const groups = groupsAllowedFor(elementType);
    if (groups.length > 0 && !groups.includes(newAssetGroup)) setNewAssetGroup(groups[0]);
    // Auto-select first allowed group that has available assets
    const firstAvailableGroup = groups.find(
      (g) =>
        availableAssets.filter(
          (a) => !usedAssetIds.has(a.id) && a.assetGroup === g,
        ).length > 0,
    );
    if (firstAvailableGroup) setSelectedGroup(firstAvailableGroup);
  }, [open, initialAssetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAsset = isCreatingNew
    ? undefined
    : availableAssets.find((a) => a.id === assetId);
  const effectiveGroup: AssetGroup = isCreatingNew
    ? newAssetGroup
    : (selectedAsset?.assetGroup ?? "data");

  const availableTypes = useMemo<AnyAssetRelationType[]>(
    () => relationTypesFor(elementType, effectiveGroup),
    [effectiveGroup, elementType],
  );
  // Groups this element may relate to (asset tabs, new-asset group).
  const allowedGroups = useMemo(() => groupsAllowedFor(elementType), [elementType]);
  // Relations already stored that the rules do not allow (e.g. created
  // before B15 was fixed): shown, but they must be removed before saving.
  const notAllowed = [...relationMap.keys()].filter((type) => !availableTypes.includes(type));

  const isAnSelected = relationMap.has("is_an");

  const toggleType = useCallback((type: AnyAssetRelationType) => {
    setRelationMap((prev) => {
      const next = new Map(prev);
      if (next.has(type)) {
        next.delete(type);
        setExpandedTypes((s) => {
          const ns = new Set(s);
          ns.delete(type);
          return ns;
        });
      } else {
        if (type === "is_an") {
          next.clear();
          setExpandedTypes(new Set());
        } else {
          next.delete("is_an");
        }
        next.set(type, DEFAULT_RELATION_CONFIG());
        if (type !== "is_an") setExpandedTypes((s) => new Set([...s, type]));
      }
      return next;
    });
  }, []);

  const updateConfig = useCallback(
    (type: AnyAssetRelationType, patch: Partial<RelationConfig>) => {
      setRelationMap((prev) => {
        const next = new Map(prev);
        next.set(type, {
          ...(next.get(type) ?? DEFAULT_RELATION_CONFIG()),
          ...patch,
        });
        return next;
      });
    },
    [],
  );

  const handleConfirmNewAsset = useCallback(() => {
    if (!newAssetName.trim() || !onCreateAsset) return;
    const created = onCreateAsset(newAssetName.trim(), newAssetGroup);
    setAssetId(created.id);
    setRelationMap(new Map());
    setNewAssetName("");
  }, [newAssetName, newAssetGroup, onCreateAsset]);

  const asset = selectedAsset;
  const canSave =
    !!asset &&
    isMapValid(relationMap, effectiveGroup) &&
    !isCreatingNew &&
    notAllowed.length === 0;

  return (
    <>
      <ConfirmDialog
        open={pendingGroup !== null}
        title={t(
          "tabs.dfd.element_description.assetRelations.groupChange.title",
          {
            defaultValue: "Change Asset Group?",
          },
        )}
        message={t(
          "tabs.dfd.element_description.assetRelations.groupChange.warning",
          {
            defaultValue:
              "Changing the asset group will remove all currently selected relation types, as they are specific to the current group.",
          },
        )}
        confirmLabel={t(
          "tabs.dfd.element_description.assetRelations.groupChange.confirm",
          {
            defaultValue: "Change & clear relations",
          },
        )}
        confirmColor="warning"
        onCancel={() => setPendingGroup(null)}
        onConfirm={() => {
          if (pendingGroup) {
            setNewAssetGroup(pendingGroup);
            setRelationMap(new Map());
            setExpandedTypes(new Set());
          }
          setPendingGroup(null);
        }}
      />

      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEditMode
            ? t("tabs.dfd.element_description.assetRelations.editRelations", {
                defaultValue: "Edit Asset Relations",
              })
            : t("tabs.dfd.element_description.assetRelations.addRelation", {
                defaultValue: "Add Asset Relation",
              })}
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* ── Asset header / selector ─────────────── */}
            {isEditMode ? (
              <Paper
                variant="outlined"
                sx={{ p: 1.5, bgcolor: "action.hover" }}
              >
                {asset && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Asset
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {asset.displayId}&nbsp;·&nbsp;{asset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {GROUP_LABEL[asset.assetGroup]}
                    </Typography>
                  </>
                )}
              </Paper>
            ) : (
              <Box>
                {/* Group tabs — only show groups with available assets */}
                {(() => {
                  const groupsWithAssets = allowedGroups.filter(
                    (g) =>
                      availableAssets.filter(
                        (a) => !usedAssetIds.has(a.id) && a.assetGroup === g,
                      ).length > 0,
                  );
                  if (groupsWithAssets.length === 0) {
                    return (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: "italic", p: 1 }}
                      >
                        {t(
                          "tabs.dfd.element_description.assetRelations.asset.noAvailable",
                          {
                            defaultValue:
                              "No assets available. Create assets in the DFD Asset Panel first.",
                          },
                        )}
                      </Typography>
                    );
                  }
                  const assetsInGroup = availableAssets.filter(
                    (a) =>
                      !usedAssetIds.has(a.id) && a.assetGroup === selectedGroup,
                  );
                  return (
                    <Stack spacing={1.5}>
                      <Tabs
                        value={
                          groupsWithAssets.includes(selectedGroup)
                            ? selectedGroup
                            : groupsWithAssets[0]
                        }
                        onChange={(_, g) => {
                          setSelectedGroup(g);
                          setAssetId("");
                          setRelationMap(new Map());
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          borderBottom: 1,
                          borderColor: "divider",
                          minHeight: 36,
                        }}
                      >
                        {groupsWithAssets.map((g) => {
                          const count = availableAssets.filter(
                            (a) =>
                              !usedAssetIds.has(a.id) && a.assetGroup === g,
                          ).length;
                          const colors = getAssetGroupColor(g);
                          return (
                            <Tab
                              key={g}
                              value={g}
                              sx={{ minHeight: 36, py: 0.5, fontSize: 12 }}
                              label={
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  alignItems="center"
                                >
                                  <span>{GROUP_LABEL[g]}</span>
                                  <Chip
                                    label={count}
                                    size="small"
                                    sx={{
                                      height: 16,
                                      fontSize: 10,
                                      "& .MuiChip-label": { px: 0.5 },
                                      bgcolor:
                                        selectedGroup === g
                                          ? colors.colorLight
                                          : undefined,
                                      color:
                                        selectedGroup === g
                                          ? colors.color
                                          : undefined,
                                    }}
                                  />
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Tabs>

                      {/* Asset list for selected group */}
                      <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                        {assetsInGroup.length === 0 ? (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ p: 1, display: "block" }}
                          >
                            No available assets in this group
                          </Typography>
                        ) : (
                          <List dense disablePadding>
                            {assetsInGroup.map((a) => {
                              const isSelected = assetId === a.id;
                              const colors = getAssetGroupColor(a.assetGroup);
                              return (
                                <ListItem key={a.id} disablePadding>
                                  <ListItemButton
                                    selected={isSelected}
                                    onClick={() => {
                                      setAssetId(a.id);
                                      setRelationMap(new Map());
                                    }}
                                    sx={{
                                      py: 0.5,
                                      borderRadius: 0.5,
                                      "&.Mui-selected": {
                                        bgcolor: colors.colorLight,
                                      },
                                    }}
                                  >
                                    <ListItemText
                                      primary={
                                        <Stack
                                          direction="row"
                                          spacing={1}
                                          alignItems="center"
                                        >
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              fontFamily: "monospace",
                                              color: colors.color,
                                              minWidth: 52,
                                            }}
                                          >
                                            {a.displayId}
                                          </Typography>
                                          <Typography variant="body2">
                                            {a.name || (
                                              <em style={{ opacity: 0.5 }}>
                                                unnamed
                                              </em>
                                            )}
                                          </Typography>
                                        </Stack>
                                      }
                                    />
                                  </ListItemButton>
                                </ListItem>
                              );
                            })}
                          </List>
                        )}
                      </Box>
                    </Stack>
                  );
                })()}

                {/* Inline new-asset form */}
                {isCreatingNew && onCreateAsset && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      mt: 1,
                      borderColor: "primary.main",
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{ display: "block", mb: 1, fontWeight: 600 }}
                    >
                      {t(
                        "tabs.dfd.element_description.assetRelations.asset.newAsset.title",
                        {
                          defaultValue: "New Asset",
                        },
                      )}
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        label={t(
                          "tabs.dfd.element_description.assetRelations.asset.newAsset.name",
                          {
                            defaultValue: "Asset Name",
                          },
                        )}
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        size="small"
                        fullWidth
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newAssetName.trim())
                            handleConfirmNewAsset();
                        }}
                      />
                      <FormControl size="small" fullWidth>
                        <InputLabel>
                          {t(
                            "tabs.dfd.element_description.assetRelations.asset.newAsset.group",
                            {
                              defaultValue: "Asset Group",
                            },
                          )}
                        </InputLabel>
                        <Select
                          value={newAssetGroup}
                          onChange={(e) => {
                            const next = e.target.value as AssetGroup;
                            if (
                              next !== newAssetGroup &&
                              relationMap.size > 0
                            ) {
                              // Relations exist for the current group — warn before clearing
                              setPendingGroup(next);
                            } else {
                              setNewAssetGroup(next);
                            }
                          }}
                          label={t(
                            "tabs.dfd.element_description.assetRelations.asset.newAsset.group",
                            {
                              defaultValue: "Asset Group",
                            },
                          )}
                        >
                          {allowedGroups.map(
                            (g) => {
                              const colors = getAssetGroupColor(g);

                              return (
                                <MenuItem key={g} value={g}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                  >
                                    <Box
                                      sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        bgcolor: colors.color,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span>{GROUP_LABEL[g]}</span>
                                  </Stack>
                                </MenuItem>
                              );
                            },
                          )}
                        </Select>
                      </FormControl>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!newAssetName.trim()}
                        onClick={handleConfirmNewAsset}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        {t(
                          "tabs.dfd.element_description.assetRelations.asset.newAsset.confirm",
                          {
                            defaultValue: "Create & continue",
                          },
                        )}
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </Box>
            )}

            {/* ── Relation toggles + notes ─────────────── */}
            {assetId && !isCreatingNew && (
              <>
                {/* is_an — only where the element may be one (always in the
                    side panel; the asset graph restricts by element type) */}
                {availableTypes.includes("is_an") && (
                <>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: 9,
                      letterSpacing: 1.2,
                      color: "text.secondary",
                    }}
                  >
                    {t(
                      "tabs.dfd.element_description.assetRelations.isAnSection",
                      {
                        defaultValue: "Identity",
                      },
                    )}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {(() => {
                      const colors = getAssetGroupColor(effectiveGroup);
                      return (
                        <Chip
                          icon={
                            isAnSelected ? (
                              <CheckIcon sx={{ fontSize: 14 }} />
                            ) : undefined
                          }
                          label="is_an"
                          size="small"
                          onClick={() => toggleType("is_an")}
                          sx={{
                            fontFamily: "monospace",
                            fontStyle: "italic",
                            cursor: "pointer",
                            bgcolor: isAnSelected
                              ? colors.colorLight
                              : undefined,
                            color: isAnSelected
                              ? colors.color
                              : "text.secondary",
                            border: `1px solid ${isAnSelected ? colors.color : "transparent"}`,
                          }}
                        />
                      );
                    })()}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1.5 }}
                    >
                      {t(
                        "tabs.dfd.element_description.assetRelations.isAnDescription",
                        {
                          defaultValue:
                            "This element IS an instance — exclusive",
                        },
                      )}
                    </Typography>
                  </Box>
                </Box>

                <Divider>
                  <Typography variant="caption" color="text.secondary">
                    or
                  </Typography>
                </Divider>
                </>
                )}

                {/* Other relation type chips */}
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: 9,
                      letterSpacing: 1.2,
                      color: "text.secondary",
                    }}
                  >
                    {t(
                      "tabs.dfd.element_description.assetRelations.relationType.label",
                      {
                        defaultValue: "Relation Types",
                      },
                    )}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 0.75,
                      mt: 0.5,
                    }}
                  >
                    {availableTypes
                      .filter((type) => type !== "is_an")
                      .map((type) => {
                        const selected = relationMap.has(type);
                        const disabled = isAnSelected;
                        const colors = getAssetGroupColor(
                          effectiveGroup ?? "data",
                        );
                        const qualOptions = qualifierOptionsFor(type, effectiveGroup);
                        const missingQual =
                          selected &&
                          qualOptions.length > 0 &&
                          !qualOptions.some((o) => o.value === relationMap.get(type)?.qualifier);
                        return (
                          <Tooltip
                            key={type}
                            title={
                              disabled
                                ? "Disabled — is_an is exclusive"
                                : missingQual
                                  ? "Qualifier required"
                                  : ""
                            }
                            disableHoverListener={!disabled && !missingQual}
                          >
                            <Chip
                              icon={
                                selected && !missingQual ? (
                                  <CheckIcon sx={{ fontSize: 13 }} />
                                ) : undefined
                              }
                              label={type}
                              size="small"
                              onClick={() => !disabled && toggleType(type)}
                              sx={{
                                fontFamily: "monospace",
                                cursor: disabled ? "not-allowed" : "pointer",
                                bgcolor:
                                  selected && !missingQual
                                    ? colors.colorLight
                                    : undefined,
                                color:
                                  selected && !missingQual
                                    ? colors.color
                                    : disabled
                                      ? "text.disabled"
                                      : undefined,
                                border: `1px solid ${selected ? (missingQual ? "orange" : colors.color) : "transparent"}`,
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                  </Box>
                </Box>

                {notAllowed.length > 0 && (
                  <Alert severity="warning" data-testid="asset-relation-not-allowed">
                    {t(
                      "tabs.dfd.element_description.assetRelations.notAllowed",
                      {
                        defaultValue:
                          "Not allowed for a {{elementType}} and this asset: {{types}}. Remove it to save.",
                        elementType: elementType ?? "",
                        types: notAllowed.join(", "),
                      },
                    )}
                  </Alert>
                )}

                {/* Selected relation cards (safety per relation) */}
                {relationMap.size > 0 && (
                  <Stack spacing={1}>
                    <Typography
                      variant="overline"
                      sx={{
                        fontSize: 9,
                        letterSpacing: 1.2,
                        color: "text.secondary",
                      }}
                    >
                      {t(
                        "tabs.dfd.element_description.assetRelations.selectedRelations",
                        {
                          defaultValue: "Selected Relations",
                        },
                      )}
                    </Typography>
                    {[...relationMap.entries()].map(([type, cfg]) => (
                      <RelationDetailCard
                        key={type}
                        type={type}
                        config={cfg}
                        assetGroup={effectiveGroup}
                        expanded={expandedTypes.has(type)}
                        onToggleExpand={() =>
                          setExpandedTypes((prev) => {
                            const s = new Set(prev);
                            if (s.has(type)) s.delete(type);
                            else s.add(type);
                            return s;
                          })
                        }
                        onUpdate={(patch) => updateConfig(type, patch)}
                        onRemove={() => toggleType(type)}
                      />
                    ))}
                  </Stack>
                )}

                {/* Notes — once per asset */}
                <TextField
                  label={t(
                    "tabs.dfd.element_description.assetRelations.notes",
                    {
                      defaultValue: "Notes (optional)",
                    },
                  )}
                  placeholder={t(
                    "tabs.dfd.element_description.assetRelations.notesPlaceholder",
                    {
                      defaultValue:
                        "Notes about this asset in the context of this element…",
                    },
                  )}
                  value={assetNotes}
                  onChange={(e) => setAssetNotes(e.target.value)}
                  multiline
                  rows={2}
                  size="small"
                  fullWidth
                />
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            justifyContent: isEditMode ? "space-between" : "flex-end",
            px: 3,
            py: 1.5,
          }}
        >
          {isEditMode && (
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => onRemoveAsset(assetId)}
              size="small"
            >
              {t(
                "tabs.dfd.element_description.assetRelations.removeAllRelations",
                {
                  defaultValue: "Remove all",
                },
              )}
            </Button>
          )}
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose} size="small">
              {t("tabs.dfd.element_description.assetRelations.cancel", {
                defaultValue: "Cancel",
              })}
            </Button>
            <Button
              variant="contained"
              onClick={() => asset && onSave(asset, relationMap, assetNotes)}
              disabled={!canSave}
              size="small"
            >
              {t("tabs.dfd.element_description.assetRelations.save", {
                defaultValue: "Save",
              })}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ==================== RELATION DETAIL CARD ====================

interface RelationDetailCardProps {
  type: AnyAssetRelationType;
  config: RelationConfig;
  assetGroup: AssetGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<RelationConfig>) => void;
  onRemove: () => void;
}

const RelationDetailCard: React.FC<RelationDetailCardProps> = ({
  type,
  config,
  assetGroup,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}) => {
  const { t } = useTranslation();
  const colors = getAssetGroupColor(assetGroup ?? "data");
  const qualifierOptions = qualifierOptionsFor(type, assetGroup);
  const needsQualifier = qualifierOptions.length > 0;
  // A stored qualifier from another group (before B15) counts as missing.
  const qualifierValid = qualifierOptions.some((o) => o.value === config.qualifier);
  const hasSafety = config.safety.relevance !== "none";

  if (type === "is_an") {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 1.25, borderColor: colors.color, bgcolor: colors.colorLight }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              fontStyle: "italic",
              color: colors.color,
            }}
          >
            is_an
          </Typography>
          <Tooltip
            title={t("tabs.dfd.element_description.assetRelations.deselect", {
              defaultValue: "Deselect",
            })}
          >
            <IconButton size="small" onClick={onRemove}>
              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: expanded ? colors.color : "divider",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.5,
          py: 0.75,
          bgcolor: expanded ? colors.colorLight : undefined,
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
      >
        <Typography
          variant="body2"
          sx={{
            fontFamily: "monospace",
            color: colors.color,
            fontWeight: expanded ? 600 : 400,
            flexGrow: 1,
          }}
        >
          {type}
          {config.qualifier && (
            <Box component="span" sx={{ ml: 0.5, opacity: 0.7 }}>
              [{config.qualifier}]
            </Box>
          )}
          {hasSafety && (
            <Box
              component="span"
              sx={{
                ml: 0.75,
                fontSize: 11,
                color:
                  config.safety.relevance === "direct"
                    ? "error.main"
                    : "warning.main",
              }}
            >
              ⚠ {config.safety.relevance}
              {config.safety.impact &&
                ` · ${t(safetyImpactI18nKey(config.safety.impact))}`}
            </Box>
          )}
          {needsQualifier && !qualifierValid && (
            <Box
              component="span"
              sx={{ ml: 0.75, color: "warning.main", fontSize: 11 }}
            >
              qualifier required
            </Box>
          )}
        </Typography>
        <Tooltip
          title={t("tabs.dfd.element_description.assetRelations.deselect", {
            defaultValue: "Deselect",
          })}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            color: "text.secondary",
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </Stack>

      {expanded && (
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
          <Stack spacing={1.5}>
            {needsQualifier && (
              <FormControl required size="small" fullWidth>
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.assetRelations.qualifier.label",
                    {
                      defaultValue: "Qualifier",
                    },
                  )}
                </InputLabel>
                <Select
                  value={qualifierValid ? config.qualifier : ""}
                  onChange={(e) => onUpdate({ qualifier: e.target.value })}
                  label={t(
                    "tabs.dfd.element_description.assetRelations.qualifier.label",
                    {
                      defaultValue: "Qualifier",
                    },
                  )}
                  error={!qualifierValid}
                >
                  {qualifierOptions.map((q) => (
                    <MenuItem key={q.value} value={q.value}>
                      <Box
                        component="span"
                        sx={{ fontFamily: "monospace", mr: 1 }}
                      >
                        {q.value}
                      </Box>
                      <Box
                        component="span"
                        sx={{ color: "text.secondary", fontSize: 12 }}
                      >
                        — {q.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Safety annotation per relation */}
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                "&:before": { display: "none" },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    {t(
                      "tabs.dfd.element_description.assetRelations.safetyAnnotation.title",
                      {
                        defaultValue: "Safety Annotation",
                      },
                    )}
                  </Typography>
                  {config.safety.relevance !== "none" && (
                    <Chip
                      label={config.safety.relevance}
                      size="small"
                      color={
                        config.safety.relevance === "direct"
                          ? "error"
                          : "warning"
                      }
                    />
                  )}
                  {config.safety.impact && config.safety.impact !== "none" && (
                    <Chip
                      label={t(safetyImpactI18nKey(config.safety.impact))}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <SafetyAnnotationForm
                  safety={config.safety}
                  assetGroup={assetGroup}
                  onChange={(s) => onUpdate({ safety: s })}
                />
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Box>
      )}
    </Paper>
  );
};

// ==================== SAFETY ANNOTATION FORM ====================

interface SafetyAnnotationFormProps {
  safety: SafetyAnnotation;
  assetGroup: AssetGroup;
  onChange: (safety: SafetyAnnotation) => void;
}

const SafetyAnnotationForm: React.FC<SafetyAnnotationFormProps> = ({
  safety,
  assetGroup,
  onChange,
}) => {
  const { t } = useTranslation();
  const set = (patch: Partial<SafetyAnnotation>) =>
    onChange({ ...safety, ...patch });

  return (
    <Stack spacing={1.5}>
      <FormControl size="small" fullWidth>
        <InputLabel>
          {t(
            "tabs.dfd.element_description.assetRelations.safetyAnnotation.relevance",
            {
              defaultValue: "Safety Relevance",
            },
          )}
        </InputLabel>
        <Select
          value={safety.relevance}
          onChange={(e) =>
            set({ relevance: e.target.value as SafetyAnnotation["relevance"] })
          }
          label={t(
            "tabs.dfd.element_description.assetRelations.safetyAnnotation.relevance",
            {
              defaultValue: "Safety Relevance",
            },
          )}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="indirect">Indirect — systemic / cascading</MenuItem>
          <MenuItem value="direct">Direct — controls physical action</MenuItem>
        </Select>
      </FormControl>

      {safety.relevance !== "none" && (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.assetRelations.safetyAnnotation.impact.label",
                {
                  defaultValue: "Safety Impact",
                },
              )}
            </InputLabel>
            <Select
              value={safety.impact ?? "none"}
              onChange={(e) =>
                set({ impact: e.target.value as SafetyAnnotation["impact"] })
              }
              label={t(
                "tabs.dfd.element_description.assetRelations.safetyAnnotation.impact.label",
                {
                  defaultValue: "Safety Impact",
                },
              )}
            >
              {SAFETY_IMPACTS.map((impact) => (
                <MenuItem key={impact} value={impact}>
                  {t(safetyImpactI18nKey(impact))}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.assetRelations.safetyAnnotation.physicalHazardPotential",
                {
                  defaultValue: "Physical Hazard Potential",
                },
              )}
            </InputLabel>
            <Select
              value={safety.physicalHazardPotential ?? ""}
              onChange={(e) =>
                set({
                  physicalHazardPotential:
                    (e.target
                      .value as SafetyAnnotation["physicalHazardPotential"]) ||
                    undefined,
                })
              }
              label={t(
                "tabs.dfd.element_description.assetRelations.safetyAnnotation.physicalHazardPotential",
                {
                  defaultValue: "Physical Hazard Potential",
                },
              )}
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="low">Low — minimal risk</MenuItem>
              <MenuItem value="medium">
                Medium — configuration / systemic
              </MenuItem>
              <MenuItem value="high">
                High — direct safety function impact
              </MenuItem>
            </Select>
          </FormControl>

          {assetGroup === "human" && (
            <Alert
              severity="info"
              sx={{ py: 0.5 }}
              action={
                <Button
                  size="small"
                  variant={safety.protectionTarget ? "contained" : "outlined"}
                  color="warning"
                  onClick={() =>
                    set({ protectionTarget: !safety.protectionTarget })
                  }
                >
                  {safety.protectionTarget ? "Yes" : "No"}
                </Button>
              }
            >
              <Typography variant="caption">
                Protection Target (ISO 12100)
              </Typography>
            </Alert>
          )}

          <TextField
            label={t(
              "tabs.dfd.element_description.assetRelations.safetyAnnotation.rationale.label",
              {
                defaultValue: "Safety Rationale",
              },
            )}
            placeholder={t(
              "tabs.dfd.element_description.assetRelations.safetyAnnotation.rationale.placeholder",
              {
                defaultValue: "Explain why this relation is safety-relevant…",
              },
            )}
            value={safety.rationale ?? ""}
            onChange={(e) => set({ rationale: e.target.value || undefined })}
            multiline
            rows={3}
            size="small"
            fullWidth
            required={safety.relevance === "direct"}
            error={safety.relevance === "direct" && !safety.rationale}
            helperText={
              safety.relevance === "direct" && !safety.rationale
                ? t(
                    "tabs.dfd.element_description.assetRelations.safetyAnnotation.rationale.helperManual",
                    {
                      defaultValue:
                        "Required for direct safety relevance (IEC 62443-4-1)",
                    },
                  )
                : undefined
            }
          />
        </>
      )}
    </Stack>
  );
};

export default AssetRelationSelector;
