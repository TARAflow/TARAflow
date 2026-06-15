// features/hazards/components/hazard-import-profile-dialog.tsx
//
// Interactive import mapping with an explicit active-target model, a banner
// that always states what a column-header click does, explicit field states
// (unmapped / active / mapped=green), single/matrix per field, provenance
// (extra) columns, a column-map overview and a live preview. Fully i18n'd.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Divider,
  Alert,
  Stack,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  MyLocation as PickIcon,
} from "@mui/icons-material";

import {
  CANONICAL_FIELDS, REQUIRED_FIELDS, type CanonicalField,
} from "../services/safety-hazard-importer";
import { applyImportProfile, suggestProfile } from "../services/apply-import-profile";
import {
  MARKER_CAPABLE_FIELDS, markerValueOptions,
  type ImportProfile, type WorkbookPreview, type CellValue,
} from "../models/import-profile-types";

const PREVIEW_ROWS = 25;

function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type ActiveTarget =
  | { kind: "field"; field: CanonicalField }
  | { kind: "meta"; index: number }
  | null;

export interface HazardImportProfileDialogProps {
  open: boolean;
  workbook: WorkbookPreview;
  fileName: string;
  savedProfiles?: ImportProfile[];
  onConfirm: (profile: ImportProfile) => void;
  onCancel: () => void;
  onSaveProfile?: (profile: ImportProfile) => void;
}

