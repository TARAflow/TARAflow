import React from "react";
// ==================== RISK COLUMNS ====================
// Column definitions for Risk MUI Table.
// Uses RiskColumn[] instead of GridColDef[] — no DataGrid dependency.

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Stack,
  Tooltip,
  Typography,
  FormControl,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";
import {
  Risk,
  RiskConfiguration,
  MoSCoWPriority,
  RiskStatus,
  MOSCOW_PRIORITIES,
  RISK_STATUSES,
  RISK_TREATMENTS,
  getFactorDefinition,
} from "../../models/risk-types";
import {
  getRiskColor,
  getRiskLabel,
} from "../../services/risk-calculation-service";
import { resolveMitigationDrafts } from "../../../threats/services/threat-catalog-service";
import type { StrideCategory } from "shared";

// ==================== COLUMN TYPE ====================

export interface RiskColumn {
  id: string;
  header: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  align?: "left" | "center" | "right";
  renderCell: (risk: Risk) => React.ReactNode;
}

// ==================== CONSTANTS ====================

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

const TREATMENT_MAP = new Map(RISK_TREATMENTS.map((tr) => [tr.value, tr]));

// ── Stable sub-components (defined outside hook to prevent re-mounting) ──────

interface FactorTooltipContentProps {
  lines: string;
  label: string | null;
  color: string | null;
}

const FactorTooltipContent: React.FC<FactorTooltipContentProps> = ({
  lines,
  label,
  color,
}) => (
  <Box sx={{ whiteSpace: "pre-line" }}>
    <Typography variant="caption" fontWeight="bold" display="block" mb={0.5}>
      Factor Breakdown
    </Typography>
    {lines}
    {label && (
      <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid rgba(255,255,255,0.3)" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: color ?? "grey.400",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          />
          <Typography variant="caption" fontWeight="bold">
            {label}
          </Typography>
        </Stack>
      </Box>
    )}
  </Box>
);

interface RiskChipProps {
  value: number;
  scale: string;
  rounding: string;
  tooltipLines: string;
  tooltipLabel: string | null;
  tooltipColor: string | null;
}

const RiskChipCell: React.FC<RiskChipProps> = ({
  value,
  scale,
  rounding,
  tooltipLines,
  tooltipLabel,
  tooltipColor,
}) => (
  <Tooltip
    title={
      <FactorTooltipContent
        lines={tooltipLines}
        label={tooltipLabel}
        color={tooltipColor}
      />
    }
    arrow
  >
    <Chip
      label={value > 0 ? value.toFixed(1) : "–"}
      size="small"
      sx={{
        bgcolor: getRiskColor(value, scale as any, rounding as any),
        color: "white",
        fontWeight: "bold",
        cursor: "help",
        minWidth: 40,
      }}
    />
  </Tooltip>
);

// ==================== HOOK ====================

interface UseRiskColumnsProps {
  configuration: RiskConfiguration;
  onEdit: (risk: Risk, groupRisks?: Risk[]) => void;
  /** All risks in the current group — passed to dialog for sidebar navigation */
  groupRisks?: Risk[];
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string,
  ) => void;
  onStatusChange: (riskId: string, status: string) => void;
  onTreatmentChange: (riskId: string, treatment: string) => void;
}

