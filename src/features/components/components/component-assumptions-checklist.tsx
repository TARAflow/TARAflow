// ==================== COMPONENT ASSUMPTIONS CHECKLIST ====================
// Multi-project TARA, phase 3b (design §7.6, I7 (2)): the component's
// assumptions of use (AoU) as a checklist of one instance, in the
// multiprocess's details panel. Per assumption: this instance's status, the
// component's own status beside it, evidence (this machine's measures and a
// note), and the mandatory rationale for "not applicable". Open entries are
// counted in the heading; "not fulfilled" means the component's analysis is
// not valid here until resolved.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const NS = "components";
const STATUSES = ["open", "fulfilled", "not_fulfilled", "not_applicable"] as const;
export type AssumptionCheckStatus = (typeof STATUSES)[number];

export interface AssumptionCheckView {
  assumptionId: string;
  displayId: string;
  text: string;
  componentStatus: string;
  status: AssumptionCheckStatus;
  evidence?: { mitigationIds?: string[]; note?: string; elementIds?: string[] };
  rationale?: string;
}

export interface AssumptionCheckDecision {
  status: AssumptionCheckStatus;
  evidence?: { mitigationIds?: string[]; note?: string; elementIds?: string[] };
  rationale?: string;
}

export interface ComponentAssumptionsChecklistProps {
  prefix: string;
  assumptions: readonly AssumptionCheckView[];
  /** This machine's measures that can serve as evidence. */
  measures: readonly { id: string; label: string }[];
  onChange: (assumptionId: string, decision: AssumptionCheckDecision) => void;
}

const COLOR = { open: "warning", fulfilled: "success", not_fulfilled: "error", not_applicable: "default" } as const;

export const ComponentAssumptionsChecklist: React.FC<ComponentAssumptionsChecklistProps> = ({ prefix, assumptions, measures, onChange }) => {
  const { t } = useTranslation(NS);
  if (assumptions.length === 0) return null;
  const open = assumptions.filter((a) => a.status === "open").length;
  return (
    <Accordion
      disableGutters
      elevation={0}
      // Open while something is to decide — a click on an assumption
      // finding lands here (manual test 2026-11-15).
      defaultExpanded={assumptions.some((a) => a.status === "open" || a.status === "not_fulfilled")}
      sx={{ mt: 1, border: 1, borderColor: "divider" }}
      data-testid="component-assumptions"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" fontWeight="medium">
          {t("components.assumptions.title", {
            prefix,
            count: assumptions.length,
            open,
            defaultValue: "Assumptions of use ({{count}}) — open: {{open}}",
          })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {assumptions.map((a) => (
            <AssumptionRow key={a.assumptionId} a={a} measures={measures} onChange={(d) => onChange(a.assumptionId, d)} />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

const AssumptionRow: React.FC<{
  a: AssumptionCheckView;
  measures: readonly { id: string; label: string }[];
  onChange: (d: AssumptionCheckDecision) => void;
}> = ({ a, measures, onChange }) => {
  const { t } = useTranslation(NS);
  const [rationale, setRationale] = useState(a.rationale ?? "");
  const [note, setNote] = useState(a.evidence?.note ?? "");
  const [pendingNa, setPendingNa] = useState(false);
  const evidence = (patch: Partial<NonNullable<AssumptionCheckView["evidence"]>>) => ({ ...(a.evidence ?? {}), ...patch });
  const status = pendingNa ? "not_applicable" : a.status;
  const statusLabel = (s: string) => t(`components.assumptions.status.${s}`, { defaultValue: s.replace("_", " ") });
  return (
    <Box data-testid={`component-assumption-${a.displayId}`}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" fontWeight="medium" sx={{ fontFamily: "monospace" }}>
          {a.displayId}
        </Typography>
        <Chip size="small" color={COLOR[a.status]} label={statusLabel(a.status)} />
        <Typography variant="caption" color="text.secondary">
          {t("components.assumptions.componentStatus", { status: a.componentStatus, defaultValue: "component: {{status}}" })}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ my: 0.5 }}>
        {a.text}
      </Typography>
      <Stack spacing={1}>
        <Select
          size="small"
          value={status}
          onChange={(e) => {
            const next = e.target.value as AssumptionCheckStatus;
            if (next === "not_applicable" && !rationale.trim()) {
              setPendingNa(true); // the rationale comes first
              return;
            }
            setPendingNa(false);
            onChange({ status: next, evidence: a.evidence, ...(rationale.trim() ? { rationale } : {}) });
          }}
          inputProps={{ "data-testid": `component-assumption-status-${a.displayId}` }}
        >
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {statusLabel(s)}
            </MenuItem>
          ))}
        </Select>
        {status === "not_applicable" && (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              fullWidth
              multiline
              label={t("components.assumptions.rationale", { defaultValue: "Why it does not apply here (required)" })}
              value={rationale}
              error={!rationale.trim()}
              onChange={(e) => setRationale(e.target.value)}
              onBlur={() => {
                // an existing "not applicable": the edited rationale is saved
                if (!pendingNa && a.status === "not_applicable" && rationale.trim() && rationale !== (a.rationale ?? "")) {
                  onChange({ status: "not_applicable", evidence: a.evidence, rationale });
                }
              }}
              inputProps={{ "data-testid": `component-assumption-rationale-${a.displayId}` }}
            />
            {pendingNa && (
              <Button
                size="small"
                disabled={!rationale.trim()}
                onClick={() => {
                  setPendingNa(false);
                  onChange({ status: "not_applicable", evidence: a.evidence, rationale });
                }}
                data-testid={`component-assumption-rationale-save-${a.displayId}`}
              >
                {t("components.assumptions.save", { defaultValue: "Save" })}
              </Button>
            )}
          </Stack>
        )}
        {(status === "fulfilled" || status === "not_applicable") && measures.length > 0 && (
          <EvidenceMeasures
            displayId={a.displayId}
            measures={measures}
            selected={a.evidence?.mitigationIds ?? []}
            onSelect={(ids) =>
              onChange({ status: a.status, evidence: evidence({ mitigationIds: ids }), ...(a.rationale ? { rationale: a.rationale } : {}) })
            }
          />
        )}
        {status !== "open" && (
          <TextField
            size="small"
            fullWidth
            label={t("components.assumptions.note", { defaultValue: "Evidence note" })}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((a.evidence?.note ?? "") !== note) {
                onChange({ status: a.status, evidence: evidence({ note }), ...(a.rationale ? { rationale: a.rationale } : {}) });
              }
            }}
            inputProps={{ "data-testid": `component-assumption-note-${a.displayId}` }}
          />
        )}
      </Stack>
    </Box>
  );
};

