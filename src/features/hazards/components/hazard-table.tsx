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
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  EditNote as ManualIcon,
  AccountTree as GraphIcon,
  Download as ImportedIcon,
} from "@mui/icons-material";

import type {
  AssetReference,
  HazardItem,
  HazardItemId,
  HazardRelation,
} from "shared";
import {
  HAZARD_SEVERITY_RANK_COLOR,
  isContributesTo,
  isEndangers,
  withSeverityClass,
  worstEndangersSeverity,
} from "shared";
import type { HazardData } from "../models/hazard-data-types";

// ==================== TYPES ====================

export interface HazardTableProps {
  data: HazardData;
  assets: AssetReference[];
  onEdit: (hazard: HazardItem) => void;
  onDelete: (id: HazardItemId) => void;
  onQuickAdd: (label: string) => void;
  /**
   * Label vocabulary of the preset: under "iso-21434" person-harm severities
   * show their ISO 26262 class (S0–S3, RQ-15-06, conformance plan 1H-S).
   */
  labelVocabulary?: "default" | "iso-21434";
}

interface AssetChip {
  id: string;
  /** Readable label (e.g. "SY-003"); the id is an opaque UUID and never shown. */
  displayId?: string;
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

// Rank and colour of the "Max Severity" column: shared with the asset graph
// (shared/models/hazard-severity-display.ts).
const RANK_COLOR = HAZARD_SEVERITY_RANK_COLOR;

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

const AssetChips: React.FC<{
  chips: AssetChip[];
  kind: "cause" | "target";
}> = ({ chips, kind }) => {
  const { t } = useTranslation();

  if (chips.length === 0) {
    return (
      <Tooltip
        title={t(
          kind === "cause"
            ? "tabs.hazards.tip.noCausesLinked"
            : "tabs.hazards.tip.noTargetsLinked",
          {
            defaultValue:
              kind === "cause"
                ? "No causes linked yet"
                : "No targets linked yet",
          },
        )}
      >
        <Chip
          label="0"
          size="small"
          color="error"
          variant="filled"
          sx={{ height: 20, minWidth: 30, fontWeight: 600 }}
        />
      </Tooltip>
    );
  }
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.5,
        py: 0.5,
        width: "100%",
      }}
    >
      {chips.map((c) => {
        const col = groupColor(c.group);
        // An asset is "unresolved" when it could not be matched against the
        // current asset list (e.g. a freshly minted human target that has not
        // been merged back yet) — then name falls back to the raw id.
        const resolved = c.displayId !== undefined && c.group !== "";
        const tip = (
          <Box sx={{ lineHeight: 1.4 }}>
            <Box sx={{ fontWeight: 700 }}>{c.name}</Box>
            <Box
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                opacity: 0.85,
              }}
            >
              {c.displayId ?? "?"}
              {c.group ? ` · ${c.group}` : ""}
            </Box>
            {!resolved && (
              <Box sx={{ fontSize: "0.7rem", mt: 0.25, color: "#fca5a5" }}>
                {t("tabs.hazards.tip.assetUnresolved", {
                  defaultValue: "Asset not found — showing ID only",
                })}
              </Box>
            )}
          </Box>
        );
        return (
          <Tooltip key={c.id} title={tip} placement="top">
            <Chip
              size="small"
              label={
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 0.5,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.62rem",
                      opacity: 0.7,
                    }}
                  >
                    {c.displayId ?? "?"}
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
          </Tooltip>
        );
      })}
    </Box>
  );
};

// ==================== COMPONENT ====================

