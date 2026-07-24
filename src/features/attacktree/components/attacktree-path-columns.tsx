// src/features/attacktree/components/attacktree-path-columns.tsx
//
// Column definitions for the attack-path table, against the shared DataTable.
//
// The Risk tab's useRiskColumns is the model: the generic table lives in
// shared, the columns live with the feature that knows what a row means. Here a
// row is an AttackPath — a ROOT→leaf chain — not a node and not a threat.
//
// WHY RELEVANCE IS NOT ONE CONTROL PER ROW
// ----------------------------------------
// A decision is keyed by (pathKey, strideCategory), not by path: ATTACK_GOAL_TO_STRIDE
// maps `destruction` onto BOTH T and D, so such a path yields two threats that
// may violate different security goals and need different controls. One toggle
// per row would silently merge two decisions. So the relevance cell renders one
// control per STRIDE category the path attacks — usually one, two for destruction.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Link,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import type { DataColumn, ThreatRelevanceRef } from "shared";
import {
  AttackPath,
  EvaluationMethod,
  MitigationReference,
  MITIGATION_VERIFICATION_DISPLAY,
  calculateRiskLevel,
  getRiskScoreEmoji,
} from "../models/attacktree-types";
import type {
  FeasibilityLevel,
  LikelihoodModel,
} from "../models/attacktree-feasibility-types";
import type { AttackPathAssessment } from "../models/attacktree-types";
import { setPathAssessment } from "../services/attacktree-threat-sync";
import { strideCategoriesForPath } from "../services/attacktree-threat-generator";

// ==================== ROW BACKGROUND ====================

/**
 * Row tint by feasibility, mirroring the Risk table's tint by risk score:
 * same visual language, driven by the quantity this table is about.
 * An unrated path stays neutral — it must not read as "safe".
 */
const FEASIBILITY_ROW_BG: Record<FeasibilityLevel, string> = {
  "very-low": "#f0fdf4", // green
  low: "#fefce8", // yellow
  medium: "#fff7ed", // orange
  high: "#fef2f2", // red
};

export function getPathRowBackground(path: AttackPath): string {
  if (!path.feasibilityLevel) return "transparent";
  return FEASIBILITY_ROW_BG[path.feasibilityLevel] ?? "transparent";
}

// ==================== OPTIONS ====================

export interface AttackTreePathColumnsOptions {
  evaluationMethod: EvaluationMethod;
  /**
   * Mitigation id (UPPERCASE) → reference, mirrored from the Risk tab. Absent
   * means mitigations render as plain id chips.
   */
  mitigationLookup?: Map<string, MitigationReference>;
  /**
   * The project's likelihood model — the actual mode switch (it is what the ISO
   * chip in the Overview tab binds to), not an invented boolean.
   *
   * "feasibility-only" (ISO 21434) hides the path risk score: there the number
   * belongs to the risk, not to the path — risk is feasibility × impact
   * (Cl. 3.1.29) and impact lives on the damage scenario, not in the tree.
   * "feasibility-x-motivation" (IEC 62443 / classic) keeps it: the tree's own
   * score is the working quantity there.
   */
  likelihoodModel?: LikelihoodModel;
  /**
   * Relevance editing. All three must be present for the column to appear —
   * without a tree id a decision cannot be attributed.
   */
  treeId?: string;
  assessments?: AttackPathAssessment[];
  onAssessmentsChange?: (next: AttackPathAssessment[]) => void;
}

const RELEVANCE_OPTIONS: ThreatRelevanceRef[] = [
  "relevant",
  "not_relevant",
  "uncertain",
];

/** Read-only rendering — confirmed stands out, unrated stays quiet. */
const RELEVANCE_COLOR: Record<
  ThreatRelevanceRef,
  "default" | "success" | "warning"
> = {
  unrated: "default",
  relevant: "success",
  not_relevant: "default",
  uncertain: "warning",
};

// ==================== HOOK ====================

