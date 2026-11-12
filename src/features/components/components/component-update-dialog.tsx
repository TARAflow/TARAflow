// ==================== COMPONENT UPDATE DIALOG ====================
// Multi-project TARA phase 5c-2 (design §9.2; decided 2026-11-09: per import,
// one change; reviews 2026-11-10). One dialog for every instance of an
// import: what changed in the component, the mapping of EEs new in this
// state, the pairings offered (obsolete ↔ new threat / path / boundary flow),
// what the update drops and how many decisions go to review. Presentational:
// the app computes the preview and, for every choice, what applying would do
// (a dry run of the very update "Apply" runs) — the numbers shown are the
// numbers applied. Texts through i18n from structured data only (never the
// English commit lines of ComponentImport.lastUpdate).
//
//   - every new EE needs a decision (map to a machine element, or take it
//     over as a new EE) before Apply — no silent default (review)
//   - pairings are offered unchecked, never applied by themselves; one
//     obsolete item pairs with at most one new one
//   - the tag pattern (only tagged states count from then on) is set here

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { MachineElementOption } from "../models/component-import-dialog-types";

const NS = "components";
export const TAKE_OVER = "__take_over__";

export type UpdateChangeKind = "elements" | "flows" | "threats" | "paths" | "measures" | "assumptions" | "claims" | "assets" | "relations";

export interface ComponentUpdatePreview {
  component: string;
  /** "tag sd/v1 · commit 01234567" → "tag sd/v2 · commit 89abcdef" */
  from: string;
  to: string;
  changes: { kind: UpdateChangeKind; added: number; removed: number }[];
  /** The component's overview (description, responsible, sources, Item Definition texts) changed. */
  aboutChanged?: boolean;
  /** EEs new in this state, per instance with the machine elements they can be mapped to. */
  newEes: { eeId: string; name: string; instances: { instanceId: string; label: string; options: readonly MachineElementOption[] }[] }[];
  /** Offered pairings (obsolete → new); key identifies one. */
  candidates: { key: string; from: string; kind: "threat" | "path" | "flow"; fromLabel: string; toLabel: string; reason: string }[];
  tagPattern?: string;
}

export interface ComponentUpdateChoice {
  /** Keys of the pairings ticked. */
  pairs: string[];
  /** instanceId → EE id → machine tfId, or TAKE_OVER. */
  ees: Record<string, Record<string, string>>;
  tagPattern?: string;
}

/** What applying the current choice would do — from the app's dry run. */
export interface ComponentUpdateOutcome {
  /** Decisions that go to review after the update (incl. pairings). */
  review: number;
  /** Dropped decisions by kind (inventory kinds). */
  dropped: { kind: string; count: number }[];
  /** Tracker tickets that lose their risk. */
  tickets: string[];
}

export interface ComponentUpdateDialogProps {
  open: boolean;
  preview: ComponentUpdatePreview;
  outcomeOf: (choice: ComponentUpdateChoice) => ComponentUpdateOutcome;
  onApply: (choice: ComponentUpdateChoice) => void;
  onClose: () => void;
}

/**
 * A trivial update (6d, review point 2): no new external entity to decide,
 * no pairing candidate, and the dry run of the default choice leaves nothing
 * to review, drops nothing and orphans no ticket — no decision of this
 * machine is affected. The dialog says so and stays; nothing is skipped.
 */
export function isTrivialUpdate(preview: Pick<ComponentUpdatePreview, "newEes" | "candidates">, outcome: ComponentUpdateOutcome): boolean {
  return (
    preview.newEes.length === 0 &&
    preview.candidates.length === 0 &&
    outcome.review === 0 &&
    outcome.dropped.length === 0 &&
    outcome.tickets.length === 0
  );
}

