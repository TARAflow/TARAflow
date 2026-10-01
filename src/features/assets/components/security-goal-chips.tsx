// ==================== SECURITY-GOAL CHIPS ====================
//
// The security-goal column of the asset table (design doc §4.4): one chip per
// goal with its level and a state marker, so 50 assets can be reviewed without
// opening every dialog. Renders ONLY what goalState() says:
//
//   level     — displayLevel; "?" when the assessment is missing (invariant D:
//               the minimum level is never shown as an ordinary "Low")
//   excluded  — greyed out and struck through, rationale in the tooltip
//               (invariant C: an exclusion is a decision and stays visible)
//   manual    — pen icon (adjusted / added / excluded)
//   marker    — dot for the goal's worst finding (goalFindings — the same
//               source as the findings panel): red = error, amber = warning.
//               Infos stay in the tooltip.

import React from "react";
import { useTranslation } from "react-i18next";
import { Badge, Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { EditNote as ManualIcon } from "@mui/icons-material";

import type { Asset } from "../models/asset-types";
import type { ImpactScaleType } from "../models/asset-impact-types";
import type { SecurityGoal } from "../models/asset-security-goals-types";
import {
  CIANAAA_LEVEL_KEY_PREFIX,
  SECURITY_GOALS,
  SECURITY_GOAL_KEY_PREFIX,
} from "../models/asset-security-goals-types";
import { goalStates, type GoalState } from "../services/asset-goal-state";
import { goalBadges, goalMarker } from "../utils/goal-badges";
import { GOAL_LEVEL_COLOR } from "./security-goal-card";

const ORDER = SECURITY_GOALS.map((g) => g.type);
const MISSING_COLOR = "#d97706";

export interface GoalChipEntry {
  goal: SecurityGoal;
  state: GoalState;
}

/**
 * The goals the table shows: active ones and deliberate exclusions, in the
 * canonical goal order. Goals that are neither (hidden) are left out.
 */
export function goalChipEntries(asset: Asset, impactScale: ImpactScaleType): GoalChipEntry[] {
  const goals = asset.securityGoals ?? [];
  const states = goalStates(asset, impactScale);
  return goals
    .map((goal, i) => ({ goal, state: states[i] }))
    .filter(
      ({ goal, state }) =>
        state.visibility === "excluded" ||
        (state.visibility === "card" && goal.level !== "none"),
    )
    .sort((a, b) => ORDER.indexOf(a.goal.type) - ORDER.indexOf(b.goal.type));
}

export interface SecurityGoalChipsProps {
  asset: Asset;
  impactScale: ImpactScaleType;
}

export const SecurityGoalChips: React.FC<SecurityGoalChipsProps> = ({ asset, impactScale }) => {
  const { t } = useTranslation();
  const entries = goalChipEntries(asset, impactScale);
  if (entries.length === 0) return <Typography color="text.disabled">–</Typography>;

  const levelName = (l: string) => t(`${CIANAAA_LEVEL_KEY_PREFIX}.${l}`);

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
      {entries.map(({ goal, state }) => {
        const excluded = state.visibility === "excluded";
        const missing = !excluded && state.displayLevel === null;
        const manual = state.source === "manual";
        const marker = goalMarker(state, goal);
        const flagged = marker === "error" || marker === "warning";
        const color = excluded
          ? GOAL_LEVEL_COLOR.none
          : missing
            ? MISSING_COLOR
            : GOAL_LEVEL_COLOR[state.displayLevel!];
        const filled = !excluded && !missing;
        const label = excluded
          ? goal.type
          : `${goal.type} · ${missing ? "?" : levelName(state.displayLevel!)}`;
        const badges = goalBadges(state, goal);

        return (
          <Tooltip
            key={goal.type}
            arrow
            placement="top"
            title={
              <Box sx={{ p: 0.5, maxWidth: 260 }}>
                <Typography variant="caption" fontWeight="bold" display="block">
                  {t(`${SECURITY_GOAL_KEY_PREFIX}.${goal.type}.name`, { defaultValue: goal.type })} (
                  {goal.type})
                  {!excluded &&
                    ` · ${
                      missing
                        ? t("tabs.assets.goalCards.assessmentRequired", {
                            defaultValue: "Assessment required",
                          })
                        : levelName(state.displayLevel!)
                    }`}
                </Typography>
                <Typography variant="caption" display="block" color="rgba(255,255,255,0.8)">
                  {badges.map((b) => t(b.key, { defaultValue: b.defaultValue })).join(" · ")}
                </Typography>
                {goal.rationale?.trim() && (
                  <Typography
                    variant="caption"
                    display="block"
                    color="rgba(255,220,0,0.9)"
                    sx={{ mt: 0.5, whiteSpace: "normal" }}
                  >
                    ℹ {goal.rationale}
                  </Typography>
                )}
                {!excluded && goal.formalDescription?.trim() && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, whiteSpace: "normal" }}>
                    {goal.formalDescription}
                  </Typography>
                )}
                {flagged && (
                  <Typography
                    variant="caption"
                    display="block"
                    color={marker === "error" ? "#fca5a5" : "#fcd34d"}
                    sx={{ mt: 0.5, whiteSpace: "normal" }}
                  >
                    {t("tabs.assets.goalChips.needsReview", {
                      defaultValue: "Needs review — see the findings below the table",
                    })}
                  </Typography>
                )}
              </Box>
            }
          >
            <Badge
              variant="dot"
              color={marker === "error" ? "error" : "warning"}
              invisible={!flagged}
              overlap="rectangular"
            >
              <Chip
                data-testid={`goal-chip-${goal.type}`}
                data-state={excluded ? "excluded" : missing ? "missing" : "level"}
                data-marker={marker ?? "none"}
                label={label}
                size="small"
                variant={filled ? "filled" : "outlined"}
                icon={
                  manual ? (
                    <ManualIcon data-testid="goal-chip-manual" sx={{ fontSize: 13 }} />
                  ) : undefined
                }
                sx={{
                  height: 20,
                  fontSize: "0.72rem",
                  fontWeight: manual ? 700 : 500,
                  cursor: "help",
                  borderColor: color,
                  backgroundColor: filled ? color : undefined,
                  color: filled ? "#fff" : color,
                  ...(excluded && { textDecoration: "line-through", opacity: 0.75 }),
                  "& .MuiChip-icon": { color: "inherit", ml: 0.5, mr: -0.25 },
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            </Badge>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
