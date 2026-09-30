// ==================== ASSET NOTIFICATIONS PANEL ====================
// Findings of the asset validation below the asset table, in the style of the
// DFD notification panel. A click on a finding opens the asset in the dialog
// tab where it is fixed (and, for a security goal, on that goal's card).
//
// Errors and warnings are shown by default; infos (legitimate states, e.g. a
// goal without a formal requirement text) are behind the info chip so they do
// not drown the findings that matter.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
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

import type { AssetFinding } from "../services/asset-validator";
import { compareDisplayIds } from "shared";

const RANK: Record<AssetFinding["severity"], number> = { error: 0, warning: 1, info: 2 };

// Resizable like the DFD notification panel: drag the handle upward to grow.
export const MIN_PANEL_HEIGHT = 80;
export const MAX_PANEL_HEIGHT = 500;
const DEFAULT_PANEL_HEIGHT = 180;
const HEADER_HEIGHT = 40;
const HANDLE_HEIGHT = 8;

export interface AssetNotificationPanelProps {
  findings: AssetFinding[];
  /** Open the asset of the finding in the right dialog tab. */
  onOpen: (finding: AssetFinding) => void;
}

export const AssetNotificationPanel: React.FC<AssetNotificationPanelProps> = ({
  findings,
  onOpen,
}) => {
  const { t } = useTranslation();
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

  const count = (s: AssetFinding["severity"]) =>
    findings.filter((f) => f.severity === s).length;
  const errors = count("error");
  const warnings = count("warning");
  const infos = count("info");

  const visible = useMemo(
    () =>
      findings
        .filter((f) => showInfos || f.severity !== "info")
        .sort(
          (a, b) =>
            RANK[a.severity] - RANK[b.severity] ||
            compareDisplayIds(a.assetLabel, b.assetLabel) ||
            a.key.localeCompare(b.key),
        ),
    [findings, showInfos],
  );

  if (findings.length === 0) return null;

  const borderColor = errors > 0 ? "error.main" : warnings > 0 ? "warning.main" : "info.main";
  const message = (f: AssetFinding) =>
    t(f.key, {
      id: f.assetLabel ?? "",
      type: f.goal ?? "",
      criterion: f.criterionId
        ? t(`tabs.assets.impactCriteria.${f.criterionId}.name`, { defaultValue: f.criterionId })
        : "",
    });

  return (
    <Paper
      elevation={2}
      data-testid="asset-notification-panel"
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
          data-testid="asset-notification-resize"
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
          {t("tabs.assets.notifications.title", {
            count: errors + warnings + (showInfos ? infos : 0),
            defaultValue: "{{count}} finding(s)",
          })}
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
              title={
                showInfos
                  ? t("tabs.assets.notifications.hideInfos", { defaultValue: "Hide infos" })
                  : t("tabs.assets.notifications.showInfos", { defaultValue: "Show infos" })
              }
            >
              <Chip
                data-testid="asset-notification-info-toggle"
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
          data-testid="asset-notification-list"
          sx={{
            maxHeight: panelHeight - HEADER_HEIGHT - HANDLE_HEIGHT,
            overflowY: "auto",
          }}
        >
          {visible.map((f, i) => {
            const clickable = !!f.assetId;
            const color =
              f.severity === "error" ? "error.main" : f.severity === "warning" ? "warning.dark" : "info.main";
            const Icon =
              f.severity === "error" ? ErrorOutlineIcon : f.severity === "warning" ? WarningAmberIcon : InfoOutlinedIcon;
            return (
              <Box
                key={`${f.key}-${f.assetId ?? ""}-${f.goal ?? ""}-${i}`}
                data-testid="asset-notification-row"
                role={clickable ? "button" : undefined}
                onClick={clickable ? () => onOpen(f) : undefined}
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
                  {message(f)}
                </Typography>
                {clickable && (
                  <Tooltip
                    title={t("tabs.assets.notifications.open", {
                      defaultValue: "Open the asset where this is fixed",
                    })}
                  >
                    <OpenInNewIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Box>
            );
          })}
          {visible.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 1.5, py: 0.75 }}>
              {t("tabs.assets.notifications.onlyInfos", {
                defaultValue: "No errors or warnings — infos are hidden.",
              })}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
