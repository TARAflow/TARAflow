// ==================== THREAT TABLE ====================
// Displays threats grouped by Trust Boundary and Element (per-element)
// or by Trust Boundary and DataFlow (per-interaction)
// Uses nested Accordions for better organization
// Features:
// - Collapsible filter bar (STRIDE category, search text)
// - Grouped by Trust Boundary with nested Element/DataFlow accordions
//
// LOCALIZATION:
// For per-interaction threats, uses getEffectiveThreatDescription()
// to display localized text based on current language

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
  Collapse,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  SwapHoriz as DataFlowIcon,
  Security as TrustBoundaryIcon,
  Cable as CableIcon,
  SettingsInputComponent as InterfaceIcon,
  Add as AddIcon,
  ArrowDownward,
  ArrowUpward,
} from "@mui/icons-material";

import {
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  LinkedDFDElement,
  DataFlowReference,
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
  isInterfaceTable,
  isInterfaceThreat,
  getDefaultInterfaceThreatDescription,
  getDefaultInterfaceAttackDescription,
} from "../models/threat-types";
import {
  getEffectiveThreatDescription,
  formatInteractionDirection,
  getDirectionColor,
} from "../services/interaction-templates";
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
  showFilters?: boolean;
  onEdit: (tableIndex: number, threat: Threat) => void;
  onDelete: (tableIndex: number, threatId: string) => void;
  onAdd?: (info: AddThreatInfo) => void;
}

