// ==================== THREAT TABLE ====================
// Displays threats grouped by Trust Boundary and Element (per-element)
// or by Trust Boundary and DataFlow (per-interaction)
// Uses nested Accordions for better organization

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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Memory as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  CompareArrows as DataFlowIcon,
  Security as TrustBoundaryIcon,
  Add as AddIcon,
} from "@mui/icons-material";

import {
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  LinkedDFDElement,
  DataFlowReference,
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
  formatDataFlowDisplay,
} from "../models/threat-types";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

export interface AddThreatInfo {
  tableIndex: number;
  trustBoundaryId: string | null;
  trustBoundaryName: string;
  linkedElement?: LinkedDFDElement;
  dataFlow?: DataFlowReference;
}

interface ThreatTableProps {
  threatTables: ThreatTableType[];
  configuration: ThreatConfiguration;
  onEdit: (tableIndex: number, threat: Threat) => void;
  onDelete: (tableIndex: number, threatId: string) => void;
  onAdd?: (info: AddThreatInfo) => void;
}

interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  threats: Threat[];
}

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

// ==================== STRIDE COLORS ====================

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444", // red
  T: "#f97316", // orange
  R: "#eab308", // yellow
  I: "#22c55e", // green
  D: "#3b82f6", // blue
  E: "#a855f7", // purple
};

// ==================== ELEMENT ICONS ====================

