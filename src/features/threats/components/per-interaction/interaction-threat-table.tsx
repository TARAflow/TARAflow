// ==================== INTERACTION THREAT TABLE ====================
// Displays threats for STRIDE per-interaction method.
// Supports DataFlow tables (grouped by flow) and Interface tables (grouped by interface).

import React, { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  SwapHoriz as DataFlowIcon,
  Security as TrustBoundaryIcon,
  Cable as CableIcon,
  SettingsInputComponent as InterfaceIcon,
  ArrowDownward,
  ArrowUpward,
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  AddCircleOutline as AddCircleOutlineIcon,
  Add as AddIcon,
} from "@mui/icons-material";

import {
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  isInterfaceTable,
} from "../../models/threat-types";
import { AssetReference, type AssetDataReference } from "shared";

import { sortThreatsByPriority } from "../../utils/threat-asset-utils";
import {
  ThreatSortField,
  SortDir,
  sortThreats,
  ThreatIdCell,
  StrideCell,
  MissingChip,
  ActorCell,
  SourceBadge,
} from "../../components/shared/threat-table-utils";
import { ImpactCell } from "../../components/shared/impact-cell";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "../../services/threat-catalog-service";
import { CreateThreatDialog } from "../../components/shared/create-threat-dialog";
import type { InteractionDirection } from "features/threats/models/per-interaction-types";

// ==================== TYPES ====================

interface DataFlowGroup {
  dataFlowId: string;
  displayId?: string;
  dataFlowName: string;
  sourceName: string;
  targetName: string;
  sourceId: string;
  targetId: string;
  sourceType: string;
  targetType: string;
  threats: Threat[];
}

interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  displayId?: string;
  threats: Threat[];
}

export interface InteractionThreatTableProps {
  table: ThreatTableType;
  tableIndex: number;
  configuration: ThreatConfiguration;
  assetDataRef?: AssetDataReference;
  showThreatActor?: boolean;
  onEdit: (threat: Threat) => void;
  onDelete: (threatId: string) => void;
  onAdd: (threat: Threat) => void;
}

// ==================== HELPERS ====================

const getElementIcon = (elementType: string) => {
  switch (elementType) {
    case "Process":
      return <ProcessIcon fontSize="small" />;
    case "Multiprocess":
      return <MultiProcessIcon fontSize="small" />;
    case "DataStore":
      return <DataStoreIcon fontSize="small" />;
    case "ExternalEntity":
      return <ExternalEntityIcon fontSize="small" />;
    case "DataFlow":
      return <DataFlowIcon fontSize="small" />;
    case "PhysicalInterface":
      return <CableIcon fontSize="small" />;
    case "Interface":
      return <InterfaceIcon fontSize="small" />;
    default:
      return <TrustBoundaryIcon fontSize="small" />;
  }
};

const RELEVANCE_ROW_BG: Record<string, string> = {
  unrated: "transparent",
  relevant: "#f0fdf4",
  not_relevant: "#fef2f2",
  uncertain: "#fffbeb",
};

function isCompleted(t: Threat): boolean {
  return t.workflowStatus === "reviewed" || t.workflowStatus === "closed";
}

function countCompletedByLevel(
  threats: Threat[],
  assetDataRef?: AssetDataReference,
): Partial<Record<ImpactLevel, { done: number; total: number }>> {
  const result: Partial<Record<ImpactLevel, { done: number; total: number }>> =
    {};
  if (!assetDataRef) return result;

  for (const t of threats) {
    const linked = t.linkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
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
    const level: ImpactLevel | undefined =
      hasSafety && worstBusiness === "CRITICAL"
        ? "CRITICAL"
        : hasSafety
          ? "HIGH"
          : worstBusiness;
    if (!level) continue;
    const prev = result[level] ?? { done: 0, total: 0 };
    result[level] = {
      done: prev.done + (isCompleted(t) ? 1 : 0),
      total: prev.total + 1,
    };
  }
  return result;
}

function getDirectionColor(direction: InteractionDirection): string {
  return direction === "incoming" ? "#2196f3" : "#ff9800";
}

// ==================== INNER TABLE ====================

