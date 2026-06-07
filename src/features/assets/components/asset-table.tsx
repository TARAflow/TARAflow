// ==================== ASSET TABLE ====================
// Displays assets in a MUI DataGrid
//
// Column order:
//   ID | Name | Type | [Factors] | Safety | Overall | Aggregated | HVA | Sec. Goals | Downstream | DFD Links | Actions
//
// Fixes applied vs previous version:
//   - ASSET_GROUP_CONFIG imported from "shared" (asset-color-constants.ts)
//   - Category icons kept as local map (React elements cannot go in shared)
//   - getCategoryFromAsset(): derives category from ID prefix (DA/SY/PR/IN/HU)
//     → asset.category to survive any field-name variant
//   - ID chip width 95 so content is never clipped
//   - DFD Links tooltip uses JSX Box — plain "\n" strings are not rendered by MUI Tooltip
//   - columnVisibilityModel controlled via useState → user toggles persist across renders
//   - NO GridToolbar slot (causes "Component is not a function" crash in x-data-grid v7)
//   - All hardcoded strings replaced with t() — no more isGerman ternaries for UI text
//
// Compatible with @mui/x-data-grid v7

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import { Box, Button, Chip, Stack, Tooltip, Typography } from "@mui/material";
import {
  Edit as EditIcon,
  Star as StarIcon,
  LocalFireDepartment as FlameIcon,
  AccountTree as DerivedIcon,
  EditNote as ManualIcon,
  TableRows as ShowColumnsIcon,
  // Category icons — kept local, shared cannot hold React elements
  Article as DataIcon,
  Functions as FunctionIcon,
  Computer as SystemIcon,
  Settings as ProcessIcon,
  Dns as InfraIcon,
  Inventory2 as PhysicalIcon,
  Cloud as ServiceIcon,
  Person as HumanIcon,
  Nature as EnvironmentIcon,
} from "@mui/icons-material";

import type { Asset, AssetConfiguration, AssetToAssetRelationReference } from "../models/asset-types";
import type { DFDElementLink } from "../models/dfd-reference-types";
import { getDownstreamCount } from "../utils/asset-graph-utils";
import {
  PREDEFINED_IMPACT_CRITERIA,
  IMPACT_SCALES,
  SAFETY_CRITERION_ID,
  IMPACT_CRITERION_KEY_PREFIX,
} from "../models/asset-impact-types";
import type {
  SecurityGoal,
  SecurityGoalType,
} from "../models/asset-security-goals-types";
import {
  SECURITY_GOALS,
  SECURITY_GOAL_KEY_PREFIX,
} from "../models/asset-security-goals-types";
import {
  getImpactLevel,
  calculateOverallImpact,
} from "../services/asset-impact-calculator";

// Import color config from shared — no dependency on dfd-types or relation-types
import { ASSET_GROUP_CONFIG, type AssetGroup } from "shared";

// ==================== TYPES ====================

export interface AssetTableProps {
  assets: Asset[];
  configuration: AssetConfiguration;
  a2aRelations?: AssetToAssetRelationReference[];
  onEdit: (asset: Asset) => void;
}

// ==================== CATEGORY ICONS ====================
// Icons cannot live in shared (React elements) — kept local and merged with ASSET_GROUP_CONFIG

const ASSET_GROUP_ICONS: Record<AssetGroup, React.ReactElement> = {
  data: <DataIcon sx={{ fontSize: 14 }} />,
  function: <FunctionIcon sx={{ fontSize: 14 }} />,
  system: <SystemIcon sx={{ fontSize: 14 }} />,
  infrastructure: <InfraIcon sx={{ fontSize: 14 }} />,
  process: <ProcessIcon sx={{ fontSize: 14 }} />,
  physical: <PhysicalIcon sx={{ fontSize: 14 }} />,
  service: <ServiceIcon sx={{ fontSize: 14 }} />,
  human: <HumanIcon sx={{ fontSize: 14 }} />,
  environment: <EnvironmentIcon sx={{ fontSize: 14 }} />,
};

// ==================== CATEGORY LOOKUP ====================
// Primary:  asset.properties.category  — set by asset-sync-service from dfdAsset.assetGroup
// Fallback: ID prefix heuristic        — for assets in storage before the sync fix was deployed
//   DA-xxx → data  |  SY-xxx → system  |  PR-xxx → process
//   IN-xxx → infrastructure  |  HU-xxx → human

