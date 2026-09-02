// ==================== IMPACT CELL ====================
// Shows per-asset impact chips sorted by criticality.
// One chip per linked asset: AssetID + aggregatedImpact color + safety icon.
// Tooltip shows all 3 contributing values per asset.

import React from "react";
import { Box, Chip, Tooltip, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { Threat } from "../../models/threat-types";
import { AssetReference, type AssetDataReference } from "shared";
import { getImpactColor, getPhysicalImpactColor } from "../../utils/threat-asset-utils";

// ==================== CONSTANTS ====================

const IMPACT_ORDER = ["CRITICAL", "HIGH+", "HIGH", "MED+", "MED", "LOW"];

const PHYSICAL_IMPACT_LABELS: Record<string, string> = {
  fatality: "Fatality",
  irreversible_injury: "Irreversible injury",
  reversible_injury: "Reversible injury",
};

const HVA_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ==================== HELPERS ====================

function impactRank(impact?: string): number {
  if (!impact) return IMPACT_ORDER.length;
  const idx = IMPACT_ORDER.indexOf(impact);
  return idx === -1 ? IMPACT_ORDER.length : idx;
}

function sortAssetsByPriority(assets: AssetReference[]): AssetReference[] {
  return [...assets].sort((a, b) => {
    // Safety first
    const safetyA = a.physicalImpact === "fatality" ? 0
      : a.physicalImpact === "irreversible_injury" ? 1
      : a.physicalImpact === "reversible_injury" ? 2 : 3;
    const safetyB = b.physicalImpact === "fatality" ? 0
      : b.physicalImpact === "irreversible_injury" ? 1
      : b.physicalImpact === "reversible_injury" ? 2 : 3;
    if (safetyA !== safetyB) return safetyA - safetyB;
    // Then aggregatedImpact
    return impactRank(a.aggregatedImpact) - impactRank(b.aggregatedImpact);
  });
}

function AssetTooltip({ asset }: { asset: AssetReference }): React.ReactElement {
  return (
    <Box sx={{ p: 0.5, minWidth: 160 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
      >
        {asset.displayId}: {asset.name}
        {asset.description}
      </Typography>
      {asset.physicalImpact && (
        <Typography
          variant="caption"
          display="block"
          sx={{ color: getPhysicalImpactColor(asset.physicalImpact) }}
        >
          ⚠ Safety: {PHYSICAL_IMPACT_LABELS[asset.physicalImpact]}
        </Typography>
      )}
      {asset.isHighValueAsset && asset.isHighValueAsset !== "low" && (
        <Typography variant="caption" display="block">
          ★ HVA: {HVA_LABELS[asset.isHighValueAsset]}
        </Typography>
      )}
      {asset.aggregatedImpact && (
        <Typography variant="caption" display="block">
          ● Business: {asset.aggregatedImpact}
        </Typography>
      )}
    </Box>
  );
}

// ==================== COMPONENT ====================

export const ImpactCell: React.FC<{
  threat: Threat;
  assetDataRef: AssetDataReference;
}> = ({ threat, assetDataRef }) => {
  if (threat.linkedAssetIds.length === 0) return null;

  const linked = threat.linkedAssetIds
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter((a): a is AssetReference => Boolean(a));

  if (linked.length === 0) return null;

  const sorted = sortAssetsByPriority(linked);

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {sorted.map((asset) => {
        const color = getImpactColor(asset.aggregatedImpact);
        const hasSafety = asset.physicalImpact === "fatality" ||
          asset.physicalImpact === "irreversible_injury";

        return (
          <Tooltip key={asset.id} title={<AssetTooltip asset={asset} />} arrow>
            <Chip
              size="small"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                  {hasSafety && (
                    <WarningAmberIcon
                      sx={{
                        fontSize: 10,
                        color: getPhysicalImpactColor(asset.physicalImpact),
                      }}
                    />
                  )}
                  <span
                    style={{ fontFamily: "monospace", fontSize: "0.65rem" }}
                  >
                    {asset.name}
                  </span>
                  {asset.aggregatedImpact && (
                    <span style={{ fontSize: "0.6rem", fontWeight: 700 }}>
                      {" "}
                      {asset.aggregatedImpact}
                    </span>
                  )}
                </Box>
              }
              sx={{
                height: 20,
                backgroundColor: color + "18",
                borderColor: color,
                border: "1px solid",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};