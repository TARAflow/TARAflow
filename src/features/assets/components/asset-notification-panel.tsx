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
// finding only the component can fix carries the component's chip — name,
// DFD links, and on a goal the COMPONENT has active (locked, 4a-2) its
// requirement text and "goal without threat" (the threats there are the
// component's). Impact, safety and rationale stay the machine's; what only a
// new component revision can close carries the component's chip too (4a-4).

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FindingsPanel, compareDisplayIds, type PanelFinding } from "shared";
import type { AssetFinding } from "../services/asset-validator";
import type { Asset } from "../models/asset-types";

/** Findings on an imported asset that only its component can fix (its name and DFD links are the component's). */
const COMPONENT_OWNED = new Set(["tabs.assets.validation.noName", "tabs.assets.validation.notLinkedToDFD"]);
/** … on a goal the component has active: its requirement text, and the threats violating it, are the component's. */
const COMPONENT_GOAL_OWNED = new Set(["tabs.assets.validation.noSecurityGoalDescription", "tabs.assets.validation.goalWithoutThreat"]);
const GOAL_WITHOUT_THREAT = "tabs.assets.validation.goalWithoutThreat";
const NOT_LINKED = "tabs.assets.validation.notLinkedToDFD";
/** Phase 4a-4 (user 2026-11-09, "signal, not analysis"): what only a new revision of the component can close. */
export const GOAL_ADDED_NO_COMPONENT_THREAT = "tabs.assets.validation.goalAddedNoComponentThreat";
export const LINKED_ONLY_TO_COMPONENT = "tabs.assets.validation.linkedOnlyToComponent";

export interface AssetFindingContext {
  assets: readonly Pick<Asset, "id" | "importedFrom">[];
  /** An imported asset's component goal types (phase 4a-2). */
  componentGoalsOf?: (assetId: string) => readonly string[] | undefined;
  /** Asset-to-asset relations (phase 4a-4: a machine asset tied only to a component's assets). */
  relations?: readonly { sourceAssetId: string; targetAssetId: string }[];
}

/**
 * How a finding is shown: its owner (the component, from the asset's
 * importedFrom "SD1 · Smoke Detector"; undefined = the machine's) and the
 * message key. Threats on a component's elements come only from the
 * component (the machine's generators are off there), so two findings can
 * only be closed by a new component revision (phase 4a-4, user 2026-11-09:
 * signal, not analysis — the machine does not analyse the component's
 * internals):
 *   - a goal the machine ADDED to an imported asset that no threat violates
 *     → "goal added — the component has no threats for it, request a new
 *     revision", the component's chip
 * A machine asset with no DFD link that is related only to a component's
 * assets gets its own text naming both ways out (link it to an element of
 * the machine, or — if the data is processed only inside the component —
 * request a revision) but stays the MACHINE's finding: the machine can fix
 * it itself, and the component's chip is kept for what only the component
 * can fix (review 2026-11-09).
 */
export function assetFindingView(
  f: Pick<AssetFinding, "key" | "assetId" | "goal">,
  ctx: AssetFindingContext,
): { owner?: string; key: string; component?: string } {
  if (!f.assetId) return { key: f.key };
  const asset = ctx.assets.find((a) => a.id === f.assetId);
  if (asset?.importedFrom) {
    if (COMPONENT_OWNED.has(f.key)) return { owner: asset.importedFrom, key: f.key };
    if (COMPONENT_GOAL_OWNED.has(f.key) && f.goal) {
      const fromComponent = !!ctx.componentGoalsOf?.(f.assetId)?.includes(f.goal);
      if (fromComponent) return { owner: asset.importedFrom, key: f.key };
      if (f.key === GOAL_WITHOUT_THREAT) return { owner: asset.importedFrom, key: GOAL_ADDED_NO_COMPONENT_THREAT };
    }
    return { key: f.key };
  }
  if (f.key === NOT_LINKED && asset) {
    const related = (ctx.relations ?? [])
      .flatMap((r) => (r.sourceAssetId === asset.id ? [r.targetAssetId] : r.targetAssetId === asset.id ? [r.sourceAssetId] : []))
      .map((id) => ctx.assets.find((a) => a.id === id));
    const components = [...new Set(related.map((a) => a?.importedFrom))];
    if (related.length > 0 && components.length === 1 && components[0]) return { key: LINKED_ONLY_TO_COMPONENT, component: components[0] };
  }
  return { key: f.key };
}

/** The component owning a finding; undefined = the machine's (see assetFindingView). */
export function assetFindingOwner(
  f: Pick<AssetFinding, "key" | "assetId" | "goal">,
  assets: readonly Pick<Asset, "id" | "importedFrom">[],
  componentGoalsOf?: (assetId: string) => readonly string[] | undefined,
  relations?: AssetFindingContext["relations"],
): string | undefined {
  return assetFindingView(f, { assets, componentGoalsOf, relations }).owner;
}

export interface AssetNotificationPanelProps {
  findings: AssetFinding[];
  /** Open the asset of the finding in the right dialog tab. */
  onOpen: (finding: AssetFinding) => void;
  /** The assets — an imported one's findings may belong to its component (phase 4a). */
  assets?: readonly Pick<Asset, "id" | "importedFrom">[];
  /** An imported asset's component goal types (phase 4a-2). */
  componentGoalsOf?: (assetId: string) => readonly string[] | undefined;
  /** Asset-to-asset relations (phase 4a-4). */
  relations?: AssetFindingContext["relations"];
}

export const AssetNotificationPanel: React.FC<AssetNotificationPanelProps> = ({
  findings,
  onOpen,
  assets = [],
  componentGoalsOf,
  relations,
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
        const { owner, key, component } = assetFindingView(f, { assets, componentGoalsOf, relations });
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
          text: t(key, {
            component: owner ?? component ?? "",
            id: f.assetLabel ?? "",
            type: f.goal ?? "",
            criterion: f.criterionId
              ? t(`tabs.assets.impactCriteria.${f.criterionId}.name`, { defaultValue: f.criterionId })
              : "",
            ...f.params,
          }),
        };
      }),
    [sorted, t, assets, componentGoalsOf, relations],
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
