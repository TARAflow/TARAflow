// features/risks/components/risk-goal-claim-tab.tsx
//
// Fourth tab of the risk dialog, "Goal / Claim" (ISO/SAE 21434 9.4,
// RQ-09-05/06; conformance plan Phase 4, decision 25). It shows only what is
// linked to THIS risk, by its treatment:
//
//   reduce          cybersecurity goal(s): link an existing one or create one
//                   (proposal: the formal description of the asset × property
//                   the risk violates); optional CAL
//   retain / share  cybersecurity claim(s): retain relies on assumptions of
//                   the Item Definition, share names the responsible party
//   avoid           no object — the justification (tab Mitigations) is what
//                   counts, mandatory under ISO
//
// Goals and claims are shared texts: one-click reuse with a text preview
// (same scenario and kind first); editing a statement changes it for every
// linked risk, so the card says where else it is used. Changes go straight to
// the project (the dialog saves continuously, too).

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add as AddIcon, LinkOff as UnlinkIcon } from "@mui/icons-material";
import {
  addClaim,
  addGoal,
  claimsOfRisk,
  emptyCybersecurityConcept,
  goalTypesFor,
  goalsOfRisk,
  linkClaim,
  linkGoal,
  newClaim,
  newGoal,
  unlinkClaim,
  unlinkGoal,
  updateClaim,
  updateGoal,
  type AssetDataReference,
  type AssetPropertyRef,
  type Assumption,
  type Cal,
  type ClaimKind,
  type CybersecurityClaim,
  type CybersecurityConcept,
  type CybersecurityGoal,
} from "shared";
import type { Risk } from "../models/risk-assessment-types";
import type { RiskTreatment } from "../models/risk-scale-types";

export interface RiskGoalClaimTabProps {
  risk: Risk;
  treatment: RiskTreatment;
  /** Every risk of the register — for "also on …" and the scenario order. */
  allRisks: readonly Risk[];
  concept: CybersecurityConcept | undefined;
  onConceptChange: (concept: CybersecurityConcept) => void;
  assetDataRef?: AssetDataReference;
  assumptions?: readonly Assumption[];
  /** The risk's treatment justification (tab Mitigations) — a claim text to take over. */
  treatmentJustification: string;
  isoMode?: boolean;
}

/** Which object a treatment needs (decision 25). */
export function conceptKindFor(treatment: RiskTreatment): "goal" | ClaimKind | "avoid" {
  switch (treatment) {
    case "reduce":
      return "goal";
    case "accept":
      return "retain";
    case "share":
    case "transfer":
      return "share";
    case "eliminate":
      return "avoid";
  }
}

/** "AT-2.3" or the threat label, for "also on …". */
const riskLabel = (r: Risk) => r.threatDisplayId || r.id;

/** The threat scenario of a risk: its attack tree, else the risk itself (3a). */
const scenarioOf = (r: Risk | undefined) => r?.attackTreeAssessment?.treeId ?? r?.id;

/** A text field that commits on blur — a shared statement is not rewritten per keystroke. */
const CommitField: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  label: string;
  testId?: string;
  multiline?: boolean;
}> = ({ value, onCommit, label, testId, multiline = true }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <TextField
      size="small"
      fullWidth
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      inputProps={testId ? { "data-testid": testId } : undefined}
    />
  );
};