const ID_PREFIX_TO_CATEGORY: Record<string, AssetGroup> = {
  DA: "data",
  FU: "function",
  SY: "system",
  IF: "infrastructure",
  PR: "process",
  PH: "physical",
  SE: "service",
  HU: "human",
  EN: "environment",
};

function getCategoryFromAsset(asset: Asset): AssetGroup | undefined {
  // 1. Canonical path — populated by asset-sync-service since sync fix
  const fromProperties = asset.properties?.category;
  if (fromProperties && fromProperties in ASSET_GROUP_CONFIG)
    return fromProperties as AssetGroup;

  // 2. Fallback: derive from ID prefix for legacy / manually-created assets
  const prefix = asset.id?.split("-")[0]?.toUpperCase();
  return prefix ? ID_PREFIX_TO_CATEGORY[prefix] : undefined;
}

// ==================== IMPACT STYLES ====================

const AGGREGATED_IMPACT_STYLES: Record<
  string,
  { bg: string; color: string; labelKey: string }
> = {
  CRITICAL: { bg: "#ef4444", color: "#fff", labelKey: "tabs.assets.impactLabels.critical" },
  "HIGH+":  { bg: "#f97316", color: "#fff", labelKey: "tabs.assets.impactLabels.highPlus" },
  HIGH:     { bg: "#f59e0b", color: "#fff", labelKey: "tabs.assets.impactLabels.high" },
  "MED+":   { bg: "#eab308", color: "#fff", labelKey: "tabs.assets.impactLabels.medPlus" },
  MED:      { bg: "#64748b", color: "#fff", labelKey: "tabs.assets.impactLabels.med" },
  LOW:      { bg: "#94a3b8", color: "#1e293b", labelKey: "tabs.assets.impactLabels.low" },
};

// Severity-based colors — aligned with ISO 12100 / EN 50742
// severityKey maps to existing tabs.assets.safetyScale.{n}.severity i18n entries
const PHYSICAL_IMPACT_STYLES: Record<
  string,
  { bg: string; color: string; severityKey: string }
> = {
  fatality:            { bg: "#dc2626", color: "#fff", severityKey: "tabs.assets.safetyScale.4.severity" },
  irreversible_injury: { bg: "#f97316", color: "#fff", severityKey: "tabs.assets.safetyScale.3.severity" },
  reversible_injury:   { bg: "#eab308", color: "#fff", severityKey: "tabs.assets.safetyScale.2.severity" },
};

function getBusinessImpactBg(level: number, maxLevels: number): string {
  const palettes: Record<number, string[]> = {
    3: ["#22c55e", "#eab308", "#ef4444"],
    4: ["#22c55e", "#eab308", "#f97316", "#ef4444"],
    5: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"],
  };
  const palette = palettes[maxLevels] ?? palettes[4];
  return palette[Math.min(level - 1, palette.length - 1)] ?? "#94a3b8";
}

// ==================== COMPONENT ====================