export function useAttackTreePathColumns({
  evaluationMethod,
  mitigationLookup,
  likelihoodModel = "feasibility-only",
  treeId,
  assessments,
  onAssessmentsChange,
}: AttackTreePathColumnsOptions): DataColumn<AttackPath>[] {
  const { t, i18n } = useTranslation();

  const relevanceLabel: Record<ThreatRelevanceRef, string> = React.useMemo(
    () => ({
      unrated: t("attacktree:tabs.attacktree.threatTable.unrated"),
      relevant: t("attacktree:tabs.attacktree.threatTable.confirmed"),
      not_relevant: t("attacktree:tabs.attacktree.threatTable.dismissed"),
      uncertain: t("attacktree:tabs.attacktree.threatTable.uncertain"),
    }),
    [i18n.language, t],
  );

  const renderMitigationChip = React.useCallback(
    (mid: string): React.ReactNode => {
      const ref = mitigationLookup?.get(mid.toUpperCase());
      const display = ref?.status
        ? MITIGATION_VERIFICATION_DISPLAY[ref.status]
        : undefined;

      const statusLabel = ref?.status
        ? t(`attacktree:tabs.attacktree.mitigationStatus.${ref.status}`)
        : t("attacktree:tabs.attacktree.mitigationStatus.notTracked");

      // No catalogue entry means the DSL references an id that does not exist
      // — the validator already reports it as mitigationNotFound. Saying so
      // here stops it from reading like a known measure with no description.
      const tooltip = ref ? (
        <Box sx={{ whiteSpace: "pre-line" }}>
          {ref.description ? `${mid}: ${ref.description}\n` : `${mid}\n`}
          {t("attacktree:tabs.attacktree.tableview.verificationLabel")}
          {statusLabel}
          {ref.ticketId ? `\nTicket: ${ref.ticketId}` : ""}
        </Box>
      ) : (
        <Box sx={{ whiteSpace: "pre-line" }}>
          {t("attacktree:tabs.attacktree.tableview.mitigationUnknown", {
            id: mid,
            defaultValue:
              '"{{id}}" is not in the mitigation catalogue. Either the id in the DSL is wrong, or the measure has not been created yet.',
          })}
        </Box>
      );

      return (
        <Tooltip key={mid} title={tooltip} placement="top">
          <Chip
            label={
              <Box
                component="span"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
              >
                {display && <span>{display.icon}</span>}
                <span>{mid}</span>
                {ref?.ticketId && ref?.ticketUrl && (
                  <Link
                    href={ref.ticketUrl}
                    target="_blank"
                    rel="noopener"
                    underline="hover"
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.65rem",
                      ml: 0.25,
                    }}
                  >
                    {ref.ticketId}
                  </Link>
                )}
                {ref?.ticketId && !ref?.ticketUrl && (
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.65rem",
                      ml: 0.25,
                      color: "text.secondary",
                    }}
                  >
                    {ref.ticketId}
                  </Box>
                )}
              </Box>
            }
            size="small"
            variant="outlined"
            color={ref ? "default" : "warning"}
            sx={
              display
                ? { borderColor: display.color, color: display.color }
                : undefined
            }
          />
        </Tooltip>
      );
    },

    [mitigationLookup, t],
  );

  // Two levels: the column appears as soon as decisions can be SHOWN, and
  // becomes interactive only when there is somewhere to write them back to.
  // The overview wants the status without turning a card into an editor.
  const showRelevance = Boolean(treeId && assessments);
  const canRate = Boolean(showRelevance && onAssessmentsChange);

  return React.useMemo(() => {
    const columns: DataColumn<AttackPath>[] = [];

    // ── Path chain ────────────────────────────────────────────────────────
    columns.push({
      id: "path",
      header: t("attacktree:tabs.attacktree.tableview.attackPath"),
      flex: 1,
      minWidth: 260,
      renderCell: (path) => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          {path.path.map((node, idx) => (
            <Box
              key={idx}
              sx={{
                pl: idx * 1.5,
                fontSize: "0.75rem",
                color: idx === 0 ? "primary.main" : "text.primary",
                fontWeight: idx === 0 ? 600 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {idx > 0 && "└─ "}
              {node}
            </Box>
          ))}
        </Box>
      ),
    });

    // ── Feasibility ───────────────────────────────────────────────────────
    columns.push({
      id: "feasibility",
      header: t("attacktree:tabs.attacktree.tableview.feasibility", {
        defaultValue: "Feasibility",
      }),
      width: 120,
      align: "center",
      renderCell: (path) =>
        path.feasibilityLevel ? (
          <Chip
            label={t(
              `attacktree:tabs.attacktree.feasibility.level.${path.feasibilityLevel}`,
            )}
            size="small"
            variant="outlined"
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t("attacktree:tabs.attacktree.threatTable.unrated")}
          </Typography>
        ),
    });

    // ── Risk score — 62443 / classic only ─────────────────────────────────
    if (likelihoodModel === "feasibility-x-motivation") {
      columns.push({
        id: "riskScore",
        header: t("attacktree:tabs.attacktree.tableview.riskScore"),
        width: 110,
        align: "center",
        renderCell: (path) => {
          const result = calculateRiskLevel(path.riskScore, evaluationMethod);
          return (
            <Chip
              label={`${result.score.toFixed(1)} ${getRiskScoreEmoji(result.level)}`}
              size="small"
              sx={{
                backgroundColor: result.color,
                color: "white",
                fontWeight: "bold",
              }}
            />
          );
        },
      });
    }

    // ── Mitigations ───────────────────────────────────────────────────────
    columns.push({
      id: "mitigations",
      header: t("attacktree:tabs.attacktree.tableview.mitigations"),
      width: 200,
      renderCell: (path) => (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {path.mitigations.length > 0 ? (
            path.mitigations.map((mid) => renderMitigationChip(mid))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("attacktree:tabs.attacktree.tableview.none")}
            </Typography>
          )}
        </Box>
      ),
    });

    // ── Critical marker ───────────────────────────────────────────────────
    columns.push({
      id: "status",
      header: t("attacktree:tabs.attacktree.tableview.status"),
      width: 90,
      align: "center",
      renderCell: (path) =>
        path.isCritical ? (
          <Chip
            label={t("attacktree:tabs.attacktree.tableview.critical3")}
            size="small"
            color="error"
          />
        ) : null,
    });

    // ── Relevance — one control per STRIDE category ───────────────────────
    if (showRelevance) {
      columns.push({
        id: "relevance",
        header: t("attacktree:tabs.attacktree.threatTable.relevance"),
        width: 260,
        align: "center",
        stopRowClick: true,
        renderCell: (path) => {
          const categories = strideCategoriesForPath(path);

          if (categories.length === 0) {
            return (
              <Tooltip
                title={t("attacktree:tabs.attacktree.tableview.noGoalHint", {
                  defaultValue:
                    "No attack goal declared — this path cannot become a threat.",
                })}
              >
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              </Tooltip>
            );
          }

          return (
            <Stack spacing={0.5} alignItems="center">
              {categories.map((stride) => {
                const current =
                  assessments!.find(
                    (a) =>
                      a.pathKey === path.pathKey && a.strideCategory === stride,
                  )?.relevance ?? "unrated";

                return (
                  <Stack
                    key={stride}
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                  >
                    {categories.length > 1 && (
                      <Chip label={stride} size="small" sx={{ height: 18 }} />
                    )}
                    {canRate ? (
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={current}
                        onChange={(_e, next) =>
                          onAssessmentsChange!(
                            setPathAssessment(
                              assessments!,
                              path.pathKey,
                              stride,
                              (next as ThreatRelevanceRef | null) ?? "unrated",
                            ),
                          )
                        }
                      >
                        {RELEVANCE_OPTIONS.map((opt) => (
                          <ToggleButton
                            key={opt}
                            value={opt}
                            aria-label={relevanceLabel[opt]}
                            sx={{ py: 0, px: 0.75, fontSize: "0.65rem" }}
                          >
                            {relevanceLabel[opt]}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    ) : (
                      <Chip
                        label={relevanceLabel[current]}
                        size="small"
                        variant={current === "unrated" ? "outlined" : "filled"}
                        color={RELEVANCE_COLOR[current]}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          );
        },
      });
    }

    return columns;
  }, [
    t,
    likelihoodModel,
    evaluationMethod,
    renderMitigationChip,
    showRelevance,
    canRate,
    assessments,
    onAssessmentsChange,
    relevanceLabel,
  ]);
}