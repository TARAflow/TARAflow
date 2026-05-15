// ==================== CREATE THREAT DIALOG ====================
// Wizard-style manual threat creation.
//
// Gray context box always visible on all tabs — shows accumulated decisions.
// Mitigations/Verifications appear in the context box with delete buttons.
// Add field always at the bottom.

import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  Typography,
  Chip,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";
import type { AssetDataReference, AssetReference } from "shared";
import type { Threat, ThreatTable } from "../../models/threat-types";
import { createEmptyThreat } from "../../models/threat-types";
import {
  STRIDE_PER_ELEMENT_TYPE,
  generateThreatIdPerElement,
} from "../../models/per-element-types";
import { generateThreatIdPerInteraction } from "../../models/per-interaction-types";
import {
  getApplicableElementTemplates,
  getApplicableInteractionTemplates,
  getLocalizedElementThreat,
  getLocalizedElementAttack,
  getLocalizedElementCause,
  getLocalizedInteractionThreat,
  getLocalizedInteractionAttack,
  getLocalizedInteractionCause,
  getAllMitigations,
  getAllVerifications,
  getLocalizedMitigation,
  getLocalizedVerification,
} from "../../services/threat-catalog-service";

// ==================== PROPS ====================

interface DataFlowRef {
  dataFlowId: string;
  displayId?: string;
  dataFlowName: string;
  sourceName: string;
  targetName: string;
  sourceId: string;
  targetId: string;
  sourceType?: string;
  targetType?: string;
}

interface CreateThreatDialogProps {
  open: boolean;
  table: ThreatTable;
  existingThreats: Threat[];
  assetDataRef?: AssetDataReference;
  // Per-element mode
  elementId?: string;
  elementName?: string;
  elementType?: string;
  elementDisplayId?: string;
  // Per-interaction mode
  dataFlowRef?: DataFlowRef;
  onClose: () => void;
  onAdd: (threat: Threat) => void;
}

// ==================== HELPERS ====================

function computeNextSeqNum(
  existingThreats: Threat[],
  elementDisplayId: string | undefined,
  strideCategory: StrideCategory,
): number {
  return (
    existingThreats.filter(
      (t) =>
        t.strideCategory === strideCategory &&
        (t.linkedElement?.displayId === elementDisplayId ||
          t.linkedElement?.elementId === elementDisplayId),
    ).length + 1
  );
}

// ==================== CONTEXT BOX ====================

