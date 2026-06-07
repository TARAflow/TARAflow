// features/hazards/components/hazard-table.tsx
//
// Master list of Hazard Items in a MUI DataGrid (same idiom as AssetTable).
//
// Columns: ID | Hazard | Type | PHP | Logic | Causes | Targets | Max Severity | Source | Actions
//   - Causes / Targets show the actual contributing / endangered asset NAMES as chips,
//     coloured by the asset group (parallel to the DFD asset palette). They are projected
//     onto the rows as real fields (_causeAssets / _targetAssets) so the grid stays on the
//     v6/v7-safe path (no valueGetter).
//   - Max Severity is the worst endangers severity across targets (cross-target heuristic).
//   - A quick-add row above the grid creates a bare hazard (label only); the analyst
//     enriches it afterwards in the Bowtie dialog.
//
// GROUP_COLOR mirrors the DFD ASSET_GROUP_CONFIG palette. It is duplicated here on
// purpose: features must not import from one another. If this palette is needed in a
// third place, hoist it to shared rather than cross-importing the DFD feature.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import { Box, Button, Chip, TextField, Typography } from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  EditNote as ManualIcon,
  AccountTree as GraphIcon,
  Download as ImportedIcon,
} from "@mui/icons-material";

import type { AssetReference, HazardItem, HazardItemId, HazardRelation } from "shared";
import { isContributesTo, isEndangers } from "shared";
import type { HazardData } from "../models/hazard-data-types";

// ==================== TYPES ====================

export interface HazardTableProps {
  data: HazardData;
  assets: AssetReference[];
  onEdit: (hazard: HazardItem) => void;
  onDelete: (id: HazardItemId) => void;
  onQuickAdd: (label: string) => void;
}

interface AssetChip {
  id: string;
  name: string;
  group: string;
}

/** A hazard row augmented with the derived edge aggregates (real, sortable fields). */
interface HazardRow extends HazardItem {
  _causeAssets: AssetChip[];
  _targetAssets: AssetChip[];
  _worstRank: number;
  _worstSeverity: string;
}

// ==================== COLOUR MAPS ====================

const GROUP_COLOR: Record<string, { bg: string; fg: string }> = {
  data: { bg: "#E3F2FD", fg: "#1976D2" },
  function: { bg: "#E0F2F1", fg: "#00796B" },
  system: { bg: "#F3E5F5", fg: "#7B1FA2" },
  infrastructure: { bg: "#EFEBE9", fg: "#4E342E" },
  process: { bg: "#FFF3E0", fg: "#E65100" },
  physical: { bg: "#FFF8E1", fg: "#F57F17" },
  service: { bg: "#E8EAF6", fg: "#283593" },
  human: { bg: "#E8F5E9", fg: "#2E7D32" },
  environment: { bg: "#F1F8E9", fg: "#558B2F" },
};
const GROUP_FALLBACK = { bg: "#F1F5F9", fg: "#475569" };

const groupColor = (g: string) => GROUP_COLOR[g] ?? GROUP_FALLBACK;

const PHP_COLOR: Record<string, { bg: string; fg: string }> = {
  low: { bg: "#F1F5F9", fg: "#475569" },
  medium: { bg: "#FFF3E0", fg: "#E65100" },
  high: { bg: "#FEE2E2", fg: "#dc2626" },
};

// Cross-target rank so a single "Max Severity" column can rate human, environment
// and infrastructure edges on one ordinal scale (display heuristic only).
function severityRank(sev: string): number {
  switch (sev) {
    case "fatality":
    case "critical":
      return 4;
    case "irreversible_injury":
    case "high":
      return 3;
    case "reversible_injury":
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

const RANK_COLOR: Record<number, string> = {
  0: "#cbd5e1",
  1: "#94a3b8",
  2: "#eab308",
  3: "#f97316",
  4: "#ef4444",
};

const SOURCE_META: Record<
  string,
  { icon: React.ReactElement; labelKey: string; fallback: string }
> = {
  manual: {
    icon: <ManualIcon sx={{ fontSize: 14 }} />,
    labelKey: "tabs.hazards.source.manual",
    fallback: "Manual",
  },
  imported: {
    icon: <ImportedIcon sx={{ fontSize: 14 }} />,
    labelKey: "tabs.hazards.source.imported",
    fallback: "Imported",
  },
  graph: {
    icon: <GraphIcon sx={{ fontSize: 14 }} />,
    labelKey: "tabs.hazards.source.derived",
    fallback: "Derived",
  },
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ==================== ASSET CHIP CELL ====================

const AssetChips: React.FC<{ chips: AssetChip[] }> = ({ chips }) => {
  if (chips.length === 0) {
    return (
      <Chip
        label="0"
        size="small"
        color="error"
        variant="filled"
        sx={{ height: 20, minWidth: 30, fontWeight: 600 }}
      />
    );
  }
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, py: 0.5, width: "100%" }}>
      {chips.map((c) => {
        const col = groupColor(c.group);
        return (
          <Chip
            key={c.id}
            size="small"
            title={`${c.id} · ${c.group}`}
            label={
              <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5 }}>
                <Box
                  component="span"
                  sx={{ fontFamily: "monospace", fontSize: "0.62rem", opacity: 0.7 }}
                >
                  {c.id}
                </Box>
                <Box component="span">{c.name}</Box>
              </Box>
            }
            sx={{
              height: 20,
              fontSize: "0.7rem",
              backgroundColor: col.bg,
              color: col.fg,
              border: `1px solid ${col.fg}33`,
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
        );
      })}
    </Box>
  );
};

