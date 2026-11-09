// ==================== ASSET NOTIFICATIONS PANEL ====================
// Findings of the asset validation below the asset table, in the style of the
// DFD notification panel. A click on a finding opens the asset in the dialog
// tab where it is fixed (and, for a security goal, on that goal's card).
//
// Errors and warnings are shown by default; infos (legitimate states, e.g. a
// goal without a formal requirement text) are behind the info chip so they do
// not drown the findings that matter. The panel itself is the shared
// FindingsPanel (FX-1); this file maps the asset findings onto it.
//
// Multi-project TARA phase 4a: on an asset imported from a component, a
// finding only the component can fix (name, DFD links) carries the
// component's chip; impact, safety and goal findings stay the machine's.

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FindingsPanel, compareDisplayIds, type PanelFinding } from "shared";
import type { AssetFinding } from "../services/asset-validator";
import type { Asset } from "../models/asset-types";

/** Findings on an imported asset that only its component can fix (its name and DFD links are the component's). */
const COMPONENT_OWNED = new Set(["tabs.assets.validation.noName", "tabs.assets.validation.notLinkedToDFD"]);

/** The component owning a finding, from the asset's importedFrom ("SD1 · Smoke Detector"); undefined = the machine's. */
export function assetFindingOwner(f: Pick<AssetFinding, "key" | "assetId">, assets: readonly Pick<Asset, "id" | "importedFrom">[]): string | undefined {
  if (!f.assetId || !COMPONENT_OWNED.has(f.key)) return undefined;
  return assets.find((a) => a.id === f.assetId)?.importedFrom;
}

export interface AssetNotificationPanelProps {
  findings: AssetFinding[];
  /** Open the asset of the finding in the right dialog tab. */
  onOpen: (finding: AssetFinding) => void;
  /** The assets — an imported one's findings may belong to its component (phase 4a). */
  assets?: readonly Pick<Asset, "id" | "importedFrom">[];
}

export const AssetNotificationPanel: React.FC<AssetNotificationPanelProps> = ({
  findings,
  onOpen,
  assets = [],
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
      sorted.map((f, i) => {
        const owner = assetFindingOwner(f, assets);
        return {
          id: String(i),
          severity: f.severity,
          clickable: !!f.assetId,
          ...(owner
            ? {
                owner: {
                  label: t("tabs.assets.notifications.ownerLabel", {
                    prefix: owner.split(" · ")[0],
                    defaultValue: "Component {{prefix}}",
                  }),
                  tooltip: t("tabs.assets.notifications.ownerTooltip", {
                    component: owner,
                    defaultValue: "Belongs to {{component}} — read-only here, fixed in the component's TARA.",
                  }),
                },
              }
            : {}),
          text: t(f.key, {
            id: f.assetLabel ?? "",
            type: f.goal ?? "",
            criterion: f.criterionId
              ? t(`tabs.assets.impactCriteria.${f.criterionId}.name`, { defaultValue: f.criterionId })
              : "",
            ...f.params,
          }),
        };
      }),
    [sorted, t, assets],
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