const ContextBox: React.FC<{
  activeTab: number;
  strideCategory: StrideCategory | "";
  threatDescription: string;
  attackDescription: string;
  causeDescription: string;
  mitigations: string[];
  verifications: string[];
  linkedAssets: AssetReference[];
  onDeleteMitigation?: (i: number) => void;
  onDeleteVerification?: (i: number) => void;
}> = ({
  activeTab,
  strideCategory,
  threatDescription,
  attackDescription,
  causeDescription,
  mitigations,
  verifications,
  linkedAssets,
  onDeleteMitigation,
  onDeleteVerification,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        mb: 2,
      }}
    >
      {/* Assets — always shown */}
      {linkedAssets.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mb: 1 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.columns.assets", { defaultValue: "Assets" })}:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {linkedAssets.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.65rem", height: 18 }}
              />
            ))}
          </Stack>
        </Stack>
      )}

      {/* Threat — shown from Tab 2 onwards, STRIDE chip acts as label */}
      {activeTab > 0 && strideCategory && threatDescription && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mb: 0.75 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.dialog.threat", { defaultValue: "Threat" })}:
          </Typography>
          <Chip
            label={strideCategory}
            size="small"
            sx={{
              bgcolor: STRIDE_COLORS[strideCategory],
              color: "white",
              fontWeight: "bold",
              flexShrink: 0,
              height: 18,
              fontSize: "0.65rem",
              mt: 0.1,
            }}
          />
          <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
            {threatDescription}
          </Typography>
        </Stack>
      )}

      {/* Attack — from Tab 3 */}
      {activeTab > 1 && attackDescription && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mb: 0.75 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.dialog.attack", { defaultValue: "Attack" })}:
          </Typography>
          <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
            {attackDescription}
          </Typography>
        </Stack>
      )}

      {/* Cause — from Tab 4 */}
      {activeTab > 2 && causeDescription && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mb: 0.75 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.causeDescription", { defaultValue: "Cause" })}:
          </Typography>
          <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
            {causeDescription}
          </Typography>
        </Stack>
      )}

      {/* Mitigations — from Tab 4, with delete on Tab 4 */}
      {activeTab > 2 && mitigations.length > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mb: 0.75 }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.dialog.mitigations", { defaultValue: "Mitig." })}:
          </Typography>
          <Stack spacing={0.25} sx={{ flexGrow: 1 }}>
            {mitigations.map((m, i) => (
              <Stack
                key={i}
                direction="row"
                alignItems="flex-start"
                spacing={0.5}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0 }}
                >
                  —
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ lineHeight: 1.4, flexGrow: 1 }}
                >
                  {m}
                </Typography>
                {activeTab === 3 && onDeleteMitigation && (
                  <IconButton
                    size="small"
                    sx={{ p: 0, flexShrink: 0 }}
                    onClick={() => onDeleteMitigation(i)}
                  >
                    <DeleteIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                )}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Verifications — Tab 5, with delete on Tab 5 */}
      {activeTab > 3 && verifications.length > 0 && (
        <Stack direction="row" spacing={0.75} alignItems="flex-start">
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, mt: 0.25, minWidth: 44, fontWeight: 500 }}
          >
            {t("tabs.threats.dialog.verifications", { defaultValue: "Verif." })}
            :
          </Typography>
          <Stack spacing={0.25} sx={{ flexGrow: 1 }}>
            {verifications.map((v, i) => (
              <Stack
                key={i}
                direction="row"
                alignItems="flex-start"
                spacing={0.5}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0 }}
                >
                  —
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ lineHeight: 1.4, flexGrow: 1 }}
                >
                  {v}
                </Typography>
                {onDeleteVerification && (
                  <IconButton
                    size="small"
                    sx={{ p: 0, flexShrink: 0 }}
                    onClick={() => onDeleteVerification(i)}
                  >
                    <DeleteIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                )}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Empty state */}
      {linkedAssets.length === 0 && activeTab === 0 && (
        <Typography variant="caption" color="text.disabled">
          {t("tabs.threats.createDialog.noContext", {
            defaultValue: "Fill in the fields below to build the threat.",
          })}
        </Typography>
      )}
    </Box>
  );
};

// ==================== CATALOG LIST ====================