export const AssetTable = React.memo<AssetTableProps>(
  ({ assets, configuration, a2aRelations = [], onEdit }) => {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";

    // ── Column visibility ─────────────────────────────────────────────────
    const factorFields = useMemo(
      () => configuration.impactCriteria.map(({ id }) => `impact_${id}`),
      [configuration.impactCriteria],
    );

    const [columnVisibilityModel, setColumnVisibilityModel] = useState<
      Record<string, boolean>
    >(() => Object.fromEntries(factorFields.map((f) => [f, false])));

    const factorsVisible = factorFields.some(
      (f) => columnVisibilityModel[f] !== false,
    );

    const handleToggleFactors = () => {
      const next = !factorsVisible;
      setColumnVisibilityModel((prev) => ({
        ...prev,
        ...Object.fromEntries(factorFields.map((f) => [f, next])),
      }));
    };

    // ── Downstream counts (derived from Asset-to-Asset graph) ────────────
    const downstreamCounts = useMemo(
      () =>
        Object.fromEntries(
          assets.map((a) => [a.id, getDownstreamCount(a.id, a2aRelations)]),
        ),
      [assets, a2aRelations],
    );

    // ── Columns ───────────────────────────────────────────────────────────

    const columns = useMemo<GridColDef<Asset>[]>(() => {
      const scale = IMPACT_SCALES[configuration.impactScale];

      // ── ID — colored chip using category color ─────────────────────────
      const idColumn: GridColDef<Asset> = {
        field: "id",
        headerName: t("tabs.assets.columns.id"),
        width: 95,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const category = getCategoryFromAsset(params.row);
          const cfg = category ? ASSET_GROUP_CONFIG[category] : undefined;
          return (
            <Chip
              label={params.value}
              size="small"
              variant="outlined"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.72rem",
                height: 20,
                borderColor: cfg?.color ?? "#94a3b8",
                color: cfg?.color ?? "#64748b",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          );
        },
      };

      // ── Name ───────────────────────────────────────────────────────────
      const nameColumn: GridColDef<Asset> = {
        field: "name",
        headerName: t("tabs.assets.columns.name"),
        width: 160,
        minWidth: 100,
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
      };

      // ── Type — icon + colored badge from ASSET_GROUP_CONFIG ────────────
      const typeColumn: GridColDef<Asset> = {
        field: "assetType",
        headerName: t("tabs.assets.columns.type"),
        width: 115,
        sortable: true,
        valueGetter: (params: { row: Asset }) =>
          getCategoryFromAsset(params.row) ?? "",
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const category = getCategoryFromAsset(params.row);
          if (!category)
            return <Typography color="text.disabled">–</Typography>;

          const cfg = ASSET_GROUP_CONFIG[category];
          const icon = ASSET_GROUP_ICONS[category];
          // cfg.label / cfg.labelDE come from shared constants — not i18n strings
          const label = isGerman ? cfg.labelDE : cfg.label;

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ color: cfg.color, display: "flex" }}>{icon}</Box>
              <Chip
                label={label}
                size="small"
                sx={{
                  backgroundColor: cfg.colorLight,
                  color: cfg.color,
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  height: 20,
                  border: `1px solid ${cfg.color}44`,
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            </Stack>
          );
        },
      };

      // ── Individual Impact Factor Columns (hidden by default) ───────────
      const impactFactorColumns: GridColDef<Asset>[] =
        configuration.impactCriteria.map(({ id: criterionId }) => {
          const criterion = PREDEFINED_IMPACT_CRITERIA.find(
            (c) => c.id === criterionId,
          );
          const headerName = criterion
            ? t(`${IMPACT_CRITERION_KEY_PREFIX}.${criterionId}.name`, {
                defaultValue: criterionId,
              })
            : criterionId;
          const description = criterion
            ? t(`${IMPACT_CRITERION_KEY_PREFIX}.${criterionId}.description`, {
                defaultValue: "",
              })
            : "";

          return {
            field: `impact_${criterionId}`,
            headerName,
            width: 80,
            sortable: true,
            align: "center" as const,
            headerAlign: "center" as const,
            hideable: true,
            valueGetter: (params: { row: Asset }) =>
              params.row.impactRatings?.find(
                (r) => r.criterionId === criterionId,
              )?.value ?? null,
            renderCell: (params: GridRenderCellParams<Asset>) => {
              const value = params.value as number | "na" | null;
              if (value === "na") {
                return (
                  <Tooltip title={`${headerName}: N/A`}>
                    <Chip
                      label="N/A"
                      size="small"
                      sx={{
                        backgroundColor: "#94a3b8",
                        color: "#fff",
                        height: 20,
                        fontSize: "0.8rem",
                      }}
                    />
                  </Tooltip>
                );
              }
              if (!value || value === 0)
                return <Typography color="text.disabled">–</Typography>;

              const levelLabel = getImpactLevelLabel(value, scale, t);
              const bg = getImpactColorByLevel(value, scale.levels.length);

              return (
                <Tooltip
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography
                        variant="caption"
                        fontWeight="bold"
                        display="block"
                      >
                        {headerName}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {description}
                      </Typography>
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        {levelLabel} ({value})
                      </Typography>
                    </Box>
                  }
                >
                  <Chip
                    label={value}
                    size="small"
                    sx={{
                      backgroundColor: bg,
                      color: "#fff",
                      fontWeight: "bold",
                      minWidth: 28,
                      height: 20,
                      fontSize: "0.8rem",
                      cursor: "help",
                    }}
                  />
                </Tooltip>
              );
            },
          };
        });

      // ── Safety Impact ──────────────────────────────────────────────────
      const safetyImpactColumn: GridColDef<Asset> = {
        field: "physicalImpact",
        headerName: t("tabs.assets.columns.safetyImpact"),
        width: 115,
        sortable: true,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.safetyImpact.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.safetyImpact.description")}
                </Typography>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.safetyImpact")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const row = params.row;
          const impact = row.physicalImpact as string | undefined;
          const source = row.physicalImpactSource as
            | "derived"
            | "manual"
            | undefined;
          if (!impact) return <Typography color="text.disabled">–</Typography>;

          const style = PHYSICAL_IMPACT_STYLES[impact] ?? {
            bg: "#94a3b8",
            color: "#1e293b",
          };
          const isManual = source === "manual";

          return (
            <Tooltip
              arrow
              placement="top"
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                  >
                    {t("tabs.assets.tooltips.safetyImpact.title")}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ mt: 0.5 }}
                  >
                    {isManual ? (
                      <ManualIcon sx={{ fontSize: 12, color: "#fbbf24" }} />
                    ) : (
                      <DerivedIcon sx={{ fontSize: 12, color: "#60a5fa" }} />
                    )}
                    <Typography variant="caption" color="rgba(255,255,255,0.8)">
                      {t(
                        isManual
                          ? "tabs.assets.tooltips.safetyImpact.manual"
                          : "tabs.assets.tooltips.safetyImpact.derived",
                      )}
                    </Typography>
                  </Stack>
                  {row.physicalImpactRationale && (
                    <Typography
                      variant="caption"
                      display="block"
                      color="rgba(255,220,0,0.9)"
                      sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                    >
                      ℹ {row.physicalImpactRationale}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Chip
                  label={t(style.severityKey, {
                    defaultValue: impact,
                  })}
                  size="small"
                  sx={{
                    backgroundColor: style.bg,
                    color: style.color,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    height: 20,
                    cursor: "help",
                  }}
                />
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isManual ? "#fbbf2422" : "#3b82f622",
                    border: `1px solid ${isManual ? "#fbbf24" : "#3b82f6"}`,
                  }}
                >
                  {isManual ? (
                    <ManualIcon sx={{ fontSize: 9, color: "#fbbf24" }} />
                  ) : (
                    <DerivedIcon sx={{ fontSize: 9, color: "#60a5fa" }} />
                  )}
                </Box>
              </Stack>
            </Tooltip>
          );
        },
      };

      // ── Business Impact (Overall) ──────────────────────────────────────
      const businessImpactColumn: GridColDef<Asset> = {
        field: "overallImpact",
        headerName: t("tabs.assets.columns.overallImpact"),
        width: 115,
        sortable: true,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.overallImpact.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.overallImpact.description")}
                </Typography>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.overallImpact")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const value = params.value as number;
          if (!value || value === 0)
            return <Typography color="text.disabled">–</Typography>;

          const level = getImpactLevel(value, configuration.roundingMethod);
          const bg = getBusinessImpactBg(level, scale.levels.length);
          const scaleLevel = scale.levels.find(
            (l) => l.value === Math.round(level),
          );
          const label = scaleLevel ? t(scaleLevel.labelKey) : "-";

          // Weighted average — secondary signal for ranking among same-level assets.
          // Shown alongside the conservative (MAX) level when method = conservative.
          const avgValue =
            configuration.calculationMethod === "conservative"
              ? calculateOverallImpact(
                  params.row.impactRatings,
                  "average",
                  configuration.roundingMethod,
                  configuration.impactCriteria,
                )
              : null;

          const factorLines =
            params.row.impactRatings
              ?.filter(
                (r): r is typeof r & { value: number } =>
                  typeof r.value === "number",
              )
              .map(
                (r) =>
                  `${getCriterionLabel(r.criterionId, t)}: ${r.value.toFixed(1)}`,
              ) ?? [];

          const naLines =
            params.row.impactRatings
              ?.filter((r) => r.value === "na")
              .map((r) => `${getCriterionLabel(r.criterionId, t)}: N/A`) ?? [];

          const methodKey =
            configuration.calculationMethod === "conservative"
              ? "tabs.assets.tooltips.overallImpact.conservative"
              : "tabs.assets.tooltips.overallImpact.average";

          return (
            <Tooltip
              arrow
              title={
                <Box sx={{ whiteSpace: "pre-line" }}>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                    gutterBottom
                  >
                    {t("tabs.assets.tooltips.overallImpact.title")}
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    color="rgba(255,255,255,0.7)"
                    sx={{ mb: 0.5 }}
                  >
                    {t(methodKey)}
                  </Typography>
                  {factorLines.join("\n")}

                  {naLines.length > 0 && (
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ opacity: 0.6 }}
                    >
                      {naLines.join("\n")}
                    </Typography>
                  )}

                  <Box
                    sx={{
                      mt: 1,
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
                          backgroundColor: bg,
                          border: "1px solid rgba(255,255,255,0.5)",
                        }}
                      />
                      <Typography variant="caption" fontWeight="bold">
                        {label} ({value.toFixed(1)})
                        {avgValue !== null && avgValue !== value && (
                          <> &nbsp;·&nbsp; Ø {avgValue.toFixed(1)}</>
                        )}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              }
            >
              <Chip
                label={
                  avgValue !== null && avgValue !== value
                    ? `${value.toFixed(1)} · Ø ${avgValue.toFixed(1)}`
                    : value.toFixed(1)
                }
                size="small"
                sx={{
                  backgroundColor: bg,
                  color: level >= 2 ? "#fff" : "#1e293b",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  height: 20,
                  cursor: "help",
                  maxWidth: "none",
                }}
              />
            </Tooltip>
          );
        },
      };

      // ── Aggregated Impact ──────────────────────────────────────────────
      const aggregatedImpactColumn: GridColDef<Asset> = {
        field: "aggregatedImpact",
        headerName: t("tabs.assets.columns.aggregatedImpact"),
        width: 115,
        sortable: true,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.aggregatedImpact.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.aggregatedImpact.description")}
                </Typography>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.aggregatedImpact")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const row = params.row;
          const agg = row.aggregatedImpact as string | undefined;
          if (!agg) return <Typography color="text.disabled">–</Typography>;

          const style = AGGREGATED_IMPACT_STYLES[agg] ?? {
            bg: "#94a3b8",
            color: "#1e293b",
            labelKey: agg,
          };

          const safetyOverrideActive =
            (row as Asset & { safetyOverrideActive?: boolean })
              .safetyOverrideActive ??
            ((row.physicalImpact === "fatality" ||
              row.physicalImpact === "irreversible_injury") &&
              row.physicalImpactSource !== "manual" &&
              agg === "CRITICAL");

          const displayLabel = t(style.labelKey, { defaultValue: agg });

          return (
            <Tooltip
              arrow
              placement="top"
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    display="block"
                    gutterBottom
                  >
                    {t("tabs.assets.tooltips.aggregatedImpact.title")}
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    color="rgba(255,255,255,0.7)"
                  >
                    {t("tabs.assets.tooltips.aggregatedImpact.description")}
                  </Typography>
                  {safetyOverrideActive && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{ mt: 0.5 }}
                    >
                      <FlameIcon sx={{ fontSize: 12, color: "#f87171" }} />
                      <Typography
                        variant="caption"
                        color="#f87171"
                        fontWeight="bold"
                      >
                        {t(
                          "tabs.assets.tooltips.aggregatedImpact.safetyOverride",
                        )}
                      </Typography>
                    </Stack>
                  )}
                  {agg === "HIGH+" && (
                    <Typography
                      variant="caption"
                      display="block"
                      color="rgba(255,220,0,0.9)"
                      sx={{ mt: 0.5 }}
                    >
                      {t("tabs.assets.tooltips.aggregatedImpact.highPlus")}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Chip
                  label={displayLabel}
                  size="small"
                  sx={{
                    backgroundColor: style.bg,
                    color: style.color,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    height: 20,
                    cursor: "help",
                    ...(agg === "CRITICAL" && {
                      boxShadow: "0 0 0 2px #ef444455",
                    }),
                  }}
                />
                {safetyOverrideActive && (
                  <FlameIcon sx={{ fontSize: 13, color: "#f87171" }} />
                )}
              </Stack>
            </Tooltip>
          );
        },
      };

      // ── HVA ────────────────────────────────────────────────────────────
      const hvaColumn: GridColDef<Asset> = {
        field: "hva",
        headerName: t("tabs.assets.columns.hva"),
        width: 115,
        sortable: true,
        align: "center",
        headerAlign: "center",
        valueGetter: (params: { row: Asset }) =>
          params.row.properties?.isHighValueAsset ? 1 : 0,
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.hva.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 240, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.hva.description")}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  {(["critical", "high", "medium", "low"] as const).map(
                    (lvl) => (
                      <Typography
                        key={lvl}
                        variant="caption"
                        display="block"
                        sx={{ mt: 0.25 }}
                      >
                        {t(`tabs.assets.tooltips.hva.${lvl}`)}
                      </Typography>
                    ),
                  )}
                </Box>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.hva")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          if (!params.row.properties?.isHighValueAsset)
            return <Typography color="text.disabled">–</Typography>;
          return (
            <Tooltip
              arrow
              placement="top"
              title={t("tabs.assets.tooltips.hva.title")}
            >
              <StarIcon sx={{ fontSize: 16, color: "#f59e0b" }} />
            </Tooltip>
          );
        },
      };

      // ── Downstream ────────────────────────────────────────────────────
      const downstreamColumn: GridColDef<Asset> = {
        field: "downstream",
        width: 200,
        sortable: true,
        align: "center",
        headerAlign: "center",
        valueGetter: (params: { row: Asset }) =>
          downstreamCounts[params.row.id] ?? 0,
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.downstream.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.downstream.description")}
                </Typography>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.downstream")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const count = downstreamCounts[params.row.id] ?? 0;
          if (count === 0)
            return <Typography color="text.disabled">–</Typography>;
          return (
            <Tooltip
              arrow
              placement="top"
              title={t("tabs.assets.tooltips.downstream.count", { count })}
            >
              <Chip
                label={count}
                size="small"
                sx={{
                  backgroundColor: count >= 3 ? "#f97316" : "#64748b",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  height: 20,
                  minWidth: 28,
                  cursor: "help",
                }}
              />
            </Tooltip>
          );
        },
      };

      // ── Security Goals (CIANAAA) ───────────────────────────────────────
      const securityGoalsColumn: GridColDef<Asset> = {
        field: "securityGoals",
        headerName: t("tabs.assets.columns.securityGoals"),
        width: 200,
        sortable: false,
        renderHeader: () => (
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t("tabs.assets.tooltips.cianaaa.title")}
                </Typography>
                <Typography
                  variant="caption"
                  display="block"
                  color="rgba(255,255,255,0.8)"
                  sx={{ mt: 0.5, maxWidth: 220, whiteSpace: "normal" }}
                >
                  {t("tabs.assets.tooltips.cianaaa.description")}
                </Typography>
              </Box>
            }
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ cursor: "help" }}
            >
              {t("tabs.assets.columns.securityGoals")}
            </Typography>
          </Tooltip>
        ),
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const row = params.row;
          if (!row?.securityGoals)
            return <Typography color="text.disabled">–</Typography>;

          const enabledGoals: SecurityGoal[] = row.securityGoals.filter(
            (sg: SecurityGoal) => sg.level !== "none",
          );
          if (enabledGoals.length === 0)
            return <Typography color="text.disabled">–</Typography>;

          return (
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ py: 0.5 }}
            >
              {enabledGoals.map((goal: SecurityGoal) => {
                const isManual = goal.source === "manual";
                const isSuggested = goal.source === "suggested";
                const goalName = getSecurityGoalName(goal.type, t);

                return (
                  <Tooltip
                    key={goal.type}
                    arrow
                    placement="top"
                    title={
                      <Box sx={{ p: 0.5 }}>
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          display="block"
                        >
                          {goalName}
                        </Typography>
                        {goal.source && (
                          <Typography
                            variant="caption"
                            display="block"
                            color="rgba(255,255,255,0.75)"
                          >
                            {t(
                              isManual
                                ? "tabs.assets.tooltips.cianaaa.manual"
                                : "tabs.assets.tooltips.cianaaa.suggested",
                            )}
                          </Typography>
                        )}
                        {goal.formalDescription && (
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{
                              mt: 0.5,
                              maxWidth: 240,
                              whiteSpace: "normal",
                            }}
                          >
                            {goal.formalDescription}
                          </Typography>
                        )}
                        {goal.rationale && (
                          <Typography
                            variant="caption"
                            display="block"
                            color="rgba(255,220,0,0.9)"
                            sx={{
                              mt: 0.5,
                              maxWidth: 240,
                              whiteSpace: "normal",
                            }}
                          >
                            ℹ {goal.rationale}
                          </Typography>
                        )}
                      </Box>
                    }
                  >
                    <Chip
                      label={goal.type}
                      size="small"
                      variant={isManual ? "filled" : "outlined"}
                      color="primary"
                      sx={{
                        fontSize: "0.8rem",
                        height: 20,
                        fontWeight: isManual ? 700 : 400,
                        cursor: "help",
                        ...(isSuggested && {
                          borderStyle: "dashed",
                          opacity: 0.85,
                        }),
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          );
        },
      };

      // ── DFD Links ─────────────────────────────────────────────────────
      const linkedElementsColumn: GridColDef<Asset> = {
        field: "linkedDFDElements",
        headerName: t("tabs.assets.columns.linkedElements"),
        width: 260,
        minWidth: 180,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Asset>) => {
          const row = params.row;
          if (!row?.linkedDFDElements)
            return <Typography color="text.disabled">–</Typography>;

          const links: DFDElementLink[] = row.linkedDFDElements;
          if (!Array.isArray(links) || links.length === 0) {
            return (
              <Chip
                label={t("tabs.assets.notLinked")}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontSize: "0.65rem" }}
              />
            );
          }

          // Group multiple entries with same elementId into one chip
          const grouped = new Map<
            string,
            { link: DFDElementLink; relations: string[] }
          >();
          for (const link of links) {
            if (!link?.elementId) continue;
            const existing = grouped.get(link.elementId);
            if (existing) {
              if (
                link.relationType &&
                !existing.relations.includes(link.relationType)
              ) {
                existing.relations.push(link.relationType);
              }
            } else {
              grouped.set(link.elementId, {
                link,
                relations: link.relationType ? [link.relationType] : [],
              });
            }
          }

          const entries = Array.from(grouped.values());

          return (
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ py: 0.5 }}
            >
              {entries.map(({ link, relations }) => {
                const displayId = link.displayId ?? link.elementId.slice(0, 8);
                const relStr =
                  relations.length > 0 ? relations.join("; ") : "–";
                const chipLabel = `${displayId}: ${relStr}`;

                const tooltipContent = (
                  <Box sx={{ p: 0.5 }}>
                    <Typography
                      variant="caption"
                      fontWeight="bold"
                      display="block"
                    >
                      {displayId}
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      color="rgba(255,255,255,0.8)"
                    >
                      {link.elementName ?? ""}
                      {link.elementType ? ` [${link.elementType}]` : ""}
                    </Typography>
                    {link.qualifier && (
                      <Typography
                        variant="caption"
                        display="block"
                        color="rgba(255,220,0,0.9)"
                        sx={{ mt: 0.25 }}
                      >
                        qualifier: {link.qualifier}
                      </Typography>
                    )}
                  </Box>
                );

                return (
                  <Tooltip
                    key={link.elementId}
                    title={tooltipContent}
                    placement="top"
                    arrow
                  >
                    <Chip
                      label={chipLabel}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: "0.65rem",
                        height: "auto",
                        py: 0.25,
                        cursor: "default",
                        fontFamily: "monospace",
                        "& .MuiChip-label": {
                          whiteSpace: "normal",
                          lineHeight: 1.3,
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          );
        },
      };

      // ── Actions ────────────────────────────────────────────────────────
      const actionsColumn: GridColDef<Asset> = {
        field: "actions",
        type: "actions",
        headerName: t("common.actions", { defaultValue: "Actions" }),
        width: 70,
        getActions: (params) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label={t("common.edit", { defaultValue: "Edit" })}
            onClick={() => onEdit(params.row)}
          />,
        ],
      };

      // ── Column visibility ──────────────────────────────────────────────
      // Safety: visible when safety criterion is in config
      const showSafetyColumn = configuration.impactCriteria.some(
        (c) => c.id === SAFETY_CRITERION_ID,
      );

      // HVA: visible when any infrastructure/physical asset has HVA fields set
      const showHVAColumn = assets.some(
        (a) =>
          (a.assetGroup === "infrastructure" || a.assetGroup === "physical") &&
          (a.properties?.replacementLeadTime ||
            a.properties?.vendorDependency ||
            a.properties?.spareAvailability),
      );

      // Aggregated: visible when safety or HVA is visible
      const showAggregatedColumn = showSafetyColumn || showHVAColumn;

      // ── Column order ───────────────────────────────────────────────────
      // ID | Name | Type | [Factors] | Safety | Overall | Aggregated | HVA | Sec. Goals | Downstream | DFD Links | Actions
      return [
        idColumn,
        nameColumn,
        typeColumn,
        ...impactFactorColumns,
        ...(showSafetyColumn ? [safetyImpactColumn] : []),
        businessImpactColumn,
        ...(showAggregatedColumn ? [aggregatedImpactColumn] : []),
        ...(showHVAColumn ? [hvaColumn] : []),
        securityGoalsColumn,
        downstreamColumn,
        linkedElementsColumn,
        actionsColumn,
      ];
    }, [configuration, t, isGerman, onEdit, downstreamCounts]);

    // ==================== EMPTY STATE ====================

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
            {t("tabs.assets.noAssets")}
          </Typography>
          <Typography variant="body2">
            {t("tabs.assets.noAssetsHint")}
          </Typography>
        </Box>
      );
    }

    // ==================== RENDER ====================

    return (
      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        {/* Factor Columns Toggle bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            backgroundColor: "grey.50",
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<ShowColumnsIcon />}
            onClick={handleToggleFactors}
            color={factorsVisible ? "primary" : "inherit"}
            sx={{ fontSize: "0.72rem", py: 0.25, textTransform: "none" }}
          >
            {t(
              factorsVisible
                ? "tabs.assets.tooltips.hideFactors"
                : "tabs.assets.tooltips.showFactors",
            )}
          </Button>
        </Box>

        {/* DataGrid */}
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <DataGrid
            rows={assets}
            columns={columns}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            getRowHeight={() => "auto"}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: {
                sortModel: [{ field: "aggregatedImpact", sort: "desc" }],
              },
            }}
            onRowClick={(params) => onEdit(params.row)}
            disableRowSelectionOnClick
            density="compact"
            sx={{
              border: "none",
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 0.5,
                alignItems: "center",
              },
              "& .MuiDataGrid-main": {
                backgroundColor: "background.paper",
              },
              "& .MuiDataGrid-columnHeaders": {
                borderBottom: "2px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
              },
              "& .MuiDataGrid-columnHeader": {
                fontSize: "0.75rem",
                fontWeight: 600,
              },
              "& .MuiDataGrid-row--criticalImpact": {
                backgroundColor: "rgba(239,68,68,0.04)",
              },
              "& .MuiDataGrid-row:hover": { cursor: "pointer" },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "1px solid",
                borderColor: "divider",
                minHeight: 40,
              },
            }}
            getRowClassName={(params) =>
              params.row.aggregatedImpact === "CRITICAL"
                ? "MuiDataGrid-row--criticalImpact"
                : ""
            }
          />
        </Box>
      </Box>
    );
  },
);