export const useRiskColumns = ({
  configuration,
  onEdit,
  groupRisks,
  onPriorityChange,
  onStatusChange,
  onTreatmentChange,
}: UseRiskColumnsProps): RiskColumn[] => {
  const { t } = useTranslation();

  return useMemo(() => {
    // ── Factor breakdown tooltip helper ────────────────────────────────────
    const factorTooltip = (risk: Risk, mitigated = false) => {
      const ratings = mitigated
        ? risk.mitigatedFactorRatings
        : risk.factorRatings;
      const value = mitigated
        ? risk.calculatedRiskAfterMitigation
        : risk.calculatedRiskBeforeMitigation;
      if (!ratings?.length)
        return {
          lines: t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" }),
          value,
          color: null,
          label: null,
        };
      const lines = ratings
        .map((r) => {
          const def = getFactorDefinition(
            r.factorId,
            configuration.customFactors,
          );
          if (!def) return null;
          return `${def.name}: ${r.value > 0 ? r.value.toFixed(1) : "-"}`;
        })
        .filter(Boolean)
        .join("\n");
      return {
        lines,
        value,
        color: getRiskColor(
          value,
          configuration.scale,
          configuration.roundingMethod,
        ),
        label: getRiskLabel(
          value,
          configuration.scale,
          configuration.roundingMethod,
        ),
      };
    };

    // ── Risk score chip — uses stable RiskChipCell defined outside hook ────────
    // (inline component definitions inside useMemo cause React to re-mount on every render)

    // ── Base columns ────────────────────────────────────────────────────────
    const cols: RiskColumn[] = [
      {
        id: "threatId",
        header: t("tabs.risks.columns.threatId", { defaultValue: "T-ID" }),
        width: 80,
        renderCell: (risk) => (
          <Tooltip title={risk.threatId} placement="top">
            <Chip
              label={risk.threatId}
              size="small"
              sx={{
                bgcolor: STRIDE_COLORS[risk.strideCategory] ?? "#9ca3af",
                color: "white",
                fontWeight: "bold",
                fontSize: "0.7rem",
                maxWidth: 100,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          </Tooltip>
        ),
      },
      {
        id: "threatDescription",
        header: t("tabs.risks.columns.threat", { defaultValue: "Threat" }),
        flex: 1,
        minWidth: 120,
        renderCell: (risk) => (
          <Tooltip title={risk.threatDescription ?? ""}>
            <Typography
              variant="body2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.8rem",
              }}
            >
              {risk.threatDescription || "–"}
            </Typography>
          </Tooltip>
        ),
      },
    ];

    // ── Risk before ─────────────────────────────────────────────────────────
    // if (configuration.method === "simple") {
    //   cols.push({
    //     id: "riskBefore",
    //     header: t("tabs.risks.columns.riskBefore", {
    //       defaultValue: "Risk (Before)",
    //     }),
    //     width: 80,
    //     align: "center",
    //     renderCell: (risk) => {
    //       const d = factorTooltip(risk, false);
    //       return (
    //         <RiskChipCell
    //           value={risk.calculatedRiskBeforeMitigation}
    //           scale={configuration.scale}
    //           rounding={configuration.roundingMethod}
    //           tooltipLines={d.lines}
    //           tooltipLabel={d.label}
    //           tooltipColor={d.color}
    //         />
    //       );
    //     },
    //   });
    // } else {
    cols.push(
      {
        id: "impact",
        header: t("tabs.risks.columns.impact", { defaultValue: "Impact" }),
        width: 80,
        align: "center",
        renderCell: (risk) => {
          const d = factorTooltip(risk, false);
          return (
            <RiskChipCell
              value={risk.calculatedImpact}
              scale={configuration.scale}
              rounding={configuration.roundingMethod}
              tooltipLines={d.lines}
              tooltipLabel={d.label}
              tooltipColor={d.color}
            />
          );
        },
      },
      {
        id: "likelihood",
        header: t("tabs.risks.columns.likelihood", {
          defaultValue: "Likelihood",
        }),
        width: 80,
        align: "center",
        renderCell: (risk) => {
          const d = factorTooltip(risk, false);
          return (
            <RiskChipCell
              value={risk.calculatedLikelihood}
              scale={configuration.scale}
              rounding={configuration.roundingMethod}
              tooltipLines={d.lines}
              tooltipLabel={d.label}
              tooltipColor={d.color}
            />
          );
        },
      },
      {
        id: "riskBefore",
        header: t("tabs.risks.columns.riskBefore", { defaultValue: "Risk" }),
        width: 80,
        align: "center",
        renderCell: (risk) => {
          const d = factorTooltip(risk, false);
          return (
            <RiskChipCell
              value={risk.calculatedRiskBeforeMitigation}
              scale={configuration.scale}
              rounding={configuration.roundingMethod}
              tooltipLines={d.lines}
              tooltipLabel={d.label}
              tooltipColor={d.color}
            />
          );
        },
      },
    );
    //}

    // ── Mitigation ──────────────────────────────────────────────────────────
    cols.push({
      id: "mitigation",
      header: t("tabs.risks.columns.mitigation", {
        defaultValue: "Mitigation",
      }),
      flex: 0.5,
      minWidth: 100,
      renderCell: (risk) => {
        if (!risk.selectedMitigations.length)
          return (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ fontSize: "0.8rem" }}
            >
              –
            </Typography>
          );

        // Resolve full text from catalog (same approach as threat-tables)
        const selected =
          risk.proposedMitigations?.filter((m) =>
            risk.selectedMitigations.includes(m.id ?? m.notes ?? ""),
          ) ?? [];
        const resolved = resolveMitigationDrafts(selected);
        const lines =
          resolved.length > 0
            ? resolved.map((m) =>
                m.isCustom ? `[custom] ${m.notes ?? ""}` : `${m.id}: ${m.text}`,
              )
            : risk.selectedMitigations;

        const displayText = lines[0] ?? "";
        const tooltipText = lines.join("\n");

        return (
          <Tooltip
            title={
              <Box sx={{ whiteSpace: "pre-line", maxWidth: 360 }}>
                {tooltipText}
              </Box>
            }
            placement="top"
          >
            <Typography
              variant="body2"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.8rem",
              }}
            >
              {lines.length > 1
                ? `${displayText} (+${lines.length - 1})`
                : displayText}
            </Typography>
          </Tooltip>
        );
      },
    });

    // ── Risk after ──────────────────────────────────────────────────────────
    cols.push({
      id: "riskAfter",
      header: t("tabs.risks.columns.riskAfter", {
        defaultValue: "Risk (After)",
      }),
      width: 80,
      align: "center",
      renderCell: (risk) => {
        if (!risk.calculatedRiskAfterMitigation)
          return (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ fontSize: "0.8rem" }}
            >
              –
            </Typography>
          );
        const d = factorTooltip(risk, true);
        return (
          <RiskChipCell
            value={risk.calculatedRiskAfterMitigation}
            scale={configuration.scale}
            rounding={configuration.roundingMethod}
            tooltipLines={d.lines}
            tooltipLabel={d.label}
            tooltipColor={d.color}
          />
        );
      },
    });

    // ── Treatment ────────────────────────────────────────────────────────────
    cols.push({
      id: "treatment",
      header: t("tabs.risks.columns.treatment", { defaultValue: "Treatment" }),
      flex: 0.5,
      width: 100,
      renderCell: (risk) => {
        const tr = TREATMENT_MAP.get(risk.treatment);
        if (!tr) return null;
        const label = t(`risks.treatment.${risk.treatment}.label`, {
          defaultValue: tr.label,
        });
        return (
          <Tooltip
            title={t(`risks.treatment.${risk.treatment}.description`, {
              defaultValue: tr.description,
            })}
          >
            <Chip
              label={label}
              size="small"
              sx={{
                bgcolor: tr.color,
                color: "white",
                fontSize: "0.65rem",
                height: 20,
                cursor: "default",
              }}
            />
          </Tooltip>
        );
      },
    });

    // ── MoSCoW priority (inline select) ────────────────────────────────────
    cols.push({
      id: "moscowPriority",
      header: t("tabs.risks.columns.priority", { defaultValue: "Priority" }),
      width: 120,
      renderCell: (risk) => (
        <FormControl size="small" fullWidth>
          <Select
            value={risk.moscowPriority}
            onChange={(e) => onPriorityChange(risk.id, e.target.value)}
            size="small"
            sx={{ fontSize: "0.75rem", "& .MuiSelect-select": { py: 0.5 } }}
          >
            {MOSCOW_PRIORITIES.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                <Chip
                  label={t(`risks.moscow.${p.value}.label`, {
                    defaultValue: p.label,
                  })}
                  size="small"
                  sx={{ bgcolor: p.color, color: "white", fontSize: "0.65rem" }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    });

    // ── Status (inline select) ──────────────────────────────────────────────
    cols.push({
      id: "status",
      header: t("tabs.risks.columns.status", { defaultValue: "Status" }),
      width: 120,
      renderCell: (risk) => (
        <FormControl size="small" fullWidth>
          <Select
            value={risk.status}
            onChange={(e) => onStatusChange(risk.id, e.target.value)}
            size="small"
            sx={{ fontSize: "0.75rem", "& .MuiSelect-select": { py: 0.5 } }}
          >
            {RISK_STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                <Chip
                  label={t(`risks.status.${s.value.replace("-", "_")}.label`, {
                    defaultValue: s.label,
                  })}
                  size="small"
                  sx={{ bgcolor: s.color, color: "white", fontSize: "0.65rem" }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    });

    // ── Actions ─────────────────────────────────────────────────────────────
    cols.push({
      id: "actions",
      header: "",
      width: 40,
      align: "center",
      renderCell: (risk) => (
        <Tooltip title={t("common.edit", { defaultValue: "Edit" })}>
          <IconButton size="small" onClick={() => onEdit(risk, groupRisks)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    });

    return cols;
  }, [
    configuration,
    t,
    onEdit,
    groupRisks,
    onPriorityChange,
    onStatusChange,
    onTreatmentChange,
  ]);
};