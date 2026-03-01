// ==================== DFD DETAILS PANEL ====================
// Slide-over panel displaying element/connection description forms.
// Positioned absolutely over the DFD canvas — no layout shift on open/close.
// Toggle tab sits on the left edge, always visible.

import React from "react";
import {
  Box,
  IconButton,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import type { AvailableAsset } from "./forms/asset-relation-selector";
import { DFDElementForm } from "./dfd-element-form";

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
  /** Whether the selected connection crosses a trust boundary */
  crossesTrustBoundary?: boolean;
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
  crossesTrustBoundary = false,
}) => {
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
        pointerEvents: "none", // Let clicks pass through when panel is closed
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
            width: 400,
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
              p: 2,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography variant="h6">
                {displayId ?? "Details"}
              </Typography>
              {name && (
                <Typography variant="body2" color="text.secondary">
                  {name}
                </Typography>
              )}
            </Box>
            <IconButton onClick={onClose} size="small" sx={{ ml: 1 }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Scrollable content */}
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            <DFDElementForm
              element={element}
              connection={connection}
              onChange={onChange}
              availableAssets={availableAssets}
              crossesTrustBoundary={crossesTrustBoundary}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DFDDetailsPanel;