AssetTable.displayName = "AssetTable";

export default AssetTable;

// ==================== PURE HELPERS ====================

function getSecurityGoalName(type: SecurityGoalType, t: TFunction): string {
  return t(`${SECURITY_GOAL_KEY_PREFIX}.${type}.name`, { defaultValue: type });
}

function getImpactColorByLevel(value: number, maxLevels: number): string {
  const palettes: Record<number, string[]> = {
    3: ["#22c55e", "#eab308", "#ef4444"],
    4: ["#22c55e", "#eab308", "#f97316", "#ef4444"],
    5: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"],
  };
  const palette = palettes[maxLevels] ?? palettes[4];
  return palette[Math.min(value - 1, palette.length - 1)] ?? "#6b7280";
}

function getImpactLevelLabel(
  value: number | string,
  scale: (typeof IMPACT_SCALES)[keyof typeof IMPACT_SCALES],
  t: TFunction,
): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (value === "na" || isNaN(numericValue)) return "N/A";
  if (numericValue === 0) return "-";
  const level = scale.levels.find((l) => l.value === Math.round(numericValue));
  if (!level) return numericValue.toString();
  return t(level.labelKey);
}

function getCriterionLabel(criterionId: string, t: TFunction): string {
  return t(`tabs.assets.criterionLabels.${criterionId}`, {
    defaultValue: criterionId,
  });
}
