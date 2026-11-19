// ==================== RISK DIALOG — RiskMitigationsTab ====================
// Split out of risk-dialog.tsx (MT-2): tab "Mitigations" — treatment, priority, the
// mitigation and verification selection.

import React from "react";
import type { RiskDialogModel } from "./use-risk-dialog-model";
import { Box, Typography, Chip, Stack, Divider, Tooltip, Alert, Paper, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { isTreatmentToReview, offeredTreatments, treatmentFallbackLabel, treatmentI18nKey } from "../../models/risk-treatment-vocabulary";
import { MoSCoWPriority, MOSCOW_PRIORITIES } from "../../models/risk-scale-types";
import { MitigationScopeSelector } from "../mitigation-scope-selector";
import { MitigationCoverageBadge } from "shared";
import { mitigationSelectionKey } from "../../models/risk-mitigation-types";

export function RiskMitigationsTab({ m }: { m: RiskDialogModel }) {
  const { t, currentRisk, local, setLocal, vocabulary, resolvedVerifications, displayedMitigations, setScopeOverride, toggleVerification, mitigationCatalog, toggleMitigation, mitigationCoverage, isPerInteraction, isAccepted, passiveTreatment, extraSection, assumptions } = m;
  // The reverse of Assumption.mitigationIds (phase 3c): the assumptions a
  // measure relies on, shown at the measure — the dependency is maintained
  // at the assumption, but thought of when a measure is chosen.
  const reliesOn = (id: string | undefined) =>
    id ? (assumptions ?? []).filter((a) => a.mitigationIds?.includes(id)).map((a) => a.displayId) : [];
  return (
    <Stack spacing={2.5}>
      {extraSection?.(currentRisk)}
      {/* Accept / Transfer banner — mitigations not applicable */}
      {isAccepted && (
        <Box
          sx={{
            p: 1.5,
            bgcolor: "#fef3c7",
            borderRadius: 1,
            border: "1px solid #fcd34d",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {local.treatment === "accept" && vocabulary === "iso-21434"
              ? t("tabs.risks.dialog.retainedNote", {
                  defaultValue:
                    "Risk is retained — no mitigations required. Risk After equals Risk Before.",
                })
              : local.treatment === "accept"
              ? t("tabs.risks.dialog.acceptedNote", {
                  defaultValue:
                    "Risk is accepted — no mitigations required. Risk After equals Risk Before.",
                })
              : t("tabs.risks.dialog.transferredNote", {
                  defaultValue:
                    "Risk is transferred — no internal mitigations required. Risk After equals Risk Before.",
                })}
          </Typography>
        </Box>
      )}

      {/* ══ 1. RISK TREATMENT ═══════════════════════════════ */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {t("tabs.risks.dialog.treatment", {
            defaultValue: "Risk Treatment",
          })}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {offeredTreatments(vocabulary, currentRisk.treatment).map((tr) => (
            <Tooltip
              key={tr.value}
              title={t(`${treatmentI18nKey(tr.value, vocabulary)}.description`, {
                defaultValue: tr.description,
              })}
              placement="top"
              arrow
            >
              <Chip
                label={t(`${treatmentI18nKey(tr.value, vocabulary)}.label`, {
                  defaultValue: treatmentFallbackLabel(tr.value, vocabulary),
                })}
                onClick={() =>
                  setLocal((prev) => {
                    if (!prev) return prev;

                    const autoFixed =
                      tr.value === "accept" ||
                      tr.value === "transfer";

                    const newMoscow = autoFixed
                      ? ("wont" as MoSCoWPriority)
                      : prev.moscowPriority === "wont"
                        ? ("should" as MoSCoWPriority)
                        : prev.moscowPriority;

                    return {
                      ...prev,
                      treatment: tr.value,
                      moscowPriority: newMoscow,
                      ...(autoFixed
                        ? {
                            mitigatedFactorRatings:
                              prev.factorRatings.map((r) => ({
                                ...r,
                              })),
                          }
                        : {}),
                    };
                  })
                }
                sx={{
                  bgcolor:
                    local.treatment === tr.value
                      ? tr.color
                      : "transparent",
                  color:
                    local.treatment === tr.value ? "white" : tr.color,
                  border: `2px solid ${tr.color}`,
                  fontWeight:
                    local.treatment === tr.value ? "bold" : "normal",
                  cursor: "pointer",
                }}
              />
            </Tooltip>
          ))}
        </Stack>

        {isTreatmentToReview(local.treatment, vocabulary) && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t("tabs.risks.dialog.transferToReview", {
              defaultValue:
                "Decision to review: ISO/SAE 21434 offers no \"Transfer\" option. Confirm the decision as Share or choose another option.",
            })}
          </Alert>
        )}

        {/* Justification — contextual to Risk Treatment (accept/transfer/share) */}
        {passiveTreatment && local.moscowPriority !== "wont" && (
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 1.5 }}
            label={t("tabs.risks.dialog.treatmentJustification", {
              defaultValue: "Treatment Justification (required)",
            })}
            value={local.treatmentJustification}
            onChange={(e) =>
              setLocal((prev) =>
                prev
                  ? {
                      ...prev,
                      treatmentJustification: e.target.value,
                    }
                  : prev,
              )
            }
            error={
              passiveTreatment && !local.treatmentJustification.trim()
            }
            helperText={
              passiveTreatment && !local.treatmentJustification.trim()
                ? t(
                    "tabs.risks.dialog.treatmentJustificationRequired",
                    {
                      defaultValue:
                        "Required for accept / transfer / share",
                    },
                  )
                : undefined
            }
          />
        )}
      </Box>

      <Divider />

      {/* ══ 2. MITIGATION & VERIFICATION ═══════════════════ */}
      {displayedMitigations.length > 0 && (
        <Box sx={{ opacity: isAccepted ? 0.5 : 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.selectedMitigations", {
              defaultValue: "Proposed Mitigations",
            })}
          </Typography>
          <Stack spacing={0.5}>
            {displayedMitigations.map((m) => {
              const key = mitigationSelectionKey(m);
              const isMandated =
                "isMandated" in m && m.isMandated === true;
              const label = isMandated
                ? m.text
                : m.isCustom
                  ? `[custom] ${m.notes ?? ""}`
                  : `${m.id}: ${m.text}`;
              return (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: "background.paper",
                  }}
                >
                  <FormControlLabel
                    disabled={isAccepted}
                    control={
                      <Checkbox
                        size="small"
                        checked={local.selectedMitigations.some(
                          (sel) => mitigationSelectionKey(sel) === key,
                        )}
                        onChange={() => toggleMitigation(m)}
                        disabled={isAccepted}
                      />
                    }
                    label={
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2">
                          {label}
                        </Typography>
                        {isMandated && (
                          <Chip
                            label={t(
                              "tabs.risks.dialog.en50742Mandated",
                              { defaultValue: "EN 50742 A" },
                            )}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        <MitigationCoverageBadge
                          coverage={
                            m.id ? mitigationCoverage.get(m.id) : undefined
                          }
                        />
                        {reliesOn(m.id).length > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            data-testid={`mitigation-relies-on-${m.id}`}
                          >
                            {t("tabs.risks.dialog.reliesOn", {
                              defaultValue: "relies on {{list}}",
                              list: reliesOn(m.id).join(", "),
                            })}
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ m: 0, width: "100%" }}
                  />

                  {/* Scope selector — only for per-interaction risks */}
                  {/* Catalog mitigations only: the scope is defined
                      by the catalog entry's affected properties. */}
                  {isPerInteraction &&
                    m.id &&
                    local.selectedMitigations.some(
                      (sel) => sel.id === m.id,
                    ) && (
                      <MitigationScopeSelector
                        mitigationId={m.id}
                        selectedMitigation={
                          local.selectedMitigations.find(
                            (sel) => sel.id === m.id,
                          )!
                        }
                        catalog={mitigationCatalog}
                        onChange={(roles) =>
                          setScopeOverride(m.id!, roles)
                        }
                      />
                    )}
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Proposed Verifications checkboxes */}
      {resolvedVerifications.length > 0 && (
        <Box sx={{ opacity: isAccepted ? 0.5 : 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.verifications", {
              defaultValue: "Proposed Verifications",
            })}
          </Typography>
          <Stack spacing={0.5}>
            {resolvedVerifications.map((v) => {
              const id = v.id ?? v.notes ?? "";
              const label = v.isCustom
                ? `[custom] ${v.notes ?? ""}`
                : `${v.id}: ${v.text}`;
              return (
                <Paper
                  key={id}
                  variant="outlined"
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: "background.paper",
                  }}
                >
                  <FormControlLabel
                    disabled={isAccepted}
                    control={
                      <Checkbox
                        size="small"
                        checked={local.selectedVerifications.includes(
                          id,
                        )}
                        onChange={() => toggleVerification(id)}
                        disabled={isAccepted}
                      />
                    }
                    label={
                      <Typography variant="body2">{label}</Typography>
                    }
                    sx={{ m: 0, width: "100%" }}
                  />
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider />

      {/* ══ 3. MOSCOW PRIORITY — same visual language as Risk Treatment ══ */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {t("tabs.risks.dialog.priority", {
            defaultValue: "Priority",
          })}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {MOSCOW_PRIORITIES.map((p) => (
            <Chip
              key={p.value}
              label={t(`risks.moscow.${p.value}.label`, {
                defaultValue: p.label,
              })}
              onClick={() =>
                setLocal((prev) =>
                  prev ? { ...prev, moscowPriority: p.value } : prev,
                )
              }
              sx={{
                bgcolor:
                  local.moscowPriority === p.value
                    ? p.color
                    : "transparent",
                color:
                  local.moscowPriority === p.value
                    ? "white"
                    : p.color,
                border: `2px solid ${p.color}`,
                fontWeight:
                  local.moscowPriority === p.value
                    ? "bold"
                    : "normal",
                cursor: "pointer",
              }}
            />
          ))}
        </Stack>

        {/* Won't justification — contextual to MoSCoW "wont" */}
        {local.moscowPriority === "wont" && (
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 1.5 }}
            label={t("tabs.risks.dialog.wontJustification", {
              defaultValue: "Justification for Won't (required)",
            })}
            value={local.wontJustification}
            onChange={(e) =>
              setLocal((prev) =>
                prev
                  ? { ...prev, wontJustification: e.target.value }
                  : prev,
              )
            }
            error={!local.wontJustification.trim()}
            helperText={
              !local.wontJustification.trim()
                ? t("tabs.risks.validation.required", {
                    defaultValue: "Required",
                  })
                : undefined
            }
          />
        )}
      </Box>
    </Stack>
  );
}
