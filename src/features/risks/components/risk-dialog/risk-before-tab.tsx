// ==================== RISK DIALOG — RiskBeforeTab ====================
// Split out of risk-dialog.tsx (MT-2): tab "Risk Before" — threat, factor ratings, calculated
// score, EN 50742 SRSL / ISO panels.

import React from "react";
import type { RiskDialogModel } from "./use-risk-dialog-model";
import { renderFactorRowOf, type FactorRowFactor, renderIsoFactorRowOf, renderTreeFactorRowOf } from "./factor-rows";
import { isoFeasibilityNoteOf, isoImpactNoteOf } from "./iso-notes";
import { ISO_AP_FACTOR_IDS } from "./local-risk-state";
import { Box, Typography, Chip, Stack, Divider, Tooltip, IconButton, Paper, TextField, Collapse } from "@mui/material";
import { ExpandMore as ExpandMoreIcon, InfoOutlined as InfoIcon } from "@mui/icons-material";
import { impactBasisText } from "../../utils/impact-basis-text";
import { IsoRiskPanel } from "../shared/iso-risk-panel";
import { getFactorDefinition } from "../../models/risk-assessment-types";
import { explainImpact } from "../../services/risk-calculation-service";
import { ASSET_GROUP_CONFIG } from "shared";
import { formatAssetLabel, isIrreversibleOrWorse } from "shared";
import { RiskScorePanel } from "../shared/risk-score-panel";
import { SrslBadge } from "../shared/srsl-badge";
import { SrslReferenceTables } from "../shared/srsl-reference-tables";

