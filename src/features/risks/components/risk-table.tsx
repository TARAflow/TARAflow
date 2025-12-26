// ==================== RISK TABLE ====================
// Displays risks in a MUI DataGrid with configurable columns
// Grouped by Trust Boundary (and by Element/DataFlow matching threat-table)
// Supports both simple and complex methods

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderCellParams,
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
  Select,
  MenuItem,
  FormControl,
  TextField,
  InputAdornment,
  LinearProgress,
} from "@mui/material";
import {
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Security as TrustBoundaryIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Memory as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  CompareArrows as DataFlowIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  MoSCoWPriority,
  RiskStatus,
  MOSCOW_PRIORITIES,
  RISK_STATUSES,
  getRiskColor,
  getRiskLabel,
  getFactorDefinition,
} from "../models/risk-types";
import type { StrideCategory, StrideMethod } from "shared";

// ==================== TYPES ====================

interface RiskTableProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  strideMethod: StrideMethod;
  onEdit: (risk: Risk) => void;
  onPriorityChange: (riskId: string, priority: string, justification?: string) => void;
  onStatusChange: (riskId: string, status: string) => void;
}

interface TrustBoundaryGroup {
  id: string;
  name: string;
  displayIdentifier?: string;
  risks: Risk[];
  elements?: ElementGroup[];
  dataFlows?: DataFlowGroup[];
}

interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  risks: Risk[];
}

interface DataFlowGroup {
  dataFlowId: string;
  dataFlowName: string;
  sourceName?: string;
  targetName?: string;
  risks: Risk[];
}

// ==================== STRIDE COLORS ====================

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate progress statistics for a group of risks
 */
function calculateProgress(risks: Risk[]): { done: number; total: number; percent: number } {
  const total = risks.length;
  const done = risks.filter(
    (r) => r.status === "mitigated" || r.status === "accepted" || r.status === "wont-do"
  ).length;
  return {
    done,
    total,
    percent: total > 0 ? (done / total) * 100 : 0,
  };
}

/**
 * Format element ID with hyphen (e.g., EE1 -> EE-1)
 */
function formatElementId(elementId: string): string {
  // Match pattern like EE1, P2, DS3
  const match = elementId.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return elementId;
}

/**
 * Get element icon based on type
 */
function getElementIcon(elementType: string) {
  switch (elementType?.toLowerCase()) {
    case "dataflow":
      return <DataFlowIcon fontSize="small" color="action" />;
    case "process":
    case "multiprocess":
      return <ProcessIcon fontSize="small" color="action" />;
    case "datastore":
    case "data store":
      return <DataStoreIcon fontSize="small" color="action" />;
    case "externalentity":
    case "external entity":
      return <ExternalEntityIcon fontSize="small" color="action" />;
    default:
      return <ProcessIcon fontSize="small" color="action" />;
  }
}

// ==================== COMPONENT ====================

