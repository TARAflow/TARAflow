// ==================== WONT RISK TABLE ====================
// Displays risks with MoSCoW priority "Won't"
// Shows justification for accepted risks
// Simpler table than main RiskTable

import React from "react";
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
  Typography,
  Tooltip,
  Paper,
  Stack,
} from "@mui/material";
import {
  Edit as EditIcon,
  DoNotDisturb as WontIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  getRiskColor,
} from "../models/risk-types";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

interface WontRiskTableProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  onEdit: (risk: Risk) => void;
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

// ==================== COMPONENT ====================

export const WontRiskTable = React.memo<WontRiskTableProps>(
  ({ risks, threats, configuration, onEdit }) => {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";

    // ==================== COLUMNS ====================

    const columns: GridColDef<Risk>[] = [
      {
        field: "threatId",
        headerName: t("tabs.risks.columns.threatId", { defaultValue: "T-ID" }),
        width: 100,
        renderCell: (params: GridRenderCellParams<Risk>) => (
          <Chip
            label={params.value}
            size="small"
            variant="outlined"
            sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
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
      {
        field: "calculatedRiskBeforeMitigation",
        headerName: t("tabs.risks.columns.originalRisk", {
          defaultValue: "Original Risk",
        }),
        width: 100,
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
      {
        field: "wontJustification",
        headerName: t("tabs.risks.columns.justification", {
          defaultValue: "Justification",
        }),
        flex: 1.5,
        minWidth: 250,
        renderCell: (params: GridRenderCellParams<Risk>) => {
          const value = params.value as string;
          const hasJustification = value && value.trim().length > 0;

          return (
            <Tooltip title={value || ""}>
              <Typography
                variant="body2"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: hasJustification ? "text.primary" : "error.main",
                  fontStyle: hasJustification ? "normal" : "italic",
                }}
              >
                {hasJustification
                  ? value
                  : t("tabs.risks.noJustification", {
                      defaultValue: "Missing justification!",
                    })}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
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
      },
    ];

    // ==================== RENDER ====================

    if (risks.length === 0) {
      return null;
    }

    return (
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
          borderColor: "grey.400",
          borderStyle: "dashed",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: "grey.100",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <WontIcon color="action" />
          <Typography variant="subtitle1" fontWeight="medium">
            {t("tabs.risks.wontTableTitle", {
              defaultValue: "Accepted Risks (Won't Address)",
            })}
          </Typography>
          <Chip
            label={risks.length}
            size="small"
            color="default"
            sx={{ ml: 1 }}
          />
        </Box>

        {/* Table */}
        <Box sx={{ height: Math.min(300, risks.length * 52 + 56) }}>
          <DataGrid
            rows={risks}
            columns={columns}
            pageSizeOptions={[5, 10]}
            initialState={{
              pagination: { paginationModel: { pageSize: 5 } },
              sorting: {
                sortModel: [
                  { field: "calculatedRiskBeforeMitigation", sort: "desc" },
                ],
              },
            }}
            disableRowSelectionOnClick
            density="compact"
            hideFooter={risks.length <= 5}
            sx={{
              border: "none",
              "& .MuiDataGrid-cell": { py: 0.5 },
              "& .MuiDataGrid-row": {
                backgroundColor: "grey.50",
              },
            }}
          />
        </Box>

        {/* Warning if missing justifications */}
        {risks.some(
          (r) => !r.wontJustification || !r.wontJustification.trim()
        ) && (
          <Box
            sx={{
              px: 2,
              py: 1,
              backgroundColor: "error.light",
              color: "error.contrastText",
            }}
          >
            <Typography variant="caption">
              {t("tabs.risks.wontWarning", {
                defaultValue:
                  "⚠️ Some accepted risks are missing justification. Please provide reasoning for compliance documentation.",
              })}
            </Typography>
          </Box>
        )}
      </Paper>
    );
  }
);

export default WontRiskTable;
