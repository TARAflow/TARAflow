// ==================== RISK DIALOG — RiskAfterTab ====================
// Split out of risk-dialog.tsx (MT-2): tab "Risk After" — residual factor ratings and score.

import React from "react";
import type { RiskDialogModel } from "./use-risk-dialog-model";
import { renderFactorRowOf, type FactorRowFactor, renderIsoFactorRowOf, renderTreeFactorRowOf } from "./factor-rows";
import { isoResidualOf, isoFeasibilityNoteOf, isoImpactNoteOf } from "./iso-notes";
import { ISO_AP_FACTOR_IDS } from "./local-risk-state";
import { Button, Box, Typography, Chip, Stack, Divider, Tooltip, Paper, TextField } from "@mui/material";
import { ContentCopy as CopyIcon } from "@mui/icons-material";
import { FactorRating } from "../../models/risk-factor-types";
import { impactBasisText } from "../../utils/impact-basis-text";
import { IsoRiskPanel } from "../shared/iso-risk-panel";
import { getFactorDefinition } from "../../models/risk-assessment-types";
import { explainImpact } from "../../services/risk-calculation-service";
import { ASSET_GROUP_CONFIG, MitigationCoverageBadge } from "shared";
import { formatAssetLabel, isIrreversibleOrWorse } from "shared";
import { RiskScorePanel } from "../shared/risk-score-panel";

