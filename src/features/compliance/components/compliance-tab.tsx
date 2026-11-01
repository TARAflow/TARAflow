// features/compliance/components/compliance-tab.tsx
//
// The Compliance tab (iec-62443-4-2-cra-coverage.md D-9, IEC-8): the
// IEC 62443-4-2 requirement matrix of the project — component under
// evaluation (D-7), device categories of the 2019 edition (K-C1), target
// SL-C per FR with the achieved and planned values (D-2, D-4, D-14), and
// the rows with their status, source and the analyst statements (D-8, D-17).
//
// Presentational: the app layer evaluates the model (compliance-report.ts)
// and stores what the tab changes (project.compliance).

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  FOUNDATIONAL_REQUIREMENTS,
  withComplianceComponent,
  withComplianceStatement,
  withComplianceTarget,
  withDeviceCategories,
  withoutComplianceStatement,
  type ComplianceData,
  type ComplianceStatement,
  type DeviceCategory,
  type StatementStatus,
  type TargetSecurityLevel,
} from "shared";
import type { Edition } from "../models/compliance-types";
import type { ComplianceResult, RowResult, RowStatus } from "../models/evaluation-types";
import type { DeviceCategoryProposal } from "../services/device-category";

const NS = "compliance";

/** Keys of the compliance namespace live under "compliance.*" (one file per feature, full key paths). */
function useComplianceT() {
  const { t } = useTranslation(NS);
  const translate = t as unknown as (key: string, options: Record<string, unknown>) => string;
  return (key: string, defaultValue: string, options?: Record<string, unknown>): string =>
    translate(`compliance.${key}`, { defaultValue, ...(options ?? {}) });
}

const DEVICE_CATEGORIES: DeviceCategory[] = ["SAR", "EDR", "HDR", "NDR"];
const OPEN_STATUSES: readonly RowStatus[] = ["gap", "unknown", "needs-statement", "pending-category"];

const STATUS_DEFAULT: Record<RowStatus, string> = {
  met: "met",
  claimed: "claimed",
  "n/a": "not applicable",
  unknown: "unknown",
  "pending-category": "confirm category",
  "needs-statement": "statement needed",
  gap: "gap",
};
const STATUS_COLOR: Record<RowStatus, "success" | "info" | "default" | "warning" | "error"> = {
  met: "success",
  claimed: "info",
  "n/a": "default",
  unknown: "warning",
  "pending-category": "warning",
  "needs-statement": "warning",
  gap: "error",
};
const SOURCE_DEFAULT: Record<string, string> = {
  model: "model",
  mitigation: "mitigation",
  "supporting-measure": "supporting measure",
  statement: "statement",
  claim: "claim",
  edition: "edition",
  "device-category": "device category",
};
const STATEMENT_DEFAULT: Record<StatementStatus, string> = { met: "met", "not-met": "not met", "n/a": "not applicable" };

export interface ComplianceTabProps {
  edition: Edition;
  achieved: ComplianceResult;
  planned: ComplianceResult;
  data: ComplianceData | undefined;
  /** Elements that can be the component (Multiprocess, Process). */
  componentOptions: readonly { id: string; label: string }[];
  /** 2019 edition: the proposal for the selected component (K-C1). */
  deviceProposal?: DeviceCategoryProposal;
  /** Element id → "P-6 Maintenance Authentication Service". */
  nameOf: (id: string) => string;
  /** ISO date stored with a statement. */
  today: string;
  onChange: (data: ComplianceData) => void;
}

