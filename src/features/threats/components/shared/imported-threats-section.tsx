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
}

export const ImportedThreatsSection: React.FC<ImportedThreatsSectionProps> = ({ groups, onOverrideRelevance }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ groupKey: string; row: ImportedThreatRow } | null>(null);
  if (!groups || groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.threats.length, 0);
  return (
    <Accordion disableGutters sx={{ mb: 1.5, flexShrink: 0 }} data-testid="imported-threats-section">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {t("components.threats.title", { ...NS, count: total, defaultValue: "Threats from imported components ({{count}}) — read-only" })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ maxHeight: 360, overflow: "auto", pt: 0 }}>
        {groups.map((g) => {
          const rows: ImportedThreatRow[] = g.rows
            ? [...g.rows]
            : g.threats.map((threat) => ({ threat, threatKey: threat.id, componentRelevance: threat.relevance, boundary: false }));
          rows.sort((a, b) => compareThreatsByLabel(a.threat, b.threat));
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
                  {rows.map((row) => (
                    <TableRow key={row.threat.id} data-testid={`imported-threat-${row.threatKey}`}>
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
                            onClick={() => setEditing({ groupKey: g.key, row })}
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
        })}
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
