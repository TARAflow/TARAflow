// ==================== IMPORTED THREATS SECTION ====================
// Multi-project TARA (design v3 §7.1, patch 14/15): the threats of imported
// components, read-only — text, STRIDE and relevance are the component's
// decisions; risks are rated in the Risk tab. Grouped per instance. The
// app layer derives them (features/threats knows no components).
//
// Boundary flows (§17 I3): the machine may override the relevance, in both
// directions, with a mandatory rationale; the component's decision stays
// visible beside it. An override whose component decision changed since is
// marked "to review".
//
// Manual test 2026-11-07: only the active method's threats are shown (the
// count matches the machine's own tables), and a row opens the threat in
// the threat dialog, read-only.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {
  ImportedRelevanceDecision,
  ImportedThreatRow,
  StrideMethod,
  Threat,
  ThreatRelevance,
} from "../../models/threat-types";
import { DescriptionCell, StrideCell, ThreatIdCell, compareThreatsByLabel } from "./threat-table-utils";

const NS = { ns: "components" } as const;

export interface ImportedThreatGroup {
  key: string;
  label: string;
  threats: Threat[];
  rows?: readonly ImportedThreatRow[];
  /** The component the instance belongs to — instances of one component are shown together (I5). */
  componentKey?: string;
  componentLabel?: string;
  /** Instance prefix, e.g. "SD1" — the display ids carry it. */
  prefix?: string;
}

const where = (t: Threat) =>
  t.dataFlow
    ? t.dataFlow.dataFlowName || `${t.dataFlow.sourceName} → ${t.dataFlow.targetName}`
    : [t.linkedElement?.displayId, t.linkedElement?.elementName].filter(Boolean).join(" ");

const RELEVANCES: ThreatRelevance[] = ["relevant", "not_relevant", "uncertain", "unrated"];

export interface ImportedThreatsSectionProps {
  groups?: readonly ImportedThreatGroup[];
  /** Absent: no override offered (read-only everywhere). */
  onOverrideRelevance?: (groupKey: string, threatKey: string, decision: ImportedRelevanceDecision) => void;
  /** The active method: only its threats are shown. Absent: all. */
  method?: StrideMethod;
  /** Open a threat read-only: the group's shown threats in display order and the index clicked. */
  onOpenThreat?: (group: { key: string; label: string }, threats: Threat[], index: number) => void;
}

/** The rows of a group as shown: the active method only, sorted by label. */
function rowsOf(g: ImportedThreatGroup, method: StrideMethod | undefined): ImportedThreatRow[] {
  const rows: ImportedThreatRow[] = g.rows
    ? [...g.rows]
    : g.threats.map((threat) => ({ threat, threatKey: threat.id, componentRelevance: threat.relevance, boundary: false }));
  return rows
    .filter((r) => !method || !r.method || r.method === method)
    .sort((a, b) => compareThreatsByLabel(a.threat, b.threat));
}

