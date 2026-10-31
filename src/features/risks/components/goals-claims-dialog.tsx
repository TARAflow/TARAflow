// features/risks/components/goals-claims-dialog.tsx
//
// "Goals & Claims" — the overall view of the cybersecurity goals and claims
// (ISO/SAE 21434 9.4; conformance plan Phase 4, P4-2, decision 25), opened
// from the Risk tab's toolbar. The risk dialog edits what belongs to one risk;
// here the analyst sees all of them grouped by threat scenario, works off the
// findings, accepts goal proposals for several risks at once, merges
// duplicates and removes unused ones.

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  addGoal,
  emptyCybersecurityConcept,
  linkGoal,
  mergeClaims,
  mergeGoals,
  newGoal,
  removeClaim,
  removeGoal,
  updateClaim,
  updateGoal,
  type AssetDataReference,
  type CybersecurityClaim,
  type CybersecurityConcept,
  type CybersecurityGoal,
} from "shared";
import type { Risk } from "../models/risk-assessment-types";
import type { ConceptFinding } from "../services/concept-findings";
import { openGoalProposals } from "../services/concept-proposals";
import { conceptFindingText } from "./concept-finding-text";

export interface GoalsClaimsDialogProps {
  open: boolean;
  onClose: () => void;
  risks: readonly Risk[];
  concept: CybersecurityConcept | undefined;
  onConceptChange: (concept: CybersecurityConcept) => void;
  findings: readonly ConceptFinding[];
  assetDataRef?: AssetDataReference;
  /** Open the risk dialog for a risk (from a finding or a risk chip). */
  onOpenRisk?: (riskId: string) => void;
}

/** "AT-2.3" → "AT-2"; a risk without a tree is its own scenario. */
const scenarioLabel = (r: Risk | undefined, id: string) => {
  const label = r?.threatDisplayId ?? id;
  return /^(AT-\d+)\.\d+$/.exec(label)?.[1] ?? label;
};

