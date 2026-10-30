// features/audit/components/verification-panel.tsx
//
// TARA verification in the Audit tab (ISO/SAE 21434 RQ-09-07 → WP-09-05;
// conformance plan Phase 4, decision 25). A review by people, not a
// calculation: who checked which state when, which of the four points of
// RQ-09-07, with what result and findings. The open findings per point (from
// the Definition sub-tab and the goals / claims) are shown as a checklist —
// the reviewer decides. The entry records a hash of the analysis content, so
// "changed since the verification" is known without git; committing it (round
// "Verification", Reviewed-by) puts it into the audit trail, and the panel
// shows the commit that did.

import React, { useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import { VERIFICATION_HASH_VERSION, type VerificationEntry, type VerificationResult, type VerificationScope } from "shared";

const SCOPES: VerificationScope[] = ["tara", "treatment", "goals-claims", "consistency"];
const RESULTS: VerificationResult[] = ["passed", "passed-with-conditions", "failed"];

const SCOPE_DEFAULT: Record<VerificationScope, string> = {
  tara: "a) TARA correct and complete with respect to the item definition",
  treatment: "b) Risk treatment decisions complete, correct and consistent",
  "goals-claims": "c) Goals and claims correct with respect to the treatment decisions",
  consistency: "d) All goals and claims consistent with each other",
};
const RESULT_DEFAULT: Record<VerificationResult, string> = {
  passed: "passed",
  "passed-with-conditions": "passed with conditions",
  failed: "failed",
};
const RESULT_COLOR: Record<VerificationResult, "success" | "warning" | "error"> = {
  passed: "success",
  "passed-with-conditions": "warning",
  failed: "error",
};

export interface VerificationPanelProps {
  entries: readonly VerificationEntry[];
  currentStateHash: string;
  checklist: readonly { scope: VerificationScope; open: number }[];
  projectVersion?: string;
  defaultReviewer?: string;
  /** Entry id → short commit hash that introduced it (from git), if known. */
  commits: ReadonlyMap<string, string>;
  /** git is bound — "not committed" is meaningful. */
  gitAvailable: boolean;
  onChange: (entries: VerificationEntry[]) => void;
  /** Open the commit dialog prefilled for this entry. */
  onCommit?: (entry: VerificationEntry) => void;
}

let seq = 0;
const newId = () => `ver-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  entries,
  currentStateHash,
  checklist,
  projectVersion,
  defaultReviewer = "",
  commits,
  gitAvailable,
  onChange,
  onCommit,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<VerificationEntry, "id" | "stateHash">>({
    date: "",
    reviewer: "",
    scope: [],
    result: "passed",
  });
  const scopeLabel = (s: VerificationScope) => t(`audit.verification.scope.${s}`, { defaultValue: SCOPE_DEFAULT[s] });
  const resultLabel = (r: VerificationResult) => t(`audit.verification.result.${r}`, { defaultValue: RESULT_DEFAULT[r] });

  const start = () => {
    setDraft({ date: new Date().toISOString().slice(0, 10), reviewer: defaultReviewer, scope: [...SCOPES], result: "passed" });
    setOpen(true);
  };
  const save = () => {
    onChange([
      ...entries,
      {
        id: newId(),
        ...draft,
        reviewer: draft.reviewer.trim(),
        ...(draft.findings?.trim() ? { findings: draft.findings.trim() } : { findings: undefined }),
        stateHash: currentStateHash,
        hashVersion: VERIFICATION_HASH_VERSION,
        ...(projectVersion ? { projectVersion } : {}),
      },
    ]);
    setOpen(false);
  };
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <Box sx={{ px: 2, pt: 2 }} data-testid="verification-panel">
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {t("audit.verification.title", { defaultValue: "TARA verification (ISO/SAE 21434 RQ-09-07)" })}
          </Typography>
          <Button size="small" variant="outlined" onClick={start} data-testid="verification-new">
            {t("audit.verification.new", { defaultValue: "Record verification" })}
          </Button>
        </Stack>
        {sorted.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("audit.verification.none", { defaultValue: "Not verified yet." })}
          </Typography>
        )}
        <Stack spacing={1}>
          {sorted.map((e) => {
            const commit = commits.get(e.id);
            return (
              <Paper key={e.id} variant="outlined" sx={{ p: 1 }} data-testid={`verification-${e.date}`}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" fontWeight={600}>
                    {e.date}
                  </Typography>
                  <Typography variant="body2">{e.reviewer}</Typography>
                  <Chip size="small" color={RESULT_COLOR[e.result]} label={resultLabel(e.result)} />
                  {(e.hashVersion ?? 1) !== VERIFICATION_HASH_VERSION || e.reconfirm ? (
                    <Chip size="small" variant="outlined" color="warning" label={t("audit.verification.stateReconfirm", { defaultValue: "confirm again" })} data-testid="verification-state-reconfirm" />
                  ) : e.stateHash === currentStateHash ? (
                    <Chip size="small" variant="outlined" color="success" label={t("audit.verification.stateCurrent", { defaultValue: "state unchanged" })} />
                  ) : (
                    <Chip size="small" variant="outlined" color="warning" label={t("audit.verification.stateChanged", { defaultValue: "changed since" })} data-testid="verification-state-changed" />
                  )}
                  {commit ? (
                    <Chip size="small" variant="outlined" label={t("audit.verification.committed", { defaultValue: "committed {{hash}}", hash: commit })} data-testid="verification-committed" />
                  ) : (
                    gitAvailable && (
                      <>
                        <Chip size="small" color="warning" label={t("audit.verification.notCommitted", { defaultValue: "not committed" })} data-testid="verification-not-committed" />
                        {onCommit && (
                          <Button size="small" onClick={() => onCommit(e)} data-testid="verification-commit">
                            {t("audit.verification.commit", { defaultValue: "Commit" })}
                          </Button>
                        )}
                        <Button size="small" color="error" onClick={() => onChange(entries.filter((x) => x.id !== e.id))} data-testid="verification-remove">
                          {t("audit.verification.remove", { defaultValue: "Remove" })}
                        </Button>
                      </>
                    )
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block">
                  {e.scope.map(scopeLabel).join(" · ")}
                  {e.projectVersion ? ` · v${e.projectVersion}` : ""} · {e.stateHash}
                </Typography>
                {e.findings && (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                    {e.findings}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("audit.verification.new", { defaultValue: "Record verification" })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                size="small"
                label={t("audit.verification.date", { defaultValue: "Date" })}
                InputLabelProps={{ shrink: true }}
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
              <TextField
                size="small"
                fullWidth
                label={t("audit.verification.reviewer", { defaultValue: "Reviewer" })}
                value={draft.reviewer}
                onChange={(e) => setDraft((d) => ({ ...d, reviewer: e.target.value }))}
                inputProps={{ "data-testid": "verification-reviewer" }}
              />
            </Stack>
            <Box>
              <Typography variant="subtitle2">
                {t("audit.verification.checked", { defaultValue: "Checked (RQ-09-07)" })}
              </Typography>
              {SCOPES.map((s) => {
                const openCount = checklist.find((c) => c.scope === s)?.open ?? 0;
                return (
                  <Box key={s}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={draft.scope.includes(s)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              scope: e.target.checked ? [...d.scope, s] : d.scope.filter((x) => x !== s),
                            }))
                          }
                        />
                      }
                      label={<Typography variant="body2">{scopeLabel(s)}</Typography>}
                    />
                    {openCount > 0 && (
                      <Alert severity="warning" sx={{ py: 0, ml: 4 }} data-testid={`verification-open-${s}`}>
                        {t("audit.verification.openFindings", {
                          defaultValue: "{{count}} open finding(s) — see the Definition sub-tab and Goals & Claims",
                          count: openCount,
                        })}
                      </Alert>
                    )}
                  </Box>
                );
              })}
            </Box>
            <TextField
              select
              size="small"
              label={t("audit.verification.resultLabel", { defaultValue: "Result" })}
              value={draft.result}
              onChange={(e) => setDraft((d) => ({ ...d, result: e.target.value as VerificationResult }))}
            >
              {RESULTS.map((r) => (
                <MenuItem key={r} value={r}>
                  {resultLabel(r)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              multiline
              minRows={3}
              label={t("audit.verification.findings", { defaultValue: "Findings / conditions" })}
              value={draft.findings ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, findings: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={!draft.date || !draft.reviewer.trim() || draft.scope.length === 0}
            data-testid="verification-save"
          >
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
