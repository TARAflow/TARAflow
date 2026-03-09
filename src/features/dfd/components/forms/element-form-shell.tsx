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
// The shell owns: tab navigation, safety badge on Tab 2 label.
// The caller owns: Tab 1 content, React.memo wrapping of the outer form.

import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Tab, Tabs } from "@mui/material";
import { WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import { isIsAnRelation } from "../../models/asset-relation-types";
import {
  AssetRelationSelector,
  type AvailableAsset,
} from "./asset-relation-selector";
import { SafetySummary } from "./safety-summary";

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
}) => {
  const { t } = useTranslation();

  const [internalTab, setInternalTab] = React.useState(0);
  const activeTab = controlledTab ?? internalTab;
  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setInternalTab(v);
    onTabChange?.(v);
  };

  const assetRels = element.assetRelations ?? [];

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

      {/* Tab 1: General — element-specific content */}
      <TabPanel value={activeTab} index={0}>
        {generalTab}
      </TabPanel>

      {/* Tab 2: Asset — identical for all elements */}
      <TabPanel value={activeTab} index={1}>
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
      </TabPanel>
    </Box>
  );
};
