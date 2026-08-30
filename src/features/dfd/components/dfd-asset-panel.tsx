// ==================== ASSET PANEL ====================
// Vertical split panel:
//   Top:    Asset Tree — categories as collapsible groups, eye-icon per asset
//           Eye = toggle DFD visibility; max 1 visible per category (radio behaviour)
//           Clicking asset name selects it for the detail form below
//   Bottom: AssetDescriptionForm for the selected asset, or placeholder

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
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
  Add as AddIcon,
  Computer as SystemIcon,
  DataObject as DataIcon,
  DeleteOutline as DeleteIcon,
  ExpandLess as CollapseTreeIcon,
  ExpandMore as ExpandMoreIcon,
  Factory as InfrastructureIcon,
  Loop as ProcessIcon,
  Functions as FunctionIcon,
  Person as PersonIcon,
  Cloud as ServiceIcon,
  Inventory2 as PhysicalIcon,
  Visibility as VisibilityOnIcon,
  VisibilityOff as VisibilityOffIcon,
  Nature as EnvironmentIcon,
} from "@mui/icons-material";
import type { DFDConnection, DFDElement } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import { getAssetGroupColor } from "../models/dfd-formatters";
import { AssetDescriptionForm } from "./forms/asset-description-form";
import { AssetGroup } from "shared";

// ==================== CONSTANTS ====================

const ASSET_GROUPS: AssetGroup[] = [
  "data",
  "function",
  "system",
  "infrastructure",
  "process",
  "physical",
  "service",
  "human",
  "environment",
];

const GROUP_ICON: Record<AssetGroup, React.ReactNode> = {
  data: <DataIcon fontSize="small" />,
  function: <FunctionIcon fontSize="small" />,
  system: <SystemIcon fontSize="small" />,
  infrastructure: <InfrastructureIcon fontSize="small" />,
  process: <ProcessIcon fontSize="small" />,
  physical: <PhysicalIcon fontSize="small" />,
  service: <ServiceIcon fontSize="small" />,
  human: <PersonIcon fontSize="small" />,
  environment: <EnvironmentIcon fontSize="small" />,
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
  /** Called when user creates a new asset for a given group */
  onCreateAsset?: (group: AssetGroup) => void;
  /** Called when user confirms deletion of an asset */
  onDeleteAsset?: (assetId: string) => void;
  /** Called when user clicks the global "clear all overlays" button */
  onClearAllVisibility?: () => void;
  selectedAssetId?: string | null;
}

// ==================== ASSET TREE ====================

interface AssetTreeProps {
  assets: DFDAsset[];
  visibility: AssetVisibility;
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onVisibilityChange: (group: AssetGroup, assetId: string | null) => void;
  onCreateAsset?: (group: AssetGroup) => void;
  onDeleteAsset?: (assetId: string) => void;
  /** Group to force-expand (e.g. after creating a new asset) */
  expandedGroup?: AssetGroup | null;
}

