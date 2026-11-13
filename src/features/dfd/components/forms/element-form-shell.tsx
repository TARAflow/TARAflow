// ==================== ELEMENT FORM SHELL ====================
// Shared two-tab shell for all DFD element description forms.
//
// Tab 1 — General:  Rendered by the caller via `generalTab` prop (element-specific)
// Tab 2 — Asset:    AssetRelationSelector + SafetySummary (identical for all elements)
//
// Usage:
//   <ElementFormShell element={element} onChange={onChange}>
//     <InterfaceGeneralTab element={element} onChange={onChange} />
//   </ElementFormShell>
//
// Further tabs before "General" (`extraTabs`, user 2026-11-13): a general
// slot — the shell knows nothing of what they hold (the details panel fills
// it, e.g. "Component" of an imported multiprocess). With extra tabs the
// form starts on the first of them; a tab the user picks stays picked for
// the session among elements with the same extra tabs; `tabRequest` opens a
// tab on purpose (a finding, "Show in DFD").
//
// The shell owns: tab navigation, safety badge on Tab 2 label.
// The caller owns: Tab 1 content, React.memo wrapping of the outer form.

import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Box, Stack, Tab, Tabs } from "@mui/material";
import { WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import { isIsAnRelation } from "../../models/asset-relation-types";
import {
  AssetRelationSelector,
  type AvailableAsset,
} from "./asset-relation-selector";
import { SafetySummary } from "./safety-summary";
import { AssetRollupContext, AssetRollupView } from "./asset-rollup-view";

// ==================== TAB PANEL ====================

interface TabPanelProps {
  children: ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ==================== PROPS ====================

/** A tab before "General" — filled by the caller. */
export interface ExtraTab {
  id: string;
  label: ReactNode;
  /** Open items, shown as a number on the tab; 0 / absent = none. */
  badge?: number;
  render: () => ReactNode;
}

/** Open a tab on purpose; a new object each time (e.g. per finding click). */
export interface TabRequest {
  tab: string;
}

/** The tab ids besides the extra ones. */
const GENERAL = "general";
const RELATIONS = "relations";

/** Per set of extra tabs the tab the user picked last — for this session only. */
const pickedTab = new Map<string, string>();

export interface ElementFormShellProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;

  /** Available assets for the AssetRelationSelector in Tab 2 */
  availableAssets?: AvailableAsset[];

  /** Called when the user creates a new asset inline */
  onCreateAsset?: (name: string, group: AssetGroup) => AvailableAsset;

  /** Tab 1 content — element-specific, provided by the caller */
  generalTab: ReactNode;

  /** Override the General tab label (defaults to i18n key) */
  generalTabLabel?: string;

  /** Override the Asset tab label (defaults to i18n key) */
  assetTabLabel?: string;

  /** Tabs before "General", in this order. */
  extraTabs?: readonly ExtraTab[];
  /** Open this tab (an extra tab's id, "general" or "relations"). */
  tabRequest?: TabRequest | null;

  /** Controlled active tab (optional — shell manages own state if omitted) */
  activeTab?: number;
  onTabChange?: (tab: number) => void;
}

// ==================== COMPONENT ====================

export const ElementFormShell: React.FC<ElementFormShellProps> = ({
  element,
  onChange,
  availableAssets = [],
  onCreateAsset,
  generalTab,
  generalTabLabel,
  assetTabLabel,
  activeTab: controlledTab,
  onTabChange,
  extraTabs = [],
  tabRequest,
}) => {
  const { t } = useTranslation();

  // Tab order: the extra tabs, "General", "Relations" — addressed by id.
  const ids = [...extraTabs.map((x) => x.id), GENERAL, RELATIONS];
  const setKey = extraTabs.map((x) => x.id).join("|");
  // Fixed start (review 2026-11-13): the first extra tab, or what the user
  // picked among elements with the same extra tabs; never by state.
  const startId = () => (setKey ? (pickedTab.get(setKey) ?? extraTabs[0].id) : GENERAL);
  const [internalId, setInternalId] = React.useState<string>(startId);
  // Elements with extra tabs start by the rule; others keep the tab as before
  // (their tab set does not change).
  const lastKey = React.useRef(setKey);
  React.useEffect(() => {
    if (setKey || lastKey.current !== setKey) setInternalId(startId());
    lastKey.current = setKey;
  }, [element.id, setKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // A request opens its tab (and counts as picked).
  React.useEffect(() => {
    if (!tabRequest || !ids.includes(tabRequest.tab)) return;
    setInternalId(tabRequest.tab);
    if (setKey) pickedTab.set(setKey, tabRequest.tab);
  }, [tabRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const internalTab = Math.max(0, ids.indexOf(ids.includes(internalId) ? internalId : GENERAL));
  const activeTab = controlledTab ?? internalTab;
  const offset = extraTabs.length;
  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setInternalId(ids[v]);
    if (setKey) pickedTab.set(setKey, ids[v]);
    onTabChange?.(v);
  };

  const assetRels = element.assetRelations ?? [];
  // Leveled DFD (6d): a decomposed multiprocess shows the roll-up of its
  // parts instead of editable relations.
  const rollup = React.useContext(AssetRollupContext);
  const showRollup = rollup !== null && rollup.elementId === element.id;

  // Safety badge: any relation with non-none safety relevance
  const hasSafetyAnnotations = assetRels.some(
    (r) => !isIsAnRelation(r) && r.safety?.relevance !== "none",
  );

  return (
    <Box p={1}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        {extraTabs.map((x) => (
          <Tab
            key={x.id}
            data-testid={`element-tab-${x.id}`}
            label={
              x.badge ? (
                <Badge color="warning" badgeContent={x.badge} sx={{ "& .MuiBadge-badge": { right: -10 } }} data-testid={`element-tab-${x.id}-badge`}>
                  {x.label}
                </Badge>
              ) : (
                x.label
              )
            }
          />
        ))}
        <Tab
          label={
            generalTabLabel ??
            t("tabs.dfd.element_description.tabs.general", {
              defaultValue: "General",
            })
          }
        />
        <Tab
          label={
            <Stack direction="row" spacing={0.75} alignItems="center">
              <span>
                {assetTabLabel ??
                  t("tabs.dfd.element_description.tabs.relations", {
                    defaultValue: "Asset",
                  })}
              </span>
              {hasSafetyAnnotations && (
                <WarningAmberIcon
                  sx={{ fontSize: 14, color: "warning.main" }}
                />
              )}
            </Stack>
          }
        />
      </Tabs>

      {extraTabs.map((x, i) => (
        <TabPanel key={x.id} value={activeTab} index={i}>
          {x.render()}
        </TabPanel>
      ))}

      {/* Tab 1: General — element-specific content */}
      <TabPanel value={activeTab} index={offset}>
        {generalTab}
      </TabPanel>

      {/* Tab 2: Asset — identical for all elements */}
      <TabPanel value={activeTab} index={offset + 1}>
        {showRollup ? (
          <AssetRollupView
            value={rollup}
            availableAssets={availableAssets}
            ownRelations={assetRels}
            onChange={(relations) => onChange({ assetRelations: relations })}
          />
        ) : (
          <Stack spacing={3}>
            <AssetRelationSelector
              assetRelations={assetRels}
              elementType={element.type}
              availableAssets={availableAssets}
              onChange={(relations) => onChange({ assetRelations: relations })}
              onCreateAsset={onCreateAsset}
            />
            <SafetySummary
              assetRelations={assetRels}
              availableAssets={availableAssets}
            />
          </Stack>
        )}
      </TabPanel>
    </Box>
  );
};
