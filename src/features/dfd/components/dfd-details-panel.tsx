// ==================== DFD DETAILS PANEL ====================
// Slide-over panel displaying element/connection description forms.
// Positioned absolutely over the DFD canvas — no layout shift on open/close.
// Toggle tab sits on the left edge, always visible.
//
// Tab behaviour:
//   • Element selected  → both "Element" and "Assets" tabs shown
//   • Nothing selected  → only "Assets" tab shown (Element tab hidden)

import React, { useEffect, useState } from "react";
import { Box, IconButton, Tab, Tabs, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import type {
  AssetGroup,
  DFDAsset,
  DFDConnection,
  DFDElement,
} from "../models/dfd-types";
import type { AvailableAsset } from "./forms/asset-relation-selector";
import { DFDElementForm } from "./dfd-element-form";
import { AssetPanel } from "./dfd-asset-panel";
import type { AssetVisibility } from "./dfd-asset-panel";

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
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
  /** Current DFD visibility state for assets (controlled from parent) */
  assetVisibility?: AssetVisibility;
  /** Called when user toggles eye icon in asset tree */
  onAssetVisibilityChange?: (group: AssetGroup, assetId: string | null) => void;
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
  onAssetFeatureUpdate,
  assetVisibility = {},
  onAssetVisibilityChange,
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
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, lineHeight: 1.4 }}
                >
                  {t("tabs.dfd.detailsPanel.assetsTitle", {
                    defaultValue: "Asset List",
                  })}
                </Typography>
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
                <DFDElementForm
                  element={element}
                  connection={connection}
                  onChange={onChange}
                  availableAssets={availableAssets}
                  crossesTrustBoundary={crossesTrustBoundary}
                  onCreateAsset={onCreateAsset}
                />
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
                  onVisibilityChange={onAssetVisibilityChange ?? (() => {})}
                  onAssetChange={onAssetChange ?? (() => {})}
                  onAssetFeatureUpdate={onAssetFeatureUpdate}
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