// ==================== DFD PREVIEW PANEL ====================
// Displays the DFD image with zoom and pan capabilities
// Uses thumbnail from project.dfd.thumbnail (generated on DFD save)

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Slider,
  CircularProgress,
} from "@mui/material";
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

import { Asset } from "../models/asset-types";

// ==================== TYPES ====================

interface DFDPreviewPanelProps {
  /** DFD thumbnail image (base64 SVG or data URL) */
  imageSrc?: string;
  /** Assets for potential highlighting (future feature) */
  assets?: Asset[];
  /** Callback to regenerate thumbnail if missing */
  onRegenerateThumbnail?: () => Promise<string | null>;
  /** Loading state while generating */
  isGenerating?: boolean;
}

// ==================== CONSTANTS ====================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// ==================== COMPONENT ====================

export const DFDPreviewPanel: React.FC<DFDPreviewPanelProps> = ({
  imageSrc,
  assets = [],
  onRegenerateThumbnail,
  isGenerating = false,
}) => {
  const { t } = useTranslation();

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // ==================== ZOOM HANDLERS ====================

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current;
    const image = imageRef.current;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = image.naturalWidth || 800;
    const imageHeight = image.naturalHeight || 600;

    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.95; // 95% to add some padding

    setZoom(newZoom);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomSlider = useCallback((_: Event, value: number | number[]) => {
    setZoom(value as number);
  }, []);

  // ==================== PAN HANDLERS ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ==================== WHEEL ZOOM ====================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  // ==================== REGENERATE THUMBNAIL ====================

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerateThumbnail || isRegenerating) return;

    setIsRegenerating(true);
    try {
      await onRegenerateThumbnail();
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegenerateThumbnail, isRegenerating]);

  // ==================== FIT ON LOAD ====================

  useEffect(() => {
    if (imageSrc) {
      // Fit to screen when image loads
      const timer = setTimeout(handleFitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [imageSrc, handleFitToScreen]);

  // ==================== RENDER: NO IMAGE ====================

  if (!imageSrc && !isGenerating && !isRegenerating) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "grey.100",
          color: "text.secondary",
          gap: 2,
        }}
      >
        <Typography variant="body1">
          {t("tabs.assets.noDFDImage", {
            defaultValue: "No DFD image available",
          })}
        </Typography>
        <Typography
          variant="caption"
          sx={{ textAlign: "center", maxWidth: 300 }}
        >
          {t("tabs.assets.noDFDImageHint", {
            defaultValue: "Save the DFD to generate a preview image",
          })}
        </Typography>
        {onRegenerateThumbnail && (
          <Tooltip
            title={t("tabs.assets.dfdPreview.regenerate", {
              defaultValue: "Generate preview from DFD",
            })}
          >
            <IconButton onClick={handleRegenerate} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // ==================== RENDER: LOADING ====================

  if (isGenerating || isRegenerating) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "grey.100",
          color: "text.secondary",
          gap: 2,
        }}
      >
        <CircularProgress size={32} />
        <Typography variant="body2">
          {t("tabs.assets.dfdPreview.generating", {
            defaultValue: "Generating preview...",
          })}
        </Typography>
      </Box>
    );
  }

  // ==================== RENDER: IMAGE ====================

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 0.5,
          backgroundColor: "grey.50",
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: 40,
        }}
      >
        <Tooltip
          title={t("tabs.assets.dfdPreview.zoomOut", {
            defaultValue: "Zoom Out",
          })}
        >
          <IconButton size="small" onClick={handleZoomOut}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Slider
          value={zoom}
          onChange={handleZoomSlider}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          sx={{ width: 100 }}
          size="small"
        />

        <Tooltip
          title={t("tabs.assets.dfdPreview.zoomIn", {
            defaultValue: "Zoom In",
          })}
        >
          <IconButton size="small" onClick={handleZoomIn}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Typography variant="caption" sx={{ minWidth: 45 }}>
          {Math.round(zoom * 100)}%
        </Typography>

        <Tooltip
          title={t("tabs.assets.dfdPreview.fitToScreen", {
            defaultValue: "Fit to Screen",
          })}
        >
          <IconButton size="small" onClick={handleFitToScreen}>
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip
          title={t("tabs.assets.dfdPreview.resetView", {
            defaultValue: "Reset View",
          })}
        >
          <IconButton size="small" onClick={handleResetView}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="caption" color="text.secondary">
          {t("tabs.assets.dfdPreview.hint", {
            defaultValue: "Drag to pan, scroll to zoom",
          })}
        </Typography>
      </Box>

      {/* Image Container */}
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflow: "hidden",
          cursor: isDragging ? "grabbing" : "grab",
          backgroundColor: "grey.200",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt="DFD Preview"
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            maxWidth: "none",
            maxHeight: "none",
            userSelect: "none",
            pointerEvents: "none",
          }}
          onLoad={handleFitToScreen}
        />
      </Box>
    </Box>
  );
};

export default DFDPreviewPanel;