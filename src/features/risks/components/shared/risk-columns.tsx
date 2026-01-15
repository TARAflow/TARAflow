import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
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
  FormControl,
  Select,
  MenuItem,
} from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";
import {
  Risk,
  RiskConfiguration,
  MoSCoWPriority,
  RiskStatus,
  MOSCOW_PRIORITIES,
  RISK_STATUSES,
  getRiskColor,
  getRiskLabel,
  getFactorDefinition,
} from "../../models/risk-types";
import type { StrideCategory } from "shared";

const MOSCOW_MAP = new Map(MOSCOW_PRIORITIES.map((p) => [p.value, p]));
const STATUS_MAP = new Map(RISK_STATUSES.map((s) => [s.value, s]));

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

interface UseRiskColumnsProps {
  configuration: RiskConfiguration;
  onEdit: (risk: Risk) => void;
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string
  ) => void;
  onStatusChange: (riskId: string, status: string) => void;
}

export const useRiskColumns = ({
  configuration,
  onEdit,
  onPriorityChange,
  onStatusChange,
}: UseRiskColumnsProps) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const columns = useMemo<GridColDef<Risk>[]>(() => {
    // Helper function to create factor breakdown tooltip
    const getFactorBreakdownTooltip = (
      risk: Risk,
      isMitigated: boolean = false
    ) => {
      const ratings = isMitigated
        ? risk.mitigatedFactorRatings
        : risk.factorRatings;
      const riskValue = isMitigated
        ? risk.calculatedRiskAfterMitigation
        : risk.calculatedRiskBeforeMitigation;

      if (!ratings || ratings.length === 0) {
        return {
          factors: t("tabs.risks.dialog.notRated", {
            defaultValue: "Not rated",
          }),
          riskLevel: null,
          riskColor: null,
        };
      }

      const lines = ratings
        .map((rating) => {
          const def = getFactorDefinition(
            rating.factorId,
            configuration.customFactors
          );
          if (!def) return null;
          const factorName = isGerman ? def.nameDE : def.name;
          const value = rating.value > 0 ? rating.value.toFixed(1) : "-";
          return `${factorName}: ${value}`;
        })
        .filter(Boolean);

      return {
        factors: lines.join("\n"),
        riskLevel: getRiskLabel(
          riskValue,
          configuration.scale,
          isGerman,
          configuration.roundingMethod
        ),
        riskColor: getRiskColor(
          riskValue,
          configuration.scale,
          configuration.roundingMethod
        ),
        riskValue: riskValue,
      };
    };

    const baseColumns: GridColDef<Risk>[] = [
      {
        field: "threatId",
        headerName: t("tabs.risks.columns.threatId", {
          defaultValue: "T-ID",
        }),
        width: 120,
        renderCell: (params: GridRenderCellParams<Risk>) => (
          <Tooltip title={params.value || ""} placement="top">
            <Chip
              label={params.value}
              size="small"
              sx={{
                backgroundColor:
                  STRIDE_COLORS[params.row.strideCategory] || "#9ca3af",
                color: "white",
                fontWeight: "bold",
                fontSize: "0.75rem",
                maxWidth: "100%",
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          </Tooltip>
        ),
      },
      {
        field: "strideCategory",
        headerName: t("tabs.risks.columns.stride", {
          defaultValue: "STRIDE",
        }),
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
        headerName: t("tabs.risks.columns.threat", {
          defaultValue: "Threat",
        }),
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
    const riskBeforeColumns: GridColDef<Risk>[] =
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
                const tooltipData = getFactorBreakdownTooltip(
                  params.row,
                  false
                );
                return (
                  <Tooltip
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          display="block"
                        >
                          {t("tabs.risks.dialog.riskFactors", {
                            defaultValue: "Factor Breakdown",
                          })}
                        </Typography>
                        {tooltipData.factors}
                        {tooltipData.riskLevel && (
                          <Box
                            sx={{
                              mt: 1,
                              pt: 1,
                              borderTop: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor: tooltipData.riskColor,
                                  border: "1px solid rgba(255,255,255,0.5)",
                                }}
                              />
                              <Typography variant="caption" fontWeight="bold">
                                {tooltipData.riskLevel}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          value,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
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
              headerName: t("tabs.risks.columns.impact", {
                defaultValue: "Impact",
              }),
              width: 80,
              align: "center",
              renderCell: (params: GridRenderCellParams<Risk>) => {
                const value = params.value as number;
                const impactFactors = params.row.factorRatings.filter((r) => {
                  const def = getFactorDefinition(
                    r.factorId,
                    configuration.customFactors
                  );
                  return def?.category === "impact";
                });
                const tooltipLines = impactFactors
                  .map((r) => {
                    const def = getFactorDefinition(
                      r.factorId,
                      configuration.customFactors
                    );
                    return `${isGerman ? def?.nameDE : def?.name}: ${
                      r.value > 0 ? r.value.toFixed(1) : "-"
                    }`;
                  })
                  .join("\n");

                return (
                  <Tooltip
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          display="block"
                        >
                          {t("tabs.risks.dialog.impactFactors", {
                            defaultValue: "Impact Factors",
                          })}
                        </Typography>
                        {tooltipLines || "-"}
                        {value > 0 && (
                          <Box
                            sx={{
                              mt: 1,
                              pt: 1,
                              borderTop: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor: getRiskColor(
                                    value,
                                    configuration.scale,
                                    configuration.roundingMethod
                                  ),
                                  border: "1px solid rgba(255,255,255,0.5)",
                                }}
                              />
                              <Typography variant="caption" fontWeight="bold">
                                {getRiskLabel(
                                  value,
                                  configuration.scale,
                                  isGerman,
                                  configuration.roundingMethod
                                )}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          value,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
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
                const likelihoodFactors = params.row.factorRatings.filter(
                  (r) => {
                    const def = getFactorDefinition(
                      r.factorId,
                      configuration.customFactors
                    );
                    return def?.category === "likelihood";
                  }
                );
                const tooltipLines = likelihoodFactors
                  .map((r) => {
                    const def = getFactorDefinition(
                      r.factorId,
                      configuration.customFactors
                    );
                    return `${isGerman ? def?.nameDE : def?.name}: ${
                      r.value > 0 ? r.value.toFixed(1) : "-"
                    }`;
                  })
                  .join("\n");

                return (
                  <Tooltip
                    title={
                      <Box sx={{ whiteSpace: "pre-line" }}>
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          display="block"
                        >
                          {t("tabs.risks.dialog.likelihoodFactors", {
                            defaultValue: "Likelihood Factors",
                          })}
                        </Typography>
                        {tooltipLines || "-"}
                        {value > 0 && (
                          <Box
                            sx={{
                              mt: 1,
                              pt: 1,
                              borderTop: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  backgroundColor: getRiskColor(
                                    value,
                                    configuration.scale,
                                    configuration.roundingMethod
                                  ),
                                  border: "1px solid rgba(255,255,255,0.5)",
                                }}
                              />
                              <Typography variant="caption" fontWeight="bold">
                                {getRiskLabel(
                                  value,
                                  configuration.scale,
                                  isGerman,
                                  configuration.roundingMethod
                                )}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          value,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
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
                  <Tooltip
                    title={
                      value > 0 ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              backgroundColor: getRiskColor(
                                value,
                                configuration.scale,
                                configuration.roundingMethod
                              ),
                              border: "1px solid rgba(255,255,255,0.5)",
                            }}
                          />
                          <Typography variant="caption" fontWeight="bold">
                            {getRiskLabel(
                              value,
                              configuration.scale,
                              isGerman,
                              configuration.roundingMethod
                            )}
                          </Typography>
                        </Stack>
                      ) : (
                        t("tabs.risks.dialog.notRated", {
                          defaultValue: "Not rated",
                        })
                      )
                    }
                    arrow
                  >
                    <Chip
                      label={value > 0 ? value.toFixed(1) : "-"}
                      size="small"
                      sx={{
                        backgroundColor: getRiskColor(
                          value,
                          configuration.scale,
                          configuration.roundingMethod
                        ),
                        color: "white",
                        fontWeight: "bold",
                        cursor: "help",
                      }}
                    />
                  </Tooltip>
                );
              },
            },
          ];

    // Risk After column (only for simple method)
    const riskAfterColumn: GridColDef<Risk> | null =
      configuration.method === "simple"
        ? {
            field: "calculatedRiskAfterMitigation",
            headerName: t("tabs.risks.columns.riskAfter", {
              defaultValue: "Risk (After)",
            }),
            width: 100,
            align: "center",
            renderCell: (params: GridRenderCellParams<Risk>) => {
              const value = params.value as number;
              const tooltipData = getFactorBreakdownTooltip(params.row, true);
              return (
                <Tooltip
                  title={
                    <Box sx={{ whiteSpace: "pre-line" }}>
                      <Typography
                        variant="caption"
                        fontWeight="bold"
                        display="block"
                      >
                        {t("tabs.risks.dialog.riskFactorsAfter", {
                          defaultValue: "Factor Breakdown (After)",
                        })}
                      </Typography>
                      {tooltipData.factors}
                      {tooltipData.riskLevel && (
                        <Box
                          sx={{
                            mt: 1,
                            pt: 1,
                            borderTop: "1px solid rgba(255,255,255,0.3)",
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                backgroundColor: tooltipData.riskColor,
                                border: "1px solid rgba(255,255,255,0.5)",
                              }}
                            />
                            <Typography variant="caption" fontWeight="bold">
                              {tooltipData.riskLevel}
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  }
                  arrow
                >
                  <Chip
                    label={value > 0 ? value.toFixed(1) : "-"}
                    size="small"
                    sx={{
                      backgroundColor: getRiskColor(
                        value,
                        configuration.scale,
                        configuration.roundingMethod
                      ),
                      color: "white",
                      fontWeight: "bold",
                      cursor: "help",
                    }}
                  />
                </Tooltip>
              );
            },
          }
        : null;

    // Priority & Status columns
    const priorityStatusColumns: GridColDef<Risk>[] = [
      {
        field: "moscowPriority",
        headerName: t("tabs.risks.columns.priority", {
          defaultValue: "Priority",
        }),
        width: 110,
        renderCell: (params: GridRenderCellParams<Risk>) => {
          const priority = MOSCOW_MAP.get(params.value);
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
        headerName: t("tabs.risks.columns.status", {
          defaultValue: "Status",
        }),
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
      headerName: t("tabs.risks.columns.mitigation", {
        defaultValue: "Mitigation",
      }),
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
      ...riskBeforeColumns,
      mitigationColumn,
      ...(riskAfterColumn ? [riskAfterColumn] : []),
      ...priorityStatusColumns,
      actionsColumn,
    ];
  }, [configuration, t, isGerman, onEdit, onPriorityChange, onStatusChange]);

  return columns;
};