export const ImportedThreatsSection: React.FC<ImportedThreatsSectionProps> = ({ groups, onOverrideRelevance, method, onOpenThreat }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ groupKey: string; row: ImportedThreatRow } | null>(null);
  if (!groups || groups.length === 0) return null;
  const shown = groups.map((g) => ({ group: g, rows: rowsOf(g, method) })).filter((x) => x.rows.length > 0);
  if (shown.length === 0) return null;
  // Per component, its instances below (I5, patch 31): a component used
  // more than once shows each threat once with a line per instance.
  type Shown = { group: ImportedThreatGroup; rows: ImportedThreatRow[] };
  const byKey = new Map<string, { key: string; label: string; items: Shown[] }>();
  for (const x of shown) {
    const key = x.group.componentKey ?? x.group.key;
    const entry = byKey.get(key) ?? { key, label: x.group.componentLabel ?? x.group.label, items: [] };
    entry.items.push(x);
    byKey.set(key, entry);
  }
  const components = [...byKey.values()];
  const total = components.reduce(
    (n, c) => n + (c.items.length === 1 ? c.items[0].rows.length : new Set(c.items.flatMap((x) => x.rows.map((r) => r.threatKey))).size),
    0,
  );
  const renderInstance = (g: ImportedThreatGroup, rows: ImportedThreatRow[]) => {
    const open = (index: number) => onOpenThreat?.({ key: g.key, label: g.label }, rows.map((r) => r.threat), index);
    return (
            <Box key={g.key} sx={{ mb: 2 }} data-testid={`imported-threats-${g.key}`}>
        <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
          {g.label}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>STRIDE</TableCell>
              <TableCell>{t("components.threats.where", { ...NS, defaultValue: "Element / flow" })}</TableCell>
              <TableCell>{t("components.threats.threat", { ...NS, defaultValue: "Threat" })}</TableCell>
              <TableCell>{t("components.threats.relevance", { ...NS, defaultValue: "Relevance (component)" })}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.threat.id}
                data-testid={`imported-threat-${row.threatKey}`}
                hover={!!onOpenThreat}
                onClick={onOpenThreat ? () => open(index) : undefined}
                sx={onOpenThreat ? { cursor: "pointer" } : undefined}
              >
                <TableCell>
                  <ThreatIdCell id={row.threat.displayId} />
                </TableCell>
                <TableCell>
                  <StrideCell cat={row.threat.strideCategory} />
                </TableCell>
                <TableCell sx={{ fontSize: "0.8rem" }}>{where(row.threat)}</TableCell>
                <TableCell sx={{ maxWidth: 340 }}>
                  <DescriptionCell
                    value={row.threat.threatDescription || row.threat.attackDescription}
                    fallback={t("components.threats.templateText", { ...NS, defaultValue: "(catalog text)" })}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={row.componentRelevance}
                      sx={row.override ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                    />
                    {row.override && (
                      <Tooltip title={row.override.rationale}>
                        <Chip
                          size="small"
                          color="primary"
                          label={t("components.threats.overridden", { ...NS, relevance: row.override.relevance, defaultValue: "machine: {{relevance}}" })}
                          data-testid={`imported-threat-override-${row.threatKey}`}
                        />
                      </Tooltip>
                    )}
                    {row.stale && (
                      <Chip
                        size="small"
                        color="warning"
                        label={t("components.threats.toReview", { ...NS, defaultValue: "to review — the component changed its decision" })}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  {row.boundary && onOverrideRelevance && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing({ groupKey: g.key, row });
                      }}
                      data-testid={`imported-threat-edit-${row.threatKey}`}
                    >
                      {row.override
                        ? t("components.threats.editOverride", { ...NS, defaultValue: "Change" })
                        : t("components.threats.override", { ...NS, defaultValue: "Override" })}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };
  return (
    <Accordion disableGutters sx={{ mb: 1.5, flexShrink: 0 }} data-testid="imported-threats-section">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {t("components.threats.title", { ...NS, count: total, defaultValue: "Threats from imported components ({{count}}) — read-only" })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ maxHeight: 360, overflow: "auto", pt: 0 }}>
        {components.map((c) =>
          c.items.length === 1 ? (
            renderInstance(c.items[0].group, c.items[0].rows)
          ) : (
            <ComponentThreatsTable
              key={c.key}
              componentKey={c.key}
              label={c.label}
              items={c.items}
              onOverride={onOverrideRelevance ? (groupKey, row) => setEditing({ groupKey, row }) : undefined}
              onOpenThreat={onOpenThreat}
            />
          ),
        )}
        {editing && onOverrideRelevance && (
          <OverrideDialog
            row={editing.row}
            onClose={() => setEditing(null)}
            onSave={(decision) => {
              onOverrideRelevance(editing.groupKey, editing.row.threatKey, decision);
              setEditing(null);
            }}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
};

/** A display id without the instance prefix ("SD1:DF7-T-1" → "DF7-T-1"). */
const unprefixed = (id: string | undefined, prefix: string | undefined) =>
  id && prefix && id.startsWith(`${prefix}:`) ? id.slice(prefix.length + 1) : (id ?? "");

/**
 * A component used by several instances (I5): each threat once, with a line
 * per instance — its relevance (the component's, struck through when the
 * machine overrode it), the override, "to review". A click on the threat
 * opens it read-only (the first instance's copy, browsing the component's
 * threats); the override acts on its instance.
 */
const ComponentThreatsTable: React.FC<{
  componentKey: string;
  label: string;
  items: readonly { group: ImportedThreatGroup; rows: readonly ImportedThreatRow[] }[];
  onOverride?: (groupKey: string, row: ImportedThreatRow) => void;
  onOpenThreat?: ImportedThreatsSectionProps["onOpenThreat"];
}> = ({ componentKey, label, items, onOverride, onOpenThreat }) => {
  const { t } = useTranslation();
  // threat key → its row per instance, in the order of the first appearance
  const keys: string[] = [];
  const perKey = new Map<string, { group: ImportedThreatGroup; row: ImportedThreatRow }[]>();
  for (const { group, rows } of items) {
    for (const row of rows) {
      if (!perKey.has(row.threatKey)) {
        perKey.set(row.threatKey, []);
        keys.push(row.threatKey);
      }
      perKey.get(row.threatKey)!.push({ group, row });
    }
  }
  const first = (key: string) => perKey.get(key)![0];
  keys.sort((a, b) => compareThreatsByLabel(first(a).row.threat, first(b).row.threat));
  const open = (index: number) => {
    const head = first(keys[index]);
    onOpenThreat?.(
      { key: head.group.key, label: head.group.label },
      keys.map((k) => first(k).row.threat),
      index,
    );
  };
  return (
    <Box sx={{ mb: 2 }} data-testid={`imported-component-${componentKey}`}>
      <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
        {label}{" "}
        <Typography component="span" variant="caption" color="text.secondary">
          {t("components.threats.instances", {
            ...NS,
            list: items.map((x) => x.group.label).join(", "),
            defaultValue: "— instances: {{list}}",
          })}
        </Typography>
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>STRIDE</TableCell>
            <TableCell>{t("components.threats.where", { ...NS, defaultValue: "Element / flow" })}</TableCell>
            <TableCell>{t("components.threats.threat", { ...NS, defaultValue: "Threat" })}</TableCell>
            <TableCell>{t("components.threats.perInstance", { ...NS, defaultValue: "Relevance per instance" })}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((key, index) => {
            const head = first(key);
            const threat = head.row.threat;
            const prefix = head.group.prefix;
            const place = threat.dataFlow
              ? threat.dataFlow.dataFlowName || `${threat.dataFlow.sourceName} → ${threat.dataFlow.targetName}`
              : [unprefixed(threat.linkedElement?.displayId, prefix), threat.linkedElement?.elementName].filter(Boolean).join(" ");
            return (
              <TableRow
                key={key}
                data-testid={`imported-component-threat-${key}`}
                hover={!!onOpenThreat}
                onClick={onOpenThreat ? () => open(index) : undefined}
                sx={onOpenThreat ? { cursor: "pointer", verticalAlign: "top" } : { verticalAlign: "top" }}
              >
                <TableCell>
                  <ThreatIdCell id={unprefixed(threat.displayId, prefix)} />
                </TableCell>
                <TableCell>
                  <StrideCell cat={threat.strideCategory} />
                </TableCell>
                <TableCell sx={{ fontSize: "0.8rem" }}>{place}</TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <DescriptionCell
                    value={threat.threatDescription || threat.attackDescription}
                    fallback={t("components.threats.templateText", { ...NS, defaultValue: "(catalog text)" })}
                  />
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    {perKey.get(key)!.map(({ group, row }) => (
                      <Stack
                        key={group.key}
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                        data-testid={`imported-component-threat-${key}-${group.key}`}
                      >
                        <Typography variant="caption" sx={{ minWidth: 48, fontFamily: "monospace" }}>
                          {group.prefix ?? group.label}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={row.componentRelevance}
                          sx={row.override ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                        />
                        {row.override && (
                          <Tooltip title={row.override.rationale}>
                            <Chip
                              size="small"
                              color="primary"
                              label={t("components.threats.overridden", { ...NS, relevance: row.override.relevance, defaultValue: "machine: {{relevance}}" })}
                            />
                          </Tooltip>
                        )}
                        {row.stale && (
                          <Chip
                            size="small"
                            color="warning"
                            label={t("components.threats.toReview", { ...NS, defaultValue: "to review — the component changed its decision" })}
                          />
                        )}
                        {row.boundary && onOverride && (
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOverride(group.key, row);
                            }}
                            data-testid={`imported-component-threat-edit-${key}-${group.key}`}
                          >
                            {row.override
                              ? t("components.threats.editOverride", { ...NS, defaultValue: "Change" })
                              : t("components.threats.override", { ...NS, defaultValue: "Override" })}
                          </Button>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

/** Relevance + mandatory rationale; "remove" returns to the component's decision. */
const OverrideDialog: React.FC<{
  row: ImportedThreatRow;
  onClose: () => void;
  onSave: (decision: ImportedRelevanceDecision) => void;
}> = ({ row, onClose, onSave }) => {
  const { t } = useTranslation();
  const [relevance, setRelevance] = useState<ThreatRelevance>(
    row.override?.relevance ?? (row.componentRelevance === "relevant" ? "not_relevant" : "relevant"),
  );
  const [rationale, setRationale] = useState(row.override?.rationale ?? "");
  const valid = rationale.trim() !== "" && relevance !== row.componentRelevance;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth data-testid="imported-threat-override-dialog">
      <DialogTitle>
        {t("components.threats.overrideTitle", { ...NS, id: row.threat.displayId, defaultValue: "Relevance of {{id}} in this machine" })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("components.threats.overrideIntro", {
              ...NS,
              relevance: row.componentRelevance,
              defaultValue:
                "The component rated this threat on its boundary flow as “{{relevance}}” — without the machine context. Where the flow runs in this machine may change that. The rationale goes into the report (deviations from the component's assessment).",
            })}
          </Typography>
          <Select size="small" value={relevance} onChange={(e) => setRelevance(e.target.value as ThreatRelevance)} inputProps={{ "data-testid": "imported-threat-override-relevance" }}>
            {RELEVANCES.filter((r) => r !== row.componentRelevance).map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
          <TextField
            label={t("components.threats.rationale", { ...NS, defaultValue: "Rationale (required)" })}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ "data-testid": "imported-threat-override-rationale" }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {row.override && (
          <Button color="warning" onClick={() => onSave(null)} data-testid="imported-threat-override-remove">
            {t("components.threats.removeOverride", { ...NS, defaultValue: "Back to the component's decision" })}
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>{t("components.import.cancel", { ...NS, defaultValue: "Cancel" })}</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => onSave({ relevance, rationale: rationale.trim(), componentRelevance: row.componentRelevance })}
          data-testid="imported-threat-override-save"
        >
          {t("components.threats.saveOverride", { ...NS, defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