export function RiskAfterTab({ m }: { m: RiskDialogModel }) {
  const { t, configuration, currentRisk, local, setLocal, isISO, linkedAssets, afterValues, resolvedMitigations, resolvedVerifications, effectiveCauseDescription, impactFactors, likelihoodFactors, handleCopyToMitigated, mitigationCoverage, isAccepted, liveIso, hasTreeIsoFactors } = m;
  const renderFactorRow = (factor: FactorRowFactor, mitigated: boolean) => renderFactorRowOf(m, factor, mitigated);
  const renderIsoFactorRow = (factorId: string, mitigated: boolean) => renderIsoFactorRowOf(m, factorId, mitigated);
  const renderTreeFactorRow = (mitigated: boolean) => renderTreeFactorRowOf(m, mitigated);
  const isoResidual = (ratings: FactorRating[]) => isoResidualOf(m, ratings);
  const isoFeasibilityNote = (mitigated: boolean) => isoFeasibilityNoteOf(m, mitigated);
  const isoImpactNote = (mitigated: boolean) => isoImpactNoteOf(m, mitigated);
  return (
    <Stack spacing={2.5}>
      {/* Threat description read-only */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {t("tabs.risks.dialog.threatDescription", {
            defaultValue: "Threat",
          })}
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "grey.50" }}>
          <Typography variant="body2">
            {currentRisk.threatDescription}
          </Typography>
          {currentRisk.attackDescription && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {currentRisk.attackDescription}
              </Typography>
            </>
          )}
        </Paper>
      </Box>

      {/* Cause — amber, read-only */}
      {effectiveCauseDescription && (
        <Box
          sx={{
            p: 1.5,
            bgcolor: "#fef3c7",
            borderRadius: 1,
            border: "1px solid #fcd34d",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight="medium"
            display="block"
            mb={0.5}
          >
            {t("tabs.risks.dialog.cause", {
              defaultValue: "Root Cause",
            })}
          </Typography>
          <Typography variant="body2">
            {effectiveCauseDescription}
          </Typography>
        </Box>
      )}

      {/* Linked Assets — mirrored from Risk Before so the residual
          tab is self-contained (same asset; mitigation changes the
          risk, not which asset is affected). */}
      {linkedAssets.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Assets
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
          >
            {linkedAssets.map((asset) => {
              const aImpact = asset.aggregatedImpact;
              const hasSafety =
                isIrreversibleOrWorse(asset.physicalImpact);
              const groupCfg =
                ASSET_GROUP_CONFIG[
                  asset.assetGroup as keyof typeof ASSET_GROUP_CONFIG
                ];
              return (
                <Chip
                  key={asset.id}
                  label={`${formatAssetLabel(asset)}${hasSafety ? " ⚠" : ""}${aImpact ? ` · ${aImpact}` : ""}`}
                  size="small"
                  sx={{
                    fontSize: 11,
                    height: 22,
                    bgcolor: groupCfg?.colorLight ?? "grey.100",
                    color: groupCfg?.color ?? "text.primary",
                    border: `1px solid ${groupCfg?.color ?? "#ccc"}`,
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider />

      {/* Selected Mitigations — bullet list */}
      {local.selectedMitigations.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.selectedMitigations", {
              defaultValue: "Selected Mitigations",
            })}
          </Typography>
          <Stack spacing={0.5}>
            {local.selectedMitigations.map((mitigation) => {
              const id = mitigation.id ?? mitigation.notes ?? "";
              const ref = resolvedMitigations.find(
                (m) => (m.id ?? m.notes ?? "") === id,
              );
              const text = ref
                ? ref.isCustom
                  ? `[custom] ${ref.notes ?? ""}`
                  : `${ref.id}: ${ref.text}`
                : id;
              return (
                <Typography
                  key={id}
                  variant="body2"
                  component="div"
                  sx={{
                    display: "flex",
                    gap: 0.75,
                    alignItems: "center",
                  }}
                >
                  <span style={{ flexShrink: 0, color: "#6b7280" }}>
                    •
                  </span>
                  <span style={{ flexGrow: 1 }}>{text}</span>
                  <MitigationCoverageBadge
                    coverage={mitigationCoverage.get(id)}
                  />
                </Typography>
              );
            })}
          </Stack>
        </Box>
      )}

      {local.selectedVerifications.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.verifications", {
              defaultValue: "Selected Verifications",
            })}
          </Typography>
          <Stack spacing={0.5}>
            {local.selectedVerifications.map((id) => {
              const ref = resolvedVerifications.find(
                (v) => (v.id ?? v.notes ?? "") === id,
              );
              const text = ref
                ? ref.isCustom
                  ? `[custom] ${ref.notes ?? ""}`
                  : `${ref.id}: ${ref.text}`
                : id;
              return (
                <Typography
                  key={id}
                  variant="body2"
                  sx={{ display: "flex", gap: 0.75 }}
                >
                  <span style={{ flexShrink: 0, color: "#6b7280" }}>
                    •
                  </span>
                  <span>{text}</span>
                </Typography>
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider />

      {/* After score */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="subtitle2">
          {t("tabs.risks.dialog.tabAfter", {
            defaultValue: "Risk After",
          })}
        </Typography>

        <Tooltip
          title={t("tabs.risks.dialog.copyFromBefore", {
            defaultValue: "Copy ratings from Before",
          })}
        >
          <span>
            <Button
              size="small"
              startIcon={<CopyIcon />}
              variant="outlined"
              onClick={handleCopyToMitigated}
              disabled={isAccepted}
            >
              {t("tabs.risks.dialog.copyFromBefore", {
                defaultValue: "Copy from Before",
              })}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Accept / Transfer: inform analyst risk after = risk before */}
      {isAccepted && (
        <Box
          sx={{
            p: 1,
            bgcolor: "#fef3c7",
            borderRadius: 1,
            border: "1px solid #fcd34d",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t("tabs.risks.dialog.riskAfterAutoSynced", {
              defaultValue:
                "Risk After is automatically set equal to Risk Before (no mitigation applied).",
            })}
          </Typography>
        </Box>
      )}

      <Stack
        direction="row"
        spacing={3}
        sx={{ width: "100%" }}
        justifyContent="stretch"
      >
        {isISO ? (
          <IsoRiskPanel
            impact={liveIso?.impact}
            feasibility={liveIso?.residual?.feasibility}
            value={liveIso?.residual?.value}
            testId="iso-risk-panel-after"
            feasibilityNote={isoFeasibilityNote(true)}
            impactNote={isoImpactNote(true)}
          />
        ) : (
          <RiskScorePanel
            impact={afterValues.impact}
            likelihood={afterValues.likelihood}
            risk={afterValues.risk}
            configuration={configuration}
          />
        )}
      </Stack>

      {/* Residual risk rationale — why L/I changed after mitigation */}
      <TextField
        size="small"
        fullWidth
        multiline
        rows={2}
        sx={{ mt: 1.5 }}
        label={t("tabs.risks.dialog.riskAfterRationale", {
          defaultValue:
            "Residual Risk Rationale — why likelihood/impact changed after mitigation",
        })}
        value={local.riskAfterRationale}
        onChange={(e) =>
          setLocal((prev) =>
            prev
              ? { ...prev, riskAfterRationale: e.target.value }
              : prev,
          )
        }
      />

      {/* Factor ratings — disabled when accepted/transferred */}
      <Box
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          opacity: isAccepted ? 0.5 : 1,
          pointerEvents: isAccepted ? "none" : "auto",
        }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.likelihoodFactors", {
              defaultValue: "Likelihood Factors (After)",
            })}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 1,
            }}
          >
            {/* Trees with the ISO factor breakdown: the five
                factors are the input, the residual tree level is
                derived from them (effect above) — no select. */}
            {!hasTreeIsoFactors && renderTreeFactorRow(true)}
            {hasTreeIsoFactors && (
              <>
                {ISO_AP_FACTOR_IDS.map((id) =>
                  renderIsoFactorRow(id, true),
                )}
                {/* ISO: the residual feasibility is in the panel above. */}
                {!isISO && (() => {
                  const res = isoResidual(
                    local.mitigatedFactorRatings,
                  );
                  return (
                    <Paper
                      variant="outlined"
                      data-testid="residual-feasibility-panel"
                      sx={{
                        p: 1.25,
                        gridColumn: "1 / -1",
                        borderColor: "info.main",
                        borderStyle: "dashed",
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {t("tabs.risks.dialog.residualFeasibility", {
                          defaultValue:
                            "Residual feasibility (from the factors above)",
                        })}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {res
                          ? `AP ${res.ap} → ${res.band} → L ${res.likelihood}`
                          : t(
                              "tabs.risks.dialog.residualIncomplete",
                              {
                                defaultValue:
                                  "Rate all five factors to compute residual feasibility",
                              },
                            )}
                      </Typography>
                    </Paper>
                  );
                })()}
              </>
            )}
            {likelihoodFactors.map((f) => renderFactorRow(f, true))}
          </Box>
        </Box>

        {isISO ? (
          // ISO/SAE 21434: the impact is rated on the damage scenario
          // (15.5, the asset), not on the risk — the residual keeps
          // it; a control lowers the attack feasibility (15.7).
          <Box data-testid="iso-impact-after-note">
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.risks.dialog.impactAfterIso", {
                defaultValue: "Impact (After)",
              })}
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "grey.50" }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t("tabs.risks.dialog.impactAfterIsoNote", {
                  defaultValue:
                    "Unchanged: the impact is rated on the damage scenario of the asset, a control lowers the attack feasibility. To lower the impact, re-rate the damage scenario in the Assets tab.",
                })}
              </Typography>
            </Paper>
          </Box>
        ) : impactFactors.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.risks.dialog.impactFactorsAfter", {
                defaultValue: "Impact Factors (After)",
              })}
            </Typography>
            {(() => {
              const line = impactBasisText(
                explainImpact(local?.mitigatedFactorRatings ?? [], configuration),
                t as unknown as (k: string, o?: Record<string, unknown>) => string,
                (id) =>
                  t(`risks.factors.${id}.name`, {
                    defaultValue: getFactorDefinition(id, configuration.customFactors)?.name ?? id,
                  }),
              );
              return line ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  data-testid="impact-basis-after"
                  sx={{ display: "block", mb: 1 }}
                >
                  {line}
                </Typography>
              ) : null;
            })()}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 1,
              }}
            >
              {impactFactors.map((f) => renderFactorRow(f, true))}
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