export const HazardTable = React.memo<HazardTableProps>(
  ({ data, assets, onEdit, onDelete, onQuickAdd, labelVocabulary }) => {
    const { t } = useTranslation();
    const [quickLabel, setQuickLabel] = useState("");
    // Row visibility filter. Out-of-scope hazards are hidden by default (they
    // stay in the safety record but are excluded from threat work); the filter
    // top-right brings them back into view.
    const [view, setView] = useState<"active" | "all" | "out">("active");

    // ── Build rows with derived aggregates projected as real fields ─────────
    const rows = useMemo<HazardRow[]>(() => {
      const assetById = new Map(assets.map((a) => [a.id, a]));
      const toChip = (id: string): AssetChip => {
        // Resolve against the asset list. Be tolerant about the field names so
        // this keeps working whatever the shared AssetReference shape exposes
        // (name/label, assetGroup/group). If the id is not in the list at all
        // (e.g. a freshly created asset not yet merged back), name falls back
        // to the raw id and the chip tooltip flags it as unresolved.
        const a = assetById.get(id) as
          | (AssetReference & { label?: string; group?: string })
          | undefined;
        return {
          id,
          displayId: a?.displayId,
          name: a?.name ?? a?.label ?? id,
          group: a?.assetGroup ?? a?.group ?? "",
        };
      };

      const causeAssets: Record<string, AssetChip[]> = {};
      const targetAssets: Record<string, AssetChip[]> = {};

      for (const h of data.hazards) {
        causeAssets[h.id] = [];
        targetAssets[h.id] = [];
      }
      for (const r of data.relations as HazardRelation[]) {
        if (isContributesTo(r) && r.to in causeAssets) {
          causeAssets[r.to].push(toChip(r.from));
        }
        if (isEndangers(r) && r.from in targetAssets) {
          targetAssets[r.from].push(toChip(r.to));
        }
      }

      return data.hazards.map((h) => {
        // Not rated (no rated edge) sorts below S0 ("none", rank 0).
        const worst = worstEndangersSeverity(h.id, data.relations as HazardRelation[]);
        return {
          ...h,
          _causeAssets: causeAssets[h.id] ?? [],
          _targetAssets: targetAssets[h.id] ?? [],
          _worstRank: worst.severity ? worst.rank : -1,
          _worstSeverity: worst.severity,
        };
      });
    }, [data.hazards, data.relations, assets]);

    // ── Apply the visibility filter ─────────────────────────────────────────
    const visibleRows = useMemo<HazardRow[]>(
      () =>
        rows.filter((r) => {
          const out = r.systemRelevance === "out_of_scope";
          if (view === "active") return !out;
          if (view === "out") return out;
          return true;
        }),
      [rows, view],
    );

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
        description: t("tabs.hazards.tip.id", {
          defaultValue:
            "External reference (or internal ID). Hover a cell for the internal ID.",
        }),
        width: 90,
        renderCell: (p: GridRenderCellParams<HazardRow>) => {
          // Prefer the human-readable external reference (e.g. imported "00.01");
          // fall back to the internal id. The internal id stays available on hover.
          const display = p.row.externalRef ?? String(p.value);
          return (
            <Tooltip
              title={
                p.row.externalRef
                  ? `${t("tabs.hazards.tip.externalRef", { defaultValue: "External ref" })}: ${p.row.externalRef} · id: ${p.row.id}`
                  : `id: ${p.row.id}`
              }
            >
              <Chip
                label={display}
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
            </Tooltip>
          );
        },
      };

      const labelColumn: GridColDef<HazardRow> = {
        field: "label",
        headerName: t("tabs.hazards.columns.label", { defaultValue: "Hazard" }),
        description: t("tabs.hazards.tip.label", {
          defaultValue:
            "Short hazard label. Hover a cell for the full description.",
        }),
        flex: 1,
        minWidth: 260,
        renderCell: (p) => {
          // Re-import flag (HI-10): the source row changed or disappeared.
          const status = p.row.importMeta?.importStatus;
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Tooltip title={p.row.description ?? ""} placement="top-start">
                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                  {p.value || (
                    <em style={{ color: "#94a3b8" }}>
                      {t("tabs.hazards.unnamed", { defaultValue: "(unnamed)" })}
                    </em>
                  )}
                </Typography>
              </Tooltip>
              {(status === "changed" || status === "removed") && (
                <Chip
                  size="small"
                  color={status === "removed" ? "warning" : "info"}
                  variant="outlined"
                  data-testid="hazard-import-status-chip"
                  label={
                    status === "removed"
                      ? t("tabs.hazards.imported.chip.removed", { defaultValue: "removed from source" })
                      : t("tabs.hazards.imported.chip.changed", { defaultValue: "changed in source" })
                  }
                  sx={{ height: 20, fontSize: "0.7rem", flexShrink: 0 }}
                />
              )}
            </Box>
          );
        },
      };

      const typeColumn: GridColDef<HazardRow> = {
        field: "hazardType",
        headerName: t("tabs.hazards.columns.type", { defaultValue: "Type" }),
        description: t("tabs.hazards.tip.type", {
          defaultValue: "Hazard category (ISO 12100 type).",
        }),
        width: 90,
        renderCell: (p) =>
          p.value ? (
            <Tooltip
              title={t("tabs.hazards.tip.type", {
                defaultValue: "Hazard category (ISO 12100 type).",
              })}
            >
              <Chip
                label={t(`tabs.hazards.category.${p.value}`, {
                  defaultValue: humanize(String(p.value)),
                })}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.72rem", height: 20 }}
              />
            </Tooltip>
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
        description: t("tabs.hazards.tip.php", {
          defaultValue: "Physical hazard potential (low / medium / high).",
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
            <Tooltip
              title={t("tabs.hazards.tip.php", {
                defaultValue:
                  "Physical hazard potential (low / medium / high).",
              })}
            >
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
            </Tooltip>
          );
        },
      };

      const combinationColumn: GridColDef<HazardRow> = {
        field: "combinationType",
        headerName: t("tabs.hazards.columns.combination", {
          defaultValue: "Logic",
        }),
        description: t("tabs.hazards.tip.combination", {
          defaultValue:
            "How causes combine: ANY = one suffices, ALL = all required.",
        }),
        width: 80,
        renderCell: (p) => (
          <Tooltip
            title={t(`tabs.hazards.tip.logic.${p.value}`, {
              defaultValue:
                p.value === "ALL"
                  ? "ALL causes must coincide to realise the hazard."
                  : "ANY single cause can realise the hazard.",
            })}
          >
            <Chip
              label={p.value}
              size="small"
              color={p.value === "ALL" ? "secondary" : "default"}
              variant={p.value === "ALL" ? "filled" : "outlined"}
              sx={{ fontSize: "0.68rem", height: 20, fontFamily: "monospace" }}
            />
          </Tooltip>
        ),
      };

      const causesColumn: GridColDef<HazardRow> = {
        field: "_causeAssets",
        headerName: t("tabs.hazards.columns.causes", {
          defaultValue: "Causes",
        }),
        description: t("tabs.hazards.tip.causes", {
          defaultValue:
            "Contributing assets (causes). Hover a chip for the full name.",
        }),
        flex: 1.4,
        minWidth: 170,
        sortable: false,
        renderCell: (p) => (
          <AssetChips chips={p.row._causeAssets} kind="cause" />
        ),
      };

      const targetsColumn: GridColDef<HazardRow> = {
        field: "_targetAssets",
        headerName: t("tabs.hazards.columns.targets", {
          defaultValue: "Targets",
        }),
        description: t("tabs.hazards.tip.targets", {
          defaultValue:
            "Endangered assets/persons (targets). Hover a chip for the full name.",
        }),
        flex: 1.4,
        minWidth: 170,
        sortable: false,
        renderCell: (p) => (
          <AssetChips chips={p.row._targetAssets} kind="target" />
        ),
      };

      const severityColumn: GridColDef<HazardRow> = {
        field: "_worstRank",
        headerName: t("tabs.hazards.columns.maxSeverity", {
          defaultValue: "Max Severity",
        }),
        description: t("tabs.hazards.tip.maxSeverity", {
          defaultValue: "Worst endangers-severity across all targets.",
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
            <Tooltip
              title={t("tabs.hazards.tip.maxSeverity", {
                defaultValue: "Worst endangers-severity across all targets.",
              })}
            >
              <Chip
                label={withSeverityClass(
                  p.row._worstSeverity,
                  t(`tabs.hazards.severity.${p.row._worstSeverity}`, {
                    defaultValue: humanize(p.row._worstSeverity),
                  }),
                  labelVocabulary,
                )}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  backgroundColor: RANK_COLOR[p.row._worstRank],
                  color: p.row._worstRank >= 2 ? "#fff" : "#1e293b",
                }}
              />
            </Tooltip>
          );
        },
      };

      const sourceColumn: GridColDef<HazardRow> = {
        field: "source",
        headerName: t("tabs.hazards.columns.source", {
          defaultValue: "Source",
        }),
        description: t("tabs.hazards.tip.source", {
          defaultValue:
            "How the hazard entered the model: manual, imported or derived.",
        }),
        width: 110,
        renderCell: (p) => {
          const meta = SOURCE_META[String(p.value)] ?? SOURCE_META.manual;
          return (
            <Tooltip
              title={t("tabs.hazards.tip.source", {
                defaultValue:
                  "How the hazard entered the model: manual, imported or derived.",
              })}
            >
              <Chip
                icon={meta.icon}
                label={t(meta.labelKey, { defaultValue: meta.fallback })}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.68rem", height: 22 }}
              />
            </Tooltip>
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
    }, [t, onEdit, onDelete, labelVocabulary]);

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

          <Box sx={{ flexGrow: 1 }} />

          <Select
            size="small"
            value={view}
            onChange={(e) =>
              setView(e.target.value as "active" | "all" | "out")
            }
            sx={{
              fontSize: "0.8rem",
              minWidth: 190,
              backgroundColor: "background.paper",
            }}
          >
            <MenuItem value="active">
              {t("tabs.hazards.viewFilter.active", {
                defaultValue: "Active (hide out-of-scope)",
              })}
            </MenuItem>
            <MenuItem value="all">
              {t("tabs.hazards.viewFilter.all", {
                defaultValue: "All (incl. out-of-scope)",
              })}
            </MenuItem>
            <MenuItem value="out">
              {t("tabs.hazards.viewFilter.out", {
                defaultValue: "Out-of-scope only",
              })}
            </MenuItem>
          </Select>
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
              rows={visibleRows}
              columns={columns}
              getRowHeight={() => "auto"}
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: "_worstRank", sort: "desc" }] },
              }}
              onRowClick={(params) => onEdit(params.row)}
              getRowClassName={(params) => {
                const sr = params.row.systemRelevance;
                // Out of scope → red. In scope → completeness cue (green/orange).
                // Not yet reviewed (unknown / unset) → neutral, no colour.
                if (sr === "out_of_scope") return "haz-row-out";
                if (sr === "in_scope") {
                  return params.row._targetAssets.length > 0 &&
                    params.row._causeAssets.length > 0
                    ? "haz-row-complete"
                    : "haz-row-incomplete";
                }
                return "haz-row-neutral";
              }}
              disableRowSelectionOnClick
              density="compact"
              sx={{
                border: "none",
                // Row colouring is driven by review status, not completeness
                // alone: out-of-scope = red, in-scope incomplete = orange,
                // in-scope complete = green, not-yet-reviewed = neutral.
                "& .haz-row-out": {
                  backgroundColor: "rgba(239,68,68,0.12)",
                },
                "& .haz-row-out:hover": {
                  backgroundColor: "rgba(239,68,68,0.20) !important",
                },
                "& .haz-row-incomplete": {
                  backgroundColor: "rgba(251,146,60,0.12)",
                },
                "& .haz-row-incomplete:hover": {
                  backgroundColor: "rgba(251,146,60,0.20) !important",
                },
                "& .haz-row-complete": {
                  backgroundColor: "rgba(34,197,94,0.10)",
                },
                "& .haz-row-complete:hover": {
                  backgroundColor: "rgba(34,197,94,0.16) !important",
                },
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
