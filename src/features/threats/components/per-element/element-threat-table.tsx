// ==================== ELEMENT THREAT TABLE ====================
// Displays threats for STRIDE per-element method.
// Grouped by Trust Boundary → nested Element accordions → MUI Table rows.
// MUI Table replaces DataGrid for 10× faster initial render.

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
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  SwapHoriz as DataFlowIcon,
  Security as TrustBoundaryIcon,
  Cable as CableIcon,
  SettingsInputComponent as InterfaceIcon,
  Add as AddIcon,
} from "@mui/icons-material";

import {
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
} from "../../models/threat-types";
import { AssetReference, type AssetDataReference } from "shared";
import { sortThreatsByPriority } from "../../utils/threat-asset-utils";
import {
  ThreatSortField,
  SortDir,
  sortThreats,
  ThreatIdCell,
  StrideCell,
  DescriptionCell,
  MissingChip,
  ActorCell,
  SourceBadge,
} from "../../components/shared/threat-table-utils";
import { ImpactCell } from "../../components/shared/impact-cell";
import { CreateThreatDialog } from "../../components/shared/create-threat-dialog";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "../../services/threat-catalog-service";

// ==================== TYPES ====================

interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  displayId?: string;
  threats: Threat[];
}

export interface ElementThreatTableProps {
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

const formatDisplayId = (id: string): string => {
  const match = id.match(/^([A-Z]+)(\d+)$/i);
  return match ? `${match[1].toUpperCase()}-${match[2]}` : id;
};

// ==================== IMPACT COUNT HELPER ====================

type ImpactLevel = "CRITICAL" | "HIGH+" | "HIGH" | "MED+" | "MED" | "LOW";
const IMPACT_ORDER: ImpactLevel[] = ["CRITICAL", "HIGH+", "HIGH", "MED+", "MED", "LOW"];
const IMPACT_CHIP_COLORS: Record<ImpactLevel, { bg: string; border: string; color: string }> = {
  "CRITICAL": { bg: "#dc262618", border: "#dc2626", color: "#dc2626" },
  "HIGH+":    { bg: "#ea580c18", border: "#ea580c", color: "#ea580c" },
  "HIGH":     { bg: "#f9731618", border: "#f97316", color: "#f97316" },
  "MED+":     { bg: "#ca8a0418", border: "#ca8a04", color: "#ca8a04" },
  "MED":      { bg: "#eab30818", border: "#d97706", color: "#d97706" },
  "LOW":      { bg: "#16a34a18", border: "#16a34a", color: "#16a34a" },
};

const RELEVANCE_ROW_BG: Record<string, string> = {
  unrated: "transparent",
  relevant: "#f0fdf4",
  not_relevant: "#fef2f2",
  uncertain: "#fffbeb",
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
    // Find worst impact for this threat (safety overrides business impact)
    const hasSafety = linked.some(
      (a) => a.physicalImpact === "fatality" || a.physicalImpact === "irreversible_injury",
    );
    const worstBusiness = linked.reduce<ImpactLevel | undefined>((acc, a) => {
      const imp = a.aggregatedImpact as ImpactLevel | undefined;
      if (!imp) return acc;
      if (!acc) return imp;
      return IMPACT_ORDER.indexOf(imp) < IMPACT_ORDER.indexOf(acc) ? imp : acc;
    }, undefined);
    // Safety + CRITICAL business → CRITICAL, safety alone → HIGH
    const effective: ImpactLevel | undefined = hasSafety && worstBusiness === "CRITICAL"
      ? "CRITICAL"
      : hasSafety ? "HIGH"
      : worstBusiness;
    if (effective) {
      counts[effective] = (counts[effective] ?? 0) + 1;
    }
  }
  return counts;
}

// ==================== COMPLETION HELPER ====================

function isCompleted(t: Threat): boolean {
  return t.workflowStatus === "reviewed" || t.workflowStatus === "closed";
}

function countCompletedByLevel(
  threats: Threat[],
  assetDataRef?: AssetDataReference,
): Partial<Record<ImpactLevel, { done: number; total: number }>> {
  const result: Partial<Record<ImpactLevel, { done: number; total: number }>> = {};
  if (!assetDataRef) return result;

  for (const t of threats) {
    const linked = t.linkedAssetIds
      .map((id) => assetDataRef.assets.find((a) => a.id === id))
      .filter((a): a is AssetReference => Boolean(a));
    const hasSafety = linked.some(
      (a) => a.physicalImpact === "fatality" || a.physicalImpact === "irreversible_injury",
    );
    const worstBusiness = linked.reduce<ImpactLevel | undefined>((acc, a) => {
      const imp = a.aggregatedImpact as ImpactLevel | undefined;
      if (!imp) return acc;
      if (!acc) return imp;
      return IMPACT_ORDER.indexOf(imp) < IMPACT_ORDER.indexOf(acc) ? imp : acc;
    }, undefined);
    const level: ImpactLevel | undefined = hasSafety && worstBusiness === "CRITICAL"
      ? "CRITICAL" : hasSafety ? "HIGH" : worstBusiness;
    if (!level) continue;
    const prev = result[level] ?? { done: 0, total: 0 };
    result[level] = { done: prev.done + (isCompleted(t) ? 1 : 0), total: prev.total + 1 };
  }
  return result;
}

// ==================== INNER TABLE ====================

