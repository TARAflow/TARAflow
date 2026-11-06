// ==================== FINDINGS PANEL ====================
// Findings of a tab's validation below its table, in the style of the DFD
// notification panel (FX-1: shared by the Asset and the Hazard tab).
// Errors and warnings are shown by default; infos (legitimate states) are
// behind the info chip so they do not drown the findings that matter. A
// click on a finding opens the object where it is fixed.
//
// The panel knows no feature: each tab hands in its findings as translated
// text and decides what "open" means.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export type FindingSeverity = "error" | "warning" | "info";

/** One finding as the panel shows it. */
export interface PanelFinding {
  /** Unique within the list. */
  id: string;
  severity: FindingSeverity;
  /** The message in the UI language. */
  text: string;
  /** A click opens the object the finding is about. */
  clickable: boolean;
}

/** The panel's own texts, in the UI language. */
export interface FindingsPanelLabels {
  title: (count: number) => string;
  /** Tooltip of the open icon. */
  open: string;
  showInfos: string;
  hideInfos: string;
  onlyInfos: string;
}

export interface FindingsPanelProps {
  /** In display order within a severity — the panel puts errors first, then warnings, then infos. */
  findings: readonly PanelFinding[];
  onOpen: (id: string) => void;
  labels: FindingsPanelLabels;
  /** Test ids: `${prefix}-panel`, `-row`, `-list`, `-resize`, `-info-toggle`. */
  testIdPrefix: string;
}

const RANK: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };

// Resizable like the DFD notification panel: drag the handle upward to grow.
export const MIN_PANEL_HEIGHT = 80;
export const MAX_PANEL_HEIGHT = 500;
const DEFAULT_PANEL_HEIGHT = 180;
const HEADER_HEIGHT = 40;
const HANDLE_HEIGHT = 8;

export const FindingsPanel: React.FC<FindingsPanelProps> = ({ findings, onOpen, labels, testIdPrefix }) => {
  const [expanded, setExpanded] = useState(true);
  const [showInfos, setShowInfos] = useState(false);

  // ── Resize (same interaction as the DFD notification panel) ─────────────
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isResizingRef.current) return;
    e.preventDefault();
    const delta = startYRef.current - e.clientY; // dragging up grows the panel
    setPanelHeight(
      Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, startHeightRef.current + delta)),
    );
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (handleRef.current?.hasPointerCapture?.(e.pointerId)) {
        handleRef.current.releasePointerCapture(e.pointerId);
      }
    },
    [handlePointerMove],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;
      isResizingRef.current = true;
      setIsResizing(true);
      handleRef.current?.setPointerCapture?.(e.pointerId);
      document.addEventListener("pointermove", handlePointerMove, { passive: false });
      document.addEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [panelHeight, handlePointerMove, handlePointerUp],
  );

  useEffect(
    () => () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [handlePointerMove, handlePointerUp],
  );

  const count = (s: FindingSeverity) => findings.filter((f) => f.severity === s).length;
  const errors = count("error");
  const warnings = count("warning");
  const infos = count("info");

  const visible = useMemo(
    () =>
      findings
        .filter((f) => showInfos || f.severity !== "info")
        .slice()
        .sort((a, b) => RANK[a.severity] - RANK[b.severity]),
    [findings, showInfos],
  );

  if (findings.length === 0) return null;

  const borderColor = errors > 0 ? "error.main" : warnings > 0 ? "warning.main" : "info.main";

  return (
    <Paper
      elevation={2}
      data-testid={`${testIdPrefix}-panel`}
      sx={{
        borderRadius: 0,
        borderTop: "2px solid",
        borderColor,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: expanded ? panelHeight : "auto",
        overflow: "hidden",
        userSelect: isResizing ? "none" : "auto",
      }}
    >
      {/* Resize handle — drag upward to increase the panel height */}
      {expanded && (
        <Box
          ref={handleRef}
          data-testid={`${testIdPrefix}-resize`}
          onPointerDown={handlePointerDown}
          sx={{
            height: HANDLE_HEIGHT,
            flexShrink: 0,
            cursor: "row-resize",
            touchAction: "none",
            backgroundColor: isResizing ? "primary.light" : "grey.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: isResizing ? "none" : "background-color 0.2s",
            "&:hover": { backgroundColor: "primary.light" },
            "&:active": { backgroundColor: "primary.main" },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: isResizing ? "primary.contrastText" : "grey.400",
            }}
          />
        </Box>
      )}

      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.6,
          minHeight: HEADER_HEIGHT,
          boxSizing: "border-box",
          flexShrink: 0,
          cursor: "pointer",
          userSelect: "none",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "divider",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
          {labels.title(errors + warnings + (showInfos ? infos : 0))}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {errors > 0 && (
            <Chip
              icon={<ErrorOutlineIcon sx={{ fontSize: "0.95rem !important" }} />}
              label={errors}
              size="small"
              color="error"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {warnings > 0 && (
            <Chip
              icon={<WarningAmberIcon sx={{ fontSize: "0.95rem !important" }} />}
              label={warnings}
              size="small"
              color="warning"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {infos > 0 && (
            <Tooltip
              title={showInfos ? labels.hideInfos : labels.showInfos}
            >
              <Chip
                data-testid={`${testIdPrefix}-info-toggle`}
                icon={<InfoOutlinedIcon sx={{ fontSize: "0.95rem !important" }} />}
                label={infos}
                size="small"
                color="info"
                variant={showInfos ? "filled" : "outlined"}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfos((v) => !v);
                  setExpanded(true);
                }}
                sx={{ height: 22, fontSize: "0.82rem" }}
              />
            </Tooltip>
          )}
        </Stack>
        <IconButton size="small">
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* List */}
      <Collapse in={expanded}>
        <Box
          data-testid={`${testIdPrefix}-list`}
          sx={{
            maxHeight: panelHeight - HEADER_HEIGHT - HANDLE_HEIGHT,
            overflowY: "auto",
          }}
        >
          {visible.map((f) => {
            const clickable = f.clickable;
            const color =
              f.severity === "error" ? "error.main" : f.severity === "warning" ? "warning.dark" : "info.main";
            const Icon =
              f.severity === "error" ? ErrorOutlineIcon : f.severity === "warning" ? WarningAmberIcon : InfoOutlinedIcon;
            return (
              <Box
                key={f.id}
                data-testid={`${testIdPrefix}-row`}
                role={clickable ? "button" : undefined}
                onClick={clickable ? () => onOpen(f.id) : undefined}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.4,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: "none" },
                  cursor: clickable ? "pointer" : "default",
                  "&:hover": clickable ? { bgcolor: "action.hover" } : undefined,
                }}
              >
                <Icon sx={{ fontSize: 18, color, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ flexGrow: 1, minWidth: 0 }}>
                  {f.text}
                </Typography>
                {clickable && (
                  <Tooltip title={labels.open}>
                    <OpenInNewIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Box>
            );
          })}
          {visible.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 1.5, py: 0.75 }}>
              {labels.onlyInfos}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FindingsPanel;