export function RiskBeforeTab({ m }: { m: RiskDialogModel }) {
  const { t, configuration, currentRisk, local, setLocal, showSrslTables, setShowSrslTables, isEN50742, isISO, linkedAssets, en50742Severity, hasExposureAnchor, srslFormula, beforeValues, effectiveCauseDescription, impactFactors, likelihoodFactors, elFactor, acFactor, liveIso, hasTreeIsoFactors } = m;
  const renderFactorRow = (factor: FactorRowFactor, mitigated: boolean) => renderFactorRowOf(m, factor, mitigated);
  const renderIsoFactorRow = (factorId: string, mitigated: boolean) => renderIsoFactorRowOf(m, factorId, mitigated);
  const renderTreeFactorRow = (mitigated: boolean) => renderTreeFactorRowOf(m, mitigated);
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

      {/* Linked Assets */}
      {
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
      }

      <Divider />

      {isEN50742 &&
        hasExposureAnchor &&
        (() => {
          const arrow = (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 0.5,
                flexShrink: 0,
              }}
            >
              <Typography variant="h6" color="text.disabled">
                →
              </Typography>
            </Box>
          );

          const wooBox = (
            <Tooltip
              title={t("tabs.risks.dialog.wooTooltip", {
                defaultValue:
                  "Global value — change it in the Overview tab (Security Context).",
              })}
              placement="top"
              arrow
            >
              <Paper
                variant="outlined"
                sx={{ p: 1.5, height: "100%" }}
              >
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  gutterBottom
                >
                  {t("risks.factors.window_of_opportunity.name", {
                    defaultValue: "Window of Opportunity (WoO)",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {configuration.windowOfOpportunity
                    ? t(
                        `risks.woo.${configuration.windowOfOpportunity}`,
                        {
                          defaultValue:
                            configuration.windowOfOpportunity.replace(
                              /_/g,
                              " ",
                            ),
                        },
                      )
                    : t("tabs.risks.dialog.wooNotSet", {
                        defaultValue:
                          "Not set — configure in Overview",
                      })}
                </Typography>
              </Paper>
            </Tooltip>
          );

          const severityBox = (
            <Paper variant="outlined" sx={{ p: 1.5, height: "100%" }}>
              <Typography
                variant="body2"
                fontWeight="medium"
                gutterBottom
              >
                {t("tabs.risks.dialog.severity", {
                  defaultValue: "Severity",
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {en50742Severity
                  ? t(`risks.severity.${en50742Severity}`, {
                      defaultValue: en50742Severity.replace(
                        /_/g,
                        " ",
                      ),
                    })
                  : t("tabs.risks.dialog.severityNone", {
                      defaultValue: "No linked safety-function asset",
                    })}
              </Typography>
            </Paper>
          );

          const apBox = (
            <Tooltip
              title={
                srslFormula && beforeValues.apScore != null
                  ? t("tabs.risks.dialog.srslFormula", {
                      el: srslFormula.elScore,
                      woo: srslFormula.wooMultiplier,
                      ac: srslFormula.acScore,
                      result: beforeValues.apScore.toFixed(1),
                      band: beforeValues.apBand,
                      defaultValue:
                        "AP = ({{el}} × {{woo}}) + {{ac}} = {{result}} → {{band}}",
                    })
                  : ""
              }
              placement="top"
              arrow
            >
              <Paper
                variant="outlined"
                sx={{ p: 1.5, height: "100%" }}
              >
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  gutterBottom
                >
                  {t("tabs.risks.dialog.apLabel", {
                    defaultValue: "Attack Potential (AP)",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {beforeValues.apScore != null && beforeValues.apBand
                    ? `${beforeValues.apScore.toFixed(1)} (${beforeValues.apBand})`
                    : t("tabs.risks.dialog.apNotDetermined", {
                        defaultValue: "Not yet determined",
                      })}
                </Typography>
              </Paper>
            </Tooltip>
          );

          return (
            <>
              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle2" gutterBottom>
                    {t("tabs.risks.dialog.srslSectionTitle", {
                      defaultValue: "SRSL (EN 50742)",
                    })}
                  </Typography>
                  <Tooltip
                    title={t("tabs.risks.dialog.srslTablesToggle", {
                      defaultValue: "Show norm reference tables",
                    })}
                  >
                    <IconButton
                      size="small"
                      onClick={() => setShowSrslTables((v) => !v)}
                      sx={{
                        transform: showSrslTables
                          ? "rotate(180deg)"
                          : "none",
                        transition: "transform 0.2s",
                      }}
                    >
                      <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Row 1: WoO, EL, AC → AP */}
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="stretch"
                  sx={{ mb: 1 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>{wooBox}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {elFactor && renderFactorRow(elFactor, false)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {acFactor && renderFactorRow(acFactor, false)}
                  </Box>
                  {arrow}
                  <Box sx={{ flex: 1, minWidth: 0 }}>{apBox}</Box>
                </Stack>

                {/* Row 2: AP, Severity → SRSL — full only when a
                    safety-function asset provides a severity. Without
                    it, AP stays valid (shown in Row 1) but SRSL is not
                    computable, so this row collapses to a single note
                    instead of an empty severity box + a null badge. */}
                {en50742Severity ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="stretch"
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>{apBox}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {severityBox}
                    </Box>
                    {arrow}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <SrslBadge
                        srsl={beforeValues.srsl}
                        apBand={beforeValues.apBand}
                      />
                    </Box>
                  </Stack>
                ) : (
                  <Tooltip
                    placement="top"
                    arrow
                    title={
                      <Box
                        sx={{
                          whiteSpace: "pre-line",
                          maxWidth: 340,
                        }}
                      >
                        {t(
                          "tabs.risks.dialog.srslNoSeverityTooltip",
                          {
                            defaultValue:
                              "SRSL needs a severity, which comes from a linked safety-function asset that carries a physical impact.\n\n1. In the Asset tab, add a safety-function asset and set its physical impact (Safety Impact Manual Override + rationale).\n2. Relate it to this threat's anchor: an Interface can \u201cinvokes\u201d or \u201cmonitors\u201d it; a DataFlow can \u201cinvokes\u201d it.\n\nSeverity then flows anchor \u2192 threat \u2192 risk and the SRSL is computed.",
                          },
                        )}
                      </Box>
                    }
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        cursor: "help",
                      }}
                    >
                      <InfoIcon fontSize="small" color="action" />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {t(
                          "tabs.risks.dialog.srslNoSeverityCompact",
                          {
                            defaultValue:
                              "No linked safety-function asset for Severity",
                          },
                        )}
                      </Typography>
                    </Paper>
                  </Tooltip>
                )}

                <Collapse in={showSrslTables}>
                  <SrslReferenceTables
                    currentApScore={beforeValues.apScore}
                    currentApBand={beforeValues.apBand}
                    currentSeverity={en50742Severity}
                  />
                </Collapse>
              </Box>

              <Divider />
            </>
          );
        })()}

      {/* Calculated score */}
      <Typography variant="subtitle2" gutterBottom>
        {t("tabs.risks.dialog.tabBefore", {
          defaultValue: "Risk Before",
        })}
      </Typography>
      <Stack
        direction="row"
        spacing={3}
        sx={{ width: "100%" }}
        justifyContent="stretch"
      >
        {isISO ? (
          <IsoRiskPanel
            impact={liveIso?.impact}
            feasibility={liveIso?.feasibility}
            value={liveIso?.value}
            testId="iso-risk-panel-before"
            feasibilityNote={isoFeasibilityNote(false)}
            impactNote={isoImpactNote(false)}
          />
        ) : (
          <RiskScorePanel
            impact={beforeValues.impact}
            likelihood={beforeValues.likelihood}
            risk={beforeValues.risk}
            configuration={configuration}
          />
        )}
      </Stack>

      {/* Assessment rationale — why these likelihood/impact factors */}
      <TextField
        size="small"
        fullWidth
        multiline
        rows={2}
        sx={{ mt: 1.5 }}
        label={t("tabs.risks.dialog.riskBeforeRationale", {
          defaultValue:
            "Assessment Rationale — reasoning behind the risk assessment",
        })}
        value={local.riskBeforeRationale}
        onChange={(e) =>
          setLocal((prev) =>
            prev
              ? { ...prev, riskBeforeRationale: e.target.value }
              : prev,
          )
        }
      />

      {/* Factor ratings */}
      <Box
        sx={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t("tabs.risks.dialog.likelihoodFactors", {
              defaultValue: "Likelihood Factors",
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
            {/* ISO: the tree's feasibility is in the panel above. */}
            {!isISO && renderTreeFactorRow(false)}
            {hasTreeIsoFactors &&
              ISO_AP_FACTOR_IDS.map((id) =>
                renderIsoFactorRow(id, false),
              )}
            {likelihoodFactors.map((f) => renderFactorRow(f, false))}
          </Box>
        </Box>

        {impactFactors.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("tabs.risks.dialog.impactFactors", {
                defaultValue: "Impact Factors",
              })}
            </Typography>
            {(() => {
              const line = impactBasisText(
                explainImpact(local?.factorRatings ?? [], configuration),
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
                  data-testid="impact-basis-before"
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
              {impactFactors.map((f) => renderFactorRow(f, false))}
            </Box>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