const ThreatRows: React.FC<{
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
              <TableCell sx={{ ...hdSx, width: 110 }}>
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
                <TableCell sx={{ ...hdSx, width: 120 }}>
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
                      <ThreatIdCell id={threat.displayId} />
                      <SourceBadge
                        source={threat.source}
                        initialImpact={threat.initialImpact}
                      />
                    </Stack>
                  </TableCell>

                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    <StrideCell cat={threat.strideCategory} />
                  </TableCell>

                  <TableCell sx={cellSx}>
                    <DescriptionCell
                      value={threat.threatDescription}
                      fallback={t("tabs.threats.noDescription", {
                        defaultValue: "No description",
                      })}
                    />
                  </TableCell>

                  <TableCell sx={cellSx}>
                    {threat.attackDescription ? (
                      <DescriptionCell
                        value={threat.attackDescription}
                        fallback=""
                      />
                    ) : (
                      <MissingChip
                        label={t("tabs.threats.noAttack", {
                          defaultValue: "Missing",
                        })}
                      />
                    )}
                  </TableCell>

                  <TableCell sx={cellSx}>
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
                      disableHoverListener={!mitigationTooltip}
                    >
                      <span>
                        {hasMitigations ? (
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
                        ) : (
                          <MissingChip
                            label={t("tabs.threats.noMitigation", {
                              defaultValue: "Missing",
                            })}
                          />
                        )}
                      </span>
                    </Tooltip>
                  </TableCell>

                  <TableCell sx={cellSx}>
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
                      disableHoverListener={!verificationTooltip}
                    >
                      <span>
                        {hasVerifications ? (
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
                        ) : (
                          <MissingChip
                            label={t("tabs.threats.noVerification", {
                              defaultValue: "Missing",
                            })}
                          />
                        )}
                      </span>
                    </Tooltip>
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
ThreatRows.displayName = "ThreatRows";

// ==================== COMPONENT ====================

export const ElementThreatTable = React.memo<ElementThreatTableProps>(
  ({
    table,
    assetDataRef,
    showThreatActor = false,
    onEdit,
    onDelete,
    onAdd,
  }) => {
    const { t } = useTranslation();

    const [expandedElements, setExpandedElements] = useState<
      Record<string, boolean>
    >({});

    const [createDialogGroup, setCreateDialogGroup] = useState<{
      elementId: string;
      elementName: string;
      elementType: string;
      displayId?: string;
    } | null>(null);

    const toggleElement = useCallback((key: string) => {
      setExpandedElements((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const groupThreatsByElement = (threats: Threat[]): ElementGroup[] => {
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
      return Object.values(groups).sort((a, b) => {
        const idA = a.displayId || a.elementName || a.elementId;
        const idB = b.displayId || b.elementName || b.elementId;
        return idA.localeCompare(idB, undefined, { numeric: true });
      });
    };

    const elementGroups = useMemo(
      () => groupThreatsByElement(table.threats),
      [table.threats],
    );

    const sortedElementGroups = useMemo(
      () =>
        elementGroups.map((g) => ({
          ...g,
          threats: sortThreatsByPriority(g.threats, assetDataRef),
        })),
      [elementGroups, assetDataRef],
    );

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
            {sortedElementGroups.map((group) => {
              const elementKey = `${table.trustBoundaryId || "external"}-${group.elementId}`;
              const isExpanded = expandedElements[elementKey] ?? false;

              return (
                <Accordion
                  key={elementKey}
                  expanded={isExpanded}
                  onChange={() => toggleElement(elementKey)}
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
                        label={
                          group.displayId || formatDisplayId(group.elementId)
                        }
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                      />
                      <Typography variant="body2">
                        {group.elementName}
                      </Typography>
                      <Chip
                        label={group.elementType}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.7rem" }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        ({group.threats.length}{" "}
                        {t("tabs.threats.threats", { defaultValue: "threats" })}
                        )
                      </Typography>
                      {(() => {
                        const counts = countImpacts(
                          group.threats,
                          assetDataRef,
                        );
                        const completedByLevel = countCompletedByLevel(
                          group.threats,
                          assetDataRef,
                        );
                        return (
                          <>
                            {IMPACT_ORDER.filter(
                              (lvl) => (counts[lvl] ?? 0) > 0,
                            ).map((lvl) => {
                              const c = IMPACT_CHIP_COLORS[lvl];
                              return (
                                <Chip
                                  key={lvl}
                                  label={`${completedByLevel[lvl]?.done ?? 0}/${completedByLevel[lvl]?.total ?? counts[lvl] ?? 0} ${lvl}`}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: "0.6rem",
                                    bgcolor: c.bg,
                                    color: c.color,
                                    border: `1px solid ${c.border}`,
                                  }}
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                      {/* + button rightmost, left of expand — stopPropagation prevents accordion toggle */}
                      <Box sx={{ flexGrow: 1 }} />
                      <Tooltip
                        title={t("tabs.threats.createDialog.addToGroup", {
                          defaultValue: "Add manual threat",
                        })}
                      >
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreateDialogGroup({
                              elementId: group.elementId,
                              elementName: group.elementName,
                              elementType: group.elementType,
                              displayId: group.displayId,
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
                      <ThreatRows
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

        {/* Create Threat Dialog */}
        <CreateThreatDialog
          open={!!createDialogGroup}
          table={table}
          existingThreats={table.threats}
          assetDataRef={assetDataRef}
          elementId={createDialogGroup?.elementId}
          elementName={createDialogGroup?.elementName}
          elementType={createDialogGroup?.elementType}
          elementDisplayId={createDialogGroup?.displayId}
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

ElementThreatTable.displayName = "ElementThreatTable";