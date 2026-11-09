// ==================== COMPONENT TREATMENT SECTION ====================
// Multi-project TARA, phase 3a (design §7.4): in the risk dialog of an
// imported risk, how the component treated it — read-only. Its measures
// with their status (implemented / verified count; any other status depends
// on a component release), or, for a risk it handed over (share / transfer)
// or accepted, the claims that say why it arrives untreated here. The
// machine's own treatment and measures stay below as for any risk.
// Phase 3d-1 (I7): per measure its effectiveness in this instance —
// effective, not effective (a real problem) or unclear (a gap in the
// evidence), told apart, with the reasons.
// Phase 3d-2b (I7 (5)): the machine may mark a measure "not effective here"
// with a mandatory rationale — downgrade only; withdrawn the same way. It
// acts like "not effective": the residual risk is not credited.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";

const NS = "components";

export interface ComponentTreatmentView {
  instanceLabel: string;
  treatment: string;
  justification?: string;
  measures: {
    id?: string;
    text: string;
    status: string;
    state: "implemented" | "pending" | "rejected";
    reliesOn?: string[];
    effectiveness?: "effective" | "not_effective" | "unclear";
    reasons?: {
      kind: "pending" | "aou_open" | "aou_not_fulfilled" | "aou_invalid_in_component" | "overridden_here";
      assumption?: string;
      rationale?: string;
    }[];
    /** Marked "not effective here" by this machine. */
    override?: { rationale: string; date: string };
  }[];
  claims: { displayId: string; kind: string; statement: string; responsibleParty?: string }[];
  handedOver: boolean;
  /** Handed over: has the machine set its own treatment yet? */
  decided?: boolean;
}

const REASON_DEFAULT = {
  pending: "not implemented yet",
  aou_open: "{{assumption}} open",
  aou_not_fulfilled: "{{assumption}} not fulfilled",
  aou_invalid_in_component: "{{assumption}} invalid in the component",
  overridden_here: "marked not effective here",
} as const;

/** "Not effective here…" — the rationale is mandatory; a marked measure can be withdrawn. */
const OverrideControl: React.FC<{
  measureId: string;
  override?: { rationale: string; date: string };
  onOverride: (measureId: string, rationale: string | null) => void;
}> = ({ measureId, override, onOverride }) => {
  const { t } = useTranslation(NS);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  if (override) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 2 }} data-testid={`component-treatment-override-${measureId}`}>
        <Typography variant="caption" color="error.main">
          {t("components.treatment.override.marked", {
            rationale: override.rationale,
            date: override.date,
            defaultValue: "Marked not effective here ({{date}}): {{rationale}}",
          })}
        </Typography>
        <Button size="small" onClick={() => onOverride(measureId, null)} data-testid={`component-treatment-override-withdraw-${measureId}`}>
          {t("components.treatment.override.withdraw", { defaultValue: "Withdraw" })}
        </Button>
      </Stack>
    );
  }
  if (!editing) {
    return (
      <Button
        size="small"
        color="error"
        sx={{ alignSelf: "flex-start", ml: 1.5 }}
        onClick={() => setEditing(true)}
        data-testid={`component-treatment-override-start-${measureId}`}
      >
        {t("components.treatment.override.start", { defaultValue: "Not effective here…" })}
      </Button>
    );
  }
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ pl: 2 }}>
      <TextField
        size="small"
        fullWidth
        autoFocus
        multiline
        value={text}
        onChange={(e) => setText(e.target.value)}
        label={t("components.treatment.override.rationale", { defaultValue: "Why does it not hold in this machine? (required)" })}
        inputProps={{ "data-testid": `component-treatment-override-rationale-${measureId}` }}
      />
      <Button
        size="small"
        variant="contained"
        color="error"
        disabled={!text.trim()}
        onClick={() => {
          onOverride(measureId, text.trim());
          setEditing(false);
          setText("");
        }}
        data-testid={`component-treatment-override-save-${measureId}`}
      >
        {t("components.treatment.override.save", { defaultValue: "Mark" })}
      </Button>
      <Button size="small" onClick={() => setEditing(false)}>
        {t("components.treatment.override.cancel", { defaultValue: "Cancel" })}
      </Button>
    </Stack>
  );
};

