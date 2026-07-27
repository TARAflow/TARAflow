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
  IconButton,
} from "@mui/material";
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from "@mui/icons-material";
import type { DataColumn, StrideCategory, ThreatRelevanceRef } from "shared";
import { RELEVANCE_COLORS } from "shared";
import {
  AttackPath,
  EvaluationMethod,
  MitigationReference,
  MITIGATION_VERIFICATION_DISPLAY,
} from "../models/attacktree-types";
import type { LikelihoodModel } from "../models/attacktree-feasibility-types";
import type { AttackPathAssessment } from "../models/attacktree-types";
import { setPathAssessment } from "../services/attacktree-threat-sync";
import { strideCategoriesForPath } from "../services/attacktree-threat-generator";

// ==================== OPTIONS ====================

export interface AttackTreePathColumnsOptions {
  evaluationMethod: EvaluationMethod;
  /**
   * Mitigation id (UPPERCASE) → reference, mirrored from the Risk tab. Absent
   * means mitigations render as plain id chips.
   */
  mitigationLookup?: Map<string, MitigationReference>;
  mitigationCatalog?: readonly { id: string; text: string }[];
  verificationCatalog?: readonly { id: string; text: string }[];
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

  /**
   * Threat-anchored trees only — lets the analyst pick which path keeps
   * feeding the anchor threat's likelihood, so every OTHER path reaching
   * the same effect (anchorStrideCategory) can become its own threat once
   * confirmed. See AttackTree.primaryPathKey's doc comment. All three must
   * be present for the column to appear; without anchorStrideCategory there
   * is nothing to compare a path's STRIDE categories against.
   */
  anchorStrideCategory?: StrideCategory;
  primaryPathKey?: string;
  onSetPrimaryPath?: (pathKey: string) => void;
  /**
   * Suggestion only, never persisted — the most feasible unassigned path
   * reaching anchorStrideCategory, shown as an outlined "suggested" star
   * until the analyst actually clicks one. Ignored once primaryPathKey is
   * set (it wins outright — see the renderCell below).
   */
  suggestedPrimaryPathKey?: string;
}

const RELEVANCE_OPTIONS: ThreatRelevanceRef[] = [
  "relevant",
  "not_relevant",
  "uncertain",
];

// ==================== HOOK ====================