export const RiskTable: React.FC<RiskTableProps> = ({
  risks,
  threats,
  configuration,
  strideMethod,
  onEdit,
  onPriorityChange,
  onStatusChange,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";
  const isPerElement = strideMethod === "per-element";

  // Filter state
  const [searchText, setSearchText] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<MoSCoWPriority | "">("");
  const [statusFilter, setStatusFilter] = useState<RiskStatus | "">("");

  // Expanded state for Trust Boundary accordions (collapsed by default)
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  // Expanded state for Element/DataFlow accordions (collapsed by default)
  const [expandedElements, setExpandedElements] = useState<Record<string, boolean>>({});

  // ==================== FILTERING ====================

  const filteredRisks = useMemo(() => {
    let filtered = risks;

    if (priorityFilter) {
      filtered = filtered.filter((r) => r.moscowPriority === priorityFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          r.id.toLowerCase().includes(search) ||
          r.threatId.toLowerCase().includes(search) ||
          r.threatDescription.toLowerCase().includes(search) ||
          r.selectedMitigations.some((m) => m.toLowerCase().includes(search))
        );
      });
    }

    return filtered;
  }, [risks, priorityFilter, statusFilter, searchText]);

  // ==================== GROUPING ====================

  const groupedByTrustBoundary = useMemo(() => {
    const groups = new Map<string, TrustBoundaryGroup>();

    for (const risk of filteredRisks) {
      const threat = threats.find((t) => t.id === risk.threatId);
      const tbId = threat?.trustBoundaryId || "external";
      const tbName = threat?.trustBoundaryName || "External Entities";

      if (!groups.has(tbId)) {
        groups.set(tbId, { 
          id: tbId, 
          name: tbName, 
          displayIdentifier: tbId !== "external" ? `TB-${tbId.replace(/\D/g, "") || "X"}` : undefined,
          risks: [], 
          elements: [], 
          dataFlows: [] 
        });
      }
      
      const group = groups.get(tbId)!;
      group.risks.push(risk);

      // For per-element: group by element within trust boundary
      if (isPerElement && threat?.elementName) {
        // Extract element info from threatId (e.g., "EE1-S-1" -> "EE1")
        const elementIdMatch = risk.threatId.match(/^([A-Z]+\d+)/);
        const elementId = elementIdMatch ? elementIdMatch[1] : threat.elementName;
        const elementType =
          elementId.startsWith("DF") ? "DataFlow"
          : elementId.startsWith("EE") ? "ExternalEntity"
          : elementId.startsWith("DS") ? "DataStore"
          : "Process";
        
        let elementGroup = group.elements?.find((e) => e.elementId === elementId);
        if (!elementGroup) {
          elementGroup = { 
            elementId, 
            elementName: threat.elementName, 
            elementType,
            risks: [] 
          };
          group.elements!.push(elementGroup);
        }
        elementGroup.risks.push(risk);
      }

      // For per-interaction: group by dataflow within trust boundary
      if (!isPerElement && threat?.dataFlowName) {
        // Extract dataflow info
        const dataFlowIdMatch = risk.threatId.match(/^(DF\d+)/);
        const dataFlowId = dataFlowIdMatch ? dataFlowIdMatch[1] : `DF-${threat.dataFlowName}`;
        
        let dataFlowGroup = group.dataFlows?.find((df) => df.dataFlowId === dataFlowId);
        if (!dataFlowGroup) {
          dataFlowGroup = { 
            dataFlowId, 
            dataFlowName: threat.dataFlowName,
            risks: [] 
          };
          group.dataFlows!.push(dataFlowGroup);
        }
        dataFlowGroup.risks.push(risk);
      }
    }

    // Sort groups: External Entities last, then by name
    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === "external") return 1;
      if (b.id === "external") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredRisks, threats, isPerElement]);

  // ==================== COLUMNS ====================

  const columns = useMemo<GridColDef<Risk>[]>(() => {
    // Helper function to create factor breakdown tooltip
    const getFactorBreakdownTooltip = (risk: Risk, isMitigated: boolean = false) => {
      const ratings = isMitigated ? risk.mitigatedFactorRatings : risk.factorRatings;
      
      if (!ratings || ratings.length === 0) {
        return t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" });
      }

      const lines = ratings.map((rating) => {
        const def = getFactorDefinition(rating.factorId, configuration.customFactors);
        if (!def) return null;
        const factorName = isGerman ? def.nameDE : def.name;
        const value = rating.value > 0 ? rating.value.toFixed(1) : "-";
        return `${factorName}: ${value}`;
      }).filter(Boolean);

      return lines.join("\n");
    };

    const baseColumns: GridColDef<Risk>[] = [
      {
        field: "threatId",
        headerName: t("tabs.risks.columns.threatId", { defaultValue: "T-ID" }),
        width: 120,
        renderCell: (params: GridRenderCellParams<Risk>) => (
          <Chip
            label={params.value}
            size="small"
            sx={{
              backgroundColor:
                STRIDE_COLORS[params.row.strideCategory] || "#9ca3af",
              color: "white",
              fontWeight: "bold",
              fontSize: "0.75rem",
            }}
          />
        ),
      },
      {
        field: "strideCategory",
        headerName: t("tabs.risks.columns.stride", { defaultValue: "STRIDE" }),
        width: 70,
        align: "center",
        renderCell: (params: GridRenderCellParams<Risk>) => (
          <Chip
            label={params.value}
            size="small"
            sx={{
              backgroundColor: STRIDE_COLORS[params.value as StrideCategory],
              color: "white",
              fontWeight: "bold",
              minWidth: 32,
            }}
          />
        ),
      },
      {
        field: "threatDescription",
        headerName: t("tabs.risks.columns.threat", { defaultValue: "Threat" }),
        flex: 1,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<Risk>) => (
          <Tooltip title={params.value || ""}>
            <Typography
              variant="body2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {params.value || "-"}
            </Typography>
          </Tooltip>
        ),
      },
    ];

    // Risk columns based on method
    const riskColumns: GridColDef<Risk>[] =
      configuration.method === "simple"
        ? [
            {
              field: "calculatedRiskBeforeMitigation",
              headerName: t("tabs.risks.columns.riskBefore", {
                defaultValue: "Risk (Before)",
              }),
              width: 100,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                const tooltipContent = getFactorBreakdownTooltip(params.row, false);
                return (
                  <Tooltip 
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography variant="caption" fontWeight="bold" display="block">
                          {t("tabs.risks.dialog.riskFactors", { defaultValue: "Factor Breakdown" })}
                        </Typography>
                        {tooltipContent}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(value, configuration.scale),
                        color: "white",
                        fontWeight: "bold",
                        cursor: "help",
                      }}
                    />
                  </Tooltip>
                );
              },
            },
            {
              field: "calculatedRiskAfterMitigation",
              headerName: t("tabs.risks.columns.riskAfter", {
                defaultValue: "Risk (After)",
              }),
              width: 100,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                const tooltipContent = getFactorBreakdownTooltip(params.row, true);
                return (
                  <Tooltip 
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography variant="caption" fontWeight="bold" display="block">
                          {t("tabs.risks.dialog.riskFactorsAfter", { defaultValue: "Factor Breakdown (After)" })}
                        </Typography>
                        {tooltipContent}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(value, configuration.scale),
                        color: "white",
                        fontWeight: "bold",
                        cursor: "help",
                      }}
                    />
                  </Tooltip>
                );
              },
            },
          ]
        : [
            {
              field: "calculatedImpact",
              headerName: t("tabs.risks.columns.impact", { defaultValue: "Impact" }),
              width: 80,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                const impactFactors = params.row.factorRatings.filter((r) => {
                  const def = getFactorDefinition(r.factorId, configuration.customFactors);
                  return def?.category === "impact";
                });
                const tooltipLines = impactFactors.map((r) => {
                  const def = getFactorDefinition(r.factorId, configuration.customFactors);
                  return `${isGerman ? def?.nameDE : def?.name}: ${r.value > 0 ? r.value.toFixed(1) : "-"}`;
                }).join("\n");
                
                return (
                  <Tooltip 
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography variant="caption" fontWeight="bold" display="block">
                          {t("tabs.risks.dialog.impactFactors", { defaultValue: "Impact Factors" })}
                        </Typography>
                        {tooltipLines || "-"}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(value, configuration.scale),
                        color: "white",
                        cursor: "help",
                      }}
                    />
                  </Tooltip>
                );
              },
            },
            {
              field: "calculatedLikelihood",
              headerName: t("tabs.risks.columns.likelihood", {
                defaultValue: "Likelihood",
              }),
              width: 90,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                const likelihoodFactors = params.row.factorRatings.filter((r) => {
                  const def = getFactorDefinition(r.factorId, configuration.customFactors);
                  return def?.category === "likelihood";
                });
                const tooltipLines = likelihoodFactors.map((r) => {
                  const def = getFactorDefinition(r.factorId, configuration.customFactors);
                  return `${isGerman ? def?.nameDE : def?.name}: ${r.value > 0 ? r.value.toFixed(1) : "-"}`;
                }).join("\n");
                
                return (
                  <Tooltip 
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography variant="caption" fontWeight="bold" display="block">
                          {t("tabs.risks.dialog.likelihoodFactors", { defaultValue: "Likelihood Factors" })}
                        </Typography>
                        {tooltipLines || "-"}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(value, configuration.scale),
                        color: "white",
                        cursor: "help",
                      }}
                    />
                  </Tooltip>
                );
              },
            },
            {
              field: "calculatedRiskBeforeMitigation",
              headerName: t("tabs.risks.columns.riskBefore", {
                defaultValue: "Risk",
              }),
              width: 80,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                return (
                  <Chip
                    label={value > 0 ? value.toFixed(1) : "-"}
                    size="small"
                    sx={{
                      backgroundColor: getRiskColor(value, configuration.scale),
                      color: "white",
                      fontWeight: "bold",
                    }}
                  />
                );
              },
            },
          ];

    // Priority & Status columns
    const priorityStatusColumns: GridColDef<Risk>[] = [
      {
        field: "moscowPriority",
        headerName: t("tabs.risks.columns.priority", { defaultValue: "Priority" }),
        width: 110,
        renderCell: (params: GridRenderCellParams<Risk>) => {
          const priority = MOSCOW_PRIORITIES.find(
            (p) => p.value === params.value
          );
          return (
            <FormControl size="small" fullWidth>
              <Select
                value={params.value}
                onChange={(e) =>
                  onPriorityChange(params.row.id, e.target.value)
                }
                size="small"
                sx={{
                  fontSize: "0.75rem",
                  "& .MuiSelect-select": { py: 0.5 },
                }}
              >
                {MOSCOW_PRIORITIES.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    <Chip
                      label={isGerman ? p.labelDE : p.label}
                      size="small"
                      sx={{
                        backgroundColor: p.color,
                        color: "white",
                        fontSize: "0.65rem",
                      }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        },
      },
      {
        field: "status",
        headerName: t("tabs.risks.columns.status", { defaultValue: "Status" }),
        width: 120,
        renderCell: (params: GridRenderCellParams<Risk>) => {
          const status = RISK_STATUSES.find((s) => s.value === params.value);
          return (
            <FormControl size="small" fullWidth>
              <Select
                value={params.value}
                onChange={(e) => onStatusChange(params.row.id, e.target.value)}
                size="small"
                sx={{
                  fontSize: "0.75rem",
                  "& .MuiSelect-select": { py: 0.5 },
                }}
              >
                {RISK_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    <Chip
                      label={isGerman ? s.labelDE : s.label}
                      size="small"
                      sx={{
                        backgroundColor: s.color,
                        color: "white",
                        fontSize: "0.65rem",
                      }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        },
      },
    ];

    // Mitigation column
    const mitigationColumn: GridColDef<Risk> = {
      field: "selectedMitigations",
      headerName: t("tabs.risks.columns.mitigation", { defaultValue: "Mitigation" }),
      flex: 0.8,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Risk>) => {
        const mitigations = params.value as string[];
        if (!mitigations || mitigations.length === 0) {
          return (
            <Typography variant="body2" color="text.disabled">
              -
            </Typography>
          );
        }
        const combined = mitigations.join("; ");
        return (
          <Tooltip title={combined}>
            <Typography
              variant="body2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {combined}
            </Typography>
          </Tooltip>
        );
      },
    };

    // Actions column
    const actionsColumn: GridColDef<Risk> = {
      field: "actions",
      type: "actions",
      headerName: t("common.actions", { defaultValue: "Actions" }),
      width: 60,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label={t("common.edit", { defaultValue: "Edit" })}
          onClick={() => onEdit(params.row)}
        />,
      ],
    };

    return [
      ...baseColumns,
      ...riskColumns,
      ...priorityStatusColumns,
      mitigationColumn,
      actionsColumn,
    ];
  }, [configuration, t, isGerman, onEdit, onPriorityChange, onStatusChange]);

  // ==================== RENDER PROGRESS CHIP ====================

  const renderProgressChip = (risks: Risk[]) => {
    const progress = calculateProgress(risks);
    const chipColor = progress.percent === 100 ? "success" : progress.percent > 50 ? "warning" : "default";
    const progressColor = progress.percent === 100 ? "success" : progress.percent > 50 ? "warning" : "primary";
    
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={`${progress.done}/${progress.total}`}
          size="small"
          color={chipColor as "success" | "warning" | "default"}
          variant="outlined"
        />
        <Box sx={{ width: 60, display: { xs: "none", sm: "block" } }}>
          <LinearProgress
            variant="determinate"
            value={progress.percent}
            color={progressColor as "success" | "warning" | "primary"}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </Stack>
    );
  };

  // ==================== RENDER DATA GRID ====================

  const renderDataGrid = (risksToShow: Risk[], height?: number) => (
    <Box sx={{ height: height || Math.min(400, risksToShow.length * 52 + 56) }}>
      <DataGrid
        rows={risksToShow}
        columns={columns}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
          sorting: {
            sortModel: [{ field: "calculatedRiskBeforeMitigation", sort: "desc" }],
          },
        }}
        disableRowSelectionOnClick
        density="compact"
        hideFooter={risksToShow.length <= 10}
        sx={{
          border: "none",
          "& .MuiDataGrid-cell": { py: 0.5 },
        }}
      />
    </Box>
  );

  // ==================== RENDER ====================

  if (risks.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          color: "text.secondary",
        }}
      >
        <Typography variant="h6" gutterBottom>
          {t("tabs.risks.noRisks", { defaultValue: "No risks to display" })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Filters */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
          pb: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <TextField
          size="small"
          placeholder={t("tabs.risks.searchPlaceholder", {
            defaultValue: "Search risks...",
          })}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as MoSCoWPriority | "")
            }
            displayEmpty
            startAdornment={<FilterIcon fontSize="small" sx={{ mr: 1 }} />}
          >
            <MenuItem value="">
              {t("tabs.risks.allPriorities", { defaultValue: "All Priorities" })}
            </MenuItem>
            {MOSCOW_PRIORITIES.filter((p) => p.value !== "wont").map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {isGerman ? p.labelDE : p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RiskStatus | "")}
            displayEmpty
          >
            <MenuItem value="">
              {t("tabs.risks.allStatuses", { defaultValue: "All Statuses" })}
            </MenuItem>
            {RISK_STATUSES.filter((s) => s.value !== "wont-do").map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {isGerman ? s.labelDE : s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" color="text.secondary">
          {t("tabs.risks.showingCount", {
            count: filteredRisks.length,
            total: risks.length,
            defaultValue: `Showing ${filteredRisks.length} of ${risks.length}`,
          })}
        </Typography>
      </Box>

      {/* Grouped Tables */}
      {groupedByTrustBoundary.map((group) => (
        <Accordion
          key={group.id}
          expanded={expandedTables[group.id] ?? false}
          onChange={() =>
            setExpandedTables((prev) => ({
              ...prev,
              [group.id]: !prev[group.id],
            }))
          }
          sx={{
            "&:before": { display: "none" },
            boxShadow: 1,
          }}
        >
          {/* Trust Boundary Header - matching threat-table style */}
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              backgroundColor: "primary.50",
              "&:hover": { backgroundColor: "primary.100" },
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%" }}>
              <TrustBoundaryIcon color="primary" />
              {group.displayIdentifier && (
                <Chip
                  label={group.displayIdentifier}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              )}
              <Typography variant="subtitle1" fontWeight="medium">
                {group.name}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              {renderProgressChip(group.risks)}
            </Stack>
          </AccordionSummary>

          <AccordionDetails sx={{ p: 1 }}>
            {/* Per-element: Show nested accordions for elements */}
            {isPerElement && group.elements && group.elements.length > 0 ? (
              group.elements.map((element) => {
                const elementKey = `${group.id}-${element.elementId}`;
                
                return (
                  <Accordion
                    key={elementKey}
                    expanded={expandedElements[elementKey] ?? false}
                    onChange={() =>
                      setExpandedElements((prev) => ({
                        ...prev,
                        [elementKey]: !prev[elementKey],
                      }))
                    }
                    sx={{
                      mb: 0.5,
                      "&:before": { display: "none" },
                      boxShadow: "none",
                      border: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { mb: 0 },
                    }}
                  >
                    {/* Element Header - matching threat-table style */}
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        minHeight: 40,
                        "&.Mui-expanded": { minHeight: 40 },
                        "& .MuiAccordionSummary-content": { my: 0.5 },
                        backgroundColor: "grey.50",
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                        {getElementIcon(element.elementType)}
                        <Chip
                          label={formatElementId(element.elementId)}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
                        />
                        <Typography variant="body2" fontWeight="medium">
                          {element.elementName}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        {renderProgressChip(element.risks)}
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      {renderDataGrid(element.risks)}
                    </AccordionDetails>
                  </Accordion>
                );
              })
            ) : !isPerElement && group.dataFlows && group.dataFlows.length > 0 ? (
              // Per-interaction: Show nested accordions for dataflows
              group.dataFlows.map((dataFlow) => {
                const flowKey = `${group.id}-${dataFlow.dataFlowId}`;
                
                return (
                  <Accordion
                    key={flowKey}
                    expanded={expandedElements[flowKey] ?? false}
                    onChange={() =>
                      setExpandedElements((prev) => ({
                        ...prev,
                        [flowKey]: !prev[flowKey],
                      }))
                    }
                    sx={{
                      mb: 0.5,
                      "&:before": { display: "none" },
                      boxShadow: "none",
                      border: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { mb: 0 },
                    }}
                  >
                    {/* DataFlow Header - matching threat-table style */}
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        minHeight: 40,
                        "&.Mui-expanded": { minHeight: 40 },
                        "& .MuiAccordionSummary-content": { my: 0.5 },
                        backgroundColor: "grey.50",
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                        <DataFlowIcon fontSize="small" color="action" />
                        <Chip
                          label={dataFlow.dataFlowId}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
                        />
                        <Typography variant="body2" fontWeight="medium">
                          {dataFlow.dataFlowName}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        {renderProgressChip(dataFlow.risks)}
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      {renderDataGrid(dataFlow.risks)}
                    </AccordionDetails>
                  </Accordion>
                );
              })
            ) : (
              // Fallback: Show risks directly if no sub-groups
              renderDataGrid(group.risks)
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default RiskTable;