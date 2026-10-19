// ==================== ASSET GROUP SECTIONS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6c, D20): the asset
// table grouped like threats and risks — one accordion per top-level
// decomposed multiprocess plus "Top level", then "Shared" (assets held in
// several multiprocesses) and "Not in the DFD". Each group renders the
// asset table with its own rows. "Show in table" opens the group of the
// asset.
// Without groups (classic DFD, no decomposed MP) the table renders as before.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Typography,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import type { Asset } from "../models/asset-types";
import {
  ASSET_NOT_IN_DFD,
  ASSET_SHARED_GROUP,
  assetGroupOf,
  assetGroupSections,
} from "../utils/asset-groups";

export interface AssetGroupSectionsProps {
  groups?: DfdTableGroups;
  assets: Asset[];
  /** "Show in table" from the asset graph: opens the asset's group. */
  highlightRequest?: { readonly assetId: string } | null;
  /** Renders the asset table for the assets of one group ("" without groups). */
  renderTable: (assets: Asset[], groupKey: string) => React.ReactNode;
}

export const AssetGroupSections: React.FC<AssetGroupSectionsProps> = ({
  groups,
  assets,
  highlightRequest,
  renderTable,
}) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!groups || !highlightRequest) return;
    const asset = assets.find((a) => a.id === highlightRequest.assetId);
    if (!asset) return;
    const key = assetGroupOf(groups, asset);
    setCollapsed((c) => ({ ...c, [key]: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightRequest]);

  if (!groups) return <>{renderTable(assets, "")}</>;

  const labelOf = (key: string, label: string) =>
    key === TOP_LEVEL_GROUP
      ? t("tabs.assets.groups.topLevel", { defaultValue: "Top level" })
      : key === ASSET_SHARED_GROUP
        ? t("tabs.assets.groups.shared", { defaultValue: "Shared" })
        : key === ASSET_NOT_IN_DFD
          ? t("tabs.assets.groups.notInDfd", { defaultValue: "Not in the DFD" })
          : label;

  return (
    <>
      {assetGroupSections(groups, assets).map((section) => (
        <Accordion
          key={section.key}
          expanded={!collapsed[section.key]}
          onChange={(_, expanded) => setCollapsed((c) => ({ ...c, [section.key]: !expanded }))}
          disableGutters
          data-testid={`asset-group-${section.key}`}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {labelOf(section.key, section.label)}
            </Typography>
            {section.key === ASSET_SHARED_GROUP && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {t("tabs.assets.groups.sharedHint", {
                  defaultValue: "held in several multiprocesses",
                })}
              </Typography>
            )}
            <Chip size="small" label={section.assets.length} sx={{ mr: 1 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {!collapsed[section.key] && renderTable(section.assets, section.key)}
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
};

export default AssetGroupSections;