const CatalogList: React.FC<{
  suggestions: { id: string; text: string }[];
  alreadyAdded: string[];
  onInsert: (text: string) => void;
}> = ({ suggestions, alreadyAdded, onInsert }) => {
  const { t } = useTranslation();
  if (suggestions.length === 0) return null;

  return (
    <Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
        <LightbulbOutlinedIcon sx={{ fontSize: 14, color: "warning.main" }} />
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight="medium"
        >
          {t("tabs.threats.createDialog.catalogSuggestions", {
            defaultValue: "Catalog suggestions — click to insert",
          })}
        </Typography>
      </Stack>
      <List
        dense
        disablePadding
        sx={{
          bgcolor: "grey.50",
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          maxHeight: 160,
          overflow: "auto",
        }}
      >
        {suggestions.map((s) => {
          const added = alreadyAdded.includes(s.text);
          return (
            <ListItem key={s.id} disablePadding>
              <ListItemButton
                dense
                disabled={added}
                onClick={() => onInsert(s.text)}
                sx={{ py: 0.5, px: 1, opacity: added ? 0.4 : 1 }}
              >
                <ListItemText
                  primary={s.text}
                  primaryTypographyProps={{
                    variant: "caption",
                    sx: {
                      lineHeight: 1.4,
                      textDecoration: added ? "line-through" : "none",
                    },
                  }}
                />
                {added && (
                  <CheckCircleIcon
                    sx={{
                      fontSize: 12,
                      color: "success.main",
                      ml: 0.5,
                      flexShrink: 0,
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

// ==================== COMPONENT ====================

export const CreateThreatDialog: React.FC<CreateThreatDialogProps> = ({
  open,
  table,
  existingThreats,
  assetDataRef,
  elementId,
  elementName,
  elementType,
  elementDisplayId,
  dataFlowRef,
  onClose,
  onAdd,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [perspective, setPerspective] = useState<"sender" | "receiver">(
    "sender",
  );

  const [strideCategory, setStrideCategory] = useState<StrideCategory | "">("");
  const [threatDescription, setThreatDescription] = useState("");
  const [attackDescription, setAttackDescription] = useState("");
  const [causeDescription, setCauseDescription] = useState("");
  const [mitigations, setMitigations] = useState<string[]>([]);
  const [mitigationInput, setMitigationInput] = useState("");
  const [verifications, setVerifications] = useState<string[]>([]);
  const [verificationInput, setVerificationInput] = useState("");

  // Interaction mode detection
  const isInteractionMode = !!dataFlowRef;

  // Linked assets — element mode: from elementId; interaction: source + target
  const linkedAssets = useMemo<AssetReference[]>(() => {
    if (!assetDataRef) return [];
    if (isInteractionMode && dataFlowRef) {
      const ids = [
        dataFlowRef.sourceId,
        dataFlowRef.targetId,
        dataFlowRef.dataFlowId,
      ].filter(Boolean);
      return assetDataRef.assets.filter((a) =>
        ids.some((id) => a.linkedElementIds?.includes(id)),
      );
    }
    if (!elementId) return [];
    return assetDataRef.assets.filter((a) =>
      a.linkedElementIds?.includes(elementId),
    );
  }, [assetDataRef, elementId, isInteractionMode, dataFlowRef]);

  // STRIDE — all 6 for interaction, element-type specific for element
  const availableStride: StrideCategory[] = isInteractionMode
    ? ["S", "T", "R", "I", "D", "E"]
    : elementType
      ? (STRIDE_PER_ELEMENT_TYPE[elementType] ?? ["S", "T", "R", "I", "D", "E"])
      : ["S", "T", "R", "I", "D", "E"];

  // Catalog suggestions — interaction uses interaction templates
  const catalogSuggestions = useMemo(() => {
    if (!strideCategory) return [];
    if (isInteractionMode) {
      const placeholders = {
        sourceName: dataFlowRef?.sourceName ?? "",
        targetName: dataFlowRef?.targetName ?? "",
        dataFlowName: dataFlowRef?.dataFlowName ?? "",
        trustBoundaryName: table.trustBoundaryName ?? "",
      };
      return getApplicableInteractionTemplates(strideCategory, perspective).map(
        (tpl) => ({
          id: tpl.id,
          threat: getLocalizedInteractionThreat(tpl.id, placeholders),
          attack: getLocalizedInteractionAttack(tpl.id, placeholders),
          cause: getLocalizedInteractionCause(tpl.id, placeholders),
        }),
      );
    }
    if (!elementType) return [];
    return getApplicableElementTemplates(strideCategory, elementType).map(
      (tpl) => ({
        id: tpl.id,
        threat: getLocalizedElementThreat(tpl.id),
        attack: getLocalizedElementAttack(tpl.id),
        cause: getLocalizedElementCause(tpl.id),
      }),
    );
  }, [
    strideCategory,
    elementType,
    isInteractionMode,
    dataFlowRef,
    perspective,
    table.trustBoundaryName,
  ]);

  const mitigationSuggestions = useMemo(() => {
    if (!strideCategory) return [];
    return getAllMitigations()
      .filter((m) => m.strideCategory === strideCategory)
      .map((m) => ({ id: m.id, text: getLocalizedMitigation(m.id) }))
      .filter((m) => !!m.text);
  }, [strideCategory]);

  const verificationSuggestions = useMemo(() => {
    if (!strideCategory) return [];
    return getAllVerifications()
      .filter((v) => v.strideCategory === strideCategory)
      .map((v) => ({ id: v.id, text: getLocalizedVerification(v.id) }))
      .filter((v) => !!v.text);
  }, [strideCategory]);

  const complete = useMemo(
    () => ({
      threat: !!strideCategory && !!threatDescription.trim(),
      attack: !!attackDescription.trim(),
      cause: !!causeDescription.trim(),
      mitigations: mitigations.length > 0,
      verifications: verifications.length > 0,
    }),
    [
      strideCategory,
      threatDescription,
      attackDescription,
      causeDescription,
      mitigations,
      verifications,
    ],
  );

  const allComplete = Object.values(complete).every(Boolean);

  React.useEffect(() => {
    if (open) {
      setActiveTab(0);
      setStrideCategory("");
      setThreatDescription("");
      setAttackDescription("");
      setCauseDescription("");
      setMitigations([]);
      setMitigationInput("");
      setVerifications([]);
      setVerificationInput("");
      setPerspective("sender");
    }
  }, [open]);

  const handleAddMitigation = () => {
    const v = mitigationInput.trim();
    if (v && !mitigations.includes(v)) {
      setMitigations((p) => [...p, v]);
      setMitigationInput("");
    }
  };

  const handleAddVerification = () => {
    const v = verificationInput.trim();
    if (v && !verifications.includes(v)) {
      setVerifications((p) => [...p, v]);
      setVerificationInput("");
    }
  };

  const handleCreate = useCallback(() => {
    if (!strideCategory || !allComplete) return;

    let id: string;
    const direction = perspective === "sender" ? "outgoing" : "incoming";

    if (isInteractionMode && dataFlowRef) {
      const tbDisplayId =
        table.displayIdentifier?.replace(/[\[\]]/g, "") ?? "TB";
      const dfNum = (dataFlowRef.displayId ?? dataFlowRef.dataFlowId).replace(
        /^DF-/,
        "",
      );
      const dfIdPart = `DF${dfNum}`;
      const seqNum =
        existingThreats.filter(
          (t) =>
            t.strideCategory === strideCategory &&
            t.dataFlow?.dataFlowId === dataFlowRef.dataFlowId,
        ).length + 1;
      id = generateThreatIdPerInteraction(
        tbDisplayId,
        dfIdPart,
        strideCategory,
        direction,
        seqNum,
      );
    } else {
      const seqNum = computeNextSeqNum(
        existingThreats,
        elementDisplayId,
        strideCategory,
      );
      id = generateThreatIdPerElement(
        elementDisplayId || elementId || "M",
        strideCategory,
        seqNum,
      );
    }

    const threat = createEmptyThreat(
      id,
      strideCategory,
      table.trustBoundaryId,
      table.trustBoundaryName,
      table.displayIdentifier?.replace(/[\[\]]/g, "") ?? null,
    );

    threat.source = "manual";
    threat.threatDescription = threatDescription.trim();
    threat.attackDescription = attackDescription.trim();
    threat.causeDescription = causeDescription.trim();
    threat.proposedMitigations = mitigations.map((notes) => ({ notes }));
    threat.proposedVerifications = verifications.map((notes) => ({ notes }));

    if (isInteractionMode && dataFlowRef) {
      threat.dataFlow = {
        connectionId: dataFlowRef.dataFlowId,
        dataFlowId: dataFlowRef.displayId ?? dataFlowRef.dataFlowId,
        dataFlowName: dataFlowRef.dataFlowName,
        sourceId: dataFlowRef.sourceId,
        sourceName: dataFlowRef.sourceName,
        sourceType: dataFlowRef.sourceType ?? "",
        targetId: dataFlowRef.targetId,
        targetName: dataFlowRef.targetName,
        targetType: dataFlowRef.targetType ?? "",
      };
      threat.linkedAssetIds = linkedAssets.map((a) => a.id);
    } else if (elementId) {
      threat.linkedElement = {
        elementId,
        elementName: elementName ?? elementId,
        elementType: elementType ?? "Process",
        displayId: elementDisplayId,
      };
    }

    onAdd(threat);
    onClose();
  }, [
    strideCategory,
    allComplete,
    existingThreats,
    elementDisplayId,
    elementId,
    table,
    threatDescription,
    attackDescription,
    causeDescription,
    mitigations,
    verifications,
    elementName,
    elementType,
    onAdd,
    onClose,
    isInteractionMode,
    dataFlowRef,
    perspective,
    linkedAssets,
  ]);

  const threatIdPreview = useMemo(() => {
    if (!strideCategory) return null;
    if (isInteractionMode && dataFlowRef) {
      const tbDisplayId =
        table.displayIdentifier?.replace(/[\[\]]/g, "") ?? "TB";
      const dfNum = (dataFlowRef.displayId ?? dataFlowRef.dataFlowId).replace(
        /^DF-/,
        "",
      );
      const seqNum =
        existingThreats.filter(
          (t) =>
            t.strideCategory === strideCategory &&
            t.dataFlow?.dataFlowId === dataFlowRef.dataFlowId,
        ).length + 1;
      const dir = perspective === "sender" ? "outgoing" : "incoming";
      return generateThreatIdPerInteraction(
        tbDisplayId,
        `DF${dfNum}`,
        strideCategory,
        dir as any,
        seqNum,
      );
    }
    return generateThreatIdPerElement(
      elementDisplayId || elementId || "?",
      strideCategory,
      computeNextSeqNum(existingThreats, elementDisplayId, strideCategory),
    );
  }, [
    strideCategory,
    isInteractionMode,
    dataFlowRef,
    table.displayIdentifier,
    existingThreats,
    perspective,
    elementDisplayId,
    elementId,
  ]);

  const tabLabel = (label: string, done: boolean) => (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {done ? (
        <CheckCircleIcon sx={{ fontSize: 13, color: "success.main" }} />
      ) : (
        <RadioButtonUncheckedIcon
          sx={{ fontSize: 13, color: "text.disabled" }}
        />
      )}
      <span>{label}</span>
    </Stack>
  );

  const ctxProps = {
    activeTab,
    strideCategory,
    threatDescription,
    attackDescription,
    causeDescription,
    mitigations,
    verifications,
    linkedAssets,
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: "82vh", display: "flex", flexDirection: "column" },
      }}
    >
      <DialogTitle sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography fontWeight="bold" variant="body1" sx={{ flexGrow: 1 }}>
            {t("tabs.threats.createDialog.title", {
              defaultValue: "Add Manual Threat",
            })}
          </Typography>
          {/* Interaction: TB + DataFlow info */}
          {isInteractionMode && dataFlowRef ? (
            <>
              {table.trustBoundaryName && (
                <Chip
                  label={table.trustBoundaryName}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                label={`${dataFlowRef.sourceName} → ${dataFlowRef.targetName}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {dataFlowRef.displayId && (
                <Chip
                  label={dataFlowRef.displayId}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              )}
            </>
          ) : (
            <>
              {table.trustBoundaryName && (
                <Chip
                  label={table.trustBoundaryName}
                  size="small"
                  variant="outlined"
                />
              )}
              {elementName && (
                <Chip
                  label={`${elementDisplayId ?? ""} ${elementName}`.trim()}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </>
          )}
          {threatIdPreview && (
            <Chip
              label={threatIdPreview}
              size="small"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                bgcolor: STRIDE_COLORS[strideCategory as StrideCategory] + "22",
                border: "1px solid",
                borderColor: STRIDE_COLORS[strideCategory as StrideCategory],
                color: STRIDE_COLORS[strideCategory as StrideCategory],
              }}
            />
          )}
        </Stack>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        sx={{ borderBottom: 1, borderColor: "divider", px: 1, flexShrink: 0 }}
      >
        <Tab
          label={tabLabel(
            t("tabs.threats.dialog.threat", { defaultValue: "Threat" }),
            complete.threat,
          )}
        />
        <Tab
          label={tabLabel(
            t("tabs.threats.dialog.attack", { defaultValue: "Attack" }),
            complete.attack,
          )}
        />
        <Tab
          label={tabLabel(
            t("tabs.threats.causeDescription", { defaultValue: "Cause" }),
            complete.cause,
          )}
        />
        <Tab
          label={tabLabel(
            t("tabs.threats.dialog.mitigations", {
              defaultValue: "Mitigations",
            }),
            complete.mitigations,
          )}
        />
        <Tab
          label={tabLabel(
            t("tabs.threats.dialog.verifications", {
              defaultValue: "Verifications",
            }),
            complete.verifications,
          )}
        />
      </Tabs>

      <DialogContent sx={{ flex: 1, overflow: "auto", pt: 2 }}>
        {/* ── Tab 1: Threat ── */}
        {activeTab === 0 && (
          <Stack spacing={2}>
            {/* Context box even on Tab 1 — shows assets */}
            <ContextBox {...ctxProps} />

            {/* Perspective toggle — interaction mode only */}
            {isInteractionMode && (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  gutterBottom
                >
                  {t("tabs.threats.createDialog.perspective", {
                    defaultValue: "Perspective *",
                  })}
                </Typography>
                <ToggleButtonGroup
                  value={perspective}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setPerspective(val);
                  }}
                  size="small"
                >
                  <ToggleButton value="sender" sx={{ px: 2 }}>
                    {t("tabs.threats.createDialog.sender", {
                      defaultValue: "Sender",
                    })}
                  </ToggleButton>
                  <ToggleButton value="receiver" sx={{ px: 2 }}>
                    {t("tabs.threats.createDialog.receiver", {
                      defaultValue: "Receiver",
                    })}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                gutterBottom
              >
                {t("tabs.threats.createDialog.strideCategory", {
                  defaultValue: "STRIDE Category *",
                })}
              </Typography>
              <ToggleButtonGroup
                value={strideCategory}
                exclusive
                onChange={(_, val) => {
                  if (val) setStrideCategory(val);
                }}
                size="small"
              >
                {availableStride.map((cat) => (
                  <ToggleButton
                    key={cat}
                    value={cat}
                    sx={{
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                      px: 1.5,
                      "&.Mui-selected": {
                        bgcolor: STRIDE_COLORS[cat],
                        color: "white",
                        "&:hover": { bgcolor: STRIDE_COLORS[cat] },
                      },
                    }}
                  >
                    {cat}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <TextField
              label={t("tabs.threats.dialog.threatLabel", {
                defaultValue: "Threat Description *",
              })}
              multiline
              minRows={3}
              fullWidth
              value={threatDescription}
              onChange={(e) => setThreatDescription(e.target.value)}
            />
            <CatalogList
              suggestions={catalogSuggestions.map((s) => ({
                id: s.id,
                text: s.threat,
              }))}
              alreadyAdded={[threatDescription]}
              onInsert={setThreatDescription}
            />
          </Stack>
        )}

        {/* ── Tab 2: Attack ── */}
        {activeTab === 1 && (
          <Stack spacing={2}>
            <ContextBox {...ctxProps} />
            <TextField
              label={t("tabs.threats.dialog.attackLabel", {
                defaultValue: "Attack Scenario *",
              })}
              multiline
              minRows={3}
              fullWidth
              value={attackDescription}
              onChange={(e) => setAttackDescription(e.target.value)}
            />
            <CatalogList
              suggestions={catalogSuggestions
                .filter((s) => !!s.attack)
                .map((s) => ({ id: s.id, text: s.attack }))}
              alreadyAdded={[attackDescription]}
              onInsert={setAttackDescription}
            />
          </Stack>
        )}

        {/* ── Tab 3: Cause ── */}
        {activeTab === 2 && (
          <Stack spacing={2}>
            <ContextBox {...ctxProps} />
            <TextField
              label={t("tabs.threats.createDialog.causeLabel", {
                defaultValue: "Root Cause *",
              })}
              multiline
              minRows={3}
              fullWidth
              value={causeDescription}
              onChange={(e) => setCauseDescription(e.target.value)}
            />
            <CatalogList
              suggestions={catalogSuggestions
                .filter((s) => !!s.cause)
                .map((s) => ({ id: s.id, text: s.cause }))}
              alreadyAdded={[causeDescription]}
              onInsert={setCauseDescription}
            />
          </Stack>
        )}

        {/* ── Tab 4: Mitigations ── */}
        {activeTab === 3 && (
          <Stack spacing={2}>
            {/* Context box includes mitigations with delete */}
            <ContextBox
              {...ctxProps}
              onDeleteMitigation={(i) =>
                setMitigations((p) => p.filter((_, j) => j !== i))
              }
            />
            {/* Catalog suggestions */}
            <CatalogList
              suggestions={mitigationSuggestions}
              alreadyAdded={mitigations}
              onInsert={(text) => {
                if (!mitigations.includes(text))
                  setMitigations((p) => [...p, text]);
              }}
            />
            {/* Add field at bottom */}
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                label={t("tabs.threats.createDialog.addMitigation", {
                  defaultValue: "Add mitigation *",
                })}
                value={mitigationInput}
                onChange={(e) => setMitigationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMitigation();
                  }
                }}
              />
              <IconButton
                onClick={handleAddMitigation}
                disabled={
                  !mitigationInput.trim() ||
                  mitigations.includes(mitigationInput.trim())
                }
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Stack>
        )}

        {/* ── Tab 5: Verifications ── */}
        {activeTab === 4 && (
          <Stack spacing={2}>
            {/* Context box includes verifications with delete */}
            <ContextBox
              {...ctxProps}
              onDeleteVerification={(i) =>
                setVerifications((p) => p.filter((_, j) => j !== i))
              }
            />
            {/* Catalog suggestions */}
            <CatalogList
              suggestions={verificationSuggestions}
              alreadyAdded={verifications}
              onInsert={(text) => {
                if (!verifications.includes(text))
                  setVerifications((p) => [...p, text]);
              }}
            />
            {/* Add field at bottom */}
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                label={t("tabs.threats.createDialog.addVerification", {
                  defaultValue: "Add verification *",
                })}
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddVerification();
                  }
                }}
              />
              <IconButton
                onClick={handleAddVerification}
                disabled={
                  !verificationInput.trim() ||
                  verifications.includes(verificationInput.trim())
                }
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ flexGrow: 1, pl: 1 }}
          alignItems="center"
        >
          {Object.entries(complete).map(([key, done]) => (
            <Box
              key={key}
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: done ? "success.main" : "grey.300",
              }}
            />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {Object.values(complete).filter(Boolean).length} / 5
          </Typography>
        </Stack>
        <Button onClick={onClose}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!allComplete}
        >
          {t("tabs.threats.createDialog.create", {
            defaultValue: "Create Threat",
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};;;;