/** First items of a list, the rest counted. */
const shortList = (items: readonly string[], max = 4) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} (+${items.length - max})`;

export const ComplianceTab: React.FC<ComplianceTabProps> = ({
  edition,
  achieved,
  planned,
  data,
  componentOptions,
  deviceProposal,
  nameOf,
  today,
  onChange,
}) => {
  const t = useComplianceT();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [editing, setEditing] = useState<RowResult | null>(null);
  const hasDeviceRows = edition.rows.some((r) => r.deviceCategories);
  const cra = edition.id === "en-iec-62443-4-2-praa-2026";
  const statements = data?.statements?.[edition.id] ?? {};
  const rowDef = useMemo(() => new Map(edition.rows.map((r) => [r.label, r])), [edition]);

  const rows = useMemo(
    () => (filter === "all" ? achieved.rows : achieved.rows.filter((r) => OPEN_STATUSES.includes(r.status) || r.statementModelChanged)),
    [achieved.rows, filter],
  );

  const choice = data?.deviceCategories;
  const confirmedCategories = choice?.source === "manual" ? choice.categories : [];

  return (
    <Box sx={{ p: 3 }} data-testid="compliance-tab">
      <Stack spacing={3}>
        {/* ── Basis ─────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">{edition.title}</Typography>
            {edition.draft && <Chip size="small" color="warning" label={t("draft", "draft")} />}
            <TextField
              select
              size="small"
              sx={{ minWidth: 320 }}
              label={t("component", "Component under evaluation")}
              value={data?.componentId ?? ""}
              onChange={(e) => onChange(withComplianceComponent(data, e.target.value || undefined))}
              inputProps={{ "data-testid": "compliance-component" }}
            >
              <MenuItem value="">{t("wholeModel", "Whole model")}</MenuItem>
              {componentOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              "intro",
              "The matrix is derived from the model: properties, the mitigations of the risk treatment, supporting measures outside the component, your statements and claims. Unset properties count as unknown — never as not applicable.",
            )}
          </Typography>

          {hasDeviceRows && (
            <Box sx={{ mt: 2 }} data-testid="compliance-device-categories">
              <Typography variant="subtitle2">{t("deviceCategories", "Device categories (IEC 62443-4-2:2019)")}</Typography>
              {choice?.source !== "manual" && (
                <Alert severity="warning" sx={{ my: 1 }}>
                  {deviceProposal && deviceProposal.categories.length > 0
                    ? t("deviceProposal", "Proposal from the model: {{categories}} — confirm before the device rows count.", {
                        categories: deviceProposal.categories.join(", "),
                      })
                    : t("deviceAsk", "Choose the device category of the component — workstation or mobile device: HDR if the device is delivered, SAR for an app or tool only.")}
                </Alert>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                {DEVICE_CATEGORIES.map((category) => {
                  const current = choice?.source === "manual" ? confirmedCategories : deviceProposal?.categories ?? [];
                  return (
                    <FormControlLabel
                      key={category}
                      label={category}
                      control={
                        <Checkbox
                          size="small"
                          checked={current.includes(category)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...current, category] : current.filter((c) => c !== category);
                            onChange(withDeviceCategories(data, { categories: next, source: "manual" }));
                          }}
                        />
                      }
                    />
                  );
                })}
                {choice?.source !== "manual" && deviceProposal && deviceProposal.categories.length > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onChange(withDeviceCategories(data, { categories: deviceProposal.categories, source: "manual" }))}
                  >
                    {t("confirm", "Confirm")}
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </Paper>

        {/* ── SL table (D-26): FRs as columns ─────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("vectorTitle", "Security levels per foundational requirement")}
          </Typography>
          <Table size="small" data-testid="compliance-vector">
            <TableHead>
              <TableRow>
                <TableCell />
                {FOUNDATIONAL_REQUIREMENTS.map((fr) => (
                  <TableCell key={fr} align="center">
                    {fr}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{t("target", "SL-T (requirement)")}</span>
                    <TextField
                      select
                      size="small"
                      label={t("targetAll", "all FR")}
                      value=""
                      sx={{ minWidth: 96 }}
                      onChange={(e) => {
                        const level = e.target.value === "-" ? undefined : (Number(e.target.value) as TargetSecurityLevel);
                        let next = data;
                        for (const fr of FOUNDATIONAL_REQUIREMENTS) next = withComplianceTarget(next, fr, level);
                        if (next) onChange(next);
                      }}
                      inputProps={{ "data-testid": "compliance-target-all" }}
                    >
                      <MenuItem value="-">—</MenuItem>
                      {["1", "2", "3", "4"].map((n) => (
                        <MenuItem key={n} value={n}>
                          {n}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                </TableCell>
                {FOUNDATIONAL_REQUIREMENTS.map((fr) => {
                  const target = data?.target?.[fr];
                  return (
                    <TableCell key={fr} align="center">
                      <TextField
                        select
                        size="small"
                        value={target === undefined ? "" : String(target)}
                        onChange={(e) =>
                          onChange(withComplianceTarget(data, fr, e.target.value === "" ? undefined : (Number(e.target.value) as TargetSecurityLevel)))
                        }
                        inputProps={{ "data-testid": `compliance-target-${fr}` }}
                      >
                        <MenuItem value="">—</MenuItem>
                        {["1", "2", "3", "4"].map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  );
                })}
              </TableRow>
              {(
                [
                  ["slcProduct", t("achievedComponent", "SL-C (product)"), achieved.component, true],
                  ["slcPlanned", t("plannedComponent", "SL-C planned"), planned.component, true],
                  ["withSystem", t("achievedWithSupport", "With measures of the system"), achieved.withSupport, false],
                ] as const
              ).map(([key, label, values, compare]) => (
                <TableRow key={key} data-testid={`compliance-vector-${key}`}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{label}</TableCell>
                  {FOUNDATIONAL_REQUIREMENTS.map((fr) => (
                    <TableCell key={fr} align="center">
                      <LevelChip value={values[fr]} target={compare ? data?.target?.[fr] : undefined} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              "vectorText",
              "SL-T: what the operator or the zone requires. SL-C (product): what the product provides according to the model; planned: after the chosen open mitigations. With measures of the system: what the plant can reach if it provides the listed supporting measures and claims — the basis for the SL-A, which only arises in the operated plant.",
            )}
          </Typography>
        </Paper>

        {/* ── Rows ──────────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1">{t("rowsTitle", "Requirements")}</Typography>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
              <ToggleButton value="open" data-testid="compliance-filter-open">
                {t("filterOpen", "Open")}
              </ToggleButton>
              <ToggleButton value="all" data-testid="compliance-filter-all">
                {t("filterAll", "All")}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Table size="small" data-testid="compliance-rows">
            <TableHead>
              <TableRow>
                <TableCell>{t("requirement", "Requirement")}</TableCell>
                <TableCell>{t("minSl", "SL-C from")}</TableCell>
                {cra && <TableCell>{t("cra", "CRA")}</TableCell>}
                <TableCell>{t("statusColumn", "Status")}</TableCell>
                <TableCell>{t("sourceColumn", "Source")}</TableCell>
                <TableCell>{t("notes", "Notes")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const notes = [
                  row.failing.length > 0 && `${t("failing", "not met by")}: ${shortList(row.failing.map(nameOf))}`,
                  row.unknown.length > 0 && `${t("unknown", "properties missing on")}: ${shortList(row.unknown.map(nameOf))}`,
                  row.supportingElements.length > 0 && `${t("supporting", "supporting measure")}: ${shortList(row.supportingElements.map(nameOf))}`,
                  row.mitigationIds.length > 0 && `${t("mitigations", "mitigations")}: ${shortList([...new Set(row.mitigationIds)])}`,
                  row.checklist.length > 0 && `${t("checklist", "to confirm")}: ${row.checklist.join("; ")}`,
                  row.source === "statement" && row.reasoning,
                ].filter(Boolean);
                return (
                  <TableRow key={row.label} data-testid={`compliance-row-${row.label}`}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.label}</TableCell>
                    <TableCell>{row.minSl ?? "—"}</TableCell>
                    {cra && <TableCell>{(rowDef.get(row.label)?.cra ?? []).join(", ") || "—"}</TableCell>}
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[row.status]} label={t(`status.${row.status}`, STATUS_DEFAULT[row.status])} />
                    </TableCell>
                    <TableCell>{row.source ? t(`sourceName.${row.source}`, SOURCE_DEFAULT[row.source]) : ""}</TableCell>
                    <TableCell sx={{ maxWidth: 520 }}>
                      <Typography variant="body2">{notes.join(" · ")}</Typography>
                      {row.contradiction && (
                        <Typography variant="body2" color="error.main">
                          {t("contradiction", "Mitigation marked done, but the model shows the requirement not met.")}
                        </Typography>
                      )}
                      {row.statementModelChanged && (
                        <Typography variant="body2" color="warning.main">
                          {t("modelChanged", "The model changed since the statement — review it.")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.source !== "edition" && (
                        <Button size="small" onClick={() => setEditing(row)} data-testid={`compliance-statement-${row.label}`}>
                          {statements[row.label] ? t("editStatement", "Statement") : t("addStatement", "Add statement")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("noOpenRows", "No open requirements.")}
            </Typography>
          )}
        </Paper>
      </Stack>

      {editing && (
        <StatementDialog
          row={editing}
          existing={statements[editing.label]}
          onClose={() => setEditing(null)}
          onSave={(statement) => {
            onChange(withComplianceStatement(data, edition.id, editing.label, statement));
            setEditing(null);
          }}
          onRemove={() => {
            onChange(withoutComplianceStatement(data, edition.id, editing.label));
            setEditing(null);
          }}
          today={today}
        />
      )}
    </Box>
  );
};

// ==================== LEVEL CHIP ====================

/** A level, compared with the SL-T by colour AND symbol (D-26). */
const LevelChip: React.FC<{ value: number; target?: number }> = ({ value, target }) => {
  if (target === undefined) return <Chip size="small" variant="outlined" label={value} />;
  const ok = value >= target;
  return (
    <Chip
      size="small"
      color={ok ? "success" : "error"}
      label={`${value} ${ok ? "✓" : "✗"}`}
      sx={{ fontWeight: 700, minWidth: 48 }}
      data-level={ok ? "meets" : "below"}
    />
  );
};

// ==================== STATEMENT DIALOG ====================

interface StatementDialogProps {
  row: RowResult;
  existing?: ComplianceStatement;
  today: string;
  onSave: (statement: ComplianceStatement) => void;
  onRemove: () => void;
  onClose: () => void;
}

const StatementDialog: React.FC<StatementDialogProps> = ({ row, existing, today, onSave, onRemove, onClose }) => {
  const t = useComplianceT();
  const [status, setStatus] = useState<StatementStatus>(existing?.status ?? "met");
  const [reasoning, setReasoning] = useState(existing?.reasoning ?? "");
  const [supportingMeasure, setSupportingMeasure] = useState(existing?.supportingMeasure ?? "");
  const [evidenceRef, setEvidenceRef] = useState(existing?.evidenceRef ?? "");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("statementTitle", "Statement on {{row}}", { row: row.label })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("statementModel", "Model result now: {{status}}. It is stored with the statement, so a later change of the model is shown.", {
              status: t(`status.${row.modelStatus}`, STATUS_DEFAULT[row.modelStatus]),
            })}
          </Typography>
          <TextField select label={t("statementStatus", "Status")} value={status} onChange={(e) => setStatus(e.target.value as StatementStatus)}
            inputProps={{ "data-testid": "statement-status" }}>
            {(Object.keys(STATEMENT_DEFAULT) as StatementStatus[]).map((s) => (
              <MenuItem key={s} value={s}>
                {t(`statementStatusName.${s}`, STATEMENT_DEFAULT[s])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("reasoning", "Reasoning")}
            required
            multiline
            minRows={2}
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            inputProps={{ "data-testid": "statement-reasoning" }}
          />
          <TextField
            label={t("supportingMeasure", "Supporting measure (outside the component)")}
            helperText={t("supportingMeasureHelp", "Name it when the system around the component meets the requirement (CCSC 2).")}
            value={supportingMeasure}
            onChange={(e) => setSupportingMeasure(e.target.value)}
          />
          <TextField label={t("evidenceRef", "Evidence (document, section, test report)")} value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {existing && (
          <Button color="error" onClick={onRemove}>
            {t("removeStatement", "Remove")}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>{t("cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          disabled={reasoning.trim() === ""}
          data-testid="statement-save"
          onClick={() =>
            onSave({
              status,
              reasoning: reasoning.trim(),
              ...(supportingMeasure.trim() ? { supportingMeasure: supportingMeasure.trim() } : {}),
              ...(evidenceRef.trim() ? { evidenceRef: evidenceRef.trim() } : {}),
              modelStatusAtStatement: row.modelStatus,
              date: today,
            })
          }
        >
          {t("save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