export const ComponentUpdateDialog: React.FC<ComponentUpdateDialogProps> = ({ open, preview, outcomeOf, onApply, onClose }) => {
  const { t } = useTranslation(NS);
  const [pairs, setPairs] = useState<string[]>([]);
  const [ees, setEes] = useState<Record<string, Record<string, string>>>({});
  const [tagPattern, setTagPattern] = useState(preview.tagPattern ?? "");
  useEffect(() => {
    if (!open) return;
    setPairs([]);
    setEes({});
    setTagPattern(preview.tagPattern ?? "");
  }, [open, preview]);

  const choice: ComponentUpdateChoice = { pairs, ees, ...(tagPattern.trim() ? { tagPattern: tagPattern.trim() } : {}) };
  const outcome = useMemo(() => outcomeOf(choice), [outcomeOf, pairs, ees]); // eslint-disable-line react-hooks/exhaustive-deps
  const missingEe = preview.newEes.some((ee) => ee.instances.some((i) => !ees[i.instanceId]?.[ee.eeId]));
  const trivial = isTrivialUpdate(preview, outcome);

  const toggle = (key: string, from: string, kind: string) =>
    setPairs((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : // one obsolete item pairs with at most one new one
          [...current.filter((k) => !preview.candidates.some((c) => c.key === k && c.from === from && c.kind === kind)), key],
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-testid="component-update-dialog">
      <DialogTitle>
        {t("components.update.title", { component: preview.component, defaultValue: "Update {{component}}" })}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          {preview.from} → {preview.to}
        </Typography>
        {trivial && (
          <Alert severity="success" sx={{ mt: 1 }} data-testid="component-update-trivial">
            {t("components.update.trivial", { defaultValue: "No decision of this machine is affected — the update can be applied right away." })}
          </Alert>
        )}

        {/* What changed in the component */}
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          {t("components.update.changes", { defaultValue: "What changed in the component" })}
        </Typography>
        {preview.changes.filter((c) => c.added + c.removed > 0).length === 0 ? (
          <Typography variant="body2">{t("components.update.noStructuralChange", { defaultValue: "No element, threat or path was added or removed — only content changed." })}</Typography>
        ) : (
          <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="component-update-changes">
            {preview.changes
              .filter((c) => c.added + c.removed > 0)
              .map((c) => (
                <li key={c.kind}>
                  <Typography variant="body2">
                    {t(`components.update.kind.${c.kind}`, { defaultValue: c.kind })}: +{c.added} / −{c.removed}
                  </Typography>
                </li>
              ))}
          </Stack>
        )}
        {preview.aboutChanged && (
          <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="component-update-about-changed">
            {t("components.update.aboutChanged", { defaultValue: "The component's overview changed (description, responsible, sources, Item Definition texts)." })}
          </Typography>
        )}

        {/* New EEs: a decision each */}
        {preview.newEes.length > 0 && (
          <Box sx={{ mt: 2 }} data-testid="component-update-new-ees">
            <Typography variant="subtitle2">{t("components.update.newEes", { defaultValue: "New external entities — decide each before applying" })}</Typography>
            {preview.newEes.map((ee) =>
              ee.instances.map((inst) => (
                <Stack key={`${inst.instanceId}|${ee.eeId}`} direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography variant="body2" sx={{ minWidth: 220 }}>
                    {inst.label}: {ee.name}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 260 }}>
                    <Select
                      displayEmpty
                      value={ees[inst.instanceId]?.[ee.eeId] ?? ""}
                      onChange={(e) => setEes((cur) => ({ ...cur, [inst.instanceId]: { ...(cur[inst.instanceId] ?? {}), [ee.eeId]: String(e.target.value) } }))}
                      inputProps={{ "data-testid": `component-update-ee-${inst.instanceId}-${ee.eeId}` }}
                    >
                      <MenuItem value="" disabled>
                        {t("components.update.eeChoose", { defaultValue: "Choose…" })}
                      </MenuItem>
                      <MenuItem value={TAKE_OVER}>{t("components.update.eeTakeOver", { defaultValue: "Take over as a new external entity" })}</MenuItem>
                      {inst.options.map((o) => (
                        <MenuItem key={o.id} value={o.id}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )),
            )}
          </Box>
        )}

        {/* Pairings: offered, unchecked */}
        {preview.candidates.length > 0 && (
          <Box sx={{ mt: 2 }} data-testid="component-update-pairings">
            <Typography variant="subtitle2">{t("components.update.pairings", { defaultValue: "Possible pairings — tick only what is the same item renamed" })}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {t("components.update.pairingsHint", { defaultValue: "A paired item keeps this machine's decisions; they go to review. Unpaired, they are dropped." })}
            </Typography>
            {preview.candidates.map((c) => (
              <FormControlLabel
                key={c.key}
                control={<Checkbox size="small" checked={pairs.includes(c.key)} onChange={() => toggle(c.key, c.from, c.kind)} data-testid={`component-update-pair-${c.key}`} />}
                label={
                  <Typography variant="body2">
                    {t(`components.update.pairKind.${c.kind}`, { defaultValue: c.kind })}: {c.fromLabel} → {c.toLabel}{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({t(`components.update.reason.${c.reason}`, { defaultValue: c.reason })})
                    </Typography>
                  </Typography>
                }
              />
            ))}
          </Box>
        )}

        {/* What applying this choice does */}
        <Box sx={{ mt: 2 }} data-testid="component-update-outcome">
          <Typography variant="subtitle2">{t("components.update.outcome", { defaultValue: "What the update does to this machine's decisions" })}</Typography>
          <Typography variant="body2" data-testid="component-update-review-count">
            {t("components.update.reviewCount", { count: outcome.review, defaultValue: "Afterwards {{count}} decision(s) to review" })}
          </Typography>
          {outcome.dropped.length > 0 && (
            <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="component-update-dropped">
              {outcome.dropped.map((d) => (
                <li key={d.kind}>
                  <Typography variant="body2">
                    {t("components.update.dropped", {
                      count: d.count,
                      what: t(`components.update.decision.${d.kind}`, { defaultValue: d.kind }),
                      defaultValue: "{{count}} × {{what}} dropped",
                    })}
                  </Typography>
                </li>
              ))}
            </Stack>
          )}
          {outcome.tickets.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1 }} data-testid="component-update-tickets">
              {t("components.update.tickets", { list: outcome.tickets.join(", "), defaultValue: "Tickets losing their risk: {{list}} — close or re-link them in the tracker." })}
            </Alert>
          )}
        </Box>

        {/* Tag pattern */}
        <TextField
          size="small"
          sx={{ mt: 2, width: 320 }}
          label={t("components.update.tagPattern", { defaultValue: "Tag pattern (optional), e.g. camera-tara/v*" })}
          value={tagPattern}
          onChange={(e) => setTagPattern(e.target.value)}
          helperText={t("components.update.tagPatternHint", { defaultValue: "From then on only tagged states (releases) are offered as newer." })}
          inputProps={{ "data-testid": "component-update-tag-pattern" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("components.update.cancel", { defaultValue: "Cancel" })}</Button>
        <Button variant="contained" disabled={missingEe} autoFocus={trivial} onClick={() => onApply(choice)} data-testid="component-update-apply">
          {t("components.update.apply", { defaultValue: "Apply update" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
