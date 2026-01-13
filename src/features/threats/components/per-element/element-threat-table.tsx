// ==================== ELEMENT THREAT TABLE ====================
// Displays threats for STRIDE per-element method
// Grouped by Trust Boundary with nested Element accordions
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
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  SwapHoriz as DataFlowIcon,
  Security as TrustBoundaryIcon,
  Cable as CableIcon,
  SettingsInputComponent as InterfaceIcon,
} from "@mui/icons-material";

import {
  Threat,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
} from "../../models/threat-types";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";

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

export const ElementThreatTable = React.memo<ElementThreatTableProps>(
  ({ table, tableIndex, configuration, onEdit, onDelete }) => {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";

    // Expanded state for Element accordions
    const [expandedElements, setExpandedElements] = useState<
      Record<string, boolean>
    >({});

    const toggleElement = (key: string) => {
      setExpandedElements((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isElementExpanded = (key: string) => expandedElements[key] ?? false;

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

      return Object.values(groups).sort((a, b) => {
        const idA = a.displayId || a.elementName || a.elementId;
        const idB = b.displayId || b.elementName || b.elementId;
        return idA.localeCompare(idB, undefined, { numeric: true });
      });
    };

    const elementGroups = useMemo(
      () => groupThreatsByElement(table.threats),
      [table.threats]
    );

    // ==================== COLUMNS ====================

    const columns: GridColDef<Threat>[] = useMemo(
      () => [
        {
          field: "id",
          headerName: t("tabs.threats.columns.threatId", {
            defaultValue: "T-ID",
          }),
          width: 110,
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
          field: "attackDescription",
          headerName: t("tabs.threats.columns.attack", {
            defaultValue: "Attack",
          }),
          flex: 0.8,
          minWidth: 150,
          sortable: false,
          renderCell: (params: GridRenderCellParams<Threat>) => {
            const value = params.value as string;
            if (!value) {
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
      [t, isGerman, onEdit, onDelete]
    );

    // ==================== RENDER ====================

    return (
      <Accordion
        defaultExpanded
        sx={{
          "&:before": { display: "none" },
          boxShadow: "1",
          mb: 1,
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
          </Stack>
        </AccordionSummary>

        {/* Nested Element Accordions */}
        <AccordionDetails sx={{ p: 1 }}>
          {elementGroups.map((group) => {
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
                      sx={{ fontSize: "0.7rem" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ({group.threats.length}{" "}
                      {t("tabs.threats.threats", { defaultValue: "threats" })})
                    </Typography>
                  </Stack>
                </AccordionSummary>

                {/* Threat DataGrid */}
                <AccordionDetails sx={{ p: 0 }}>
                  <DataGrid
                    rows={group.threats}
                    columns={columns}
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

ElementThreatTable.displayName = "ElementThreatTable";