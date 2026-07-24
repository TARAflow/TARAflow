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
  MOSCOW_PRIORITIES,
  RISK_TREATMENTS,
} from "../../models/risk-scale-types";
import { RiskConfiguration } from "../../models/risk-config-types";
import { Risk, getFactorDefinition } from "../../models/risk-assessment-types";
import {
  MITIGATION_STATUS_CONFIGS,
  ImplementationProgress,
  deriveImplementationProgress,
} from "../../models/risk-mitigation-types";
import {
  getRiskColor,
  getRiskLabel,
} from "../../services/risk-calculation-service";
import { resolveMitigationDrafts } from "../../../threats/services/threat-catalog-service";
import type { StrideCategory, DataColumn } from "shared";

// ==================== COLUMN TYPE ====================

// ── Implementation progress display config (UI-only) ──────────────────────
const IMPLEMENTATION_DISPLAY: Record<
  ImplementationProgress,
  { label: string; color: string; icon: string }
> = {
  open: { label: "Open", color: "#9ca3af", icon: "⚪" },
  not_started: { label: "Not Started", color: "#9ca3af", icon: "⚪" },
  in_progress: { label: "In Progress", color: "#3b82f6", icon: "🔵" },
  in_review: { label: "In Review", color: "#7c3aed", icon: "🟣" },
  partial: { label: "Partial", color: "#f97316", icon: "🟡" },
  implemented: { label: "Implemented", color: "#22c55e", icon: "🟢" },
  verified: { label: "Verified", color: "#16a34a", icon: "✅" },
  rejected: { label: "Rejected", color: "#ef4444", icon: "🔴" },
};

/**
 * A risk table column.
 *
 * The contract itself is generic and lives in shared (DataColumn<T>) so the
 * Attack Tree tab can define its own columns against the same table. This alias
 * keeps every existing reference to RiskColumn working.
 */
export type RiskColumn = DataColumn<Risk>;

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
  groupRisks?: Risk[];
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string,
  ) => void;
  onTreatmentChange: (riskId: string, treatment: string) => void;
  /** Opens the RiskMitigationStatusDialog for the clicked risk */
  onImplementationClick?: (risk: Risk) => void;
  readOnly?: boolean;
  showJustification?: boolean;
}