const STATE_COLOR = { implemented: "success", pending: "warning", rejected: "default" } as const;
const EFFECT_COLOR = { effective: "success", not_effective: "error", unclear: "warning" } as const;
const EFFECT_DEFAULT = { effective: "effective here", not_effective: "not effective here", unclear: "unclear here" } as const;

export const ComponentTreatmentSection: React.FC<{
  view: ComponentTreatmentView;
  /** Marks (rationale) or withdraws (null) "not effective here"; absent = read-only. */
  onOverride?: (measureId: string, rationale: string | null) => void;
}> = ({ view, onOverride }) => {
  const { t } = useTranslation(NS);
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "grey.50" }} data-testid="component-treatment">
      <Typography variant="subtitle2">
        {t("components.treatment.title", {
          component: view.instanceLabel,
          treatment: t(`components.treatment.kinds.${view.treatment}`, { defaultValue: view.treatment }),
          defaultValue: "Treatment in the component ({{component}}): {{treatment}}",
        })}
      </Typography>
      {view.justification && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {view.justification}
        </Typography>
      )}

      {view.handedOver ? (
        <>
          <Alert severity={view.decided ? "success" : "warning"} sx={{ mt: 1 }} data-testid="component-treatment-handover">
            {view.decided
              ? t("components.treatment.handoverDecided", {
                  defaultValue: "The component handed this risk over; this machine has set its own treatment.",
                })
              : t("components.treatment.handoverOpen", {
                  defaultValue:
                    "The component handed this risk over or accepted it — it arrives untreated. Set this machine's treatment: an own measure, or accept / transfer with a justification.",
                })}
          </Alert>
          {view.claims.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {view.claims.map((c) => (
                <Typography key={c.displayId} variant="body2" data-testid={`component-treatment-claim-${c.displayId}`}>
                  <strong>{c.displayId}</strong> ({c.kind}
                  {c.responsibleParty ? ` → ${c.responsibleParty}` : ""}): {c.statement}
                </Typography>
              ))}
            </Stack>
          )}
        </>
      ) : view.measures.length > 0 ? (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {view.measures.map((m, i) => (
            <Stack key={`${m.id ?? ""}-${i}`} spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center" data-testid={`component-treatment-measure-${m.id ?? i}`}>
                <Chip
                  size="small"
                  color={STATE_COLOR[m.state]}
                  variant={m.state === "implemented" ? "filled" : "outlined"}
                  label={t(`components.treatment.status.${m.status}`, { defaultValue: m.status })}
                />
                <Typography variant="body2">
                  {m.id ? <code style={{ marginRight: 6 }}>{m.id}</code> : null}
                  {m.text}
                </Typography>
                {m.effectiveness && (
                  <Chip
                    size="small"
                    variant={m.effectiveness === "not_effective" ? "filled" : "outlined"}
                    color={EFFECT_COLOR[m.effectiveness]}
                    data-testid={`component-treatment-effect-${m.id ?? i}`}
                    label={
                      t(`components.treatment.effect.${m.effectiveness}`, { defaultValue: EFFECT_DEFAULT[m.effectiveness] }) +
                      ((m.reasons?.length ?? 0) > 0
                        ? `: ${m.reasons!
                            .map((r) =>
                              t(`components.treatment.reason.${r.kind}`, {
                                assumption: r.assumption ?? "",
                                defaultValue: REASON_DEFAULT[r.kind],
                              }),
                            )
                            .join(", ")}`
                        : "")
                    }
                  />
                )}
                {(m.reliesOn?.length ?? 0) > 0 && (
                  <Typography variant="caption" color="text.secondary" data-testid={`component-treatment-relies-${m.id ?? i}`}>
                    {t("components.treatment.reliesOn", { list: m.reliesOn!.join(", "), defaultValue: "relies on {{list}}" })}
                  </Typography>
                )}
              </Stack>
              {onOverride && m.id && m.state !== "rejected" && (
                <OverrideControl measureId={m.id} override={m.override} onOverride={onOverride} />
              )}
            </Stack>
          ))}
          {view.measures.some((m) => m.state === "pending") && (
            <Typography variant="caption" color="warning.main" data-testid="component-treatment-pending">
              {t("components.treatment.pending", {
                defaultValue: "Measures not implemented yet depend on a component release.",
              })}
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("components.treatment.noMeasures", { defaultValue: "The component chose no measures." })}
        </Typography>
      )}
    </Box>
  );
};
