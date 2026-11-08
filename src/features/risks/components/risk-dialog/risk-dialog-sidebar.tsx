// ==================== RISK DIALOG — RiskDialogSidebar ====================
// Split out of risk-dialog.tsx (MT-2): the risk list on the left (display-id order, before /
// after value per risk, a click switches and saves).

import React from "react";
import type { RiskDialogModel } from "./use-risk-dialog-model";
import { STRIDE_COLORS } from "./local-risk-state";
import { Box, Typography, Chip, Stack, Tooltip, List, ListItemButton, ListItemText } from "@mui/material";
import { isoRiskValueColor, isoRiskValueFallback, isoRiskValueI18nKey } from "../../models/iso-risk-display";
import { getRiskColor, getRiskLabel } from "../../services/risk-calculation-service";
import { useCreditedOf, UncreditedMark } from "../credited-residual-context";

export function RiskDialogSidebar({ m }: { m: RiskDialogModel }) {
  const { t, configuration, sortedRisks, currentIndex, isISO, beforeValues, afterValues, assessedCount, trustBoundaryName, navigateTo, liveIso } = m;
  // The residual risk that counts (multi-project TARA I7 (4)) — before-values when not credited.
  const creditedOf = useCreditedOf();
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      {/* Sidebar header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          fontWeight="medium"
        >
          {trustBoundaryName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {assessedCount}/{sortedRisks.length}{" "}
          {t("tabs.risks.assessed", { defaultValue: "assessed" })}
        </Typography>
      </Box>

      {/* Sidebar list */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List dense disablePadding>
          {sortedRisks.map((risk, index) => {
            const isActive = index === currentIndex;
            // Live values for active risk, stored values for others
            const beforeScore = isActive
              ? beforeValues.risk
              : risk.calculatedRiskBeforeMitigation;
            // ISO/SAE 21434: value 1–5 with its word instead of I × L (3a-2, 136).
            const iso = isISO ? (isActive ? liveIso : risk.isoRisk) : undefined;
            const credited = creditedOf(
              isActive
                ? {
                    ...risk,
                    calculatedRiskBeforeMitigation: beforeValues.risk,
                    calculatedRiskAfterMitigation: afterValues.risk,
                    isoRisk: liveIso,
                  }
                : risk,
            );
            const afterScore = credited.riskAfter;
            const isoWord = (v: number) =>
              t(isoRiskValueI18nKey(v), { defaultValue: isoRiskValueFallback(v) });
            const before = isISO
              ? {
                  show: true,
                  label: iso ? `${iso.value} ${isoWord(iso.value)}` : "–",
                  color: isoRiskValueColor(iso?.value),
                  tip: iso ? `${iso.value} · ${isoWord(iso.value)}` : "",
                }
              : {
                  show: true,
                  label: beforeScore > 0 ? beforeScore.toFixed(1) : "–",
                  color: getRiskColor(beforeScore, configuration),
                  tip: beforeScore > 0 ? getRiskLabel(beforeScore, configuration) : "",
                };
            const residualValue = isISO ? credited.isoResidual?.value : undefined;
            const after = isISO
              ? {
                  show: !!residualValue,
                  label: residualValue ? `${residualValue} ${isoWord(residualValue)}` : "",
                  color: isoRiskValueColor(residualValue),
                  tip: residualValue ? `${residualValue} · ${isoWord(residualValue)}` : "",
                }
              : {
                  show: afterScore > 0,
                  label: afterScore.toFixed(1),
                  color: getRiskColor(afterScore, configuration),
                  tip: getRiskLabel(afterScore, configuration),
                };
            const uncertain = risk.threatRelevance === "uncertain";
            return (
              <ListItemButton
                key={risk.id}
                selected={isActive}
                ref={(node) => {
                  if (node && isActive) {
                    requestAnimationFrame(() =>
                      node.scrollIntoView({
                        block: "nearest",
                        behavior: "auto",
                      }),
                    );
                  }
                }}
                onClick={() => navigateTo(index)}
                sx={{
                  py: 0.75,
                  px: 1.5,
                  borderLeft: "3px solid transparent",
                  "&.Mui-selected": {
                    bgcolor: "primary.50",
                    borderLeftColor: "primary.main",
                  },
                  "&.Mui-selected:hover": { bgcolor: "primary.100" },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                    mr: 0.75,
                    flexShrink: 0,
                  }}
                >
                  <Tooltip
                    title={before.tip}
                    placement="right"
                    arrow
                  >
                    <Chip
                      label={before.label}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: 10,
                        bgcolor: before.color,
                        color: "white",
                        fontWeight: "bold",
                        minWidth: 32,
                      }}
                    />
                  </Tooltip>
                  {after.show ? (
                    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
                      <Tooltip
                        title={`${t("tabs.risks.dialog.residualRisk", { defaultValue: "Residual Risk" })}: ${after.tip}`}
                        placement="right"
                      >
                        <Chip
                          label={after.label}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: 10,
                            bgcolor: after.color,
                            color: "white",
                            opacity: 0.85,
                            minWidth: 32,
                          }}
                        />
                      </Tooltip>
                      <UncreditedMark credited={credited} />
                    </Box>
                  ) : uncertain ? (
                    <Chip
                      label="?"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: 10,
                        bgcolor: "#fffbeb",
                        color: "#d97706",
                        border: "1px solid #d97706",
                      }}
                    />
                  ) : (
                    <Chip
                      label="–"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: 10,
                        bgcolor: "grey.200",
                        color: "text.disabled",
                        minWidth: 32,
                      }}
                    />
                  )}
                </Box>
                <ListItemText
                  primary={
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                    >
                      <Chip
                        label={risk.strideCategory}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: 10,
                          bgcolor: STRIDE_COLORS[risk.strideCategory],
                          color: "white",
                        }}
                      />
                      <Typography variant="caption" noWrap>
                        {risk.threatDisplayId}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: "block" }}
                    >
                      {risk.threatDescription || "—"}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}