// ==================== COMPONENT ====================

export const HazardTable = React.memo<HazardTableProps>(
  ({ data, assets, onEdit, onDelete, onQuickAdd }) => {
    const { t } = useTranslation();
    const [quickLabel, setQuickLabel] = useState("");

    // ── Build rows with derived aggregates projected as real fields ─────────
    const rows = useMemo<HazardRow[]>(() => {
      const assetById = new Map(assets.map((a) => [a.id, a]));
      const toChip = (id: string): AssetChip => {
        const a = assetById.get(id);
        return { id, name: a?.name ?? id, group: a?.assetGroup ?? "" };
      };

      const causeAssets: Record<string, AssetChip[]> = {};
      const targetAssets: Record<string, AssetChip[]> = {};
      const worstRank: Record<string, number> = {};
      const worstSeverity: Record<string, string> = {};

      for (const h of data.hazards) {
        causeAssets[h.id] = [];
        targetAssets[h.id] = [];
        worstRank[h.id] = 0;
        worstSeverity[h.id] = "";
      }
      for (const r of data.relations as HazardRelation[]) {
        if (isContributesTo(r) && r.to in causeAssets) {
          causeAssets[r.to].push(toChip(r.from));
        }
        if (isEndangers(r) && r.from in targetAssets) {
          targetAssets[r.from].push(toChip(r.to));
          const rank = severityRank(r.impact.severity);
          if (rank > worstRank[r.from]) {
            worstRank[r.from] = rank;
            worstSeverity[r.from] = r.impact.severity;
          }
        }
      }

      return data.hazards.map((h) => ({
        ...h,
        _causeAssets: causeAssets[h.id] ?? [],
        _targetAssets: targetAssets[h.id] ?? [],
        _worstRank: worstRank[h.id] ?? 0,
        _worstSeverity: worstSeverity[h.id] ?? "",
      }));
    }, [data.hazards, data.relations, assets]);

    // ── Quick add ──────────────────────────────────────────────────────────
    const submitQuickAdd = () => {
      const label = quickLabel.trim();
      if (!label) return;
      onQuickAdd(label);
      setQuickLabel("");
    };

    // ── Columns ──────────────────────────────────────────────────────────
    const columns = useMemo<GridColDef<HazardRow>[]>(() => {
      const idColumn: GridColDef<HazardRow> = {
        field: "id",
        headerName: t("tabs.hazards.columns.id", { defaultValue: "ID" }),
        width: 80,
        renderCell: (p: GridRenderCellParams<HazardRow>) => (
          <Chip
            label={p.value}
            size="small"
            variant="outlined"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.72rem",
              height: 20,
              borderColor: "#dc2626",
              color: "#dc2626",
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
        ),
      };

      const labelColumn: GridColDef<HazardRow> = {
        field: "label",
        headerName: t("tabs.hazards.columns.label", { defaultValue: "Hazard" }),
        flex: 1,
        minWidth: 150,
        renderCell: (p) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {p.value || (
              <em style={{ color: "#94a3b8" }}>
                {t("tabs.hazards.unnamed", { defaultValue: "(unnamed)" })}
              </em>
            )}
          </Typography>
        ),
      };

      const typeColumn: GridColDef<HazardRow> = {
        field: "hazardType",
        headerName: t("tabs.hazards.columns.type", { defaultValue: "Type" }),
        width: 130,
        renderCell: (p) =>
          p.value ? (
            <Chip
              label={t(`tabs.hazards.category.${p.value}`, {
                defaultValue: humanize(String(p.value)),
              })}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.72rem", height: 20 }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              –
            </Typography>
          ),
      };

      const phpColumn: GridColDef<HazardRow> = {
        field: "physicalHazardPotential",
        headerName: t("tabs.hazards.columns.php", {
          defaultValue: "Phys. Potential",
        }),
        width: 130,
        renderCell: (p) => {
          const v = p.value ? String(p.value) : "";
          if (!v) {
            return (
              <Typography variant="caption" color="text.secondary">
                –
              </Typography>
            );
          }
          const col = PHP_COLOR[v] ?? GROUP_FALLBACK;
          return (
            <Chip
              label={humanize(v)}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                fontWeight: 600,
                backgroundColor: col.bg,
                color: col.fg,
              }}
            />
          );
        },
      };

      const combinationColumn: GridColDef<HazardRow> = {
        field: "combinationType",
        headerName: t("tabs.hazards.columns.combination", {
          defaultValue: "Logic",
        }),
        width: 80,
        renderCell: (p) => (
          <Chip
            label={p.value}
            size="small"
            color={p.value === "ALL" ? "secondary" : "default"}
            variant={p.value === "ALL" ? "filled" : "outlined"}
            sx={{ fontSize: "0.68rem", height: 20, fontFamily: "monospace" }}
          />
        ),
      };

      const causesColumn: GridColDef<HazardRow> = {
        field: "_causeAssets",
        headerName: t("tabs.hazards.columns.causes", {
          defaultValue: "Causes",
        }),
        flex: 1.4,
        minWidth: 170,
        sortable: false,
        renderCell: (p) => <AssetChips chips={p.row._causeAssets} />,
      };

      const targetsColumn: GridColDef<HazardRow> = {
        field: "_targetAssets",
        headerName: t("tabs.hazards.columns.targets", {
          defaultValue: "Targets",
        }),
        flex: 1.4,
        minWidth: 170,
        sortable: false,
        renderCell: (p) => <AssetChips chips={p.row._targetAssets} />,
      };

      const severityColumn: GridColDef<HazardRow> = {
        field: "_worstRank",
        headerName: t("tabs.hazards.columns.maxSeverity", {
          defaultValue: "Max Severity",
        }),
        width: 130,
        type: "number",
        renderCell: (p) => {
          if (!p.row._worstSeverity) {
            return (
              <Typography variant="caption" color="text.secondary">
                –
              </Typography>
            );
          }
          return (
            <Chip
              label={t(`tabs.hazards.severity.${p.row._worstSeverity}`, {
                defaultValue: humanize(p.row._worstSeverity),
              })}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                fontWeight: 600,
                backgroundColor: RANK_COLOR[p.row._worstRank],
                color: p.row._worstRank >= 2 ? "#fff" : "#1e293b",
              }}
            />
          );
        },
      };

      const sourceColumn: GridColDef<HazardRow> = {
        field: "source",
        headerName: t("tabs.hazards.columns.source", {
          defaultValue: "Source",
        }),
        width: 110,
        renderCell: (p) => {
          const meta = SOURCE_META[String(p.value)] ?? SOURCE_META.manual;
          return (
            <Chip
              icon={meta.icon}
              label={t(meta.labelKey, { defaultValue: meta.fallback })}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.68rem", height: 22 }}
            />
          );
        },
      };

      const actionsColumn: GridColDef<HazardRow> = {
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
          />,
        ],
      };

      return [
        idColumn,
        labelColumn,
        typeColumn,
        phpColumn,
        combinationColumn,
        causesColumn,
        targetsColumn,
        severityColumn,
        sourceColumn,
        actionsColumn,
      ];
    }, [t, onEdit, onDelete]);

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
        {/* Quick-add row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            backgroundColor: "grey.50",
          }}
        >
          <TextField
            value={quickLabel}
            onChange={(e) => setQuickLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuickAdd();
            }}
            size="small"
            placeholder={t("tabs.hazards.quickAddPlaceholder", {
              defaultValue: "Quick add: hazard label, then Enter…",
            })}
            sx={{
              flexGrow: 1,
              maxWidth: 480,
              "& .MuiInputBase-root": { fontSize: "0.8rem" },
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={submitQuickAdd}
            disabled={!quickLabel.trim()}
            sx={{ textTransform: "none" }}
          >
            {t("common.add", { defaultValue: "Add" })}
          </Button>
        </Box>

        {/* Empty state */}
        {data.hazards.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              minHeight: 200,
              color: "text.secondary",
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t("tabs.hazards.noHazards", { defaultValue: "No hazards yet" })}
            </Typography>
            <Typography variant="body2">
              {t("tabs.hazards.noHazardsHint", {
                defaultValue:
                  "Use Quick add above or “Add Hazard” to start the Bowtie.",
              })}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              getRowHeight={() => "auto"}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: "_worstRank", sort: "desc" }] },
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
                "& .MuiDataGrid-columnHeaders": {
                  borderBottom: "2px solid",
                  borderColor: "divider",
                  backgroundColor: "background.paper",
                },
                "& .MuiDataGrid-columnHeader": {
                  fontSize: "0.75rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row:hover": { cursor: "pointer" },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "1px solid",
                  borderColor: "divider",
                  minHeight: 40,
                },
              }}
            />
          </Box>
        )}
      </Box>
    );
  },
);

HazardTable.displayName = "HazardTable";

export default HazardTable;