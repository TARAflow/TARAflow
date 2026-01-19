// ==================== ASSET TABLE ====================
// Displays assets in a MUI DataGrid with all columns
// Compatible with @mui/x-data-grid v8

import React, { useMemo } from "react";
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
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

import {
  Asset,
  AssetConfiguration,
  impactValueToLevel,
} from "../models/asset-types";

import {
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
  getImpactLevel,
} from "../models/asset-impact-types";
import type {
  SecurityGoal,
  SecurityGoalType,
} from "../models/asset-security-goals-types";
import { SECURITY_GOALS } from "../models/asset-security-goals-types";



// ==================== TYPES ====================

interface AssetTableProps {
  assets: Asset[];
  configuration: AssetConfiguration;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
}

// ==================== COMPONENT ====================

export const AssetTable: React.FC<AssetTableProps> = ({
  assets,
  configuration,
  onEdit,
  onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== COLUMNS ====================

  const columns = useMemo<GridColDef<Asset>[]>(() => {
    const scale = IMPACT_SCALES[configuration.impactScale];

    // Base columns
    const baseColumns: GridColDef<Asset>[] = [
      {
        field: "id",
        headerName: t("tabs.assets.columns.id", { defaultValue: "ID" }),
        width: 60,
        sortable: true,
      },
      {
        field: "name",
        headerName: t("tabs.assets.columns.name", { defaultValue: "Name" }),
        width: 120,
        minWidth: 80,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Asset>) => (
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
        field: "description",
        headerName: t("tabs.assets.columns.description", {
          defaultValue: "Description",
        }),
        flex: 2,
        minWidth: 250,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Asset>) => (
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

    // Impact criteria columns
    const impactColumns: GridColDef<Asset>[] = configuration.impactCriteria.map(
      (criterionId) => {
        const criterion = PREDEFINED_IMPACT_CRITERIA.find(
          (c) => c.id === criterionId
        );
        const name = isGerman
          ? criterion?.nameDE ?? criterionId
          : criterion?.name ?? criterionId;

        return {
          field: `impact_${criterionId}`,
          headerName: name,
          width: 80,
          sortable: true,
          align: "center" as const,
          headerAlign: "center" as const,
          renderCell: (params: GridRenderCellParams<Asset>) => {
            const row = params.row;
            if (!row || !row.impactRatings) {
              return <Typography color="text.disabled">-</Typography>;
            }

            const rating = row.impactRatings.find(
              (r) => r.criterionId === criterionId
            );
            const value = rating?.value ?? 0;

            if (value === 0) {
              return <Typography color="text.disabled">-</Typography>;
            }

            const criterionInfo = getCriterionInfo(criterionId, isGerman);
            const levelLabel = getImpactLevelLabel(value, scale, isGerman);

            return (
              <Tooltip
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      {criterionInfo.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ mb: 1 }}
                    >
                      {criterionInfo.description}
                    </Typography>
                    <Box
                      sx={{
                        pt: 1,
                        borderTop: "1px solid rgba(255,255,255,0.3)",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            backgroundColor: getImpactColor(
                              value,
                              scale.levels.length
                            ),
                            border: "1px solid rgba(255,255,255,0.5)",
                          }}
                        />
                        <Typography variant="caption" fontWeight="bold">
                          {levelLabel} ({value})
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Chip
                  label={value}
                  size="small"
                  sx={{
                    backgroundColor: getImpactColor(value, scale.levels.length),
                    color: "white",
                    fontWeight: "bold",
                    minWidth: 28,
                    cursor: "help",
                  }}
                />
              </Tooltip>
            );
          },
        };
      }
    );

    // Overall impact column
    const overallImpactColumn: GridColDef<Asset> = {
      field: "overallImpact",
      headerName: t("tabs.assets.columns.overallImpact", {
        defaultValue: "Overall",
      }),
      width: 70,
      sortable: true,
      align: "center",
      headerAlign: "center",
      renderCell: (params: GridRenderCellParams<Asset>) => {
        const value = params.value as number;
        if (!value || value === 0) {
          return <Typography color="text.disabled">-</Typography>;
        }

        const row = params.row;
        const level = getImpactLevel(value, configuration.roundingMethod);
        const levelLabel = getImpactLevelLabel(level, scale, isGerman);

        // Build factor breakdown
        const factorLines = row.impactRatings
          .filter((r) => r.value > 0)
          .map((rating) => {
            const criterionInfo = getCriterionInfo(
              rating.criterionId,
              isGerman
            );
            return `${criterionInfo.name}: ${rating.value}`;
          });

        // Calculation method info
        const methodLabel =
          configuration.calculationMethod === "conservative"
            ? isGerman
              ? "Konservativ (Maximum)"
              : "Conservative (Maximum)"
            : isGerman
            ? "Durchschnitt (Arithm. Mittel)"
            : "Average (Arithmetic Mean)";

        // Rounding method info
        const roundingLabel =
          configuration.roundingMethod === "ceil"
            ? isGerman
              ? "Konservativ"
              : "Conservative"
            : isGerman
            ? "Standard"
            : "Standard";

        return (
          <Tooltip
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  {t("tabs.assets.overallImpact", {
                    defaultValue: "Overall Impact",
                  })}
                </Typography>
                <Typography variant="caption" display="block">
                  {t("tabs.assets.calculationMethod", {
                    defaultValue: "Calculation",
                  })}
                  : {methodLabel}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                  {t("tabs.assets.roundingMethod", {
                    defaultValue: "Threshold",
                  })}
                  : {roundingLabel}
                </Typography>

                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                  >
                    {t("tabs.assets.criteriaBreakdown", {
                      defaultValue: "Criteria Breakdown:",
                    })}
                  </Typography>
                  <Box sx={{ pl: 1, whiteSpace: "pre-line" }}>
                    <Typography variant="caption">
                      {factorLines.join("\n")}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    pt: 1,
                    borderTop: "1px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: getImpactColor(
                          level,
                          scale.levels.length
                        ),
                        border: "1px solid rgba(255,255,255,0.5)",
                      }}
                    />
                    <Typography variant="caption" fontWeight="bold">
                      {levelLabel} ({value.toFixed(1)})
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            }
            arrow
            placement="top"
          >
            <Chip
              label={value.toFixed(1)}
              size="small"
              sx={{
                backgroundColor: getImpactColor(level, scale.levels.length),
                color: "white",
                fontWeight: "bold",
                cursor: "help",
              }}
            />
          </Tooltip>
        );
      },
    };

    // Security goals column (badges)
    const securityGoalsColumn: GridColDef<Asset> = {
      field: "securityGoals",
      headerName: t("tabs.assets.columns.securityGoals", {
        defaultValue: "Goals",
      }),
      width: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Asset>) => {
        const row = params.row;
        if (!row || !row.securityGoals) {
          return <Typography color="text.disabled">-</Typography>;
        }

        const goals = row.securityGoals.filter(
          (sg: SecurityGoal) => sg.enabled
        );
        if (goals.length === 0) {
          return <Typography color="text.disabled">-</Typography>;
        }

        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {goals.map((goal: SecurityGoal) => (
              <Tooltip
                key={goal.type}
                title={getSecurityGoalName(goal.type, isGerman)}
              >
                <Chip
                  label={goal.type}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: "0.65rem", height: 20 }}
                />
              </Tooltip>
            ))}
          </Stack>
        );
      },
    };

    // Security goals text column (descriptions)
    const securityGoalsTextColumn: GridColDef<Asset> = {
      field: "securityGoalsText",
      headerName: t("tabs.assets.columns.securityGoalsText", {
        defaultValue: "Security Requirements",
      }),
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Asset>) => {
        const row = params.row;
        if (!row || !row.securityGoals) {
          return <Typography color="text.disabled">-</Typography>;
        }

        const goalsWithText = row.securityGoals.filter(
          (sg: SecurityGoal) => sg.enabled && sg.formalDescription
        );

        if (goalsWithText.length === 0) {
          return <Typography color="text.disabled">-</Typography>;
        }

        // Combine all descriptions with goal type prefix
        const combinedText = goalsWithText
          .map((sg: SecurityGoal) => `[${sg.type}] ${sg.formalDescription}`)
          .join(" | ");

        return (
          <Tooltip title={combinedText}>
            <Typography
              variant="body2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {combinedText}
            </Typography>
          </Tooltip>
        );
      },
    };

    // Linked DFD elements column
    const linkedElementsColumn: GridColDef<Asset> = {
      field: "linkedDFDElements",
      headerName: t("tabs.assets.columns.linkedElements", {
        defaultValue: "DFD Links",
      }),
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Asset>) => {
        const row = params.row;
        if (!row || !row.linkedDFDElements) {
          return <Typography color="text.disabled">-</Typography>;
        }

        const links = row.linkedDFDElements;
        if (links.length === 0) {
          return (
            <Chip
              label={t("tabs.assets.notLinked", { defaultValue: "Not linked" })}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: "0.65rem" }}
            />
          );
        }

        // Show linked element names/types
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {links.slice(0, 3).map((link) => (
              <Tooltip
                key={link.elementId}
                title={`${link.displayId}: ${link.elementName} [${link.elementType}]`}
              >
                <Chip
                  label={link.displayId || link.elementId.slice(0, 8)}
                  size="small"
                  variant="outlined"
                  color="default"
                  sx={{ fontSize: "0.65rem", height: 20 }}
                />
              </Tooltip>
            ))}
            {links.length > 3 && (
              <Tooltip
                title={links
                  .slice(3)
                  .map(
                    (l) =>
                      `${l.displayId}: ${l.elementName} [${l.elementType}]`,
                  )
                  .join(", ")}
              >
                <Chip
                  label={`+${links.length - 3}`}
                  size="small"
                  sx={{ fontSize: "0.65rem", height: 20 }}
                />
              </Tooltip>
            )}
          </Stack>
        );
      },
    };

    // Actions column
    const actionsColumn: GridColDef<Asset> = {
      field: "actions",
      type: "actions",
      headerName: t("common.actions", { defaultValue: "Actions" }),
      width: 80,
      getActions: (params) => [
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
    };

    return [
      ...baseColumns,
      ...impactColumns,
      overallImpactColumn,
      securityGoalsColumn,
      securityGoalsTextColumn,
      linkedElementsColumn,
      actionsColumn,
    ];
  }, [configuration, t, isGerman, onEdit, onDelete]);

  // ==================== RENDER ====================

  if (assets.length === 0) {
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
          {t("tabs.assets.noAssets", { defaultValue: "No assets defined" })}
        </Typography>
        <Typography variant="body2">
          {t("tabs.assets.noAssetsHint", {
            defaultValue:
              "Add assets manually or sync from DFD to get started.",
          })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <DataGrid
        rows={assets}
        columns={columns}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          sorting: { sortModel: [{ field: "id", sort: "asc" }] },
        }}
        disableRowSelectionOnClick
        density="compact"
        sx={{
          "& .MuiDataGrid-cell": {
            py: 0.5,
          },
        }}
      />
    </Box>
  );
};

