// ==================== DFD DETAILS PANEL ====================
// Slide-over panel displaying element/connection description forms.
// Positioned absolutely over the DFD canvas — no layout shift on open/close.
// Toggle tab sits on the left edge, always visible.
//
// Tab behaviour:
//   • Element selected  → both "Element" and "Assets" tabs shown
//   • Nothing selected  → only "Assets" tab shown (Element tab hidden)

import React, { useEffect, useState } from "react";
import { Box, IconButton, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useTranslation } from "react-i18next";
import { AssetGroup } from "shared";
import type { ComponentMultiprocessInfo, DFDConnection, DFDElement } from "../models/dfd-types";
import { Button } from "@mui/material";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { AvailableAsset } from "./forms/asset-relation-selector";
import { DFDElementForm } from "./dfd-element-form";
import type { RefinementCandidate } from "./forms/dataflow-description-form";
import type { AssetUsageLookup } from "shared";
import { AssetPanel } from "./dfd-asset-panel";
import type { AssetFocusRequest, AssetVisibility } from "./dfd-asset-panel";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";
import { ChildPageSection, type ChildPageInfo } from "./child-page-ui";
import { IdentitySection, type IdentitySectionProps } from "./identity-section";
import { AssetRollupContext, type AssetRollupContextValue } from "./forms/asset-rollup-view";

// ==================== PROPS ====================

interface DFDDetailsPanelProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Toggle open/closed */
  onToggle: () => void;
  /** Close panel */
  onClose: () => void;

  /** Currently selected element (mutually exclusive with connection) */
  element?: DFDElement;
  /** Currently selected connection (mutually exclusive with element) */
  connection?: DFDConnection;

  /** Called when element or connection properties change */
  onChange: (updates: Partial<DFDElement> | Partial<DFDConnection>) => void;

  /** Assets available for relation assignment */
  availableAssets?: AvailableAsset[];
  /** Full DFDAsset objects (needed for AssetPanel detail form) */
  assets?: DFDAsset[];
  /** All elements (for AssetDescriptionForm "Used in" tab) */
  elements?: DFDElement[];
  /** All connections (for AssetDescriptionForm "Used in" tab) */
  connections?: DFDConnection[];
  /** Whether the selected connection crosses a trust boundary */
  crossesTrustBoundary?: boolean;
  /** Create a new asset inline from the AssetRelationSelector */
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  /** Called when an asset is edited in the Assets tab */
  onAssetChange?: (assetId: string, changes: Partial<DFDAsset>) => void;
  /** Called when user clicks + in the asset tree to create a new asset for a group */
  onCreateAssetForGroup?: (group: AssetGroup) => void;
  /** Called when user confirms deletion of an asset in the asset tree */
  onDeleteAsset?: (assetId: string) => void;
  /** Current DFD visibility state for assets (controlled from parent) */
  assetVisibility?: AssetVisibility;
  /** Called when user toggles eye icon in asset tree */
  onAssetVisibilityChange?: (group: AssetGroup, assetId: string | null) => void;
  /** Called when user clicks the global clear-all-overlays button */
  onClearAllVisibility?: () => void;

  graphContext?: DFDGraphAnalysisContext | null;
  focusAssetRequest?: AssetFocusRequest | null;
  /** Impact lookup for the asset delete confirm dialog. */
  assetUsage?: AssetUsageLookup;
  /** Reports the asset tree selection (asset graph view, FR-V8). */
  onSelectedAssetChange?: (assetId: string | null) => void;
  /** Leveled DFD: flows a data flow may refine (§6.4); absent = single page. */
  refinementCandidates?: RefinementCandidate[];
  /** Leveled DFD (5e): child page of the selected multiprocess. */
  childPage?: ChildPageInfo;
  /** Leveled DFD (5g): identity of the selected cell and its actions. */
  identity?: IdentitySectionProps;
  /**
   * Leveled DFD (6d): roll-up of the selected decomposed multiprocess; its
   * "Asset" tab shows it instead of editable relations.
   */
  assetRollup?: AssetRollupContextValue;
  /** Multi-project TARA: the selected multiprocess is an imported component. */
  componentInfo?: ComponentMultiprocessInfo;
}

// ==================== COMPONENT ====================

