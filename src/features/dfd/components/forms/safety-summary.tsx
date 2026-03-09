// ==================== SAFETY SUMMARY ====================
// Shared component: displays safety annotations per asset relation.
// Used by ElementFormShell (Tab 2) for all element forms that support
// asset relations with safety annotations.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import {
  Shield as ShieldIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import type { AssetRelation } from "../../models/dfd-types";
import { isIsAnRelation, hasQualifier } from "../../models/asset-relation-types";
import type { AvailableAsset } from "./asset-relation-selector";

// ==================== CONSTANTS ====================

const IMPACT_ORDER = [
  "fatality",
  "irreversible_injury",
  "reversible_injury",
  "none",
] as const;

const IMPACT_COLOR: Record<string, "error" | "warning" | "default"> = {
  fatality: "error",
  irreversible_injury: "error",
  reversible_injury: "warning",
  none: "default",
};

const RELEVANCE_COLOR: Record<string, "error" | "warning" | "default"> = {
  direct: "error",
  indirect: "warning",
  none: "default",
};

// ==================== PROPS ====================

export interface SafetySummaryProps {
  assetRelations: AssetRelation[];
  availableAssets: AvailableAsset[];
}

// ==================== COMPONENT ====================

export const SafetySummary: React.FC<SafetySummaryProps> = ({
  assetRelations,
  availableAssets,
}) => {
  const { t } = useTranslation();

  const safetyRels = assetRelations.filter(
    (r) => !isIsAnRelation(r) && r.safety && r.safety.relevance !== "none",
  );

  if (safetyRels.length === 0) return null;

  const byAsset = new Map<string, AssetRelation[]>();
  for (const r of safetyRels) {
    byAsset.set(r.assetId, [...(byAsset.get(r.assetId) ?? []), r]);
  }

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="subtitle2" color="text.secondary">
          {t("tabs.dfd.element_description.safetyAnnotation.title", {
            defaultValue: "Safety Annotations",
          })}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {[...byAsset.entries()].map(([assetId, rels]) => {
          const asset = availableAssets.find((a) => a.id === assetId);
          const worstImpact =
            IMPACT_ORDER.find((lvl) =>
              rels.some((r) => r.safety?.impact === lvl),
            ) ?? "none";
          const hasDirect = rels.some((r) => r.safety?.relevance === "direct");

          return (
            <Paper key={assetId} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 100 }}>
                  {asset ? `${asset.displayId} · ${asset.name}` : assetId}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, flex: 1 }}>
                  {rels.map((r) => {
                    const qualifier = hasQualifier(r) ? `[${r.qualifier}]` : "";
                    const relevance = r.safety!.relevance;
                    const impact = r.safety?.impact;
                    return (
                      <Stack key={r.relationType} direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={`${r.relationType}${qualifier}`}
                          size="small"
                          sx={{ fontFamily: "monospace", fontSize: 10 }}
                        />
                        <Chip
                          icon={<WarningAmberIcon sx={{ fontSize: 11 }} />}
                          label={relevance}
                          size="small"
                          color={RELEVANCE_COLOR[relevance] ?? "default"}
                          variant="outlined"
                        />
                        {impact && impact !== "none" && (
                          <Chip
                            label={impact.replace(/_/g, " ")}
                            size="small"
                            color={IMPACT_COLOR[impact] ?? "default"}
                            variant="filled"
                          />
                        )}
                        {r.safety?.rationale && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={r.safety.rationale}
                          >
                            — {r.safety.rationale}
                          </Typography>
                        )}
                      </Stack>
                    );
                  })}
                </Box>
                {(hasDirect || worstImpact === "fatality" || worstImpact === "irreversible_injury") && (
                  <Chip
                    label={hasDirect ? "DIRECT" : worstImpact.replace(/_/g, " ").toUpperCase()}
                    size="small"
                    color="error"
                    sx={{ fontWeight: 700, fontSize: 10 }}
                  />
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};
