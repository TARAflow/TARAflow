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
import { GroupAccordions, TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
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
  // "Show in table" opens the group of the asset — on a new request only,
  // not on every change of the assets (that would reopen a group the
  // analyst closed); the current data is read through a ref.
  const latest = React.useRef({ groups, assets });
  latest.current = { groups, assets };
  const openRequest = React.useMemo(() => {
    const { groups: g, assets: list } = latest.current;
    if (!g || !highlightRequest) return null;
    const asset = list.find((a) => a.id === highlightRequest.assetId);
    return asset ? { key: assetGroupOf(g, asset) } : null;
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
    <GroupAccordions
      testIdPrefix="asset-group"
      openRequest={openRequest}
      sections={assetGroupSections(groups, assets).map((section) => ({
        key: section.key,
        label: labelOf(section.key, section.label),
        count: section.assets.length,
        hint:
          section.key === ASSET_SHARED_GROUP
            ? t("tabs.assets.groups.sharedHint", { defaultValue: "held in several multiprocesses" })
            : undefined,
        render: () => renderTable(section.assets, section.key),
      }))}
    />
  );
};

export default AssetGroupSections;
