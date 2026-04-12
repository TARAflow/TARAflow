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
} from "@mui/icons-material";

import {
  AssetReference,
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  isInterfaceTable,
  type AssetDataReference,
} from "../../models/threat-types";

import { sortThreatsByPriority } from "../../utils/threat-asset-utils";
import {
  ThreatSortField,
  SortDir,
  sortThreats,
  ThreatIdCell,
  StrideCell,
  MissingChip,
  ActorCell,
} from "../../components/shared/threat-table-utils";
import { ImpactCell } from "../../components/shared/impact-cell";
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

function isCompleted(t: Threat): boolean {
  return !!(
    t.threatDescription?.trim() &&
    t.attackDescription?.trim() &&
    t.mitigation?.trim() &&
    t.verification?.trim()
  );
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
        <Table size="small" sx={{ tableLayout: "fixed", minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...hdSx, width: 100 }}>
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

              return (
                <TableRow
                  key={threat.id}
                  hover
                  sx={{ "&:last-child td": { borderBottom: 0 } }}
                >
                  <TableCell sx={cellSx}>
                    <ThreatIdCell id={threat.id} />
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
                    {threat.mitigation ? (
                      <Tooltip title={threat.mitigation}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {threat.mitigation}
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
                    {threat.verification ? (
                      <Tooltip title={threat.verification}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.8rem",
                          }}
                        >
                          {threat.verification}
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
  ({ table, assetDataRef, showThreatActor = false, onEdit, onDelete }) => {
    const { t } = useTranslation();

    const [expandedGroups, setExpandedGroups] = useState<
      Record<string, boolean>
    >({});

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

    return (
      <Accordion
        defaultExpanded
        sx={{ "&:before": { display: "none" }, boxShadow: "1", mb: 1 }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            backgroundColor: "primary.50",
            "&:hover": { backgroundColor: "primary.100" },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <TrustBoundaryIcon color="primary" />
            <Chip
              label={table.displayIdentifier}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontFamily: "monospace" }}
            />
            <Typography variant="subtitle1" fontWeight="medium">
              {table.trustBoundaryName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({table.threats.length}{" "}
              {t("tabs.threats.threats", { defaultValue: "threats" })})
            </Typography>
            {renderImpactChips(table.threats)}
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
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {getElementIcon(group.elementType)}
                        <Chip
                          label={group.displayId || group.elementId}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
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
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <DataFlowIcon fontSize="small" />
                        <Typography variant="body2">
                          {group.sourceName} → {group.targetName}
                        </Typography>
                        {group.dataFlowName &&
                          group.dataFlowName !== group.dataFlowId &&
                          !/^DataFlow\s+\S+$/i.test(group.dataFlowName) && (
                            <Typography variant="body2" color="text.secondary">
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
    );
  },
);

InteractionThreatTable.displayName = "InteractionThreatTable";