export const useRiskColumns = ({
  configuration,
  onEdit,
  groupRisks,
  onPriorityChange,
  onTreatmentChange,
  onImplementationClick,
  readOnly = false,
  showJustification = false,
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
            risk.selectedMitigations.some(
              (s) => s.id === (m.id ?? m.notes ?? ""),
            ),
          ) ?? [];
        const resolved = resolveMitigationDrafts(selected);

        const lines =
          resolved.length > 0
            ? resolved.map((m) =>
                m.isCustom ? `[custom] ${m.notes ?? ""}` : `${m.id}: ${m.text}`,
              )
            : risk.selectedMitigations.map((s) => s.id ?? "");

        const displayText = lines[0] ?? "";
        const tooltipLines = lines.map((text, idx) => {
          const mitigation = risk.selectedMitigations[idx];
          const status = mitigation?.status ?? "open";
          return `${text} [${status}]`;
        });
        const tooltipText = tooltipLines.join("\n");

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

    // ── MoSCoW priority (inline select or read-only chip) ──────────────────
    cols.push({
      id: "moscowPriority",
      header: t("tabs.risks.columns.priority", { defaultValue: "Priority" }),
      width: 120,
      align: "center" as const,
      renderCell: (risk) => {
        const current = MOSCOW_PRIORITIES.find(
          (p) => p.value === risk.moscowPriority,
        );
        if (readOnly) {
          return (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Chip
                label={t(`risks.moscow.${risk.moscowPriority}.label`, {
                  defaultValue: current?.label ?? risk.moscowPriority,
                })}
                size="small"
                sx={{
                  bgcolor: current?.color ?? "#6b7280",
                  color: "white",
                  fontSize: "0.65rem",
                }}
              />
            </Box>
          );
        }
        return (
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
                    sx={{
                      bgcolor: p.color,
                      color: "white",
                      fontSize: "0.65rem",
                    }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      },
    });

    // ── Implementation Status (derived, clickable) ──────────────────────────
    cols.push({
      id: "implementation",
      header: t("tabs.risks.columns.implementation", {
        defaultValue: "Implementation",
      }),
      width: 140,
      align: "center" as const,
      stopRowClick: true,
      onCellClick:
        onImplementationClick && !readOnly ? onImplementationClick : undefined,
      renderCell: (risk) => {
        const impl = deriveImplementationProgress(risk.selectedMitigations);
        const config = IMPLEMENTATION_DISPLAY[impl];

        return (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Tooltip
              placement="top"
              slotProps={{ tooltip: { sx: { maxWidth: 500 } } }}
              title={
                <Box>
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    gutterBottom
                    display="block"
                  >
                    {config.label}
                  </Typography>
                  <Stack spacing={0.5}>
                    {risk.selectedMitigations.map((m) => {
                      const draft = risk.proposedMitigations?.find(
                        (p) => p.id === m.id,
                      );
                      const id = m.id ?? "custom";
                      const text = draft?.isCustom
                        ? `[custom] ${draft.notes ?? ""}`
                        : (draft?.text ?? "");
                      const shortText =
                        text.length > 50 ? text.slice(0, 50) + "…" : text;
                      const statusConf = MITIGATION_STATUS_CONFIGS.find(
                        (s) => s.value === m.status,
                      );
                      const icon = statusConf?.icon ?? "⚪";
                      const statusColor = statusConf?.color ?? "#9ca3af";
                      return (
                        <Stack
                          key={id}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              minWidth: 70,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {id}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {shortText}
                          </Typography>
                          {/* Ticket key if linked */}
                          {m.ticketId && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: "monospace",
                                fontSize: "0.65rem",
                                color: "#93c5fd",
                                flexShrink: 0,
                              }}
                            >
                              {m.ticketId}
                            </Typography>
                          )}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.25,
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: statusColor,
                                flexShrink: 0,
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ whiteSpace: "nowrap", color: statusColor }}
                            >
                              {icon} {m.status}
                            </Typography>
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              }
            >
              <Chip
                label={`${config.icon} ${t(
                  `risks.implementation.${impl}.label`,
                  { defaultValue: config.label },
                )}`}
                size="small"
                sx={{
                  bgcolor: config.color,
                  color: "white",
                  fontSize: "0.65rem",
                  cursor:
                    onImplementationClick && !readOnly ? "pointer" : "default",
                  "&:hover":
                    onImplementationClick && !readOnly
                      ? { filter: "brightness(0.9)" }
                      : {},
                }}
              />
            </Tooltip>
          </Box>
        );
      },
    });

    // ── Justification (Won't table only) ───────────────────────────────────
    if (showJustification) {
      cols.push({
        id: "justification",
        header: t("tabs.risks.columns.justification", {
          defaultValue: "Justification",
        }),
        flex: 1,
        minWidth: 180,
        renderCell: (risk) => {
          const text = risk.wontJustification?.trim();
          const missing = !text;
          return (
            <Tooltip title={text ?? ""} placement="top">
              <Typography
                variant="body2"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "0.8rem",
                  color: missing ? "error.main" : "text.primary",
                  fontStyle: missing ? "italic" : "normal",
                }}
              >
                {missing
                  ? t("tabs.risks.noJustification", {
                      defaultValue: "Missing justification!",
                    })
                  : text}
              </Typography>
            </Tooltip>
          );
        },
      });
    }

    // ── Assessment Rationale (Before / After chips; tooltip per chip) ───────
    cols.push({
      id: "assessmentRationale",
      header: t("tabs.risks.columns.assessmentRationale", {
        defaultValue: "Rationale",
      }),
      width: 130,
      align: "center",
      renderCell: (risk) => {
        const before = risk.riskBeforeRationale?.trim();
        const after = risk.riskAfterRationale?.trim();
        // Empty when neither rationale exists — no placeholder noise.
        if (!before && !after) return null;
        return (
          <Stack
            direction="row"
            spacing={0.5}
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
          >
            {before && (
              <Tooltip title={before} placement="top">
                <Chip
                  label={t("tabs.risks.rationaleBefore", {
                    defaultValue: "Before",
                  })}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, height: 20 }}
                />
              </Tooltip>
            )}
            {after && (
              <Tooltip title={after} placement="top">
                <Chip
                  label={t("tabs.risks.rationaleAfter", {
                    defaultValue: "After",
                  })}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, height: 20 }}
                />
              </Tooltip>
            )}
          </Stack>
        );
      },
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
    onTreatmentChange,
    onImplementationClick,
    readOnly,
    showJustification,
  ]);
};