const getElementIcon = (elementType: string) => {
  switch (elementType) {
    case "Process":
    case "Multiprocess":
      return <ProcessIcon fontSize="small" />;
    case "DataStore":
      return <DataStoreIcon fontSize="small" />;
    case "ExternalEntity":
      return <ExternalEntityIcon fontSize="small" />;
    case "DataFlow":
      return <DataFlowIcon fontSize="small" />;
    default:
      return <TrustBoundaryIcon fontSize="small" />;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Format element ID for display with dash
 * "EE1" → "EE-1", "P1" → "P-1", "DS1" → "DS-1"
 */
const formatDisplayId = (id: string): string => {
  // Match pattern: letters followed by numbers
  const match = id.match(/^([A-Z]+)(\d+)$/i);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`;
  }
  return id;
};

// ==================== COMPONENT ====================

export const ThreatTable: React.FC<ThreatTableProps> = ({
  threatTables,
  configuration,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";
  const isPerElement = configuration.activeMethod === "per-element";

  // Filter state
  const [strideFilter, setStrideFilter] = useState<StrideCategory | "">("");
  const [searchText, setSearchText] = useState("");

  // Expanded state for Trust Boundary accordions
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>(
    () =>
      threatTables.reduce(
        (acc, table) => ({
          ...acc,
          [table.trustBoundaryId || "external"]: true,
        }),
        {}
      )
  );

  // Expanded state for Element/DataFlow accordions (nested)
  const [expandedElements, setExpandedElements] = useState<
    Record<string, boolean>
  >({});

  // ==================== FILTERING ====================

  const filterThreats = (threats: Threat[]): Threat[] => {
    let filtered = threats;

    if (strideFilter) {
      filtered = filtered.filter((t) => t.strideCategory === strideFilter);
    }

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.id.toLowerCase().includes(search) ||
          t.threatDescription.toLowerCase().includes(search) ||
          t.attackDescription.toLowerCase().includes(search) ||
          t.mitigation.toLowerCase().includes(search) ||
          t.verification.toLowerCase().includes(search) ||
          t.linkedElement?.elementName.toLowerCase().includes(search) ||
          t.dataFlow?.dataFlowName.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  // ==================== GROUPING ====================

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
          threats: [],
        };
      }
      groups[elem.elementId].threats.push(threat);
    }

    // Sort by element ID
    return Object.values(groups).sort((a, b) =>
      a.elementId.localeCompare(b.elementId)
    );
  };

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

  // ==================== COLUMNS (simplified for nested view) ====================

  const createColumnsPerElement = (
    tableIndex: number
  ): GridColDef<Threat>[] => [
    {
      field: "id",
      headerName: t("tabs.threats.columns.threatId", { defaultValue: "T-ID" }),
      width: 110,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Threat>) => (
        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
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
      headerName: t("tabs.threats.columns.threat", { defaultValue: "Threat" }),
      flex: 1,
      minWidth: 180,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Threat>) => (
        <Tooltip title={params.value || ""}>
          <Typography
            variant="body2"
            sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {params.value || (
              <em style={{ color: "#9ca3af" }}>No description</em>
            )}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "threatActor",
      headerName: t("tabs.threats.columns.actor", { defaultValue: "Actor" }),
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
      width: 50,
      getActions: (params: GridRowParams<Threat>) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label={t("common.edit", { defaultValue: "Edit" })}
          onClick={() => onEdit(tableIndex, params.row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label={t("common.delete", { defaultValue: "Delete" })}
          onClick={() => onDelete(tableIndex, params.row.id)}
          showInMenu
        />,
      ],
    },
  ];

  const createColumnsPerInteraction = (
    tableIndex: number
  ): GridColDef<Threat>[] => [
    {
      field: "id",
      headerName: t("tabs.threats.columns.threatId", { defaultValue: "T-ID" }),
      width: 130,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Threat>) => (
        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
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
      headerName: t("tabs.threats.columns.threat", { defaultValue: "Threat" }),
      flex: 1,
      minWidth: 180,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Threat>) => (
        <Tooltip title={params.value || ""}>
          <Typography
            variant="body2"
            sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {params.value || (
              <em style={{ color: "#9ca3af" }}>No description</em>
            )}
          </Typography>
        </Tooltip>
      ),
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
      width: 50,
      getActions: (params: GridRowParams<Threat>) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label={t("common.edit", { defaultValue: "Edit" })}
          onClick={() => onEdit(tableIndex, params.row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label={t("common.delete", { defaultValue: "Delete" })}
          onClick={() => onDelete(tableIndex, params.row.id)}
          showInMenu
        />,
      ],
    },
  ];

  // ==================== TOGGLE HELPERS ====================

  const toggleTable = (tableId: string) => {
    setExpandedTables((prev) => ({ ...prev, [tableId]: !prev[tableId] }));
  };

  const toggleElement = (elementKey: string) => {
    setExpandedElements((prev) => ({
      ...prev,
      [elementKey]: !prev[elementKey],
    }));
  };

  const isTableExpanded = (tableId: string) =>
    expandedTables[tableId] !== false;
  const isElementExpanded = (elementKey: string) =>
    expandedElements[elementKey] !== false;

  // ==================== TOTAL COUNT ====================

  const totalFilteredThreats = useMemo(() => {
    return threatTables.reduce(
      (sum, table) => sum + filterThreats(table.threats).length,
      0
    );
  }, [threatTables, strideFilter, searchText]);

  // ==================== RENDER ====================

  if (threatTables.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: 200,
          color: "text.secondary",
        }}
      >
        <Typography variant="h6" gutterBottom>
          {t("tabs.threats.noThreats", { defaultValue: "No threats defined" })}
        </Typography>
        <Typography variant="body2">
          {t("tabs.threats.noThreatsHint", {
            defaultValue:
              "Click 'Generate Threats' to create threats based on your DFD.",
          })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}
    >
      {/* Filter Bar */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", px: 1 }}>
        <FilterIcon color="action" />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>STRIDE</InputLabel>
          <Select
            value={strideFilter}
            label="STRIDE"
            onChange={(e) =>
              setStrideFilter(e.target.value as StrideCategory | "")
            }
          >
            <MenuItem value="">
              <em>{t("common.all", { defaultValue: "All" })}</em>
            </MenuItem>
            {(["S", "T", "R", "I", "D", "E"] as StrideCategory[]).map((cat) => {
              const def = STRIDE_DEFINITIONS.find((s) => s.type === cat);
              return (
                <MenuItem key={cat} value={cat}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={cat}
                      size="small"
                      sx={{
                        backgroundColor: STRIDE_COLORS[cat],
                        color: "white",
                      }}
                    />
                    <span>{isGerman ? def?.nameDE : def?.name}</span>
                  </Stack>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder={t("common.search", { defaultValue: "Search..." })}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ flexGrow: 1, maxWidth: 300 }}
        />
        <Typography variant="caption" color="text.secondary">
          {t("tabs.threats.totalThreats", {
            defaultValue: "Total: {{count}} threats",
            count: totalFilteredThreats,
          })}
        </Typography>
      </Box>

      {/* Threat Tables - Nested Accordions */}
      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {threatTables.map((table, tableIndex) => {
          const filteredThreats = filterThreats(table.threats);
          const tableId = table.trustBoundaryId || "external";

          // Skip empty tables when filtering
          if (filteredThreats.length === 0 && (strideFilter || searchText)) {
            return null;
          }

          // Group threats by element or dataflow
          const elementGroups = isPerElement
            ? groupThreatsByElement(filteredThreats)
            : null;
          const dataFlowGroups = !isPerElement
            ? groupThreatsByDataFlow(filteredThreats)
            : null;

          return (
            <Accordion
              key={tableId}
              expanded={isTableExpanded(tableId)}
              onChange={() => toggleTable(tableId)}
              sx={{ mb: 1 }}
            >
              {/* Trust Boundary Header */}
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Chip
                    label={table.displayIdentifier}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography fontWeight="medium">
                    {table.trustBoundaryName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ({filteredThreats.length}{" "}
                    {t("tabs.threats.threats", { defaultValue: "threats" })})
                  </Typography>
                </Stack>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 1 }}>
                {/* Per-Element: Nested accordions by Element */}
                {isPerElement &&
                  elementGroups &&
                  elementGroups.map((group) => {
                    const elementKey = `${tableId}-${group.elementId}`;

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
                        {/* Element Header */}
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
                            {getElementIcon(group.elementType)}
                            <Chip
                              label={formatDisplayId(group.elementId)}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                              }}
                            />
                            <Typography variant="body2" fontWeight="medium">
                              {group.elementName}
                            </Typography>
                            <Chip
                              label={group.elementType}
                              size="small"
                              sx={{ fontSize: "0.7rem" }}
                            />
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ({group.threats.length}{" "}
                              {t("tabs.threats.threats", {
                                defaultValue: "threats",
                              })}
                              )
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            {onAdd && (
                              <Tooltip
                                title={t("tabs.threats.addThreat", {
                                  defaultValue: "Add Threat",
                                })}
                              >
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAdd({
                                      tableIndex,
                                      trustBoundaryId: table.trustBoundaryId,
                                      trustBoundaryName:
                                        table.trustBoundaryName,
                                      linkedElement: {
                                        elementId: group.elementId,
                                        elementName: group.elementName,
                                        elementType: group.elementType,
                                      },
                                    });
                                  }}
                                  sx={{ mr: 1 }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </AccordionSummary>

                        {/* Element Threats Table */}
                        <AccordionDetails sx={{ p: 0 }}>
                          <Box
                            sx={{
                              height: Math.min(
                                300,
                                group.threats.length * 52 + 56
                              ),
                            }}
                          >
                            <DataGrid
                              rows={group.threats}
                              columns={createColumnsPerElement(tableIndex)}
                              pageSizeOptions={[5, 10, 25]}
                              initialState={{
                                pagination: {
                                  paginationModel: { pageSize: 10 },
                                },
                                sorting: {
                                  sortModel: [
                                    { field: "strideCategory", sort: "asc" },
                                  ],
                                },
                              }}
                              disableRowSelectionOnClick
                              density="compact"
                              hideFooter={group.threats.length <= 5}
                              sx={{
                                border: "none",
                                "& .MuiDataGrid-cell": { py: 0.5 },
                              }}
                            />
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}

                {/* Per-Interaction: Nested accordions by DataFlow */}
                {!isPerElement &&
                  dataFlowGroups &&
                  dataFlowGroups.map((group) => {
                    const flowKey = `${tableId}-${group.dataFlowId}`;

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
                              label={group.dataFlowId}
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
                              group.dataFlowName !== group.dataFlowId && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  ({group.dataFlowName})
                                </Typography>
                              )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ({group.threats.length}{" "}
                              {t("tabs.threats.threats", {
                                defaultValue: "threats",
                              })}
                              )
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            {onAdd && (
                              <Tooltip
                                title={t("tabs.threats.addThreat", {
                                  defaultValue: "Add Threat",
                                })}
                              >
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAdd({
                                      tableIndex,
                                      trustBoundaryId: table.trustBoundaryId,
                                      trustBoundaryName:
                                        table.trustBoundaryName,
                                      dataFlow: {
                                        dataFlowId: group.dataFlowId,
                                        dataFlowName: group.dataFlowName,
                                        sourceId: group.sourceId,
                                        sourceName: group.sourceName,
                                        sourceType: group.sourceType,
                                        targetId: group.targetId,
                                        targetName: group.targetName,
                                        targetType: group.targetType,
                                      },
                                    });
                                  }}
                                  sx={{ mr: 1 }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </AccordionSummary>

                        {/* DataFlow Threats Table */}
                        <AccordionDetails sx={{ p: 0 }}>
                          <Box
                            sx={{
                              height: Math.min(
                                300,
                                group.threats.length * 52 + 56
                              ),
                            }}
                          >
                            <DataGrid
                              rows={group.threats}
                              columns={createColumnsPerInteraction(tableIndex)}
                              pageSizeOptions={[5, 10, 25]}
                              initialState={{
                                pagination: {
                                  paginationModel: { pageSize: 10 },
                                },
                                sorting: {
                                  sortModel: [
                                    { field: "strideCategory", sort: "asc" },
                                  ],
                                },
                              }}
                              disableRowSelectionOnClick
                              density="compact"
                              hideFooter={group.threats.length <= 6}
                              sx={{
                                border: "none",
                                "& .MuiDataGrid-cell": { py: 0.5 },
                              }}
                            />
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
};

export default ThreatTable;