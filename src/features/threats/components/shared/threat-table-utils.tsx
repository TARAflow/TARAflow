// ==================== THREAT TABLE SHARED COMPONENTS ====================
// Reusable cell renderers and sort helpers for per-element and per-interaction tables.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { type Threat, type ThreatSource } from "../../models/threat-types";
import type { AssetDataReference, AssetReference, CIANAAALevel } from "shared";
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
      cmp =
        getThreatPriority(a, assetDataRef) - getThreatPriority(b, assetDataRef);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ==================== CELL RENDERERS ====================

export const ThreatIdCell: React.FC<{ id: string }> = ({ id }) => (
  <Tooltip title={id} placement="top">
    <Typography
      variant="body2"
      fontFamily="monospace"
      fontSize="0.75rem"
      noWrap
    >
      {id}
    </Typography>
  </Tooltip>
);

export const StrideCell: React.FC<{ cat: StrideCategory }> = ({ cat }) => {
  const { t } = useTranslation();
  const name = t(`stride.${cat}.name`, { defaultValue: cat });
  const description = t(`stride.${cat}.description`, { defaultValue: "" });

  return (
    <Tooltip title={`${name}${description ? ` — ${description}` : ""}`}>
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

export const ActorCell: React.FC<{ actor: string }> = ({ actor }) => {
  const { t } = useTranslation();
  const name = t(`tabs.threats.threatActors.${actor}.name`, {
    defaultValue: actor,
  });
  const description = t(`tabs.threats.threatActors.${actor}.description`, {
    defaultValue: "",
  });

  return (
    <Tooltip title={description || name}>
      <Chip
        label={name}
        size="small"
        variant="outlined"
        color={actor === "external" ? "error" : "default"}
        sx={{ fontSize: "0.7rem", height: 20 }}
      />
    </Tooltip>
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

// ==================== SOURCE BADGE ====================

const CIANAAA_LEVEL_COLOR: Record<CIANAAALevel, string> = {
  none:     "#9ca3af",
  low:      "#16a34a",
  medium:   "#d97706",
  high:     "#dc2626",
  critical: "#7c3aed",
};

const SOURCE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  // Current values
  manual: { label: "M", color: "#1d4ed8", bg: "#dbeafe" },
  "generated:classic": { label: "C", color: "#6b7280", bg: "#f3f4f6" },
  "generated:properties": { label: "P", color: "#92400e", bg: "#fef3c7" },
  "generated:cianaaa": { label: "G", color: "#065f46", bg: "#d1fae5" },
  "generated:full": { label: "★", color: "#1d4ed8", bg: "#eff6ff" },
  // Legacy: threats from before ThreatSource was extended
  auto: { label: "A", color: "#6b7280", bg: "#f3f4f6" },
  classic: { label: "C", color: "#6b7280", bg: "#f3f4f6" },
  hybrid: { label: "H", color: "#92400e", bg: "#fef3c7" },
  relation: { label: "G", color: "#065f46", bg: "#d1fae5" },
};

/** Sources where CIANAAA was active — show impact dot */
const CIANAAA_SOURCES = new Set(["generated:cianaaa", "generated:full", "relation"]);

/**
 * Per-threat badge showing generation source and CIANAAA initialImpact.
 *
 * generated:classic    → C grey  — generic STRIDE, no modulation
 * generated:properties → P amber — element properties applied
 * generated:cianaaa    → G green — CIANAAA goals applied + impact dot
 * generated:full       → ★ blue  — both modules + impact dot
 * manual               → M blue  — analyst created
 */
export const SourceBadge: React.FC<{
  source: ThreatSource;
  initialImpact?: CIANAAALevel;
  /** When true, renders as a filled Chip (for dialog title). Default: compact box+dot for tables. */
  chipStyle?: boolean;
}> = ({ source, initialImpact, chipStyle = false }) => {
  const { t } = useTranslation();
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG["classic"];

  const sourceKey = source.replace(/:/g, "_");
  const sourceLabel = t(`tabs.threats.dialog.source.${sourceKey}`, {
    defaultValue: cfg.label,
  });

  const impactLabel = initialImpact
    ? t(`tabs.assets.cianaaa.level.${initialImpact}`, {
        defaultValue: initialImpact,
      })
    : undefined;

  const tooltipParts: string[] = [
    t(`tabs.threats.sourceBadge.${sourceKey}`, { defaultValue: sourceLabel }),
  ];
  if (CIANAAA_SOURCES.has(source) && !initialImpact) {
    tooltipParts.push(
      t("tabs.threats.sourceBadge.fallback", {
        defaultValue: "No asset security goals — base STRIDE used",
      }),
    );
  }
  if (impactLabel) {
    tooltipParts.push(
      t("tabs.threats.sourceBadge.impact", {
        defaultValue: `Initial impact: ${impactLabel}`,
        level: impactLabel,
      }),
    );
  }

  // ── Chip style (dialog title) ──────────────────────────────────────────
  if (chipStyle) {
    const chipLabel = impactLabel
      ? `${sourceLabel} · ${impactLabel}`
      : sourceLabel;
    return (
      <Tooltip title={tooltipParts.join(" · ")} placement="top">
        <Chip
          label={chipLabel}
          size="small"
          sx={{
            flexShrink: 0,
            height: 20,
            fontSize: 10,
            fontWeight: "medium",
            bgcolor: cfg.color,
            color: "white",
          }}
        />
      </Tooltip>
    );
  }

  // ── Compact box+dot style (tables) ────────────────────────────────────
  return (
    <Tooltip title={tooltipParts.join(" · ")} placement="top">
      <Stack direction="row" spacing={0.25} alignItems="center">
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: "3px",
            bgcolor: cfg.bg,
            border: "1px solid",
            borderColor: cfg.color + "60",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.6rem",
            fontWeight: 700,
            color: cfg.color,
            flexShrink: 0,
          }}
        >
          {cfg.label}
        </Box>

        {/* CIANAAA level dot — when CIANAAA module was active */}
        {CIANAAA_SOURCES.has(source) && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: initialImpact
                ? CIANAAA_LEVEL_COLOR[initialImpact]
                : "#d1d5db",
              flexShrink: 0,
            }}
          />
        )}
      </Stack>
    </Tooltip>
  );
};

// ==================== ASSETS CELL ====================

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