interface ElementGroup {
  elementId: string; // XML ID
  elementName: string;
  elementType: string;
  displayId?: string; // For display
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
  showFilters = false,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === "de" ? "de" : "en") as "en" | "de";
  const isGerman = locale === "de";
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
      filtered = filtered.filter((t) => {
        // Get effective description for search (localized)
        const effectiveDescription = getEffectiveThreatDescription(t, locale);

        return (
          t.id.toLowerCase().includes(search) ||
          effectiveDescription.toLowerCase().includes(search) ||
          t.attackDescription.toLowerCase().includes(search) ||
          t.mitigation.toLowerCase().includes(search) ||
          t.verification.toLowerCase().includes(search) ||
          t.linkedElement?.elementName.toLowerCase().includes(search) ||
          t.dataFlow?.dataFlowName.toLowerCase().includes(search)
        );
      });
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
          displayId: elem.displayId,
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

  /**
   * Group threats by Interface element
   * Used in per-interaction mode for interface tables
   */
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
      a.elementId.localeCompare(b.elementId)
    );
  };

  // ==================== COLUMNS (per-element - unchanged) ====================

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
              <em style={{ color: "#9ca3af" }}>
                {isGerman ? "Keine Beschreibung" : "No description"}
              </em>
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
      width: 70,
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

  // ==================== COLUMNS (per-interaction - WITH LOCALIZATION) ====================

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
    // Direction column for per-interaction
    {
      field: "interactionContext",
      headerName: t("tabs.threats.columns.direction", { defaultValue: "Dir" }),
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
          <Tooltip title={formatInteractionDirection(ctx.direction, locale)}>
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
    // Threat description with localization
    {
      field: "threatDescription",
      headerName: t("tabs.threats.columns.threat", { defaultValue: "Threat" }),
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Threat>) => {
        // Use localized description
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
      width: 70,
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

  const createColumnsPerInterface = (
    tableIndex: number
  ): GridColDef<Threat>[] => [
    {
      field: "id",
      headerName: t("tabs.threats.columns.threatId", { defaultValue: "T-ID" }),
      width: 150,
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
    // Threat description with localization for interfaces
    {
      field: "threatDescription",
      headerName: t("tabs.threats.columns.threat", { defaultValue: "Threat" }),
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Threat>) => {
        const threat = params.row;
        // For interface threats, use default descriptions if empty
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
      headerName: t("tabs.threats.columns.attack", { defaultValue: "Attack" }),
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
      width: 70,
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
    expandedElements[elementKey] === true; // Default: collapsed

  // ==================== TOTAL COUNT ====================

  const totalFilteredThreats = useMemo(() => {
    return threatTables.reduce(
      (sum, table) => sum + filterThreats(table.threats).length,
      0
    );
  }, [threatTables, strideFilter, searchText, locale]);

  // Check if a table contains interface threats
  const getTableType = (
    table: ThreatTableType
  ): "interface" | "dataflow" | "element" => {
    if (isInterfaceTable(table)) return "interface";
    if (!isPerElement && table.threats.length > 0 && table.threats[0].dataFlow)
      return "dataflow";
    return "element";
  };

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
      {/* Filter Bar - Collapsible */}
      <Collapse in={showFilters}>
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
              {(["S", "T", "R", "I", "D", "E"] as StrideCategory[]).map(
                (cat) => {
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
                            width: 28,
                            height: 20,
                          }}
                        />
                        <Typography variant="body2">
                          {isGerman ? def?.nameDE : def?.name}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  );
                }
              )}
            </Select>
          </FormControl>

          <TextField
            size="small"
            placeholder={t("tabs.threats.searchPlaceholder", {
              defaultValue: "Search threats...",
            })}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ width: 200 }}
          />

          <Typography variant="body2" color="text.secondary">
            {totalFilteredThreats}{" "}
            {t("tabs.threats.threatsFound", { defaultValue: "threats found" })}
          </Typography>
        </Box>
      </Collapse>

      {/* Accordion List */}
      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {threatTables.map((table, tableIndex) => {
          const tableId = table.trustBoundaryId || "external";
          const filteredThreats = filterThreats(table.threats);

          // Determine table type
          const tableType = getTableType(table);

          // FIX: Unique key based on type to avoid conflicts
          const accordionKey =
            tableType === "interface" ? `${tableId}-interfaces` : tableId;

          // Group threats based on table type
          const elementGroups =
            isPerElement || tableType === "interface"
              ? groupThreatsByElement(filteredThreats)
              : null;
          const dataFlowGroups =
            tableType === "dataflow"
              ? groupThreatsByDataFlow(filteredThreats)
              : null;
          const interfaceGroups =
            tableType === "interface"
              ? groupThreatsByInterface(filteredThreats)
              : null;

          if (filteredThreats.length === 0) return null;

          return (
            <Accordion
              key={accordionKey}
              expanded={isTableExpanded(accordionKey)}
              onChange={() => toggleTable(accordionKey)}
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
                  backgroundColor:
                    tableType === "interface" ? "warning.50" : "primary.50",
                  "&:hover": {
                    backgroundColor:
                      tableType === "interface" ? "warning.100" : "primary.100",
                  },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  {tableType === "interface" ? (
                    <CableIcon color="warning" />
                  ) : (
                    <TrustBoundaryIcon color="primary" />
                  )}
                  <Chip
                    label={table.displayIdentifier}
                    size="small"
                    color={tableType === "interface" ? "warning" : "primary"}
                    variant="outlined"
                    sx={{ fontFamily: "monospace" }}
                  />
                  <Typography variant="subtitle1" fontWeight="medium">
                    {table.trustBoundaryName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({filteredThreats.length}{" "}
                    {t("tabs.threats.threats", { defaultValue: "threats" })})
                  </Typography>
                </Stack>
              </AccordionSummary>

              {/* Nested Accordions */}
              <AccordionDetails sx={{ p: 1 }}>
                {/* Per-Element OR Interface: Nested accordions by Element */}
                {(isPerElement || tableType === "interface") &&
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
                            backgroundColor:
                              tableType === "interface"
                                ? "warning.50"
                                : "grey.50",
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
                                group.displayId ||
                                formatDisplayId(group.elementId)
                              }
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
                            <Chip
                              label={group.elementType}
                              size="small"
                              variant="outlined"
                              color={
                                tableType === "interface"
                                  ? "warning"
                                  : "default"
                              }
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

                        {/* Element/Interface Threats Table */}
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
                              columns={
                                tableType === "interface"
                                  ? createColumnsPerInterface(tableIndex)
                                  : createColumnsPerElement(tableIndex)
                              }
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
                {tableType === "dataflow" &&
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
                                400,
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
                                  paginationModel: { pageSize: 12 },
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