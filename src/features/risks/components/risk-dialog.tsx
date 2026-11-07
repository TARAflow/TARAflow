// ==================== RISK DIALOG ====================
// Tabbed evaluation dialog with sidebar navigation.
// Same visual language as ThreatEvalDialog.
//
// Tab 1 — Risk Before:   Factor ratings, calculated score
// Tab 2 — Mitigations:   Checkbox selection, treatment, priority, status
// Tab 3 — Risk After:    Re-rate factors post-mitigation
// Tab 4 — Goal / Claim:  only with a concept writer (onConceptChange)
//
// Sidebar: All risks in the current accordion group, in display-id order.
// Prev/Next navigation, auto-save on switch, uncertain warning.
//
// Split into parts (MT-2, components/risk-dialog/): the state hooks
// (useRiskDialogModel composes them), the factor rows, the ISO notes, the
// side list and one file per tab. This file renders the frame: header, side
// list, tab bar, the selected tab, footer.

import React from "react";
import type { RiskDialogProps } from "./risk-dialog/types";
import { useRiskDialogModel } from "./risk-dialog/use-risk-dialog-model";
import { RiskDialogSidebar } from "./risk-dialog/risk-dialog-sidebar";
import { RiskBeforeTab } from "./risk-dialog/risk-before-tab";
import { RiskMitigationsTab } from "./risk-dialog/risk-mitigations-tab";
import { RiskAfterTab } from "./risk-dialog/risk-after-tab";
import { STRIDE_COLORS } from "./risk-dialog/local-risk-state";
import { RiskGoalClaimTab } from "./risk-goal-claim-tab";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Stack, IconButton, Tabs, Tab, Alert } from "@mui/material";
import { NavigateBefore as PrevIcon, NavigateNext as NextIcon, Warning as WarningIcon } from "@mui/icons-material";

export type { RiskDialogProps } from "./risk-dialog/types";

export const RiskDialog: React.FC<RiskDialogProps> = (props) => {
  const m = useRiskDialogModel(props);
  if (!m) return null;
  const { t, open, risks, assetDataRef, onClose, concept, onConceptChange, allRisks, assumptions, isoMode, sortedRisks, currentRisk, currentIndex, tabValue, setTabValue, local, handlePrev, handleNext, isUncertain } = m;

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: "85vh",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{ py: 1.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            label={currentRisk.strideCategory}
            size="small"
            sx={{
              bgcolor: STRIDE_COLORS[currentRisk.strideCategory],
              color: "white",
              fontWeight: "bold",
            }}
          />
          <Typography
            variant="body2"
            fontFamily="monospace"
            color="text.secondary"
          >
            {currentRisk.threatDisplayId}
          </Typography>
          <Typography
            variant="subtitle1"
            fontWeight="medium"
            sx={{ flexGrow: 1 }}
            noWrap
          >
            {currentRisk.threatDescription}
          </Typography>
          {isUncertain && (
            <Chip
              icon={<WarningIcon />}
              label={t("tabs.risks.uncertain", { defaultValue: "Uncertain" })}
              size="small"
              color="warning"
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
          flexGrow: 1,
        }}
      >
        <RiskDialogSidebar m={m} />

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Uncertain warning */}
          {isUncertain && (
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{ mx: 2, mt: 1.5, flexShrink: 0 }}
            >
              {t("tabs.risks.uncertainRiskWarning", {
                defaultValue:
                  "This risk is based on an uncertain threat. Please confirm its relevance in the Threat Eval tab before finalizing the risk assessment.",
              })}
            </Alert>
          )}

          {/* Tabs */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
              px: 2,
            }}
          >
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
              <Tab
                label={t("tabs.risks.dialog.tabBefore", {
                  defaultValue: "Risk Before",
                })}
              />
              <Tab
                label={t("tabs.risks.dialog.tabMitigations", {
                  defaultValue: "Mitigations",
                })}
              />
              <Tab
                label={t("tabs.risks.dialog.tabAfter", {
                  defaultValue: "Risk After",
                })}
              />
              {onConceptChange && (
                <Tab
                  data-testid="risk-tab-goal-claim"
                  label={t("tabs.risks.dialog.tabGoalClaim", {
                    defaultValue: "Goal / Claim",
                  })}
                />
              )}
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1.5 }}>
            {/* ══ TAB 1: RISK BEFORE ══════════════════════════════════════ */}
            {tabValue === 0 && <RiskBeforeTab m={m} />}

            {/* ══ TAB 2: MITIGATIONS ══════════════════════════════════════ */}
            {tabValue === 1 && <RiskMitigationsTab m={m} />}

            {/* ══ TAB 3: RISK AFTER ═══════════════════════════════════════ */}
            {tabValue === 2 && <RiskAfterTab m={m} />}

            {/* ══ TAB 4: GOAL / CLAIM (ISO 21434 9.4, decision 25) ═════════ */}
            {tabValue === 3 && onConceptChange && (
              <RiskGoalClaimTab
                risk={currentRisk}
                treatment={local.treatment}
                treatmentJustification={local.treatmentJustification}
                allRisks={allRisks ?? risks}
                concept={concept}
                onConceptChange={onConceptChange}
                assetDataRef={assetDataRef}
                assumptions={assumptions}
                isoMode={isoMode}
              />
            )}
          </Box>
        </Box>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <PrevIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {currentIndex + 1}/{sortedRisks.length}
          </Typography>
          <IconButton
            size="small"
            onClick={handleNext}
            disabled={currentIndex === sortedRisks.length - 1}
          >
            <NextIcon />
          </IconButton>
        </Stack>
        <Button variant="contained" onClick={onClose}>
          {t("common.ok", { defaultValue: "OK" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RiskDialog;