export const HazardImportProfileDialog: React.FC<HazardImportProfileDialogProps> = ({
  open, workbook, fileName, savedProfiles, onConfirm, onCancel, onSaveProfile,
}) => {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) =>
    t(`tabs.hazards.import.${k}`, o);
  const fieldLabel = (f: CanonicalField) =>
    t(`tabs.hazards.import.fields.${f}`, { defaultValue: f });

  const [profile, setProfile] = useState<ImportProfile>(() =>
    suggestProfile(workbook),
  );
  const [active, setActive] = useState<ActiveTarget>(null);

  const sheet = useMemo(
    () =>
      workbook.sheets.find((s) => s.name === profile.sheetName) ??
      workbook.sheets[0],
    [workbook.sheets, profile.sheetName],
  );
  const maxCols = useMemo(
    () =>
      sheet.rows
        .slice(0, PREVIEW_ROWS)
        .reduce((m, r) => Math.max(m, r?.length ?? 0), 0),
    [sheet],
  );

  const colOfField = (f: CanonicalField) =>
    profile.columns.find((c) => c.field === f)?.column;
  const markerOfField = (f: CanonicalField) =>
    profile.markerGroups.find((g) => g.field === f);
  const isMapped = (f: CanonicalField) =>
    colOfField(f) !== undefined || !!markerOfField(f);

  const update = (patch: Partial<ImportProfile>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const changeSheet = (name: string) => {
    const seeded = suggestProfile({
      ...workbook,
      sheets: [workbook.sheets.find((s) => s.name === name)!],
    });
    update({
      sheetName: name,
      headerRow: seeded.headerRow,
      dataStartRow: seeded.dataStartRow,
      columns: seeded.columns,
      markerGroups: [],
      metaColumns: [],
    });
    setActive(null);
  };

  const assignColumn = (field: CanonicalField, column: number) =>
    setProfile((p) => ({
      ...p,
      markerGroups: p.markerGroups.filter((g) => g.field !== field),
      columns: [
        ...p.columns.filter((c) => c.field !== field),
        { field, column },
      ],
    }));

  const clearField = (field: CanonicalField) =>
    setProfile((p) => ({
      ...p,
      columns: p.columns.filter((c) => c.field !== field),
      markerGroups: p.markerGroups.filter((g) => g.field !== field),
    }));

  const setFieldMode = (field: CanonicalField, mode: "single" | "matrix") =>
    setProfile((p) =>
      mode === "matrix"
        ? {
            ...p,
            columns: p.columns.filter((c) => c.field !== field),
            markerGroups: [
              ...p.markerGroups.filter((g) => g.field !== field),
              { field, columns: [] },
            ],
          }
        : {
            ...p,
            markerGroups: p.markerGroups.filter((g) => g.field !== field),
          },
    );

  const toggleMarkerColumn = (field: CanonicalField, column: number) =>
    setProfile((p) => {
      const others = p.markerGroups.filter((g) => g.field !== field);
      const grp = p.markerGroups.find((g) => g.field === field) ?? {
        field,
        columns: [],
      };
      const exists = grp.columns.some((mc) => mc.column === column);
      const columns = exists
        ? grp.columns.filter((mc) => mc.column !== column)
        : [
            ...grp.columns,
            { column, value: markerValueOptions(field)[0] ?? "" },
          ];
      return {
        ...p,
        columns: p.columns.filter((c) => c.field !== field),
        markerGroups: [...others, { field, columns }],
      };
    });

  const setMarkerValue = (
    field: CanonicalField,
    column: number,
    value: string,
  ) =>
    setProfile((p) => ({
      ...p,
      markerGroups: p.markerGroups.map((g) =>
        g.field !== field
          ? g
          : {
              ...g,
              columns: g.columns.map((mc) =>
                mc.column === column ? { ...mc, value } : mc,
              ),
            },
      ),
    }));

  // ── meta columns (provenance) ────────────────────────────────────────────
  const addMeta = () =>
    setProfile((p) => {
      const next = [...p.metaColumns, { key: "", column: -1 }];
      setActive({ kind: "meta", index: next.length - 1 });
      return { ...p, metaColumns: next };
    });
  const setMetaKey = (i: number, key: string) =>
    setProfile((p) => ({
      ...p,
      metaColumns: p.metaColumns.map((m, j) => (j === i ? { ...m, key } : m)),
    }));
  const setMetaColumn = (i: number, column: number) =>
    setProfile((p) => ({
      ...p,
      metaColumns: p.metaColumns.map((m, j) =>
        j === i ? { ...m, column } : m,
      ),
    }));
  const removeMeta = (i: number) =>
    setProfile((p) => ({
      ...p,
      metaColumns: p.metaColumns.filter((_, j) => j !== i),
    }));

  // ── column header click → depends on the active target ───────────────────
  const onColumnHeaderClick = (column: number) => {
    if (!active) return;
    if (active.kind === "meta") {
      setMetaColumn(active.index, column);
      return;
    }
    const f = active.field;
    if (markerOfField(f)) toggleMarkerColumn(f, column);
    else assignColumn(f, column);
  };

  // ── banner ─────────────────────────────────────────────────────────────────
  const banner = (() => {
    if (!active) return { sev: "info" as const, msg: tt("bannerIdle") };
    if (active.kind === "meta") {
      const key = profile.metaColumns[active.index]?.key || tt("unnamed");
      return { sev: "warning" as const, msg: tt("bannerMeta", { key }) };
    }
    const f = active.field;
    if (markerOfField(f))
      return {
        sev: "warning" as const,
        msg: tt("bannerMatrix", { field: fieldLabel(f) }),
      };
    return {
      sev: "warning" as const,
      msg: tt("bannerSingle", { field: fieldLabel(f) }),
    };
  })();

  const activeTargetLabel =
    active?.kind === "meta"
      ? profile.metaColumns[active.index]?.key || tt("unnamed")
      : active?.kind === "field"
        ? fieldLabel(active.field)
        : "";

  // ── preview + overview ──────────────────────────────────────────────────────
  const preview = useMemo(() => {
    try {
      return applyImportProfile(workbook.sheets, profile, fileName);
    } catch {
      return { hazards: [], warnings: [], adapterUsed: profile.id };
    }
  }, [workbook.sheets, profile, fileName]);

  const overview = useMemo(() => {
    const rows: { col: string; target: string }[] = [];
    for (const c of profile.columns)
      rows.push({ col: colLetter(c.column), target: fieldLabel(c.field) });
    for (const g of profile.markerGroups)
      rows.push({
        col: g.columns.map((m) => colLetter(m.column)).join("/") || "—",
        target: `${fieldLabel(g.field)} (matrix)`,
      });
    for (const m of profile.metaColumns)
      if (m.column >= 0)
        rows.push({
          col: colLetter(m.column),
          target: `${m.key || tt("unnamed")} (meta)`,
        });
    return rows.sort((a, b) => a.col.localeCompare(b.col));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.columns, profile.markerGroups, profile.metaColumns]);

  const requiredOk = REQUIRED_FIELDS.every((f) => colOfField(f) !== undefined);
  const headerCells = sheet.rows[profile.headerRow] ?? [];

  // Notice: an unmapped category column means every hazard falls back to a default.
  const categoryUnmapped =
    colOfField("hazardCategory") === undefined &&
    !markerOfField("hazardCategory");

  const fieldBorder = (f: CanonicalField) =>
    active?.kind === "field" && active.field === f
      ? "primary.main"
      : isMapped(f)
        ? "success.main"
        : "divider";

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { height: "92vh" } }}
    >
      <DialogTitle>
        {tt("title")} — {fileName}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column" }}>
        {/* controls */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
            mb: 1,
            flexShrink: 0,
          }}
        >
          {workbook.format === "spreadsheet" && (
            <Box>
              <Typography variant="caption">{tt("sheet")}</Typography>
              <Select
                size="small"
                value={sheet.name}
                onChange={(e) => changeSheet(e.target.value)}
                sx={{ minWidth: 220, display: "block" }}
              >
                {workbook.sheets.map((s) => (
                  <MenuItem key={s.name} value={s.name}>
                    {s.name} ({s.rows.length} {tt("rows")})
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}
          <Tooltip title={tt("tooltips.headerRow")}>
            <Box>
              <Typography variant="caption">{tt("headerRow")}</Typography>
              <TextField
                size="small"
                type="number"
                value={profile.headerRow + 1}
                onChange={(e) =>
                  update({ headerRow: Math.max(0, Number(e.target.value) - 1) })
                }
                sx={{ width: 100, display: "block" }}
              />
            </Box>
          </Tooltip>
          <Tooltip title={tt("tooltips.dataStartRow")}>
            <Box>
              <Typography variant="caption">{tt("dataStartRow")}</Typography>
              <TextField
                size="small"
                type="number"
                value={profile.dataStartRow + 1}
                onChange={(e) =>
                  update({
                    dataStartRow: Math.max(0, Number(e.target.value) - 1),
                  })
                }
                sx={{ width: 120, display: "block" }}
              />
            </Box>
          </Tooltip>
          <Tooltip title={tt("tooltips.idFilter")}>
            <Box>
              <Typography variant="caption">{tt("idFilter")}</Typography>
              <TextField
                size="small"
                placeholder="^\d+\.\d+$"
                value={profile.idPattern ?? ""}
                onChange={(e) =>
                  update({ idPattern: e.target.value || undefined })
                }
                sx={{ width: 180, display: "block" }}
              />
            </Box>
          </Tooltip>
        </Box>

        {/* active-target banner */}
        <Alert severity={banner.sev} sx={{ mb: 1, flexShrink: 0, py: 0 }}>
          {banner.msg}
        </Alert>

        {/* defaults notice */}
        {categoryUnmapped && (
          <Alert severity="info" sx={{ mb: 1, flexShrink: 0, py: 0 }}>
            {tt("unmappedCategory", {
              field: fieldLabel("hazardCategory"),
              value: "other",
            })}
          </Alert>
        )}

        {/* main: fields | grid */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "stretch",
            flexGrow: 1,
            minHeight: 0,
          }}
        >
          {/* left panel — fixed width, never squeezed */}
          <Box sx={{ width: 360, flexShrink: 0, overflow: "auto", pr: 1 }}>
            {CANONICAL_FIELDS.map((field) => {
              const col = colOfField(field);
              const marker = markerOfField(field);
              const isActive =
                active?.kind === "field" && active.field === field;
              const mapped = isMapped(field);
              const required = REQUIRED_FIELDS.includes(field);
              const canMatrix = MARKER_CAPABLE_FIELDS.includes(field);
              return (
                <Box
                  key={field}
                  sx={{
                    border: "2px solid",
                    borderColor: fieldBorder(field),
                    borderRadius: 1,
                    p: 1,
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Tooltip title={tt("tooltips.field")}>
                      <Button
                        size="small"
                        variant={isActive || mapped ? "contained" : "outlined"}
                        color={
                          isActive ? "primary" : mapped ? "success" : "primary"
                        }
                        onClick={() => setActive({ kind: "field", field })}
                      >
                        {fieldLabel(field)}
                        {required ? " *" : ""}
                      </Button>
                    </Tooltip>
                    {col !== undefined && (
                      <Tooltip title={tt("tooltips.clearField")}>
                        <Chip
                          size="small"
                          color="success"
                          label={`${colLetter(col)}`}
                          onDelete={() => clearField(field)}
                        />
                      </Tooltip>
                    )}
                    {marker && (
                      <Tooltip title={tt("tooltips.clearField")}>
                        <Chip
                          size="small"
                          color="success"
                          label={
                            marker.columns
                              .map((m) => colLetter(m.column))
                              .join("/") || "…"
                          }
                          onDelete={() => clearField(field)}
                        />
                      </Tooltip>
                    )}
                    {canMatrix && (
                      <Tooltip title={tt("tooltips.mode")}>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={marker ? "matrix" : "single"}
                          onChange={(_, v) => v && setFieldMode(field, v)}
                          sx={{ ml: "auto" }}
                        >
                          <ToggleButton value="single" sx={{ px: 1, py: 0 }}>
                            {tt("single")}
                          </ToggleButton>
                          <ToggleButton value="matrix" sx={{ px: 1, py: 0 }}>
                            {tt("matrix")}
                          </ToggleButton>
                        </ToggleButtonGroup>
                      </Tooltip>
                    )}
                  </Box>
                  {marker && (
                    <Box sx={{ mt: 1, pl: 1 }}>
                      {marker.columns.map((mc) => (
                        <Box
                          key={mc.column}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <Chip size="small" label={colLetter(mc.column)} />
                          <Select
                            size="small"
                            value={mc.value}
                            onChange={(e) =>
                              setMarkerValue(field, mc.column, e.target.value)
                            }
                            sx={{ minWidth: 150 }}
                          >
                            {markerValueOptions(field).map((v) => (
                              <MenuItem key={v} value={v}>
                                {v}
                              </MenuItem>
                            ))}
                          </Select>
                          <IconButton
                            size="small"
                            onClick={() => toggleMarkerColumn(field, mc.column)}
                          >
                            <DeleteIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* provenance / extra columns */}
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              {tt("extraTitle")}
            </Typography>
            {profile.metaColumns.map((m, i) => {
              const isActive = active?.kind === "meta" && active.index === i;
              return (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1,
                    border: "2px solid",
                    borderColor: isActive
                      ? "primary.main"
                      : m.column >= 0
                        ? "success.main"
                        : "divider",
                    borderRadius: 1,
                    p: 1,
                  }}
                >
                  <TextField
                    size="small"
                    placeholder={tt("extraKeyPlaceholder")}
                    value={m.key}
                    onChange={(e) => setMetaKey(i, e.target.value)}
                    sx={{ flexGrow: 1 }}
                  />
                  {m.column >= 0 && (
                    <Chip
                      size="small"
                      color="success"
                      label={colLetter(m.column)}
                    />
                  )}
                  <Tooltip title={tt("pickColumn")}>
                    <IconButton
                      size="small"
                      color={isActive ? "primary" : "default"}
                      onClick={() => setActive({ kind: "meta", index: i })}
                    >
                      <PickIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => removeMeta(i)}>
                    <DeleteIcon fontSize="inherit" />
                  </IconButton>
                </Box>
              );
            })}
            <Tooltip title={tt("tooltips.addExtra")}>
              <Button size="small" startIcon={<AddIcon />} onClick={addMeta}>
                {tt("addExtra")}
              </Button>
            </Tooltip>
          </Box>

          {/* grid — allowed to shrink (minWidth:0) instead of squeezing the panel */}
          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              overflow: "auto",
              height: "100%",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                "& td, & th": {
                  whiteSpace: "nowrap",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: "grey.100" }}>#</TableCell>
                  {Array.from({ length: maxCols }).map((_, c) => (
                    <Tooltip
                      key={c}
                      title={
                        active
                          ? tt("assignTo", { target: activeTargetLabel })
                          : String(headerCells[c] ?? "")
                      }
                    >
                      <TableCell
                        onClick={() => onColumnHeaderClick(c)}
                        sx={{
                          cursor: active ? "pointer" : "default",
                          bgcolor: active ? "primary.50" : "grey.100",
                          fontWeight: 700,
                          "&:hover": active
                            ? { bgcolor: "primary.100" }
                            : undefined,
                        }}
                      >
                        {colLetter(c)}
                      </TableCell>
                    </Tooltip>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sheet.rows.slice(0, PREVIEW_ROWS).map((row, r) => {
                  const isHeader = r === profile.headerRow;
                  const isData = r >= profile.dataStartRow;
                  return (
                    <TableRow
                      key={r}
                      sx={{
                        bgcolor: isHeader
                          ? "warning.light"
                          : isData
                            ? undefined
                            : "action.hover",
                      }}
                    >
                      <TableCell
                        onClick={() => update({ dataStartRow: r })}
                        sx={{ cursor: "pointer", fontWeight: 700 }}
                      >
                        {r + 1}
                      </TableCell>
                      {Array.from({ length: maxCols }).map((_, c) => (
                        <TableCell key={c}>
                          {cellToStr((row ?? [])[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>

        {/* overview + preview */}
        <Box sx={{ flexShrink: 0, mt: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", gap: 0.5, mb: 1 }}
          >
            <Typography variant="caption" sx={{ alignSelf: "center", mr: 1 }}>
              {tt("columnMap")}:
            </Typography>
            {overview.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {tt("nothingMapped")}
              </Typography>
            )}
            {overview.map((o, i) => (
              <Chip
                key={i}
                size="small"
                variant="outlined"
                label={`${o.col} → ${o.target}`}
              />
            ))}
          </Stack>
          <Typography variant="subtitle2">
            {tt("previewSummary", {
              hazards: preview.hazards.length,
              warnings: preview.warnings.length,
            })}
          </Typography>
          <Box sx={{ maxHeight: 130, overflow: "auto", mt: 0.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{tt("preview.id")}</TableCell>
                  <TableCell>{tt("preview.description")}</TableCell>
                  <TableCell>{tt("preview.severity")}</TableCell>
                  <TableCell>{tt("preview.probability")}</TableCell>
                  <TableCell>{tt("preview.persons")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.hazards.slice(0, 5).map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.id}</TableCell>
                    <TableCell>{h.description}</TableCell>
                    <TableCell>{h.severity}</TableCell>
                    <TableCell>{h.probability ?? ""}</TableCell>
                    <TableCell>
                      {(h.affectedPersons ?? []).join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {savedProfiles && savedProfiles.length > 0 && (
            <Select
              size="small"
              displayEmpty
              value=""
              onChange={(e) => {
                const p = savedProfiles.find((sp) => sp.id === e.target.value);
                if (p) {
                  setProfile({ ...p, metaColumns: p.metaColumns ?? [] });
                  setActive(null);
                }
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="" disabled>
                {tt("loadProfile")}
              </MenuItem>
              {savedProfiles.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          )}
          <TextField
            size="small"
            label={tt("profileName")}
            value={profile.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          {onSaveProfile && (
            <Button onClick={() => onSaveProfile(profile)}>
              {tt("saveProfile")}
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onCancel}>{tt("cancel")}</Button>
          <Tooltip title={requiredOk ? "" : tt("requiredHint")}>
            <span>
              <Button
                variant="contained"
                disabled={!requiredOk}
                onClick={() => onConfirm(profile)}
              >
                {tt("confirm", { count: preview.hazards.length })}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

function cellToStr(v: CellValue): string {
  return v === null || v === undefined ? "" : String(v);
}

export default HazardImportProfileDialog;