const StatementField: React.FC<{ value: string; onCommit: (v: string) => void; testId: string }> = ({
  value,
  onCommit,
  testId,
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      size="small"
      fullWidth
      multiline
      minRows={1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      inputProps={{ "data-testid": testId }}
    />
  );
};

export const GoalsClaimsDialog: React.FC<GoalsClaimsDialogProps> = ({
  open,
  onClose,
  risks,
  concept: stored,
  onConceptChange,
  findings,
  assetDataRef,
  onOpenRisk,
}) => {
  const { t } = useTranslation();
  const concept = stored ?? emptyCybersecurityConcept();
  const latest = useRef(concept);
  latest.current = concept;
  const apply = (op: (c: CybersecurityConcept) => CybersecurityConcept) => {
    const next = op(latest.current);
    latest.current = next;
    onConceptChange(next);
  };

  const risksById = new Map(risks.map((r) => [r.id, r]));
  const riskLabel = (id: string) => risksById.get(id)?.threatDisplayId ?? id;
  const proposals = openGoalProposals(risks, concept, assetDataRef);

  /** Risk chips grouped by scenario: "AT-2: AT-2.1, AT-2.2". */
  const riskGroups = (riskIds: readonly string[]) => {
    const groups = new Map<string, string[]>();
    for (const id of riskIds) {
      const key = risksById.has(id) ? scenarioLabel(risksById.get(id), id) : "—";
      groups.set(key, [...(groups.get(key) ?? []), id]);
    }
    return [...groups].map(([scenario, ids]) => (
      <Stack key={scenario} direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 40 }}>
          {scenario}
        </Typography>
        {ids.map((id) => (
          <Chip
            key={id}
            size="small"
            variant="outlined"
            color={risksById.has(id) ? "default" : "warning"}
            label={
              risksById.has(id)
                ? riskLabel(id)
                : t("tabs.risks.goalsClaims.removedRisk", { defaultValue: "removed ({{id}})", id })
            }
            onClick={risksById.has(id) && onOpenRisk ? () => onOpenRisk(id) : undefined}
          />
        ))}
      </Stack>
    ));
  };

  const mergeSelect = (
    item: CybersecurityGoal | CybersecurityClaim,
    candidates: (CybersecurityGoal | CybersecurityClaim)[],
    onMerge: (intoId: string) => void,
  ) =>
    candidates.length > 0 ? (
      <TextField
        select
        size="small"
        sx={{ minWidth: 160 }}
        label={t("tabs.risks.goalsClaims.mergeInto", { defaultValue: "Merge into …" })}
        value=""
        onChange={(e) => onMerge(e.target.value)}
        inputProps={{ "data-testid": `merge-${item.displayId}` }}
      >
        {candidates.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.displayId}
          </MenuItem>
        ))}
      </TextField>
    ) : null;

  const warnings = findings.filter((f) => f.severity === "warning");
  const infos = findings.filter((f) => f.severity === "info");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth data-testid="goals-claims-dialog">
      <DialogTitle>{t("tabs.risks.goalsClaims.title", { defaultValue: "Cybersecurity goals and claims" })}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {[...warnings, ...infos].length > 0 && (
            <Stack spacing={0.5} data-testid="goals-claims-findings">
              {[...warnings, ...infos].map((f, i) => (
                <Alert
                  key={i}
                  severity={f.severity}
                  sx={{ py: 0 }}
                  data-code={f.code}
                  action={
                    f.riskId && onOpenRisk ? (
                      <Button size="small" onClick={() => onOpenRisk(f.riskId!)}>
                        {t("tabs.risks.goalsClaims.openRisk", { defaultValue: "Open" })}
                      </Button>
                    ) : undefined
                  }
                >
                  {conceptFindingText(f, t, riskLabel)}
                </Alert>
              ))}
            </Stack>
          )}

          {proposals.length > 0 && (
            <Box data-testid="goals-claims-proposals">
              <Typography variant="subtitle2" gutterBottom>
                {t("tabs.risks.goalsClaims.proposals", { defaultValue: "Proposed goals for risks without a goal" })}
              </Typography>
              <Stack spacing={1}>
                {proposals.map((p) => (
                  <Paper key={`${p.assetId}:${p.property}`} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {p.label}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {p.statement || t("tabs.risks.concept.noFormal", { defaultValue: "No formal description on the asset yet" })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.riskIds.map(riskLabel).join(", ")}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        data-testid={`accept-proposal-${p.assetId}-${p.property}`}
                        onClick={() =>
                          apply((cc) => {
                            const goal = newGoal(cc, p.riskIds[0], p.statement, [{ assetId: p.assetId, property: p.property }]);
                            return p.riskIds.slice(1).reduce((acc, id) => linkGoal(acc, goal.id, id), addGoal(cc, goal));
                          })
                        }
                      >
                        {t("tabs.risks.goalsClaims.acceptProposal", {
                          defaultValue: "Create goal for {{count}} risk(s)",
                          count: p.riskIds.length,
                        })}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          <Divider />
          <Typography variant="subtitle1">{t("tabs.risks.goalsClaims.goals", { defaultValue: "Cybersecurity goals" })}</Typography>
          {concept.goals.length === 0 && <Typography color="text.secondary">–</Typography>}
          {concept.goals.map((g) => (
            <Paper key={g.id} variant="outlined" sx={{ p: 1.5 }} data-testid={`overview-goal-${g.displayId}`}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="primary" label={g.displayId} />
                  {g.cal && <Chip size="small" variant="outlined" label={`CAL ${g.cal}`} />}
                  <Box sx={{ flex: 1 }} />
                  {mergeSelect(
                    g,
                    concept.goals.filter((x) => x.id !== g.id),
                    (intoId) => apply((cc) => mergeGoals(cc, g.id, intoId)),
                  )}
                  {g.riskIds.length === 0 && (
                    <Button size="small" color="error" onClick={() => apply((cc) => removeGoal(cc, g.id))} data-testid={`remove-${g.displayId}`}>
                      {t("tabs.risks.goalsClaims.remove", { defaultValue: "Remove" })}
                    </Button>
                  )}
                </Stack>
                <StatementField
                  value={g.statement}
                  testId={`overview-goal-statement-${g.displayId}`}
                  onCommit={(statement) => apply((cc) => updateGoal(cc, g.id, { statement }))}
                />
                {riskGroups(g.riskIds)}
              </Stack>
            </Paper>
          ))}

          <Divider />
          <Typography variant="subtitle1">{t("tabs.risks.goalsClaims.claims", { defaultValue: "Cybersecurity claims" })}</Typography>
          {concept.claims.length === 0 && <Typography color="text.secondary">–</Typography>}
          {concept.claims.map((c) => (
            <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }} data-testid={`overview-claim-${c.displayId}`}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="secondary" label={c.displayId} />
                  <Chip size="small" variant="outlined" label={t(`tabs.risks.concept.kind.${c.kind}`, { defaultValue: c.kind })} />
                  {c.kind === "share" && c.responsibleParty && (
                    <Typography variant="caption">{c.responsibleParty}</Typography>
                  )}
                  {c.reviewBy && (
                    <Typography variant="caption" color="text.secondary">
                      {t("tabs.risks.concept.reviewBy", { defaultValue: "Review by" })}: {c.reviewBy}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1 }} />
                  {mergeSelect(
                    c,
                    concept.claims.filter((x) => x.id !== c.id && x.kind === c.kind),
                    (intoId) => apply((cc) => mergeClaims(cc, c.id, intoId)),
                  )}
                  {c.riskIds.length === 0 && (
                    <Button size="small" color="error" onClick={() => apply((cc) => removeClaim(cc, c.id))} data-testid={`remove-${c.displayId}`}>
                      {t("tabs.risks.goalsClaims.remove", { defaultValue: "Remove" })}
                    </Button>
                  )}
                </Stack>
                <StatementField
                  value={c.statement}
                  testId={`overview-claim-statement-${c.displayId}`}
                  onCommit={(statement) => apply((cc) => updateClaim(cc, c.id, { statement }))}
                />
                {riskGroups(c.riskIds)}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close", { defaultValue: "Close" })}</Button>
      </DialogActions>
    </Dialog>
  );
};