export function useAttackTreePathColumns({
  mitigationLookup,
  mitigationCatalog,
  verificationCatalog,
  treeId,
  assessments,
  onAssessmentsChange,
  anchorStrideCategory,
  primaryPathKey,
  onSetPrimaryPath,
  suggestedPrimaryPathKey,
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

  const catalogText = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of mitigationCatalog ?? []) m.set(c.id, c.text);
    for (const c of verificationCatalog ?? []) m.set(c.id, c.text);
    return m;
  }, [mitigationCatalog, verificationCatalog]);

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

  // Threat-anchored trees only — see AttackTree.primaryPathKey. Shown as
  // soon as the tree has a STRIDE category to compare against (so the
  // overview can display which path is primary); interactive only when
  // there is somewhere to write the choice back to.
  const showPrimary = Boolean(anchorStrideCategory);
  const canSetPrimary = Boolean(showPrimary && onSetPrimaryPath);

  return React.useMemo(() => {
    const columns: DataColumn<AttackPath>[] = [];

    // ── Path chain ────────────────────────────────────────────────────────
    columns.push({
      id: "path",
      header: t("attacktree:tabs.attacktree.tableview.attackPath"),
      flex: 1,
      minWidth: 180,
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
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Chip
              label={t(
                `attacktree:tabs.attacktree.feasibility.level.${path.feasibilityLevel}`,
              )}
              size="small"
              variant="outlined"
            />
            {path.feasibility != null && (
              <Typography variant="caption" color="text.secondary">
                {path.feasibility.toFixed(2)}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t("attacktree:tabs.attacktree.threatTable.unrated")}
          </Typography>
        ),
    });

    // ── Risk score — the path's own score, read straight off the path (same
    //    value the dialog shows). Populated by the tree's likelihood pass; shown
    //    in BOTH modes. Empty (—) when 0 / unrated. NOTE: this is the tree's own
    //    score, NOT the impact-inclusive register value — if the latter is ever
    //    wanted here, thread `risks` (RiskReference[]) and look it up by
    //    buildThreatId; kept out for now to avoid the extra plumbing.
    columns.push({
      id: "riskScore",
      header: t("attacktree:tabs.attacktree.tableview.riskScore"),
      width: 110,
      align: "center",
      renderCell: (path) =>
        path.riskScore > 0 ? (
          <Chip
            label={path.riskScore.toFixed(1)}
            size="small"
            sx={{ fontWeight: "bold" }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            —
          </Typography>
        ),
    });

    // ── Mitigations ───────────────────────────────────────────────────────
    columns.push({
      id: "mitigations",
      header: t("attacktree:tabs.attacktree.tableview.mitigations"),
      minWidth: 400,
      renderCell: (path) => {
        const forPath =
          assessments?.filter((a) => a.pathKey === path.pathKey) ?? [];
        const mitIds = [
          ...new Set(forPath.flatMap((a) => a.mitigationIds ?? [])),
        ];
        const verIds = [
          ...new Set(forPath.flatMap((a) => a.verificationIds ?? [])),
        ];
        const hasAny =
          path.mitigations.length > 0 || mitIds.length > 0 || verIds.length > 0;
        return (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {path.mitigations.map((mid) => renderMitigationChip(mid))}
            {mitIds.map((id) => (
              <Chip
                key={`m-${id}`}
                size="small"
                label={catalogText.get(id) ?? id}
              />
            ))}
            {verIds.map((id) => (
              <Chip
                key={`v-${id}`}
                size="small"
                variant="outlined"
                color="info"
                label={catalogText.get(id) ?? id}
              />
            ))}
            {!hasAny && (
              <Typography variant="body2" color="text.secondary">
                {t("attacktree:tabs.attacktree.tableview.none")}
              </Typography>
            )}
          </Box>
        );
      },
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

    // ── Primary path (threat-anchored trees only) ──────────────────────────
    // See AttackTree.primaryPathKey. Only meaningful for paths that reach the
    // anchor's own STRIDE effect — a path that doesn't (e.g. the D side of a
    // `destruction` path under a Tampering anchor) gets no control at all,
    // since it was never a candidate for this tree's threat in the first
    // place (attacktree-threat-generator.ts).
    if (showPrimary) {
      columns.push({
        id: "primary",
        header: t("attacktree:tabs.attacktree.tableview.primary", {
          defaultValue: "Primary",
        }),
        width: 90,
        align: "center",
        stopRowClick: true,
        renderCell: (path) => {
          if (!strideCategoriesForPath(path).includes(anchorStrideCategory!)) {
            return null;
          }

          const isPrimary = path.pathKey === primaryPathKey;
          const isSuggested =
            !isPrimary && path.pathKey === suggestedPrimaryPathKey;

          const label = isPrimary
            ? t("attacktree:tabs.attacktree.tableview.primaryPathHint", {
                defaultValue: "This path feeds the anchor threat's likelihood.",
              })
            : isSuggested
              ? t(
                  "attacktree:tabs.attacktree.tableview.suggestedPrimaryPathHint",
                  {
                    defaultValue:
                      "Suggested: the most feasible path to this effect. Click to make it primary.",
                  },
                )
              : t("attacktree:tabs.attacktree.tableview.setPrimaryPathHint", {
                  defaultValue:
                    "Make this the path that feeds the anchor threat's likelihood. Every other path to the same effect can then become its own threat once confirmed.",
                });

          const goldColor = "#FFD700";
          const goldDimmed = "rgba(255, 215, 0, 0.6)"; // suggestion, not decision

          return (
            <Tooltip title={label}>
              <span>
                <IconButton
                  size="small"
                  // No `disabled` here on purpose: MUI's disabled state
                  // overrides any sx color with its own grey (.Mui-disabled
                  // has higher specificity), which is why the star always
                  // showed grey — in the Overview EVERY star was disabled
                  // (no onSetPrimaryPath there), and even the primary star in
                  // the Table view lost its gold the same way. A no-op click
                  // achieves the same "nothing happens" without that CSS.
                  onClick={() => {
                    if (canSetPrimary && !isPrimary) {
                      onSetPrimaryPath!(path.pathKey);
                    }
                  }}
                  sx={{
                    cursor: canSetPrimary && !isPrimary ? "pointer" : "default",
                  }}
                >
                  {isPrimary ? (
                    // htmlColor sets a real inline style={{color}}, which
                    // beats any stylesheet rule (including MUI's own
                    // .Mui-disabled / theme overrides) — sx with !important
                    // still wasn't winning, so this is the mechanism MUI
                    // provides specifically for "must always be this colour".
                    <StarIcon fontSize="small" htmlColor={goldColor} />
                  ) : (
                    <StarBorderIcon
                      fontSize="small"
                      htmlColor={isSuggested ? goldDimmed : undefined}
                    />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      });
    }

    // ── Relevance — one control per STRIDE category ───────────────────────
    if (showRelevance) {
      columns.push({
        id: "relevance",
        header: t("attacktree:tabs.attacktree.threatTable.relevance"),
        width: 260,
        align: "center",
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
                        sx={{
                          "& .Mui-selected": {
                            color: "#fff !important",
                            bgcolor: `${RELEVANCE_COLORS[current]} !important`,
                          },
                        }}
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
                        sx={
                          current === "unrated"
                            ? undefined
                            : {
                                bgcolor: RELEVANCE_COLORS[current],
                                color: "#fff",
                              }
                        }
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
    catalogText,
    renderMitigationChip,
    showRelevance,
    canRate,
    assessments,
    onAssessmentsChange,
    relevanceLabel,
    showPrimary,
    canSetPrimary,
    anchorStrideCategory,
    primaryPathKey,
    onSetPrimaryPath,
    suggestedPrimaryPathKey,
  ]);
}