export const RiskGoalClaimTab: React.FC<RiskGoalClaimTabProps> = ({
  risk,
  treatment,
  allRisks,
  concept: storedConcept,
  onConceptChange,
  assetDataRef,
  assumptions = [],
  treatmentJustification,
  isoMode,
}) => {
  const { t } = useTranslation();
  const concept = storedConcept ?? emptyCybersecurityConcept();
  // Operations apply to the newest state: a blur commit and a click right
  // after it must not work on the same (stale) props.
  const latest = useRef(concept);
  latest.current = concept;
  const apply = (op: (c: CybersecurityConcept) => CybersecurityConcept) => {
    const next = op(latest.current);
    latest.current = next;
    onConceptChange(next);
  };
  const kind = conceptKindFor(treatment);
  const risksById = new Map(allRisks.map((r) => [r.id, r]));
  const myScenario = scenarioOf(risk);

  const elsewhere = (riskIds: readonly string[]) =>
    riskIds
      .filter((id) => id !== risk.id)
      .map((id) => (risksById.has(id) ? riskLabel(risksById.get(id)!) : id))
      .join(", ");
  /** Same scenario first, then the rest; by display id. */
  const reuseOrder = <T extends { riskIds: string[]; displayId: string }>(items: T[]) =>
    [...items].sort((a, b) => {
      const sa = a.riskIds.some((id) => scenarioOf(risksById.get(id)) === myScenario) ? 0 : 1;
      const sb = b.riskIds.some((id) => scenarioOf(risksById.get(id)) === myScenario) ? 0 : 1;
      return sa - sb || a.displayId.localeCompare(b.displayId);
    });

  // ── Goal proposals: asset × property the risk violates, with its formal description
  const proposals: (AssetPropertyRef & { label: string; statement: string })[] = [];
  for (const assetId of risk.linkedAssetIds ?? []) {
    const asset = assetDataRef?.assets.find((a) => a.id === assetId);
    for (const type of goalTypesFor(risk.strideCategory)) {
      const goal = asset?.securityGoals?.find((g) => g.type === type && g.level !== "none");
      if (!asset || !goal) continue;
      proposals.push({
        assetId,
        property: type,
        label: `${asset.displayId ?? ""} ${asset.name ?? ""} × ${type}`.trim(),
        statement: goal.formalDescription ?? "",
      });
    }
  }

  const reuseCard = (item: CybersecurityGoal | CybersecurityClaim, onLink: () => void) => (
    <Paper key={item.id} variant="outlined" sx={{ p: 1 }} data-testid={`reuse-${item.displayId}`}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Chip size="small" label={item.displayId} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Text preview: the full statement, before linking. */}
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {item.statement || "–"}
          </Typography>
          {item.riskIds.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t("tabs.risks.concept.usedOn", { defaultValue: "used on {{list}}", list: elsewhere(item.riskIds) })}
            </Typography>
          )}
        </Box>
        <Button size="small" onClick={onLink} data-testid={`reuse-link-${item.displayId}`}>
          {t("tabs.risks.concept.link", { defaultValue: "Link" })}
        </Button>
      </Stack>
    </Paper>
  );

  // ==================== AVOID ====================
  if (kind === "avoid") {
    return (
      <Alert severity={isoMode && !treatmentJustification.trim() ? "warning" : "info"} data-testid="concept-avoid">
        {t("tabs.risks.concept.avoid", {
          defaultValue:
            "Avoid needs neither a goal nor a claim — the justification in the Mitigations tab states what was removed (mandatory under ISO/SAE 21434).",
        })}
      </Alert>
    );
  }

  // ==================== GOALS (reduce) ====================
  if (kind === "goal") {
    const linked = goalsOfRisk(concept, risk.id);
    const reusable = reuseOrder(concept.goals.filter((g) => !g.riskIds.includes(risk.id)));
    return (
      <Stack spacing={2} data-testid="concept-goals">
        <Typography variant="body2" color="text.secondary">
          {t("tabs.risks.concept.goalsIntro", {
            defaultValue:
              "Treatment Reduce: the risk needs at least one cybersecurity goal — a concept-level requirement (ISO/SAE 21434 9.4, RQ-09-05).",
          })}
        </Typography>
        {linked.length === 0 && isoMode && (
          <Alert severity="warning" data-testid="concept-goal-missing">
            {t("tabs.risks.concept.goalMissing", { defaultValue: "No cybersecurity goal linked yet." })}
          </Alert>
        )}
        {linked.map((g) => (
          <Paper key={g.id} variant="outlined" sx={{ p: 1.5 }} data-testid={`goal-${g.displayId}`}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" color="primary" label={g.displayId} />
                {g.riskIds.length > 1 && (
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.risks.concept.alsoOn", {
                      defaultValue: "also on {{list}} — a change applies there too",
                      list: elsewhere(g.riskIds),
                    })}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Tooltip title={t("tabs.risks.concept.unlink", { defaultValue: "Unlink from this risk" })}>
                  <IconButton size="small" onClick={() => apply((cc) => unlinkGoal(cc, g.id, risk.id))} data-testid={`goal-unlink-${g.displayId}`}>
                    <UnlinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <CommitField
                label={t("tabs.risks.concept.goalStatement", { defaultValue: "Goal" })}
                value={g.statement}
                testId={`goal-statement-${g.displayId}`}
                onCommit={(statement) => apply((cc) => updateGoal(cc, g.id, { statement }))}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  size="small"
                  sx={{ width: 140 }}
                  label={t("tabs.risks.concept.cal", { defaultValue: "CAL (optional)" })}
                  value={g.cal ?? ""}
                  onChange={(e) =>
                    apply((cc) =>
                      updateGoal(cc, g.id, { cal: e.target.value ? (Number(e.target.value) as Cal) : undefined }),
                    )
                  }
                >
                  <MenuItem value="">–</MenuItem>
                  {[1, 2, 3, 4].map((c) => (
                    <MenuItem key={c} value={c}>{`CAL ${c}`}</MenuItem>
                  ))}
                </TextField>
                {g.cal && (
                  <CommitField
                    multiline={false}
                    label={t("tabs.risks.concept.calRationale", { defaultValue: "CAL rationale" })}
                    value={g.calRationale ?? ""}
                    onCommit={(calRationale) => apply((cc) => updateGoal(cc, g.id, { calRationale }))}
                  />
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}

        <Divider />
        <Typography variant="subtitle2">{t("tabs.risks.concept.newGoal", { defaultValue: "New goal" })}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {proposals.map((p) => (
            <Tooltip key={`${p.assetId}:${p.property}`} title={p.statement || t("tabs.risks.concept.noFormal", { defaultValue: "No formal description on the asset yet" })}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                data-testid={`goal-propose-${p.property}`}
                onClick={() =>
                  apply((cc) => addGoal(cc, newGoal(cc, risk.id, p.statement, [{ assetId: p.assetId, property: p.property }])))
                }
              >
                {p.label}
              </Button>
            </Tooltip>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            data-testid="goal-new-empty"
            onClick={() => apply((cc) => addGoal(cc, newGoal(cc, risk.id, "")))}
          >
            {t("tabs.risks.concept.emptyGoal", { defaultValue: "Empty goal" })}
          </Button>
        </Stack>

        {reusable.length > 0 && (
          <>
            <Typography variant="subtitle2">{t("tabs.risks.concept.reuseGoal", { defaultValue: "Reuse a goal" })}</Typography>
            <Stack spacing={1}>
              {reusable.map((g) => reuseCard(g, () => apply((cc) => linkGoal(cc, g.id, risk.id))))}
            </Stack>
          </>
        )}
      </Stack>
    );
  }

  // ==================== CLAIMS (retain / share) ====================
  const linked = claimsOfRisk(concept, risk.id);
  const reusable = reuseOrder(concept.claims.filter((c) => !c.riskIds.includes(risk.id) && c.kind === kind));
  const assumptionById = new Map(assumptions.map((a) => [a.id, a]));
  return (
    <Stack spacing={2} data-testid="concept-claims">
      <Typography variant="body2" color="text.secondary">
        {kind === "retain"
          ? t("tabs.risks.concept.retainIntro", {
              defaultValue:
                "Treatment Retain: the risk needs a cybersecurity claim stating why it is retained and on which assumptions (ISO/SAE 21434 9.4, RQ-09-06).",
            })
          : t("tabs.risks.concept.shareIntro", {
              defaultValue:
                "Treatment Share: the risk needs a cybersecurity claim stating who carries it (ISO/SAE 21434 9.4, RQ-09-06).",
            })}
      </Typography>
      {linked.length === 0 && isoMode && (
        <Alert severity="warning" data-testid="concept-claim-missing">
          {t("tabs.risks.concept.claimMissing", { defaultValue: "No cybersecurity claim linked yet." })}
        </Alert>
      )}
      {linked.map((c) => (
        <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }} data-testid={`claim-${c.displayId}`}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" color="secondary" label={c.displayId} />
              <Chip size="small" variant="outlined" label={t(`tabs.risks.concept.kind.${c.kind}`, { defaultValue: c.kind })} />
              {c.kind !== kind && (
                <Typography variant="caption" color="warning.main">
                  {t("tabs.risks.concept.kindMismatch", { defaultValue: "claim kind differs from the treatment" })}
                </Typography>
              )}
              {c.riskIds.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.risks.concept.alsoOn", {
                    defaultValue: "also on {{list}} — a change applies there too",
                    list: elsewhere(c.riskIds),
                  })}
                </Typography>
              )}
              <Box sx={{ flex: 1 }} />
              <Tooltip title={t("tabs.risks.concept.unlink", { defaultValue: "Unlink from this risk" })}>
                <IconButton size="small" onClick={() => apply((cc) => unlinkClaim(cc, c.id, risk.id))} data-testid={`claim-unlink-${c.displayId}`}>
                  <UnlinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <CommitField
              label={t("tabs.risks.concept.claimStatement", { defaultValue: "Claim" })}
              value={c.statement}
              testId={`claim-statement-${c.displayId}`}
              onCommit={(statement) => apply((cc) => updateClaim(cc, c.id, { statement }))}
            />
            {c.kind === "retain" ? (
              <Autocomplete
                multiple
                size="small"
                options={[...assumptions]}
                value={c.assumptionIds.map(
                  (id) => assumptionById.get(id) ?? ({ id, displayId: "?", text: id, status: "open" } as Assumption),
                )}
                getOptionLabel={(a) => `${a.displayId} ${a.text}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, v) => apply((cc) => updateClaim(cc, c.id, { assumptionIds: v.map((a) => a.id) }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("tabs.risks.concept.assumptions", { defaultValue: "Relies on assumptions (Item Definition)" })}
                    inputProps={{ ...params.inputProps, "data-testid": `claim-assumptions-${c.displayId}` }}
                  />
                )}
              />
            ) : (
              <CommitField
                multiline={false}
                label={t("tabs.risks.concept.party", { defaultValue: "Responsible party" })}
                value={c.responsibleParty ?? ""}
                testId={`claim-party-${c.displayId}`}
                onCommit={(responsibleParty) => apply((cc) => updateClaim(cc, c.id, { responsibleParty }))}
              />
            )}
            <TextField
              type="date"
              size="small"
              sx={{ width: 200 }}
              label={t("tabs.risks.concept.reviewBy", { defaultValue: "Review by" })}
              InputLabelProps={{ shrink: true }}
              value={c.reviewBy ?? ""}
              onChange={(e) => apply((cc) => updateClaim(cc, c.id, { reviewBy: e.target.value || undefined }))}
            />
          </Stack>
        </Paper>
      ))}

      <Divider />
      <Typography variant="subtitle2">{t("tabs.risks.concept.newClaim", { defaultValue: "New claim" })}</Typography>
      <Stack direction="row" spacing={1}>
        <Tooltip title={treatmentJustification || ""}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!treatmentJustification.trim()}
              data-testid="claim-from-justification"
              onClick={() => apply((cc) => addClaim(cc, newClaim(cc, risk.id, kind, treatmentJustification)))}
            >
              {t("tabs.risks.concept.fromJustification", { defaultValue: "From the treatment justification" })}
            </Button>
          </span>
        </Tooltip>
        <Button
          size="small"
          startIcon={<AddIcon />}
          data-testid="claim-new-empty"
          onClick={() => apply((cc) => addClaim(cc, newClaim(cc, risk.id, kind, "")))}
        >
          {t("tabs.risks.concept.emptyClaim", { defaultValue: "Empty claim" })}
        </Button>
      </Stack>

      {reusable.length > 0 && (
        <>
          <Typography variant="subtitle2">{t("tabs.risks.concept.reuseClaim", { defaultValue: "Reuse a claim" })}</Typography>
          <Stack spacing={1}>
            {reusable.map((c) => reuseCard(c, () => apply((cc) => linkClaim(cc, c.id, risk.id))))}
          </Stack>
        </>
      )}
    </Stack>
  );
};