const AssetTree: React.FC<AssetTreeProps> = ({
  assets,
  visibility,
  selectedAssetId,
  onSelect,
  onVisibilityChange,
  onCreateAsset,
  onDeleteAsset,
  expandedGroup,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Track controlled expanded state per group
  const [expandedGroups, setExpandedGroups] = useState<Set<AssetGroup>>(
    () =>
      new Set(
        assets
          .filter((a) => a.assetGroup)
          .map((a) => a.assetGroup as AssetGroup),
      ),
  );
  const { t } = useTranslation();

  // Force-expand group when a new asset is created
  useEffect(() => {
    if (expandedGroup) {
      setExpandedGroups((prev) => new Set([...prev, expandedGroup]));
    }
  }, [expandedGroup]);

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
    <>
      <Box sx={{ overflow: "auto", flexShrink: 0 }}>
        {ASSET_GROUPS.map((group) => {
          const groupAssets = assets.filter((a) => a.assetGroup === group);
          const color = getAssetGroupColor(group);

          return (
            <Accordion
              key={group}
              expanded={expandedGroups.has(group)}
              onChange={(_, isExpanded) =>
                setExpandedGroups((prev) => {
                  const next = new Set(prev);
                  if (isExpanded) next.add(group);
                  else next.delete(group);
                  return next;
                })
              }
              disableGutters
              elevation={0}
              sx={{
                "&:before": { display: "none" },
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <AccordionSummary
                expandIcon={null}
                sx={{
                  minHeight: 36,
                  pr: 0.5,
                  "& .MuiAccordionSummary-content": { my: 0.5, mr: 0 },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  <Box sx={{ color, display: "flex", alignItems: "center" }}>
                    {GROUP_ICON[group]}
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ flexGrow: 1 }}
                  >
                    {t(`assets.groups.${group}`, { defaultValue: group })}
                  </Typography>
                  {groupAssets.length > 0 && (
                    <Chip
                      label={groupAssets.length}
                      size="small"
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                  {/* Icon zone — aligns with list item [trash] [eye] */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {onCreateAsset ? (
                      <Tooltip
                        title={t("tabs.dfd.assetPanel.createAsset", {
                          defaultValue: "New asset",
                        })}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateAsset(group);
                          }}
                          sx={{ p: 0.25 }}
                        >
                          <AddIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Box sx={{ width: 26 }} />
                    )}
                    <IconButton
                      size="small"
                      component="span"
                      tabIndex={-1}
                      sx={{ p: 0.25, pointerEvents: "none" }}
                    >
                      <ExpandMoreIcon
                        sx={{
                          fontSize: 16,
                          transition: "transform 0.2s",
                          ".Mui-expanded &": { transform: "rotate(180deg)" },
                        }}
                      />
                    </IconButton>
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                {groupAssets.length === 0 ? (
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ px: 2, py: 1, display: "block" }}
                  >
                    {t("tabs.dfd.assetPanel.noAssets", {
                      defaultValue: "No assets",
                    })}
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
                          sx={{ pl: 3, pr: 0.5, py: 0.5 }}
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
                          <ListItemIcon
                            sx={{ minWidth: 0, display: "flex", gap: 0.25 }}
                          >
                            {onDeleteAsset && (
                              <Tooltip
                                title={t("tabs.dfd.assetPanel.deleteAsset", {
                                  defaultValue: "Delete asset",
                                })}
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(asset.id);
                                  }}
                                  sx={{
                                    opacity: 0,
                                    color: "error.main",
                                    ".MuiListItemButton-root:hover &": {
                                      opacity: 0.7,
                                    },
                                    "&:hover": { opacity: "1 !important" },
                                    transition: "opacity 0.15s",
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
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

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <Dialog
          open
          onClose={() => setConfirmDeleteId(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {t("tabs.dfd.assetPanel.confirmDelete.title", {
              defaultValue: "Delete asset?",
            })}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {t("tabs.dfd.assetPanel.confirmDelete.message", {
                defaultValue:
                  "This will remove the asset and all its relations from the DFD. This action cannot be undone.",
              })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDeleteId(null)} size="small">
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              color="error"
              variant="contained"
              size="small"
              onClick={() => {
                onDeleteAsset?.(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              {t("common.delete", { defaultValue: "Delete" })}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};;

// ==================== MAIN COMPONENT ====================

export const AssetPanel: React.FC<AssetPanelProps> = ({
  assets,
  elements,
  connections,
  visibility,
  onVisibilityChange,
  onAssetChange,
  onCreateAsset,
  onDeleteAsset,
  onClearAllVisibility,
  selectedAssetId: externalSelectedAssetId,
}) => {
  const { t } = useTranslation();

  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<AssetGroup | null>(null);
  const [shouldFocusName, setShouldFocusName] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<AssetGroup | null>(null);
  const prevAssetsLengthRef = useRef(assets.length);
  // Resizable split — height of tree pane in px
  const [treeHeight, setTreeHeight] = useState<number>(200);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [internalSelectedAssetId, setInternalSelectedAssetId] = useState<
    string | null
  >(null);

  const selectedAssetId = externalSelectedAssetId ?? internalSelectedAssetId;

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  // Handle new asset creation — set pending state, parent will add the asset
  const handleCreateAsset = useCallback(
    (group: AssetGroup) => {
      onCreateAsset?.(group);
      setExpandedGroup(group);
      setShouldFocusName(true);
      setPendingGroup(group);
    },
    [onCreateAsset],
  );

  // React to assets prop change — when a new asset appears, select it
  useEffect(() => {
    if (!pendingGroup) return;
    if (assets.length <= prevAssetsLengthRef.current) {
      prevAssetsLengthRef.current = assets.length;
      return;
    }
    // New asset found — select the last one in the group
    const groupAssets = assets.filter((a) => a.assetGroup === pendingGroup);
    const newest = groupAssets[groupAssets.length - 1];
    if (newest) setInternalSelectedAssetId(newest.id);
    prevAssetsLengthRef.current = assets.length;
    setPendingGroup(null);
    setExpandedGroup(null);
  }, [assets, pendingGroup]);

  // Drag handlers for resizable split
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragStartY.current = e.clientY;
      dragStartHeight.current = treeHeight;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - dragStartY.current;
        const containerH = containerRef.current?.clientHeight ?? 600;
        const next = Math.max(
          80,
          Math.min(containerH - 120, dragStartHeight.current + delta),
        );
        setTreeHeight(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [treeHeight],
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
      ref={containerRef}
    >
      {/* ── Top: Asset Tree ── */}
      {!treeCollapsed && (
        <Box
          sx={{
            flex: "0 0 auto",
            height: treeHeight,
            overflow: "auto",
          }}
        >
          <AssetTree
            assets={assets}
            visibility={visibility}
            selectedAssetId={selectedAssetId}
            onSelect={setInternalSelectedAssetId}
            onVisibilityChange={onVisibilityChange}
            onCreateAsset={handleCreateAsset}
            onDeleteAsset={onDeleteAsset}
            expandedGroup={expandedGroup}
          />
        </Box>
      )}

      {/* ── Drag Divider ── */}
      {!treeCollapsed && (
        <Box
          onMouseDown={handleDragStart}
          sx={{
            position: "relative",
            height: 12,
            cursor: "row-resize",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
        >
          {/* 1px thin line */}
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              bgcolor: "divider",
            }}
          />
          {/* Pill — outlined, light fill, same border color as line */}
          <Box
            sx={{
              position: "relative",
              width: 40,
              height: 8,
              borderRadius: 9999,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              transition: "border-color 0.15s, background-color 0.15s",
              "&:hover": {
                borderColor: "text.disabled",
                bgcolor: "action.hover",
              },
            }}
          />
        </Box>
      )}

      {/* ── Bottom: Detail Form or Placeholder ── */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {selectedAsset ? (
          <>
            {/* Detail header with collapse/expand toggle */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pl: 1.5,
                pr: 0.5,
                py: 0.5,
                borderBottom: 1,
                borderColor: "divider",
                flexShrink: 0,
                bgcolor: "background.default",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ flex: 1 }}
              >
                {selectedAsset.displayId} · {selectedAsset.name}
              </Typography>
              <Tooltip
                title={
                  treeCollapsed
                    ? t("tabs.dfd.assetPanel.showTree", {
                        defaultValue: "Show asset tree",
                      })
                    : t("tabs.dfd.assetPanel.hideTree", {
                        defaultValue: "Expand detail view",
                      })
                }
              >
                <IconButton
                  size="small"
                  onClick={() => setTreeCollapsed((v) => !v)}
                >
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
                key={selectedAsset.id}
                asset={selectedAsset}
                onChange={(changes) => onAssetChange(selectedAsset.id, changes)}
                allAssets={assets}
                elements={elements}
                connections={connections}
                autoFocusName={shouldFocusName}
                onNameFocused={() => setShouldFocusName(false)}
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
                defaultValue:
                  "Select an asset above to view and edit its details",
              })}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};;

export default AssetPanel;