// ==================== HELPERS ====================

function getImpactColor(value: number, maxLevels: number): string {
  const colors: Record<number, string[]> = {
    3: ["#22c55e", "#eab308", "#ef4444"], // green, yellow, red
    4: ["#22c55e", "#eab308", "#f97316", "#ef4444"], // green, yellow, orange, red
    5: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"], // +purple
  };

  const palette = colors[maxLevels] || colors[5];
  return palette[Math.min(value - 1, palette.length - 1)] || "#6b7280";
}

function getSecurityGoalName(
  type: SecurityGoalType,
  isGerman: boolean
): string {
  const goal = SECURITY_GOALS.find((g) => g.type === type);
  return isGerman ? goal?.nameDE ?? type : goal?.name ?? type;
}

/**
 * Get impact level label (Low, Medium, High, Critical, Very High)
 */
function getImpactLevelLabel(
  value: number,
  scale: (typeof IMPACT_SCALES)[keyof typeof IMPACT_SCALES],
  isGerman: boolean
): string {
  if (value === 0) return "-";

  const level = scale.levels.find((l) => l.value === Math.round(value));
  if (!level) return value.toString();

  return isGerman ? level.labelDE : level.label;
}

/**
 * Get criterion info (name and description)
 */
function getCriterionInfo(
  criterionId: string,
  isGerman: boolean
): {
  name: string;
  description: string;
} {
  const criterion = PREDEFINED_IMPACT_CRITERIA.find(
    (c) => c.id === criterionId
  );
  if (!criterion) {
    return { name: criterionId, description: "" };
  }

  return {
    name: isGerman ? criterion.nameDE : criterion.name,
    description: isGerman ? criterion.descriptionDE : criterion.description,
  };
}

export default AssetTable;