export const DFDDetailsPanel: React.FC<DFDDetailsPanelProps> = ({
  open,
  onToggle,
  onClose,
  element,
  connection,
  onChange,
  availableAssets = [],
  assets = [],
  elements = [],
  connections = [],
  crossesTrustBoundary = false,
  onCreateAsset,
  onAssetChange,
  onCreateAssetForGroup,
  onDeleteAsset,
  assetVisibility = {},
  onAssetVisibilityChange,
  onClearAllVisibility,
  graphContext,
  focusAssetRequest,
  assetUsage,
  onSelectedAssetChange,
  refinementCandidates,
  childPage,
  identity,
  assetRollup,
  componentInfo,
}) => {
  const { t } = useTranslation();

  const hasSelection = Boolean(element || connection);

  // When selection disappears, jump to Assets tab automatically
  const [activeTab, setActiveTab] = useState<"element" | "assets">(
    hasSelection ? "element" : "assets",
  );

  useEffect(() => {
    if (hasSelection) {
      setActiveTab("element");
    } else {
      setActiveTab("assets");
    }
  }, [hasSelection]);

  useEffect(() => {
    if (focusAssetRequest) {
      setActiveTab("assets");
    }
  }, [focusAssetRequest]);

  const displayId = element?.displayId ?? connection?.displayId;
  const name = element?.name ?? connection?.name;

  return (
    // Outer anchor — sits at right edge of the canvas, full height
    <Box
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "stretch",
        pointerEvents: "none",
      }}
    >
      {/* Toggle tab — always visible on the left edge */}
      <Box
        onClick={onToggle}
        sx={{
          alignSelf: "center",
          width: 20,
          height: 64,
          bgcolor: "background.paper",
          border: 1,
          borderRight: 0,
          borderColor: "divider",
          borderRadius: "6px 0 0 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "-2px 0 6px rgba(0,0,0,0.1)",
          pointerEvents: "auto",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {open ? (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronLeftIcon sx={{ fontSize: 16 }} />
        )}
      </Box>

      {/* Panel */}
      {open && (
        <Box
          sx={{
            width: 500,
            height: "100%",
            borderLeft: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
            boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            {/* Tabs row + close button */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                pl: 1,
                pr: 1,
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{ minHeight: 40 }}
                TabIndicatorProps={{ sx: { height: 2 } }}
              >
                {hasSelection && (
                  <Tab
                    value="element"
                    label={t("tabs.dfd.detailsPanel.tabs.element", {
                      defaultValue: "Element",
                    })}
                    sx={{ minHeight: 40, py: 0, fontSize: 13 }}
                  />
                )}
                <Tab
                  value="assets"
                  label={t("tabs.dfd.detailsPanel.tabs.assets", {
                    defaultValue: "Assets",
                  })}
                  sx={{ minHeight: 40, py: 0, fontSize: 13 }}
                />
              </Tabs>
              <IconButton onClick={onClose} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Title — always rendered to prevent layout jump between tabs */}
            <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
              {hasSelection && activeTab === "element" ? (
                <Typography
                  variant="subtitle1"
                  noWrap
                  sx={{ fontWeight: 600, lineHeight: 1.4 }}
                  title={`${displayId ?? ""} ${name ?? ""}`}
                >
                  {displayId && (
                    <Box
                      component="span"
                      sx={{ color: "text.secondary", mr: 0.75 }}
                    >
                      [{displayId}]
                    </Box>
                  )}
                  {name}
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, lineHeight: 1.4 }}
                  >
                    {t("tabs.dfd.detailsPanel.assetsTitle", {
                      defaultValue: "Asset List",
                    })}
                  </Typography>
                  {onClearAllVisibility &&
                    Object.values(assetVisibility).some(
                      (id) => id !== null,
                    ) && (
                      <Tooltip
                        title={t("tabs.dfd.assetPanel.clearAllOverlays", {
                          defaultValue: "Alle Overlays ausschalten",
                        })}
                      >
                        <IconButton
                          size="small"
                          onClick={onClearAllVisibility}
                          color="primary"
                          sx={{ p: 0.25 }}
                        >
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                </Box>
              )}
            </Box>
          </Box>

          {/* Scrollable content */}
          <Box
            sx={{
              flexGrow: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Element tab */}
            {activeTab === "element" && hasSelection && (
              <Box sx={{ flexGrow: 1, overflow: "auto" }}>
                {identity && <IdentitySection {...identity} />}
                {componentInfo && element?.type === "Multiprocess" && (
                  <ComponentSection info={componentInfo} />
                )}
                {childPage && element?.type === "Multiprocess" && (
                  <ChildPageSection info={childPage} />
                )}
                <AssetRollupContext.Provider value={assetRollup ?? null}>
                  <DFDElementForm
                    element={element}
                    connection={connection}
                    onChange={onChange}
                    availableAssets={availableAssets}
                    crossesTrustBoundary={crossesTrustBoundary}
                    onCreateAsset={onCreateAsset}
                    graphContext={graphContext}
                    refinementCandidates={refinementCandidates}
                  />
                </AssetRollupContext.Provider>
              </Box>
            )}

            {/* Assets tab */}
            {activeTab === "assets" && (
              <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                <AssetPanel
                  assets={assets}
                  elements={elements}
                  connections={connections}
                  visibility={assetVisibility}
                  focusAssetRequest={focusAssetRequest}
                  assetUsage={assetUsage}
                  onSelectedAssetChange={onSelectedAssetChange}
                  onVisibilityChange={onAssetVisibilityChange ?? (() => {})}
                  onAssetChange={onAssetChange ?? (() => {})}
                  onCreateAsset={onCreateAssetForGroup}
                  onDeleteAsset={onDeleteAsset}
                  onClearAllVisibility={onClearAllVisibility}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DFDDetailsPanel;

/** An imported component: name, prefix, source, "Open component TARA". */
const ComponentSection: React.FC<{ info: ComponentMultiprocessInfo }> = ({ info }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }} data-testid="component-section">
      <Typography variant="caption" color="text.secondary" display="block">
        {t("components.details.title", { ns: "components", defaultValue: "Imported component ({{prefix}}) — read-only", prefix: info.prefix })}
      </Typography>
      <Typography variant="body2" fontWeight="medium">
        {info.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {info.source}
      </Typography>
      {/* Identical units in the same installation context (I5) */}
      {info.onSetQuantity ? (
        <TextField
          size="small"
          type="number"
          label={t("components.details.quantity", { ns: "components", defaultValue: "Quantity (identical units, same place)" })}
          value={info.quantity ?? 1}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1) info.onSetQuantity!(n);
          }}
          sx={{ mt: 1, width: 240 }}
          inputProps={{ min: 1, step: 1, "data-testid": "component-quantity" }}
        />
      ) : (info.quantity ?? 1) > 1 ? (
        <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="component-quantity-label">
          ×{info.quantity}
        </Typography>
      ) : null}
      {info.onOpen && (
        <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={info.onOpen} data-testid="component-open">
          {t("components.details.open", { ns: "components", defaultValue: "Open component TARA" })}
        </Button>
      )}
    </Box>
  );
};
