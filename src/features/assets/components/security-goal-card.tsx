// ==================== SECURITY GOAL CARD ====================
//
// One card per security goal in the asset dialog (design doc §4.2). Renders
// ONLY what goalState() says — it never builds its own conditions. Every
// change of a decision goes through the explicit actions of asset-goal-state
// (wired by the dialog via the callbacks below).
//
//   collapsed: goal · level · state badges · the line that explains the level
//   expanded : why this goal? · why this level? · changed-suggestion block ·
//              level selector · rationale (when manual) · requirement ·
//              consequence · actions

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
} from "@mui/icons-material";

import type { ImpactRating } from "../models/asset-impact-types";
import {
  CAUSE_MECHANISM_KEY_PREFIX,
  CIANAAA_LEVEL_KEY_PREFIX,
  SECURITY_GOAL_KEY_PREFIX,
  type CIANAAALevel,
  type SecurityGoal,
  type StaleReason,
} from "../models/asset-security-goals-types";
import type { GoalState } from "../services/asset-goal-state";
import { severityFor } from "../services/asset-goal-state";
import {
  goalMechanism,
  goalRelevantCriteria,
} from "../services/asset-cianaaa-deriver";

export const GOAL_LEVEL_COLOR: Record<CIANAAALevel, string> = {
  none: "#9ca3af",
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const SELECTABLE: Exclude<CIANAAALevel, "none">[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const K = "tabs.assets.goalCards";

/** Width of the trailing action slot (the template button of the requirement field). */
const TRAILING_SLOT = 40;

/**
 * One text field per row, all the same width: every row reserves the
 * trailing slot the requirement field uses for its template button.
 */
const FieldRow: React.FC<{ children: React.ReactNode; trailing?: React.ReactNode }> = ({
  children,
  trailing,
}) => (
  <Box sx={{ display: "flex", gap: 1, alignItems: "start", mb: 1 }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    <Box sx={{ width: TRAILING_SLOT, flexShrink: 0, display: "flex", justifyContent: "center" }}>
      {trailing}
    </Box>
  </Box>
);

export interface SecurityGoalCardProps {
  goal: SecurityGoal;
  state: GoalState;
  impactRatings: ImpactRating[];
  criterionName: (criterionId: string) => string;
  assetDisplayName: string;
  /** Mark the rationale field (manual decision without rationale on save). */
  rationaleError?: boolean;
  defaultExpanded?: boolean;
  onLevel: (level: Exclude<CIANAAALevel, "none">) => void;
  onExclude: () => void;
  onKeep: () => void;
  onReset: () => void;
  onRationale: (text: string) => void;
  onDescription: (text: string) => void;
  onConsequence: (text: string) => void;
  onUseTemplate: () => void;
}

/** Which rationale question applies — derived, not stored (design §4.1). */
export function rationalePrompt(
  state: GoalState,
): "adjusted" | "excluded" | "added" | null {
  if (!state.rationaleRequired) return null;
  if (state.visibility === "excluded") return "excluded";
  return state.suggestion.suggested ? "adjusted" : "added";
}

const STALE_KEY: Record<StaleReason, string> = {
  "suggestion-removed": "suggestionRemoved",
  "suggestion-added": "suggestionAdded",
  "level-raised": "levelRaised",
  "level-lowered": "levelLowered",
  "basis-changed": "basisChanged",
};

export const SecurityGoalCard: React.FC<SecurityGoalCardProps> = ({
  goal,
  state,
  impactRatings,
  criterionName,
  assetDisplayName,
  rationaleError = false,
  defaultExpanded = false,
  onLevel,
  onExclude,
  onKeep,
  onReset,
  onRationale,
  onDescription,
  onConsequence,
  onUseTemplate,
}) => {
  const { t } = useTranslation();
  const needsAttention =
    !!state.stale ||
    state.assessment === "missing" ||
    rationaleError ||
    (state.rationaleRequired && !goal.rationale?.trim());
  const [open, setOpen] = useState(defaultExpanded || needsAttention);
  // A card that starts needing attention while mounted (e.g. a changed
  // suggestion after an impact edit, or a failed save) opens by itself.
  useEffect(() => {
    if (needsAttention) setOpen(true);
  }, [needsAttention]);

  const excluded = state.visibility === "excluded";
  const manual = state.source === "manual";
  const levelName = (l: CIANAAALevel) => t(`${CIANAAA_LEVEL_KEY_PREFIX}.${l}`);
  const mechanism = goalMechanism(state.type);
  const reason = state.levelReason;
  const staleSeverity = state.stale
    ? severityFor(state.stale, goal.level === "none")
    : null;
  const prompt = rationalePrompt(state);
  const rationaleMissing = !!prompt && !goal.rationale?.trim();

  // ── The one line that explains the level ─────────────────────────────────
  const driverLine = (() => {
    switch (reason.kind) {
      case "mechanism":
        return t(`${K}.driver.mechanism`, {
          criterion: criterionName(reason.criterionId),
          value: reason.value,
          defaultValue: "Driver: {{criterion}} = {{value}}",
        });
      case "fallback":
        return t(`${K}.driver.fallback`, {
          criterion: criterionName(reason.criterionId),
          value: reason.value,
          defaultValue:
            "Provisional: no goal-specific criterion rated, highest is {{criterion}} = {{value}}",
        });
      case "not-applicable":
        return t(`${K}.driver.notApplicable`, {
          defaultValue: "No applicable damage — all relevant criteria n/a",
        });
      case "floor":
        return t(`${K}.driver.floor`, {
          defaultValue: "No impact rated yet",
        });
    }
  })();

  // ── Badges ───────────────────────────────────────────────────────────────
  const sourceLabel = excluded
    ? t(`${K}.source.excluded`, { defaultValue: "Excluded" })
    : manual
      ? state.suggestion.suggested
        ? t(`${K}.source.adjusted`, { defaultValue: "Adjusted" })
        : t(`${K}.source.added`, { defaultValue: "Added" })
      : state.source === "legacy"
        ? t(`${K}.source.legacy`, { defaultValue: "Earlier decision" })
        : t(`${K}.source.suggested`, { defaultValue: "Suggested" });

  const chip = (label: string, color: string, variant: "filled" | "outlined" = "outlined") => (
    <Chip
      label={label}
      size="small"
      variant={variant}
      sx={{
        height: 18,
        fontSize: "0.65rem",
        borderColor: color,
        color: variant === "filled" ? "white" : color,
        backgroundColor: variant === "filled" ? color : undefined,
        "& .MuiChip-label": { px: 0.75 },
        flexShrink: 0,
      }}
    />
  );

  return (
    <Paper
      variant="outlined"
      data-testid={`goal-card-${state.type}`}
      sx={{
        mb: 1,
        borderLeft: 3,
        borderLeftColor: excluded
          ? GOAL_LEVEL_COLOR.none
          : state.displayLevel
            ? GOAL_LEVEL_COLOR[state.displayLevel]
            : "#f59e0b",
        opacity: excluded ? 0.75 : 1,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.5, py: 1, cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight="medium" sx={{ flexShrink: 0 }}>
              {t(`${SECURITY_GOAL_KEY_PREFIX}.${state.type}.name`)} ({state.type})
            </Typography>
            {excluded
              ? null
              : state.displayLevel
                ? chip(levelName(state.displayLevel), GOAL_LEVEL_COLOR[state.displayLevel], "filled")
                : chip(
                    t(`${K}.assessmentRequired`, { defaultValue: "Assessment required" }),
                    "#d97706",
                    "filled",
                  )}
            {chip(sourceLabel, manual ? "#1d4ed8" : "#7c3aed")}
            {!manual && state.assessment === "provisional" &&
              chip(t(`${K}.provisional`, { defaultValue: "provisional" }), "#0284c7")}
            {!manual && state.assessment === "no-applicable-impact" &&
              chip(t(`${K}.minimumLevel`, { defaultValue: "minimum level" }), "#6b7280")}
            {state.stale &&
              chip(
                staleSeverity === "warning"
                  ? t(`${K}.stale.review`, { defaultValue: "Review" })
                  : t(`${K}.stale.changed`, { defaultValue: "Suggestion changed" }),
                staleSeverity === "warning" ? "#d97706" : "#0284c7",
              )}
            {rationaleMissing &&
              chip(t(`${K}.rationaleMissing`, { defaultValue: "Rationale missing" }), "#dc2626")}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {manual && !excluded
              ? `${t(`${K}.suggestionLabel`, {
                  level: state.suggestion.suggested ? levelName(state.suggestion.level) : "—",
                  defaultValue: "Suggestion: {{level}}",
                })} · ${driverLine}`
              : driverLine}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={open ? "collapse" : "expand"}
          sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* ── Details ────────────────────────────────────────────────────── */}
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          {/* Changed suggestion */}
          {state.stale && (
            <Box
              sx={{
                mb: 1.5,
                p: 1,
                borderRadius: 1,
                backgroundColor: staleSeverity === "warning" ? "#fef3c7" : "#e0f2fe",
              }}
            >
              <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>
                {t(`${K}.staleMsg.${STALE_KEY[state.stale]}`, {
                  level: levelName(state.suggestion.level),
                  defaultValue: "The suggestion has changed since this decision.",
                })}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={onKeep}>
                  {t(`${K}.actions.keep`, { defaultValue: "Keep decision" })}
                </Button>
                <Button size="small" onClick={onReset}>
                  {t(`${K}.actions.adoptSuggestion`, { defaultValue: "Adopt suggestion" })}
                </Button>
              </Stack>
            </Box>
          )}

          {/* Why this goal? | Why this level? — side by side */}
          <Box
            data-testid="goal-card-reasons"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              columnGap: 2,
              rowGap: 1,
              p: 1,
              mb: 1.5,
              borderRadius: 1,
              backgroundColor: "action.hover",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight="bold" sx={{ display: "block" }}>
                {t(`${K}.whyGoal`, { defaultValue: "Why this goal?" })}
              </Typography>
              {state.suggestion.suggested ? (
                state.suggestionReasons.map((r) => (
                  <Typography key={r} variant="caption" sx={{ display: "block", pl: 1 }}>
                    {r}
                  </Typography>
                ))
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: 1 }}>
                  {t(`${K}.notSuggested`, {
                    defaultValue: "Not suggested by the DFD relations — added manually.",
                  })}
                </Typography>
              )}
              {mechanism && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: 1 }}>
                  {t(`${K}.violation`, { defaultValue: "Violation" })}:{" "}
                  {t(`${CAUSE_MECHANISM_KEY_PREFIX}.${mechanism}.label`)}
                </Typography>
              )}
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight="bold" sx={{ display: "block" }}>
                {t(`${K}.whyLevel`, { defaultValue: "Why this level?" })}
              </Typography>
              <Box sx={{ pl: 1 }}>
                {goalRelevantCriteria(state.type).map((cid) => {
                  const r = impactRatings.find((x) => x.criterionId === cid);
                  if (!r) return null;
                  const isDriver =
                    (reason.kind === "mechanism" || reason.kind === "fallback") &&
                    reason.criterionId === cid;
                  const value = r.value === "na" ? "n/a" : r.value ? String(r.value) : "—";
                  return (
                    <Typography
                      key={cid}
                      variant="caption"
                      sx={{ display: "block", fontWeight: isDriver ? "bold" : "normal" }}
                    >
                      {isDriver ? "● " : "○ "}
                      {criterionName(cid)} = {value}
                      {isDriver ? " ←" : ""}
                    </Typography>
                  );
                })}
                {reason.kind === "fallback" && (
                  <Typography variant="caption" sx={{ display: "block", fontWeight: "bold" }}>
                    ● {criterionName(reason.criterionId)} = {reason.value} ←
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {driverLine}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Level selector (not for excluded goals) */}
          {!excluded && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                value={goal.level}
                exclusive
                size="small"
                onChange={(_, lvl: Exclude<CIANAAALevel, "none"> | null) => {
                  if (lvl && lvl !== goal.level) onLevel(lvl);
                }}
              >
                {SELECTABLE.map((lvl) => (
                  <ToggleButton
                    key={lvl}
                    value={lvl}
                    sx={{
                      fontSize: "0.65rem",
                      py: 0.25,
                      px: 1,
                      "&.Mui-selected, &.Mui-selected:hover": {
                        backgroundColor: GOAL_LEVEL_COLOR[lvl],
                        color: "white",
                        fontWeight: "bold",
                      },
                    }}
                  >
                    {levelName(lvl)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {manual && state.suggestion.suggested && (
                <Typography variant="caption" color="text.secondary">
                  {t(`${K}.suggestionLabel`, {
                    level: levelName(state.suggestion.level),
                    defaultValue: "Suggestion: {{level}}",
                  })}
                </Typography>
              )}
            </Stack>
          )}

          {/* Rationale — required for every manual decision */}
          {prompt && (
            <FieldRow>
            <TextField
              label={t(`${K}.rationale.${prompt}`, {
                defaultValue:
                  prompt === "excluded"
                    ? "Why is this security goal not relevant for this asset?"
                    : prompt === "added"
                      ? "Why is this security goal needed in addition?"
                      : "Why does the suggested level not fit?",
              })}
              value={goal.rationale ?? ""}
              onChange={(e) => onRationale(e.target.value)}
              error={rationaleMissing && rationaleError}
              helperText={
                rationaleMissing
                  ? t(`${K}.rationaleRequired`, { defaultValue: "Required for a manual decision" })
                  : undefined
              }
              required
              fullWidth
              multiline
              minRows={1}
              size="small"
            />
            </FieldRow>
          )}

          {!excluded && (
            <>
              {/* Formal requirement */}
              <FieldRow
                trailing={
                  <Tooltip title={t("tabs.assets.dialog.useTemplate", { defaultValue: "Use template" })}>
                    <IconButton onClick={onUseTemplate} size="small">
                      <LightbulbIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <TextField
                  label={t("tabs.assets.dialog.formalDescription", {
                    defaultValue: "Formal Security Requirement",
                  })}
                  value={goal.formalDescription ?? ""}
                  onChange={(e) => onDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  placeholder={t(`${SECURITY_GOAL_KEY_PREFIX}.${state.type}.template`, {
                    assetName: assetDisplayName,
                  })}
                />
              </FieldRow>

              {/* Damage consequence — all modes (design §4.2) */}
              <FieldRow>
              <TextField
                label={t("tabs.assets.dialog.consequence", {
                  defaultValue: "Damage Scenario — Consequence",
                })}
                value={goal.consequence ?? ""}
                onChange={(e) => onConsequence(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder={t("tabs.assets.dialog.consequencePlaceholder", {
                  defaultValue:
                    "Adverse consequence of compromising this property — e.g. 'location disclosure enables physical stalking'.",
                })}
              />
              </FieldRow>
            </>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {manual && !state.stale && (
              <Button size="small" onClick={onReset}>
                {excluded
                  ? t(`${K}.actions.reactivate`, { defaultValue: "Reactivate (suggestion)" })
                  : state.suggestion.suggested
                    ? t(`${K}.actions.adoptSuggestion`, { defaultValue: "Adopt suggestion" })
                    : t(`${K}.actions.remove`, { defaultValue: "Remove goal" })}
              </Button>
            )}
            {!excluded && state.suggestion.suggested && (
              <Button size="small" color="warning" onClick={onExclude}>
                {t(`${K}.actions.exclude`, { defaultValue: "Not relevant for this asset" })}
              </Button>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