/**
 * Evidence from this machine's measures — one or more (UX, manual test
 * 2026-11-15): a checkbox per measure and a clearly marked selection make the
 * multiple choice visible; the chosen measures appear as chips, and a tooltip
 * lists them with their full text.
 */
const EvidenceMeasures: React.FC<{
  displayId: string;
  measures: readonly { id: string; label: string }[];
  selected: readonly string[];
  onSelect: (ids: string[]) => void;
}> = ({ displayId, measures, selected, onSelect }) => {
  const { t } = useTranslation(NS);
  const [menuOpen, setMenuOpen] = useState(false);
  const labelOf = (id: string) => measures.find((m) => m.id === id)?.label ?? id;
  const labelId = `component-assumption-measures-label-${displayId}`;
  const label = t("components.assumptions.measuresMulti", { defaultValue: "Evidence: this machine's measures (one or more)" });
  const tooltip =
    selected.length === 0 ? (
      ""
    ) : (
      <Box data-testid={`component-assumption-measures-tooltip-${displayId}`}>
        <Typography variant="caption" fontWeight="medium" component="div">
          {t("components.assumptions.measuresChosen", { count: selected.length, defaultValue: "Chosen as evidence ({{count}}):" })}
        </Typography>
        {selected.map((id) => (
          <Typography key={id} variant="caption" component="div">
            {labelOf(id)}
          </Typography>
        ))}
      </Box>
    );
  return (
    <Tooltip title={tooltip} placement="top-start" disableHoverListener={menuOpen || selected.length === 0}>
      <FormControl size="small" fullWidth>
        <InputLabel id={labelId} shrink>
          {label}
        </InputLabel>
        <Select
          labelId={labelId}
          label={label}
          notched
          multiple
          displayEmpty
          value={[...selected]}
          open={menuOpen}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
          onChange={(e) => onSelect((typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value) as string[])}
          renderValue={(ids) =>
            (ids as string[]).length === 0 ? (
              <Typography variant="body2" color="text.secondary" component="em">
                {t("components.assumptions.measuresNone", { defaultValue: "none chosen — select one or more" })}
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {(ids as string[]).map((id) => (
                  <Chip key={id} size="small" color="primary" variant="outlined" label={id} />
                ))}
              </Box>
            )
          }
          MenuProps={{
            PaperProps: {
              sx: {
                "& .MuiMenuItem-root.Mui-selected": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.22) },
                "& .MuiMenuItem-root.Mui-selected:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.3) },
              },
            },
          }}
          inputProps={{ "data-testid": `component-assumption-measures-${displayId}` }}
        >
          {measures.map((m) => (
            <MenuItem key={m.id} value={m.id} dense>
              <Checkbox size="small" checked={selected.includes(m.id)} sx={{ py: 0, pl: 0 }} />
              <ListItemText primary={m.label} primaryTypographyProps={{ variant: "body2" }} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Tooltip>
  );
};
