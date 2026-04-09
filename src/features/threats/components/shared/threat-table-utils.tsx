// ==================== THREAT TABLE SHARED COMPONENTS ====================
// Reusable cell renderers and sort helpers for per-element and per-interaction tables.

import React from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  STRIDE_DEFINITIONS,
  THREAT_ACTORS,
  type Threat,
  type AssetDataReference,
  type AssetReference,
} from "../../models/threat-types";
import {
  getImpactColor,
  getPhysicalImpactColor,
  getThreatPriority,
} from "../../utils/threat-asset-utils";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";

// ==================== SORT TYPES ====================

export type ThreatSortField = "id" | "strideCategory" | "priority";
export type SortDir = "asc" | "desc";

export function sortThreats(
  threats: Threat[],
  field: ThreatSortField,
  dir: SortDir,
  assetDataRef?: AssetDataReference,
): Threat[] {
  return [...threats].sort((a, b) => {
    let cmp = 0;
    if (field === "id") {
      cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
    } else if (field === "strideCategory") {
      const order = ["S", "T", "R", "I", "D", "E"];
      cmp = order.indexOf(a.strideCategory) - order.indexOf(b.strideCategory);
    } else {
      // priority: lower number = higher priority
      cmp = getThreatPriority(a, assetDataRef) - getThreatPriority(b, assetDataRef);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ==================== CELL RENDERERS ====================

export const ThreatIdCell: React.FC<{ id: string }> = ({ id }) => (
  <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem" noWrap>
    {id}
  </Typography>
);

export const StrideCell: React.FC<{ cat: StrideCategory; isGerman: boolean }> = ({
  cat,
  isGerman,
}) => {
  const def = STRIDE_DEFINITIONS.find((s) => s.type === cat);
  const name = isGerman ? def?.nameDE : def?.name;
  return (
    <Tooltip title={name || cat}>
      <Chip
        label={cat}
        size="small"
        sx={{
          backgroundColor: STRIDE_COLORS[cat],
          color: "white",
          fontWeight: "bold",
          fontSize: "0.7rem",
          height: 20,
        }}
      />
    </Tooltip>
  );
};

export const DescriptionCell: React.FC<{
  value?: string;
  fallback: string;
}> = ({ value, fallback }) => {
  if (!value)
    return <em style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{fallback}</em>;
  return (
    <Tooltip title={value}>
      <Typography
        variant="body2"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: "0.8rem",
        }}
      >
        {value}
      </Typography>
    </Tooltip>
  );
};

export const MissingChip: React.FC<{ label: string }> = ({ label }) => (
  <Chip label={label} size="small" color="warning" variant="outlined" />
);

export const ActorCell: React.FC<{
  actor: string;
  isGerman: boolean;
}> = ({ actor, isGerman }) => {
  const def = THREAT_ACTORS.find((a) => a.type === actor);
  const name = isGerman ? def?.nameDE : def?.name;
  return (
    <Chip
      label={name || actor}
      size="small"
      variant="outlined"
      color={actor === "external" ? "error" : "default"}
      sx={{ fontSize: "0.7rem", height: 20 }}
    />
  );
};

export const SafetyCell: React.FC<{
  threat: Threat;
  assetDataRef: AssetDataReference;
}> = ({ threat, assetDataRef }) => {
  const linked = threat.linkedAssetIds
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter((a): a is AssetReference => Boolean(a));
  const worst = linked.reduce<string | undefined>((acc, a) => {
    if (a.physicalImpact === "fatality") return "fatality";
    if (acc !== "fatality" && a.physicalImpact === "irreversible_injury")
      return "irreversible_injury";
    return acc;
  }, undefined);
  if (!worst) return null;
  return (
    <Tooltip
      title={worst === "fatality" ? "Safety: Fatality risk" : "Safety: Irreversible injury risk"}
    >
      <WarningAmberIcon fontSize="small" sx={{ color: getPhysicalImpactColor(worst) }} />
    </Tooltip>
  );
};

export const AssetsCell: React.FC<{
  ids: string[];
  assetDataRef: AssetDataReference;
}> = ({ ids, assetDataRef }) => {
  if (ids.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {ids.slice(0, 3).map((id) => {
        const asset = assetDataRef.assets.find((a) => a.id === id);
        if (!asset) return null;
        const color = getImpactColor(asset.aggregatedImpact);
        return (
          <Tooltip
            key={id}
            title={`${asset.name}${asset.aggregatedImpact ? ` — ${asset.aggregatedImpact}` : ""}`}
          >
            <Chip
              label={asset.id}
              size="small"
              sx={{
                fontSize: "0.65rem",
                height: 18,
                backgroundColor: color + "22",
                borderColor: color,
                border: "1px solid",
                color,
                fontFamily: "monospace",
              }}
            />
          </Tooltip>
        );
      })}
      {ids.length > 3 && (
        <Tooltip title={ids.slice(3).join(", ")}>
          <Chip label={`+${ids.length - 3}`} size="small" sx={{ fontSize: "0.65rem", height: 18 }} />
        </Tooltip>
      )}
    </Stack>
  );
};