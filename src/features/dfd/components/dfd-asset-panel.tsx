// ==================== ASSET PANEL ====================
// Vertical split panel:
//   Top:    Asset Tree — categories as collapsible groups, eye-icon per asset
//           Eye = toggle DFD visibility; max 1 visible per category (radio behaviour)
//           Clicking asset name selects it for the detail form below
//   Bottom: AssetDescriptionForm for the selected asset, or placeholder

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Computer as SystemIcon,
  DataObject as DataIcon,
  ExpandLess as CollapseTreeIcon,
  ExpandMore as ExpandMoreIcon,
  Factory as InfrastructureIcon,
  Loop as ProcessIcon,
  Person as PersonIcon,
  Visibility as VisibilityOnIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import type {
  AssetGroup,
  DFDAsset,
  DFDConnection,
  DFDElement,
} from "../models/dfd-types";
import { getAssetGroupColor } from "../models/dfd-formatters";
import { AssetDescriptionForm } from "./forms/asset-description-form";

// ==================== CONSTANTS ====================

const ASSET_GROUPS: AssetGroup[] = [
  "data",
  "system",
  "process",
  "infrastructure",
  "human",
];

const GROUP_ICON: Record<AssetGroup, React.ReactNode> = {
  data: <DataIcon fontSize="small" />,
  system: <SystemIcon fontSize="small" />,
  process: <ProcessIcon fontSize="small" />,
  infrastructure: <InfrastructureIcon fontSize="small" />,
  human: <PersonIcon fontSize="small" />,
};

// ==================== PROPS ====================

export interface AssetVisibility {
  /** assetId that is currently "visible" in the DFD per category; null = none */
  [group: string]: string | null;
}

interface AssetPanelProps {
  assets: DFDAsset[];
  elements?: DFDElement[];
  connections?: DFDConnection[];
  /** Which asset (per category) is currently shown in the DFD */
  visibility: AssetVisibility;
  /** Called when user toggles the eye icon */
  onVisibilityChange: (group: AssetGroup, assetId: string | null) => void;
  /** Called when asset properties are edited in the detail form */
  onAssetChange: (assetId: string, changes: Partial<DFDAsset>) => void;
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
}

// ==================== ASSET TREE ====================

interface AssetTreeProps {
  assets: DFDAsset[];
  visibility: AssetVisibility;
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onVisibilityChange: (group: AssetGroup, assetId: string | null) => void;
}

const AssetTree: React.FC<AssetTreeProps> = ({
  assets,
  visibility,
  selectedAssetId,
  onSelect,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();

  const handleEyeClick = useCallback(
    (e: React.MouseEvent, group: AssetGroup, assetId: string) => {
      e.stopPropagation(); // don't also select the asset
      const currentVisible = visibility[group];
      // Toggle: if this asset is already visible → hide; otherwise → show (replaces previous)
      onVisibilityChange(group, currentVisible === assetId ? null : assetId);
    },
    [visibility, onVisibilityChange],
  );

  return (
    <Box sx={{ overflow: "auto", flexShrink: 0 }}>
      {ASSET_GROUPS.map((group) => {
        const groupAssets = assets.filter((a) => a.assetGroup === group);
        const color = getAssetGroupColor(group);

        return (
          <Accordion
            key={group}
            defaultExpanded={groupAssets.length > 0}
            disableGutters
            elevation={0}
            sx={{
              "&:before": { display: "none" },
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              sx={{ minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ color, display: "flex", alignItems: "center" }}>
                  {GROUP_ICON[group]}
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {t(`tabs.dfd.assetGroups.${group}`, { defaultValue: group })}
                </Typography>
                {groupAssets.length > 0 && (
                  <Chip
                    label={groupAssets.length}
                    size="small"
                    sx={{ height: 18, fontSize: 10, ml: 0.5 }}
                  />
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
              {groupAssets.length === 0 ? (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ px: 2, py: 1, display: "block" }}
                >
                  {t("tabs.dfd.assetPanel.noAssets", { defaultValue: "No assets" })}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {groupAssets.map((asset) => {
                    const isVisible = visibility[group] === asset.id;
                    const isSelected = selectedAssetId === asset.id;

                    return (
                      <ListItemButton
                        key={asset.id}
                        selected={isSelected}
                        onClick={() => onSelect(asset.id)}
                        sx={{ pl: 3, pr: 1, py: 0.5 }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: 260 }}
                            >
                              <Box
                                component="span"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: 11,
                                  color: "text.secondary",
                                  mr: 0.75,
                                }}
                              >
                                {asset.displayId}
                              </Box>
                              {asset.name}
                            </Typography>
                          }
                        />
                        <ListItemIcon sx={{ minWidth: 0 }}>
                          <Tooltip
                            title={
                              isVisible
                                ? t("tabs.dfd.assetPanel.hideInDFD", {
                                    defaultValue: "Hide in DFD",
                                  })
                                : t("tabs.dfd.assetPanel.showInDFD", {
                                    defaultValue: "Show in DFD",
                                  })
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleEyeClick(e, group, asset.id)
                              }
                              sx={{
                                opacity: isVisible ? 1 : 0.3,
                                color: isVisible ? color : "text.secondary",
                                "&:hover": { opacity: 1 },
                              }}
                            >
                              {isVisible ? (
                                <VisibilityOnIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <VisibilityOffIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </ListItemIcon>
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

// ==================== MAIN COMPONENT ====================

export const AssetPanel: React.FC<AssetPanelProps> = ({
  assets,
  elements,
  connections,
  visibility,
  onVisibilityChange,
  onAssetChange,
  onAssetFeatureUpdate,
}) => {
  const { t } = useTranslation();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* ── Top: Asset Tree ── */}
      {!treeCollapsed && (
        <Box
          sx={{
            flex: "0 0 auto",
            maxHeight: "45%",
            overflow: "auto",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <AssetTree
            assets={assets}
            visibility={visibility}
            selectedAssetId={selectedAssetId}
            onSelect={setSelectedAssetId}
            onVisibilityChange={onVisibilityChange}
          />
        </Box>
      )}

      {/* ── Bottom: Detail Form or Placeholder ── */}
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selectedAsset ? (
          <>
            {/* Detail header with collapse/expand toggle */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                py: 0.5,
                borderBottom: 1,
                borderColor: "divider",
                flexShrink: 0,
                bgcolor: "background.default",
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                {selectedAsset.displayId} · {selectedAsset.name}
              </Typography>
              <Tooltip
                title={
                  treeCollapsed
                    ? t("tabs.dfd.assetPanel.showTree", { defaultValue: "Show asset tree" })
                    : t("tabs.dfd.assetPanel.hideTree", { defaultValue: "Expand detail view" })
                }
              >
                <IconButton size="small" onClick={() => setTreeCollapsed((v) => !v)}>
                  {treeCollapsed ? (
                    <ExpandMoreIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <CollapseTreeIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ flex: 1, overflow: "auto" }}>
              <AssetDescriptionForm
                asset={selectedAsset}
                onChange={(changes) => onAssetChange(selectedAsset.id, changes)}
                elements={elements}
                connections={connections}
                onAssetFeatureUpdate={onAssetFeatureUpdate}
              />
            </Box>
          </>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              p: 3,
            }}
          >
            <Typography variant="body2" color="text.disabled" align="center">
              {t("tabs.dfd.assetPanel.selectAsset", {
                defaultValue: "Select an asset above to view and edit its details",
              })}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AssetPanel;