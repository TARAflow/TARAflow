// ==================== INTERACTION THREAT TABLE ====================
// Displays threats for STRIDE per-interaction method
// Supports both DataFlow tables and Interface tables
// Grouped by Trust Boundary with nested DataFlow/Interface accordions
// Restored from original threat-table.tsx

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderCellParams,
  GridRowParams,
} from "@mui/x-data-grid";
import {
  Box,
  Chip,
  Stack,
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
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
  isInterfaceTable,
} from "../../models/threat-types";

import {
  getDefaultInterfaceThreatDescription,
  getDefaultInterfaceAttackDescription,
} from "../../models/per-interaction-types";

import {
  getEffectiveThreatDescription,
  formatInteractionDirection,
  getDirectionColor,
  getEffectiveAttackDescription,
} from "../../services/interaction-templates";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

interface DataFlowGroup {
  dataFlowId: string;
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
  onEdit: (threat: Threat) => void;
  onDelete: (threatId: string) => void;
}

// ==================== HELPER FUNCTIONS ====================

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
  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`;
  }
  return id;
};

// ==================== COMPONENT ====================

export const InteractionThreatTable = React.memo<InteractionThreatTableProps>(
  ({ table, tableIndex, configuration, onEdit, onDelete }) => {
    const { t, i18n } = useTranslation();
    const locale = (i18n.language === "de" ? "de" : "en") as "en" | "de";
    const isGerman = locale === "de";

    // Expanded state for DataFlow/Element accordions
    const [expandedElements, setExpandedElements] = useState<
      Record<string, boolean>
    >({});

    const toggleElement = (key: string) => {
      setExpandedElements((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isElementExpanded = (key: string) => expandedElements[key] ?? false;

    // Determine table type
    //const tableType = isInterfaceTable(table) ? "interface" : "dataflow";

    // ==================== GROUPING ====================

    const groupThreatsByDataFlow = (threats: Threat[]): DataFlowGroup[] => {
      const groups: Record<string, DataFlowGroup> = {};

      for (const threat of threats) {
        const df = threat.dataFlow;
        if (!df) continue;

        if (!groups[df.dataFlowId]) {
          groups[df.dataFlowId] = {
            dataFlowId: df.dataFlowId,
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
        a.dataFlowId.localeCompare(b.dataFlowId)
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

      return Object.values(groups).sort((a, b) => {
        const idA = a.displayId || a.elementName || a.elementId;
        const idB = b.displayId || b.elementName || b.elementId;
        return idA.localeCompare(idB, undefined, { numeric: true });
      });
    };

    const dataFlowGroups = useMemo(
      () => groupThreatsByDataFlow(table.threats),
      [table.threats]
    );

    const interfaceGroups = useMemo(
      () =>
        groupThreatsByInterface(
          table.threats.filter(
            (t) =>
              t.linkedElement &&
              (t.linkedElement.elementType === "Interface" ||
                t.linkedElement.elementType === "PhysicalInterface")
          )
        ),
      [table.threats]
    );

    // ==================== COLUMNS (Per-Interaction) ====================

    const interactionColumns: GridColDef<Threat>[] = useMemo(
      () => [
        {
          field: "id",
          headerName: t("tabs.threats.columns.threatId", {
            defaultValue: "T-ID",
          }),
          width: 130,
          sortable: true,
          renderCell: (params: GridRenderCellParams<Threat>) => (
            <Typography
              variant="body2"
              fontFamily="monospace"
              fontSize="0.75rem"
            >
              {params.value}
            </Typography>
          ),
        },
        {
          field: "strideCategory",
          headerName: "STRIDE",
          width: 80,
          sortable: true,
          align: "center",
          headerAlign: "center",
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const cat = params.value as StrideCategory;
            const def = STRIDE_DEFINITIONS.find((s) => s.type === cat);
            const name = isGerman ? def?.nameDE : def?.name;
            return (
              <Tooltip title={name || cat}>
                <Chip
                  label={cat}
                  size="small"
                  sx={{
                    backgroundColor: STRIDE_COLORS[cat],
                    color: "white",
                    fontWeight: "bold",
                  }}
                />
              </Tooltip>
            );
          },
        },
        {
          field: "interactionContext",
          headerName: t("tabs.threats.columns.direction", {
            defaultValue: "Dir",
          }),
          width: 60,
          sortable: true,
          sortComparator: (v1, v2) => {
            const d1 = v1?.direction || "";
            const d2 = v2?.direction || "";
            return d1.localeCompare(d2);
          },
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const ctx = params.row.interactionContext;
            if (!ctx) return null;

            return (
              <Tooltip
                title={formatInteractionDirection(ctx.direction, locale)}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: getDirectionColor(ctx.direction),
                    color: "white",
                  }}
                >
                  {ctx.direction === "incoming" ? (
                    <ArrowDownward sx={{ fontSize: 18 }} />
                  ) : (
                    <ArrowUpward sx={{ fontSize: 18 }} />
                  )}
                </Box>
              </Tooltip>
            );
          },
        },
        {
          field: "threatDescription",
          headerName: t("tabs.threats.columns.threat", {
            defaultValue: "Threat",
          }),
          flex: 1,
          minWidth: 200,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const effectiveDescription = getEffectiveThreatDescription(
              params.row,
              locale
            );

            return (
              <Tooltip title={effectiveDescription || ""}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {effectiveDescription || (
                    <em style={{ color: "#9ca3af" }}>
                      {isGerman ? "Keine Beschreibung" : "No description"}
                    </em>
                  )}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "attackDescription",
          headerName: t("tabs.threats.columns.attack", {
            defaultValue: "Attack",
          }),
          flex: 0.8,
          minWidth: 150,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const effectiveAttack = getEffectiveAttackDescription(
              params.row,
              locale
            );
            if (!effectiveAttack) {
              return (
                <Chip
                  label={t("tabs.threats.noAttack", {
                    defaultValue: "Missing",
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              );
            }
            return (
              <Tooltip title={effectiveAttack}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {effectiveAttack}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "threatActor",
          headerName: t("tabs.threats.columns.actor", {
            defaultValue: "Actor",
          }),
          width: 100,
          sortable: true,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const actor = THREAT_ACTORS.find((a) => a.type === params.value);
            const name = isGerman ? actor?.nameDE : actor?.name;
            return (
              <Chip
                label={name || params.value}
                size="small"
                variant="outlined"
                color={params.value === "external" ? "error" : "default"}
              />
            );
          },
        },
        {
          field: "mitigation",
          headerName: t("tabs.threats.columns.mitigation", {
            defaultValue: "Mitigation",
          }),
          flex: 0.8,
          minWidth: 120,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const value = params.value as string;
            if (!value) {
              return (
                <Chip
                  label={t("tabs.threats.noMitigation", {
                    defaultValue: "Missing",
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              );
            }
            return (
              <Tooltip title={value}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {value}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "verification",
          headerName: t("tabs.threats.columns.verification", {
            defaultValue: "Verification",
          }),
          flex: 0.8,
          minWidth: 120,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const value = params.value as string;
            if (!value) {
              return (
                <Chip
                  label={t("tabs.threats.noVerification", {
                    defaultValue: "Missing",
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              );
            }
            return (
              <Tooltip title={value}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {value}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "actions",
          type: "actions",
          headerName: "",
          width: 70,
          getActions: (params: GridRowParams<Threat>) => [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label={t("common.edit", { defaultValue: "Edit" })}
              onClick={() => onEdit(params.row)}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label={t("common.delete", { defaultValue: "Delete" })}
              onClick={() => onDelete(params.row.id)}
              showInMenu
            />,
          ],
        },
      ],
      [t, isGerman, locale, onEdit, onDelete]
    );

    // ==================== COLUMNS (Interface) ====================

    const interfaceColumns: GridColDef<Threat>[] = useMemo(
      () => [
        {
          field: "id",
          headerName: t("tabs.threats.columns.threatId", {
            defaultValue: "T-ID",
          }),
          width: 150,
          sortable: true,
          renderCell: (params: GridRenderCellParams<Threat>) => (
            <Typography
              variant="body2"
              fontFamily="monospace"
              fontSize="0.75rem"
            >
              {params.value}
            </Typography>
          ),
        },
        {
          field: "strideCategory",
          headerName: "STRIDE",
          width: 80,
          sortable: true,
          align: "center",
          headerAlign: "center",
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const cat = params.value as StrideCategory;
            const def = STRIDE_DEFINITIONS.find((s) => s.type === cat);
            const name = isGerman ? def?.nameDE : def?.name;
            return (
              <Tooltip title={name || cat}>
                <Chip
                  label={cat}
                  size="small"
                  sx={{
                    backgroundColor: STRIDE_COLORS[cat],
                    color: "white",
                    fontWeight: "bold",
                  }}
                />
              </Tooltip>
            );
          },
        },
        {
          field: "threatDescription",
          headerName: t("tabs.threats.columns.threat", {
            defaultValue: "Threat",
          }),
          flex: 1,
          minWidth: 200,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const threat = params.row;
            let effectiveDescription = threat.threatDescription;

            if (!effectiveDescription && threat.linkedElement) {
              effectiveDescription = getDefaultInterfaceThreatDescription(
                threat.strideCategory,
                threat.linkedElement.elementName,
                locale
              );
            }

            return (
              <Tooltip title={effectiveDescription || ""}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {effectiveDescription || (
                    <em style={{ color: "#9ca3af" }}>
                      {isGerman ? "Keine Beschreibung" : "No description"}
                    </em>
                  )}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "attackDescription",
          headerName: t("tabs.threats.columns.attack", {
            defaultValue: "Attack",
          }),
          flex: 0.8,
          minWidth: 180,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const threat = params.row;
            let effectiveAttack = threat.attackDescription;

            if (!effectiveAttack && threat.linkedElement) {
              effectiveAttack = getDefaultInterfaceAttackDescription(
                threat.strideCategory,
                threat.linkedElement.elementName,
                locale
              );
            }

            return (
              <Tooltip title={effectiveAttack || ""}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {effectiveAttack || (
                    <em style={{ color: "#9ca3af" }}>
                      {isGerman ? "Keine Beschreibung" : "No description"}
                    </em>
                  )}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "threatActor",
          headerName: t("tabs.threats.columns.actor", {
            defaultValue: "Actor",
          }),
          width: 100,
          sortable: true,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const actor = THREAT_ACTORS.find((a) => a.type === params.value);
            const name = isGerman ? actor?.nameDE : actor?.name;
            return (
              <Chip
                label={name || params.value}
                size="small"
                variant="outlined"
                color={params.value === "external" ? "error" : "default"}
              />
            );
          },
        },
        {
          field: "mitigation",
          headerName: t("tabs.threats.columns.mitigation", {
            defaultValue: "Mitigation",
          }),
          flex: 0.8,
          minWidth: 120,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const value = params.value as string;
            if (!value) {
              return (
                <Chip
                  label={t("tabs.threats.noMitigation", {
                    defaultValue: "Missing",
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              );
            }
            return (
              <Tooltip title={value}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {value}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "verification",
          headerName: t("tabs.threats.columns.verification", {
            defaultValue: "Verification",
          }),
          flex: 0.8,
          minWidth: 120,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const value = params.value as string;
            if (!value) {
              return (
                <Chip
                  label={t("tabs.threats.noVerification", {
                    defaultValue: "Missing",
                  })}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              );
            }
            return (
              <Tooltip title={value}>
                <Typography
                  variant="body2"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {value}
                </Typography>
              </Tooltip>
            );
          },
        },
        {
          field: "actions",
          type: "actions",
          headerName: "",
          width: 70,
          getActions: (params: GridRowParams<Threat>) => [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label={t("common.edit", { defaultValue: "Edit" })}
              onClick={() => onEdit(params.row)}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label={t("common.delete", { defaultValue: "Delete" })}
              onClick={() => onDelete(params.row.id)}
              showInMenu
            />,
          ],
        },
      ],
      [t, isGerman, locale, onEdit, onDelete]
    );

    // ==================== RENDER ====================

    return (
      <Accordion
        defaultExpanded
        sx={{
          mb: 1,
          "&:before": { display: "none" },
          boxShadow: 1,
        }}
      >
        {/* Trust Boundary Header */}
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            backgroundColor: "primary.50",
            "&:hover": {
              backgroundColor: "primary.100",
            },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {<TrustBoundaryIcon color="primary" />}
            <Chip
              label={table.displayIdentifier}
              size="small"
              color={"primary"}
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
          </Stack>
        </AccordionSummary>

        {/* Nested Accordions */}
        <AccordionDetails sx={{ p: 1 }}>
          {/* Interface Tables: Nested by Element */}
          {interfaceGroups.map((group) => {
            const elementKey = `${table.trustBoundaryId || "external"}-${
              group.elementId
            }`;

            return (
              <Accordion
                key={elementKey}
                expanded={isElementExpanded(elementKey)}
                onChange={() => toggleElement(elementKey)}
                sx={{
                  mb: 0.5,
                  "&:before": { display: "none" },
                  boxShadow: "none",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* Interface Element Header */}
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    minHeight: 40,
                    "&.Mui-expanded": { minHeight: 40 },
                    "& .MuiAccordionSummary-content": { my: 0.5 },
                    backgroundColor: "warning.50",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ flexGrow: 1 }}
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
                    <Typography variant="body2">{group.elementName}</Typography>
                    <Chip
                      label={group.elementType}
                      size="small"
                      variant="outlined"
                      color="warning"
                      sx={{ fontSize: "0.7rem" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ({group.threats.length}{" "}
                      {t("tabs.threats.threats", {
                        defaultValue: "threats",
                      })}
                      )
                    </Typography>
                  </Stack>
                </AccordionSummary>

                {/* Interface Threats DataGrid */}
                <AccordionDetails sx={{ p: 0 }}>
                  <DataGrid
                    rows={group.threats}
                    columns={interfaceColumns}
                    autoHeight
                    disableRowSelectionOnClick
                    hideFooter
                    density="compact"
                    sx={{
                      border: "none",
                      "& .MuiDataGrid-cell": {
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      },
                    }}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* DataFlow Tables: Nested by DataFlow */}
          {dataFlowGroups.map((group) => {
            const flowKey = `${table.trustBoundaryId || "external"}-${
              group.dataFlowId
            }`;

            return (
              <Accordion
                key={flowKey}
                expanded={isElementExpanded(flowKey)}
                onChange={() => toggleElement(flowKey)}
                sx={{
                  mb: 0.5,
                  "&:before": { display: "none" },
                  boxShadow: "none",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* DataFlow Header */}
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
                    sx={{ flexGrow: 1 }}
                  >
                    <DataFlowIcon fontSize="small" />
                    <Chip
                      label={`${group.dataFlowId}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                    />
                    <Typography variant="body2">
                      {group.sourceName} → {group.targetName}
                    </Typography>
                    {group.dataFlowName &&
                      group.dataFlowName !== group.dataFlowId && (
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
                  </Stack>
                </AccordionSummary>

                {/* DataFlow Threats DataGrid */}
                <AccordionDetails sx={{ p: 0 }}>
                  <DataGrid
                    rows={group.threats}
                    columns={interactionColumns}
                    autoHeight
                    disableRowSelectionOnClick
                    hideFooter
                    density="compact"
                    sx={{
                      border: "none",
                      "& .MuiDataGrid-cell": {
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      },
                    }}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </AccordionDetails>
      </Accordion>
    );
  }
);

InteractionThreatTable.displayName = "InteractionThreatTable";