const InteractionThreatRows: React.FC<{
  threats: Threat[];
  assetDataRef?: AssetDataReference;
  showThreatActor?: boolean;
  t: (key: string, opts?: any) => string;
  onEdit: (t: Threat) => void;
  onDelete: (id: string) => void;
}> = React.memo(
  ({ threats, assetDataRef, showThreatActor = false, t, onEdit, onDelete }) => {
    const [sortField, setSortField] = useState<ThreatSortField>("priority");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const formatInteractionDirection = (
      direction: InteractionDirection,
    ): string =>
      t(`tabs.threats.direction.${direction}`, {
        defaultValue: direction === "incoming" ? "Incoming" : "Outgoing",
      });

    const handleSort = useCallback((field: ThreatSortField) => {
      setSortField((prev) => {
        if (prev === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else setSortDir("asc");
        return field;
      });
    }, []);

    const sorted = useMemo(
      () => sortThreats(threats, sortField, sortDir, assetDataRef),
      [threats, sortField, sortDir, assetDataRef],
    );

    const showAssets = (assetDataRef?.assets.length ?? 0) > 0;

    const cellSx = { py: 0.5, px: 1, fontSize: "0.78rem", lineHeight: 1.4 };
    const hdSx = {
      py: 0.5,
      px: 1,
      fontWeight: 600,
      fontSize: "0.75rem",
      whiteSpace: "nowrap" as const,
      bgcolor: "grey.50",
    };

    return (
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ tableLayout: "fixed", minWidth: 750 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...hdSx, width: 120 }}>
                <TableSortLabel
                  active={sortField === "id"}
                  direction={sortField === "id" ? sortDir : "asc"}
                  onClick={() => handleSort("id")}
                >
                  {t("tabs.threats.columns.threatId", { defaultValue: "T-ID" })}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 56 }}>
                <TableSortLabel
                  active={sortField === "strideCategory"}
                  direction={sortField === "strideCategory" ? sortDir : "asc"}
                  onClick={() => handleSort("strideCategory")}
                >
                  STRIDE
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 60 }}>
                {t("tabs.threats.columns.direction", { defaultValue: "Dir" })}
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 220 }}>
                {t("tabs.threats.columns.threat", { defaultValue: "Threat" })}
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 160 }}>
                {t("tabs.threats.columns.attack", { defaultValue: "Attack" })}
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 160 }}>
                {t("tabs.threats.columns.mitigation", {
                  defaultValue: "Mitigation",
                })}
              </TableCell>
              <TableCell sx={{ ...hdSx, width: 140 }}>
                {t("tabs.threats.columns.verification", {
                  defaultValue: "Verification",
                })}
              </TableCell>
              {showThreatActor && (
                <TableCell sx={{ ...hdSx, width: 100 }}>
                  {t("tabs.threats.columns.actor", { defaultValue: "Actor" })}
                </TableCell>
              )}
              {showAssets && (
                <TableCell sx={{ ...hdSx, width: 200 }}>
                  <TableSortLabel
                    active={sortField === "priority"}
                    direction={sortField === "priority" ? sortDir : "asc"}
                    onClick={() => handleSort("priority")}
                  >
                    {t("tabs.threats.columns.impact", {
                      defaultValue: "Impact",
                    })}
                  </TableSortLabel>
                </TableCell>
              )}
              <TableCell sx={{ ...hdSx, width: 60 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((threat) => {
              const ctx = threat.interactionContext;
              const mitigationText = threat.proposedMitigations
                ?.map((m) => m.id ?? m.notes ?? "")
                .filter(Boolean)
                .join(", ");

              const verificationText = threat.proposedVerifications
                ?.map((v) => v.id ?? v.notes ?? "")
                .filter(Boolean)
                .join(", ");

              const hasMitigations = threat.proposedMitigations?.length > 0;
              const hasVerifications = threat.proposedVerifications?.length > 0;

              const mitigationTooltip = resolveMitigationDrafts(
                threat.proposedMitigations ?? [],
              )
                .map((m) =>
                  m.isCustom
                    ? `[custom] ${m.notes ?? ""}`
                    : `${m.id ?? ""}: ${m.text}`,
                )
                .filter(Boolean)
                .map((s) => `• ${s}`)
                .join("\n");

              const verificationTooltip = resolveVerificationDrafts(
                threat.proposedVerifications ?? [],
              )
                .map((v) =>
                  v.isCustom
                    ? `[custom] ${v.notes ?? ""}`
                    : `${v.id ?? ""}: ${v.text}`,
                )
                .filter(Boolean)
                .map((s) => `• ${s}`)
                .join("\n");

              return (
                <TableRow
                  key={threat.id}
                  hover
                  onClick={() => onEdit(threat)}
                  sx={{
                    "&:last-child td": { borderBottom: 0 },
                    cursor: "pointer",
                    bgcolor: RELEVANCE_ROW_BG[threat.relevance ?? "unrated"],
                    "&:hover": {
                      bgcolor: `${RELEVANCE_ROW_BG[threat.relevance ?? "unrated"]} !important`,
                      filter: "brightness(0.97)",
                    },
                  }}
                >
                  <TableCell sx={cellSx}>
                    <Stack spacing={0.5} direction="row" alignItems="center">
                      <ThreatIdCell id={threat.id} />
                      <SourceBadge
                        source={threat.source}
                        initialImpact={threat.initialImpact}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    <StrideCell cat={threat.strideCategory} />
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    {ctx && (
                      <Tooltip
                        title={formatInteractionDirection(ctx.direction)}
                      >
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            backgroundColor: getDirectionColor(ctx.direction),
                            color: "white",
                          }}
                        >
                          {ctx.direction === "incoming" ? (
                            <ArrowDownward sx={{ fontSize: 14 }} />
                          ) : (
                            <ArrowUpward sx={{ fontSize: 14 }} />
                          )}
                        </Box>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {threat.threatDescription ? (
                      <Tooltip title={threat.threatDescription}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {threat.threatDescription}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <em style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                        {t("tabs.threats.noDescription", {
                          defaultValue: "No description",
                        })}
                      </em>
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {threat.attackDescription ? (
                      <Tooltip title={threat.attackDescription}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {threat.attackDescription}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <MissingChip
                        label={t("tabs.threats.noAttack", {
                          defaultValue: "Missing",
                        })}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {hasMitigations ? (
                      <Tooltip
                        title={
                          mitigationTooltip ? (
                            <span style={{ whiteSpace: "pre-line" }}>
                              {mitigationTooltip}
                            </span>
                          ) : (
                            ""
                          )
                        }
                        placement="top"
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {mitigationText}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <MissingChip
                        label={t("tabs.threats.noMitigation", {
                          defaultValue: "Missing",
                        })}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {hasVerifications ? (
                      <Tooltip
                        title={
                          verificationTooltip ? (
                            <span style={{ whiteSpace: "pre-line" }}>
                              {verificationTooltip}
                            </span>
                          ) : (
                            ""
                          )
                        }
                        placement="top"
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {verificationText}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <MissingChip
                        label={t("tabs.threats.noVerification", {
                          defaultValue: "Missing",
                        })}
                      />
                    )}
                  </TableCell>
                  {showThreatActor && (
                    <TableCell sx={cellSx}>
                      <ActorCell actor={threat.threatActor} />
                    </TableCell>
                  )}
                  {showAssets && (
                    <TableCell sx={cellSx}>
                      {assetDataRef && (
                        <ImpactCell
                          threat={threat}
                          assetDataRef={assetDataRef}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell sx={{ ...cellSx, textAlign: "right" }}>
                    <Tooltip title={t("common.edit", { defaultValue: "Edit" })}>
                      <IconButton size="small" onClick={() => onEdit(threat)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={t("common.delete", { defaultValue: "Delete" })}
                    >
                      <IconButton
                        size="small"
                        onClick={() => onDelete(threat.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    );
  },
);
InteractionThreatRows.displayName = "InteractionThreatRows";

// ==================== IMPACT HELPERS ====================

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

function countImpacts(
  threats: Threat[],
  assetDataRef?: AssetDataReference,
): Partial<Record<ImpactLevel, number>> {
  const counts: Partial<Record<ImpactLevel, number>> = {};
  if (!assetDataRef) return counts;
  for (const t of threats) {
    const linked = t.linkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
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
    const effective: ImpactLevel | undefined =
      hasSafety && worstBusiness === "CRITICAL"
        ? "CRITICAL"
        : hasSafety
          ? "HIGH"
          : worstBusiness;
    if (effective) counts[effective] = (counts[effective] ?? 0) + 1;
  }
  return counts;
}

// ==================== MAIN COMPONENT ====================

export const InteractionThreatTable = React.memo<InteractionThreatTableProps>(
  ({
    table,
    assetDataRef,
    showThreatActor = false,
    onEdit,
    onDelete,
    onAdd,
  }) => {
    const { t } = useTranslation();

    const [expandedGroups, setExpandedGroups] = useState<
      Record<string, boolean>
    >({});
    const [createDialogGroup, setCreateDialogGroup] =
      useState<DataFlowGroup | null>(null);

    const toggleGroup = useCallback((key: string) => {
      setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const isInterface = isInterfaceTable(table);

    const groupThreatsByDataFlow = (threats: Threat[]): DataFlowGroup[] => {
      const groups: Record<string, DataFlowGroup> = {};
      for (const threat of threats) {
        const df = threat.dataFlow;
        if (!df) continue;
        if (!groups[df.dataFlowId]) {
          groups[df.dataFlowId] = {
            dataFlowId: df.dataFlowId,
            displayId: df.displayId,
            dataFlowName: df.dataFlowName,
            sourceName: df.sourceName,
            targetName: df.targetName,
            sourceId: df.sourceId,
            targetId: df.targetId,
            sourceType: df.sourceType,
            targetType: df.targetType,
            threats: [],
          };
        }
        groups[df.dataFlowId].threats.push(threat);
      }
      return Object.values(groups).sort((a, b) =>
        a.dataFlowId.localeCompare(b.dataFlowId),
      );
    };

    const groupThreatsByInterface = (threats: Threat[]): ElementGroup[] => {
      const groups: Record<string, ElementGroup> = {};
      for (const threat of threats) {
        const elem = threat.linkedElement;
        if (!elem) continue;
        if (!groups[elem.elementId]) {
          groups[elem.elementId] = {
            elementId: elem.elementId,
            elementName: elem.elementName,
            elementType: elem.elementType,
            displayId: elem.displayId,
            threats: [],
          };
        }
        groups[elem.elementId].threats.push(threat);
      }
      return Object.values(groups).sort((a, b) =>
        (a.displayId || a.elementName).localeCompare(
          b.displayId || b.elementName,
          undefined,
          {
            numeric: true,
          },
        ),
      );
    };

    const dataFlowGroups = useMemo(
      () => groupThreatsByDataFlow(table.threats),
      [table.threats],
    );
    const interfaceGroups = useMemo(
      () => groupThreatsByInterface(table.threats),
      [table.threats],
    );

    const sortedInterfaceGroups = useMemo(
      () =>
        interfaceGroups.map((g) => ({
          ...g,
          threats: sortThreatsByPriority(g.threats, assetDataRef),
        })),
      [interfaceGroups, assetDataRef],
    );
    const sortedDataFlowGroups = useMemo(
      () =>
        dataFlowGroups.map((g) => ({
          ...g,
          threats: sortThreatsByPriority(g.threats, assetDataRef),
        })),
      [dataFlowGroups, assetDataRef],
    );

    const renderImpactChips = (threats: Threat[], small = false) => {
      const counts = countImpacts(threats, assetDataRef);
      const completedByLevel = countCompletedByLevel(threats, assetDataRef);
      return (
        <>
          {IMPACT_ORDER.filter((lvl) => (counts[lvl] ?? 0) > 0).map((lvl) => {
            const c = IMPACT_CHIP_COLORS[lvl];
            return (
              <Chip
                key={lvl}
                label={`${completedByLevel[lvl]?.done ?? 0}/${completedByLevel[lvl]?.total ?? counts[lvl] ?? 0} ${lvl}`}
                size="small"
                sx={{
                  height: small ? 16 : 18,
                  fontSize: small ? "0.6rem" : "0.65rem",
                  bgcolor: c.bg,
                  color: c.color,
                  border: `1px solid ${c.border}`,
                }}
              />
            );
          })}
        </>
      );
    };

    // ── Accordion header stats ──────────────────────────────────────────────
    const total = table.threats.length;
    const reviewed = table.threats.filter(
      (t) => t.workflowStatus === "reviewed" || t.workflowStatus === "closed",
    ).length;
    const relevant = table.threats.filter(
      (t) => t.relevance === "relevant",
    ).length;
    const dismissed = table.threats.filter(
      (t) => t.relevance === "not_relevant",
    ).length;
    const uncertain = table.threats.filter(
      (t) => t.relevance === "uncertain",
    ).length;
    const unrated = table.threats.filter(
      (t) => t.relevance === "unrated",
    ).length;
    const allDone = total > 0 && unrated === 0 && uncertain === 0;
    const borderColor = allDone
      ? "#16a34a"
      : unrated > 0
        ? "#9ca3af"
        : uncertain > 0
          ? "#d97706"
          : "#16a34a";
    const counts = countImpacts(table.threats, assetDataRef);
    const topImpacts = IMPACT_ORDER.filter(
      (lvl) => (counts[lvl] ?? 0) > 0,
    ).slice(0, 2);
    const impactTooltip = IMPACT_ORDER.filter((lvl) => (counts[lvl] ?? 0) > 0)
      .map((lvl) => `${lvl}: ${counts[lvl]}`)
      .join("  ·  ");
    const progressTooltip = [
      relevant > 0 ? `${relevant} relevant ✓` : null,
      dismissed > 0 ? `${dismissed} dismissed ✗` : null,
      uncertain > 0 ? `${uncertain} uncertain ?` : null,
      unrated > 0 ? `${unrated} unrated –` : null,
    ]
      .filter(Boolean)
      .join("   ");

    return (
      <>
        <Accordion
          defaultExpanded
          sx={{
            "&:before": { display: "none" },
            boxShadow: "1",
            mb: 1,
            borderLeft: `4px solid ${borderColor}`,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: "primary.50",
              "&:hover": { backgroundColor: "primary.100" },
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ flexGrow: 1, mr: 1 }}
            >
              <TrustBoundaryIcon color="primary" />
              <Chip
                label={table.displayIdentifier}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontFamily: "monospace" }}
              />
              <Typography
                variant="subtitle1"
                fontWeight="medium"
                sx={{ flexGrow: 1 }}
              >
                {table.trustBoundaryName}
              </Typography>

              {/* Impact chips — top 2 levels with tooltip */}
              {topImpacts.length > 0 && (
                <Tooltip title={impactTooltip} placement="top">
                  <Stack direction="row" spacing={0.5}>
                    {topImpacts.map((lvl) => {
                      const col = IMPACT_CHIP_COLORS[lvl];
                      return (
                        <Chip
                          key={lvl}
                          label={`${lvl} ×${counts[lvl]}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            bgcolor: col.bg,
                            color: col.color,
                            border: `1px solid ${col.border}`,
                            cursor: "default",
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Tooltip>
              )}

              {/* Progress chip with tooltip */}
              <Tooltip
                title={
                  <span style={{ whiteSpace: "pre-line" }}>
                    {progressTooltip}
                  </span>
                }
                placement="top"
              >
                <Chip
                  size="small"
                  label={`${reviewed}/${total}`}
                  sx={{
                    height: 18,
                    fontSize: "0.65rem",
                    cursor: "default",
                    bgcolor: allDone ? "#f0fdf4" : "#f9fafb",
                    color: allDone ? "#16a34a" : "#6b7280",
                    border: `1px solid ${allDone ? "#16a34a" : "#9ca3af"}`,
                    fontWeight: allDone ? "bold" : "normal",
                  }}
                />
              </Tooltip>
            </Stack>
          </AccordionSummary>

          <AccordionDetails sx={{ p: 1 }}>
            {isInterface
              ? sortedInterfaceGroups.map((group) => {
                  const key = `${table.trustBoundaryId || "ext"}-${group.elementId}`;
                  const isExpanded = expandedGroups[key] ?? false;
                  return (
                    <Accordion
                      key={key}
                      expanded={isExpanded}
                      onChange={() => toggleGroup(key)}
                      sx={{
                        mb: 0.5,
                        "&:before": { display: "none" },
                        boxShadow: "none",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: 40,
                          "&.Mui-expanded": { minHeight: 40 },
                          "& .MuiAccordionSummary-content": { my: 0.5 },
                          backgroundColor: "grey.50",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{ flexGrow: 1, mr: 0.5 }}
                        >
                          {getElementIcon(group.elementType)}
                          <Chip
                            label={group.displayId || group.elementId}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                            }}
                          />
                          <Typography variant="body2">
                            {group.elementName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({group.threats.length}{" "}
                            {t("tabs.threats.threats", {
                              defaultValue: "threats",
                            })}
                            )
                          </Typography>
                          {renderImpactChips(group.threats, true)}
                          <Box sx={{ flexGrow: 1 }} />
                          <Tooltip
                            title={t("tabs.threats.createDialog.addToGroup", {
                              defaultValue: "Add manual threat",
                            })}
                          >
                            <IconButton
                              size="small"
                              color="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateDialogGroup({
                                  dataFlowId: group.elementId,
                                  displayId: group.displayId,
                                  dataFlowName: group.elementName,
                                  sourceName: group.elementName,
                                  targetName: group.elementName,
                                  sourceId: group.elementId,
                                  targetId: group.elementId,
                                  sourceType: group.elementType,
                                  targetType: group.elementType,
                                  threats: group.threats,
                                });
                              }}
                            >
                              <AddIcon
                                fontSize="small"
                                sx={{ color: "text.secondary" }}
                              />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        {isExpanded && (
                          <InteractionThreatRows
                            threats={group.threats}
                            assetDataRef={assetDataRef}
                            showThreatActor={showThreatActor}
                            t={t}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })
              : sortedDataFlowGroups.map((group) => {
                  const key = `${table.trustBoundaryId || "ext"}-${group.dataFlowId}`;
                  const isExpanded = expandedGroups[key] ?? false;
                  return (
                    <Accordion
                      key={key}
                      expanded={isExpanded}
                      onChange={() => toggleGroup(key)}
                      sx={{
                        mb: 0.5,
                        "&:before": { display: "none" },
                        boxShadow: "none",
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: 40,
                          "&.Mui-expanded": { minHeight: 40 },
                          "& .MuiAccordionSummary-content": { my: 0.5 },
                          backgroundColor: "grey.50",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{ flexGrow: 1, mr: 0.5 }}
                        >
                          <DataFlowIcon fontSize="small" />
                          <Chip
                            label={group.displayId || group.dataFlowId}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                            }}
                          />
                          <Typography variant="body2">
                            {group.sourceName} → {group.targetName}
                          </Typography>
                          {group.dataFlowName &&
                            group.dataFlowName !== group.dataFlowId &&
                            !/^DataFlow\s+\S+$/i.test(group.dataFlowName) && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                ({group.dataFlowName})
                              </Typography>
                            )}
                          <Typography variant="caption" color="text.secondary">
                            ({group.threats.length}{" "}
                            {t("tabs.threats.threats", {
                              defaultValue: "threats",
                            })}
                            )
                          </Typography>
                          {renderImpactChips(group.threats, true)}
                          <Box sx={{ flexGrow: 1 }} />
                          {/* + button right side */}
                          <Tooltip
                            title={t("tabs.threats.createDialog.addToGroup", {
                              defaultValue: "Add manual threat",
                            })}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreateDialogGroup(group);
                              }}
                            >
                              <AddIcon
                                fontSize="small"
                                sx={{ color: "text.secondary" }}
                              />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        {isExpanded && (
                          <InteractionThreatRows
                            threats={group.threats}
                            assetDataRef={assetDataRef}
                            showThreatActor={showThreatActor}
                            t={t}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
          </AccordionDetails>
        </Accordion>

        <CreateThreatDialog
          open={!!createDialogGroup}
          table={table}
          existingThreats={table.threats}
          assetDataRef={assetDataRef}
          dataFlowRef={
            createDialogGroup
              ? {
                  dataFlowId: createDialogGroup.dataFlowId,
                  displayId: createDialogGroup.displayId,
                  dataFlowName: createDialogGroup.dataFlowName,
                  sourceName: createDialogGroup.sourceName,
                  targetName: createDialogGroup.targetName,
                  sourceId: createDialogGroup.sourceId,
                  targetId: createDialogGroup.targetId,
                }
              : undefined
          }
          onClose={() => setCreateDialogGroup(null)}
          onAdd={(threat) => {
            onAdd(threat);
            setCreateDialogGroup(null);
          }}
        />
      </>
    );
  },
);

InteractionThreatTable.displayName = "InteractionThreatTable";