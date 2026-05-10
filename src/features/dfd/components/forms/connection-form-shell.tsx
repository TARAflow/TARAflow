// ==================== CONNECTION FORM SHELL ====================
// Shared two-tab shell for DFD connection description forms (DataFlow).
// Analog to ElementFormShell, but accepts DFDConnection instead of DFDElement.
//
// Tab 1 — General:  Rendered by the caller via `generalTab` prop
// Tab 2 — Asset:    AssetRelationSelector + SafetySummary
//
// elementType is fixed to "DataFlow" — AssetRelationSelector filters
// allowed relations to ["transports", "is_an"] accordingly.
//
// Usage:
//   <ConnectionFormShell connection={connection} onChange={onChange}>
//     <DataFlowGeneralTab connection={connection} onChange={onChange} />
//   </ConnectionFormShell>

import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Tab, Tabs, Typography, Tooltip } from "@mui/material";
import { WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import type { AssetGroup, DFDConnection } from "../../models/dfd-types";
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

export interface ConnectionFormShellProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;

  /** Available assets for the AssetRelationSelector in Tab 2 */
  availableAssets?: AvailableAsset[];

  /** Called when the user creates a new asset inline */
  onCreateAsset?: (name: string, group: AssetGroup) => AvailableAsset;

  /** Tab 1 content — provided by the caller */
  generalTab: ReactNode;

  /** Override the General tab label (defaults to i18n key) */
  generalTabLabel?: string;

  /** Override the Asset tab label (defaults to i18n key) */
  assetTabLabel?: string;

  /** Controlled active tab (optional — shell manages own state if omitted) */
  activeTab?: number;
  onTabChange?: (tab: number) => void;

  /** Incomplete required fields — shown as warning icon on General tab */
  incompleteFields?: string[];
}

// ==================== COMPONENT ====================

export const ConnectionFormShell: React.FC<ConnectionFormShellProps> = ({
  connection,
  onChange,
  availableAssets = [],
  onCreateAsset,
  generalTab,
  generalTabLabel,
  assetTabLabel,
  activeTab: controlledTab,
  onTabChange,
  incompleteFields = [],
}) => {
  const { t } = useTranslation();

  const [internalTab, setInternalTab] = React.useState(0);
  const activeTab = controlledTab ?? internalTab;
  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setInternalTab(v);
    onTabChange?.(v);
  };

  const assetRels = connection.assetRelations ?? [];

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
            <Stack direction="row" spacing={0.75} alignItems="center">
              <span>
                {generalTabLabel ??
                  t("tabs.dfd.element_description.tabs.general", {
                    defaultValue: "General",
                  })}
              </span>
              {incompleteFields.length > 0 && (
                <Tooltip
                  title={
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, display: "block" }}
                      >
                        {t("common.incomplete_fields", {
                          defaultValue: "Incomplete fields",
                        })}
                        :
                      </Typography>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: 14 }}>
                        {incompleteFields.map((f) => (
                          <li key={f}>
                            <Typography variant="caption">{f}</Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  }
                  placement="right"
                >
                  <WarningAmberIcon
                    sx={{ fontSize: 14, color: "warning.main" }}
                  />
                </Tooltip>
              )}
            </Stack>
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

      {/* Tab 1: General — caller-provided content */}
      <TabPanel value={activeTab} index={0}>
        {generalTab}
      </TabPanel>

      {/* Tab 2: Asset — fixed to DataFlow allowed relations */}
      <TabPanel value={activeTab} index={1}>
        <Stack spacing={3}>
          <AssetRelationSelector
            assetRelations={assetRels}
            elementType="DataFlow"
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