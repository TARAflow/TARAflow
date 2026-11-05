// ==================== ASSET NOTIFICATIONS PANEL ====================
// Findings of the asset validation below the asset table, in the style of the
// DFD notification panel. A click on a finding opens the asset in the dialog
// tab where it is fixed (and, for a security goal, on that goal's card).
//
// Errors and warnings are shown by default; infos (legitimate states, e.g. a
// goal without a formal requirement text) are behind the info chip so they do
// not drown the findings that matter. The panel itself is the shared
// FindingsPanel (FX-1); this file maps the asset findings onto it.

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FindingsPanel, compareDisplayIds, type PanelFinding } from "shared";
import type { AssetFinding } from "../services/asset-validator";

export interface AssetNotificationPanelProps {
  findings: AssetFinding[];
  /** Open the asset of the finding in the right dialog tab. */
  onOpen: (finding: AssetFinding) => void;
}

export const AssetNotificationPanel: React.FC<AssetNotificationPanelProps> = ({
  findings,
  onOpen,
}) => {
  const { t } = useTranslation();

  // Within a severity: by asset, then by message key.
  const sorted = useMemo(
    () =>
      findings
        .slice()
        .sort((a, b) => compareDisplayIds(a.assetLabel, b.assetLabel) || a.key.localeCompare(b.key)),
    [findings],
  );

  const items = useMemo<PanelFinding[]>(
    () =>
      sorted.map((f, i) => ({
        id: String(i),
        severity: f.severity,
        clickable: !!f.assetId,
        text: t(f.key, {
          id: f.assetLabel ?? "",
          type: f.goal ?? "",
          criterion: f.criterionId
            ? t(`tabs.assets.impactCriteria.${f.criterionId}.name`, { defaultValue: f.criterionId })
            : "",
          ...f.params,
        }),
      })),
    [sorted, t],
  );

  return (
    <FindingsPanel
      findings={items}
      onOpen={(id) => onOpen(sorted[Number(id)])}
      testIdPrefix="asset-notification"
      labels={{
        title: (count) =>
          t("tabs.assets.notifications.title", { count, defaultValue: "{{count}} finding(s)" }),
        open: t("tabs.assets.notifications.open", { defaultValue: "Open the asset where this is fixed" }),
        showInfos: t("tabs.assets.notifications.showInfos", { defaultValue: "Show infos" }),
        hideInfos: t("tabs.assets.notifications.hideInfos", { defaultValue: "Hide infos" }),
        onlyInfos: t("tabs.assets.notifications.onlyInfos", {
          defaultValue: "No errors or warnings — infos are hidden.",
        }),
      }}
    />
  );
};
