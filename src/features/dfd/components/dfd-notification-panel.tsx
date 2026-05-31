// ==================== DFD NOTIFICATIONS PANEL ====================
// Unified notification panel for the DFD Tab.
// Replaces DFDValidationPanel and DFDControlGapPanel.
//
// Message types (in display order):
//   error    — structural validation errors (red)
//   warning  — structural validation warnings (yellow)
//   security — control gap suggestions from Risk Tab mitigations (orange)
//
// Future extension points:
//   drift    — SecurityDrift conflicts (Phase 3)
//   staleness — expired verifications (Phase 3)

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Paper,
  Stack,
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  Button,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SecurityIcon from "@mui/icons-material/Security";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import FilterListIcon from "@mui/icons-material/FilterList";

import type { ValidationResult } from "../services/dfd-validator";
import type { ControlInstance } from "shared/models/control-instance";
import type { SecurityDrift } from "app/hooks/use-security-drift";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { getLocalizedMitigation } from "features/threats/services/threat-catalog-service";


// ==================== RESIZE CONSTANTS ====================

const MIN_PANEL_HEIGHT = 80;
const DEFAULT_PANEL_HEIGHT = 150;
const HEADER_HEIGHT = 44;

// ==================== NOTIFICATION TYPES ====================

type NotificationType = "error" | "warning" | "security" | "drift" | "conflict";

interface BaseNotification {
  key: string;
  type: NotificationType;
}

interface ValidationNotification extends BaseNotification {
  type: "error" | "warning";
  message: string;
  displayId?: string;
  elementId?: string;
}

interface SecurityNotification extends BaseNotification {
  type: "security";
  /** Stable DFD element or connection ID — used for onApply */
  elementId: string;
  /** True when elementId refers to a DFDConnection, false for DFDElement */
  isConnection: boolean;
  elementDisplayId: string;
  elementName: string;
  property: string;
  currentValue: unknown;
  expectedValue: unknown;
  inferenceConfidence: "deterministic" | "heuristic";
  coversMitigationIds: string[];
  coversRiskIds: string[];
}

interface DriftNotification extends BaseNotification {
  type: "drift" | "conflict";
  elementId: string;
  elementDisplayId: string;
  elementName: string;
  property: string;
  currentValue: unknown;
  expectedValue: unknown;
  recordedValue: unknown;
  /** Only present on conflict */
  conflictDetail?: SecurityDrift["conflictDetail"];
}

type Notification =
  | ValidationNotification
  | SecurityNotification
  | DriftNotification;

// ==================== VALUE HELPERS ====================

const EMPTY_VALUES = new Set([
  undefined,
  null,
  "",
  "none",
  "not_specified",
  false,
]);

function isEmptyValue(value: unknown): boolean {
  return EMPTY_VALUES.has(value as any);
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (value === false) return "false";
  if (value === true) return "true";
  return String(value);
}

// ==================== VALIDATION MESSAGE PARSER ====================
// Matches format from DFDValidator:
//   "dfdValidation.noElements"
//   "dfdValidation.emptyTrustBoundary:TB Name"
//   "dfdValidation.unconnectedElement:Process:MyProcess"

function useValidationTranslation() {
  const { t } = useTranslation();

  const translateMessage = (message: string): string => {
    // ── Neues Format: KEY|displayId|...  (LP-Validator) ─────────────────────
    if (message.includes("|")) {
      const parts = message.split("|");
      const key = parts[0];
      // parts[1] = displayId — wird als Chip gerendert, nicht in t()
      const detail = parts[2] ?? "";

      // LP-2: KEY|displayId|tag|expected,csv|got
      // LP-3: KEY|displayId|verbTag|expected,csv|got
      if (parts.length === 5) {
        const combo = parts[2];
        const expected = parts[3]
          .split(",")
          .map((v) =>
            t(
              `tabs.dfd.element_description.dataflow.fields.messageType.options.${v}`,
              { defaultValue: v },
            ),
          )
          .join(", ");
        const got = t(
          `tabs.dfd.element_description.dataflow.fields.messageType.options.${parts[4]}`,
          { defaultValue: parts[4] },
        );
        return t(key, {
          combo,
          expected,
          got,
          detail,
          defaultValue: `${combo}: expected ${expected}, got ${got}`,
        });
      }

      // LP-4: KEY|displayId|protocol
      // Label-Validator simple messages: KEY|displayId|detail
      if (parts.length === 3) {
        const displayId = parts[1];
        return t(key, {
          protocol: detail,
          name: displayId, // {{name}} interpolation uses displayId, not elementType
          detail,
          defaultValue: displayId,
        });
      }

      // LP-5: KEY|displayId|targetName|targetType
      if (
        parts.length === 4 &&
        key !== "tabs.dfd.validation.element.missingProperty"
      ) {
        const targetName = parts[2];
        const targetType = t(`dfdValidation.elementTypes.${parts[3]}`, {
          defaultValue: parts[3],
        });
        return t(key, {
          targetName,
          targetType,
          name: detail,
          detail,
          defaultValue: `${targetName} (${targetType})`,
        });
      }

      // Element missing property: KEY|displayId|elementType|field
      if (
        parts.length === 4 &&
        key === "tabs.dfd.validation.element.missingProperty"
      ) {
        // DFD element type -> i18n namespace key under element_description
        const ELEMENT_TYPE_NS: Record<string, string> = {
          Process: "process",
          Multiprocess: "multiprocess",
          DataStore: "datastore",
          ExternalEntity: "external_entity",
          TrustBoundary: "trustboundary",
          ChipBoundary: "chipboundary",
          Interface: "interface",
        };
        // Shared field label keys — same as fieldTranslationKeys in
        // dataflow-description-form.tsx. Checked first; per-type lookup is fallback.
        const FIELD_SHARED_LABEL: Record<string, string> = {
          exposureLevel: "tabs.dfd.element_description.exposure_level.label",
          defaultExposureLevel:
            "tabs.dfd.element_description.exposure_level.label",
        };
        const ns = ELEMENT_TYPE_NS[parts[2]] ?? parts[2].toLowerCase();
        const rawField = parts[3];
        const sharedPath = FIELD_SHARED_LABEL[rawField];
        const elementType = t(`dfdValidation.elementTypes.${parts[2]}`, {
          defaultValue: parts[2],
        });
        const field = sharedPath
          ? t(sharedPath, { defaultValue: rawField })
          : t(`tabs.dfd.element_description.${ns}.fields.${rawField}.label`, {
              defaultValue: rawField,
            });
        return t(key, {
          elementType,
          displayId: parts[1],
          field,
          defaultValue: `${elementType} ${parts[1]}: field '${rawField}' must be set`,
        });
      }

      // Fallback: unbekanntes Format
      return t(key, { detail, defaultValue: parts.slice(2).join(" — ") });
    }

    // ── Bestehendes Format: KEY  oder  KEY:name  oder  KEY:type:name ─────────
    const parts = message.split(":");
    const key = parts[0];

    if (parts.length === 1) return t(key);

    if (parts.length === 2) return t(key, { name: parts[1] });

    if (parts.length === 3) {
      const translatedType = t(`dfdValidation.elementTypes.${parts[1]}`, {
        defaultValue: parts[1],
      });
      return t(key, { type: translatedType, name: parts[2] });
    }

    return message;
  };

  return { translateMessage };
}

// ==================== NOTIFICATION BUILDER ====================

function buildNotifications(
  validation: ValidationResult | null | undefined,
  controlInstances: ControlInstance[],
  securityDrifts: SecurityDrift[],
  elements: DFDElement[],
  connections: DFDConnection[],
): Notification[] {
  const notifications: Notification[] = [];

  // displayId → interne XML-id
  const elementByDisplayId = new Map<string, string>([
    ...elements.map((e): [string, string] => [e.displayId, e.id]),
    ...connections.map((c): [string, string] => [c.displayId, c.id]),
  ]);

  (validation?.errors ?? []).forEach((msg, idx) => {
    const displayId = msg.includes("|") ? msg.split("|")[1] : undefined;
    const elementId = displayId ? elementByDisplayId.get(displayId) : undefined;
    notifications.push({
      key: `error:${idx}:${msg}`,
      type: "error",
      message: msg,
      displayId,
      elementId,
    });
  });

  (validation?.warnings ?? []).forEach((msg, idx) => {
    const displayId = msg.includes("|") ? msg.split("|")[1] : undefined;
    const elementId = displayId ? elementByDisplayId.get(displayId) : undefined;
    notifications.push({
      key: `warning:${idx}:${msg}`,
      type: "warning",
      message: msg,
      displayId,
      elementId,
    });
  });

  if (controlInstances.length > 0) {
    const elementById = new Map(elements.map((e) => [e.id, e]));
    const connectionById = new Map(connections.map((c) => [c.id, c]));

    for (const instance of controlInstances) {
      const element = elementById.get(instance.elementId);
      const connection = connectionById.get(instance.elementId);
      if (!element && !connection) continue;

      const isConnection = !element;
      const target = element ?? connection!;
      const currentValue = (target.properties as any)?.[instance.property];

      // Skip already satisfied
      if (
        !isEmptyValue(currentValue) &&
        currentValue === instance.expectedValue
      ) {
        continue;
      }

      notifications.push({
        key: instance.instanceKey,
        type: "security",
        elementId: instance.elementId,
        isConnection,
        elementDisplayId: target.displayId,
        elementName: target.name,
        property: instance.property,
        currentValue,
        expectedValue: instance.expectedValue,
        inferenceConfidence: instance.inferenceConfidence,
        coversMitigationIds: instance.coversMitigationIds,
        coversRiskIds: instance.coversRiskIds,
      });
    }
  }

  // Drift / conflict notifications from SecurityDrift
  for (const drift of securityDrifts) {
    if (drift.status === "aligned" || drift.status === "missing") continue;

    const el = elements.find((e) => e.id === drift.elementId);
    const conn = connections.find((c) => c.id === drift.elementId);
    if (!el && !conn) continue;
    const target = el ?? conn!;

    notifications.push({
      key: `${drift.status}:${drift.instanceKey}`,
      type: drift.status === "conflict" ? "conflict" : "drift",
      elementId: drift.elementId,
      elementDisplayId: target.displayId,
      elementName: target.name,
      property: drift.property,
      currentValue: drift.currentValue,
      expectedValue: drift.expectedValue,
      recordedValue: drift.recordedValue,
      conflictDetail: drift.conflictDetail,
    });
  }

  return notifications;
}

// ==================== PROPS ====================

export interface DFDNotificationsPanelProps {
  validation?: ValidationResult | null;
  controlInstances?: ControlInstance[];
  securityDrifts?: SecurityDrift[];
  elements?: DFDElement[];
  connections?: DFDConnection[];
  /**
   * Called when analyst clicks Apply on a security gap row.
   * DFD Tab handler routes to editor.updateElementDescription or
   * editor.updateConnectionDescription based on isConnection.
   * Omit to render panel read-only (no Apply buttons shown).
   */
  onApply?: (
    elementId: string,
    property: string,
    value: unknown,
    isConnection: boolean,
    mitigationId?: string,
    riskId?: string,
  ) => void;
  onSelectCell?: (cellId: string) => void;
}

// ==================== COMPONENT ====================

type FilterType = "all" | "error" | "warning" | "security";

export const DFDNotificationsPanel: React.FC<DFDNotificationsPanelProps> = ({
  validation,
  controlInstances = [],
  securityDrifts = [],
  elements = [],
  connections = [],
  onApply,
  onSelectCell,
}) => {
  const { t } = useTranslation();
  const { translateMessage } = useValidationTranslation();
  const [expanded, setExpanded] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isResizingRef.current) return;
    e.preventDefault();
    // Panel grows upward — dragging up increases height
    const deltaY = startYRef.current - e.clientY;
    const newHeight = Math.max(
      MIN_PANEL_HEIGHT,
      Math.min(500, startHeightRef.current + deltaY),
    );
    setPanelHeight(newHeight);
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
      if (resizeHandleRef.current?.hasPointerCapture(e.pointerId)) {
        resizeHandleRef.current.releasePointerCapture(e.pointerId);
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
      resizeHandleRef.current?.setPointerCapture(e.pointerId);
      document.addEventListener("pointermove", handlePointerMove, {
        passive: false,
      });
      document.addEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [panelHeight, handlePointerMove, handlePointerUp],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [handlePointerMove, handlePointerUp]);

  const notifications = useMemo(
    () =>
      buildNotifications(
        validation,
        controlInstances,
        securityDrifts,
        elements,
        connections,
      ),
    [validation, controlInstances, securityDrifts, elements, connections],
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "error")
      return notifications.filter(
        (n) => n.type === "error" || n.type === "conflict",
      );
    if (activeFilter === "warning")
      return notifications.filter(
        (n) => n.type === "warning" || n.type === "drift",
      );
    if (activeFilter === "security")
      return notifications.filter((n) => n.type === "security");
    return notifications;
  }, [notifications, activeFilter]);

  if (notifications.length === 0) return null;

  const errorCount = notifications.filter((n) => n.type === "error").length;
  const warningCount = notifications.filter((n) => n.type === "warning").length;
  const securityCount = notifications.filter(
    (n) => n.type === "security",
  ).length;
  const driftCount = notifications.filter((n) => n.type === "drift").length;
  const conflictCount = notifications.filter(
    (n) => n.type === "conflict",
  ).length;

  const borderColor =
    errorCount > 0 || conflictCount > 0
      ? "error.main"
      : securityCount > 0 || driftCount > 0
        ? "warning.main"
        : "warning.light";

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 0,
        borderTop: "2px solid",
        borderColor,
        height: expanded ? panelHeight : "auto",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        userSelect: isResizing ? "none" : "auto",
      }}
    >
      {/* Resize Handle — drag upward to increase panel height */}
      <Box
        ref={resizeHandleRef}
        onPointerDown={handlePointerDown}
        sx={{
          height: 8,
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
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.6,
          bgcolor: "background.paper",
          cursor: "pointer",
          userSelect: "none",
          flexShrink: 0,
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "divider",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
          {t("tabs.dfd.notifications.title", {
            count: notifications.length,
            defaultValue: "{{count}} notification(s)",
          })}
        </Typography>

        <Stack direction="row" spacing={0.5}>
          {errorCount > 0 && (
            <Chip
              icon={
                <ErrorOutlineIcon sx={{ fontSize: "0.95rem !important" }} />
              }
              label={errorCount}
              size="small"
              color="error"
              variant="filled"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {warningCount > 0 && (
            <Chip
              icon={
                <WarningAmberIcon sx={{ fontSize: "0.95rem !important" }} />
              }
              label={warningCount}
              size="small"
              color="warning"
              variant="filled"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {securityCount > 0 && (
            <Chip
              icon={<SecurityIcon sx={{ fontSize: "0.95rem !important" }} />}
              label={securityCount}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {driftCount > 0 && (
            <Chip
              label={`${driftCount} drift`}
              size="small"
              color="warning"
              variant="filled"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
          {conflictCount > 0 && (
            <Chip
              label={`${conflictCount} conflict`}
              size="small"
              color="error"
              variant="filled"
              sx={{ height: 22, fontSize: "0.82rem" }}
            />
          )}
        </Stack>

        {/* Filter dropdown — stop click so header collapse doesn't trigger */}
        <FormControl
          size="small"
          variant="standard"
          onClick={(e) => e.stopPropagation()}
          sx={{ minWidth: 100 }}
        >
          <Select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as FilterType)}
            disableUnderline
            startAdornment={
              <FilterListIcon
                sx={{ fontSize: 16, mr: 0.5, color: "text.secondary" }}
              />
            }
            sx={{ fontSize: "0.82rem", "& .MuiSelect-select": { py: 0 } }}
          >
            <MenuItem value="all" sx={{ fontSize: "0.85rem" }}>
              {t("tabs.dfd.notifications.filter.all", { defaultValue: "All" })}{" "}
              ({notifications.length})
            </MenuItem>
            {errorCount + conflictCount > 0 && (
              <MenuItem value="error" sx={{ fontSize: "0.85rem" }}>
                {t("tabs.dfd.notifications.filter.errors", {
                  defaultValue: "Errors",
                })}{" "}
                ({errorCount + conflictCount})
              </MenuItem>
            )}
            {warningCount + driftCount > 0 && (
              <MenuItem value="warning" sx={{ fontSize: "0.85rem" }}>
                {t("tabs.dfd.notifications.filter.warnings", {
                  defaultValue: "Warnings",
                })}{" "}
                ({warningCount + driftCount})
              </MenuItem>
            )}
            {securityCount > 0 && (
              <MenuItem value="security" sx={{ fontSize: "0.85rem" }}>
                {t("tabs.dfd.notifications.filter.apply", {
                  defaultValue: "Apply",
                })}{" "}
                ({securityCount})
              </MenuItem>
            )}
          </Select>
        </FormControl>

        <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
          {expanded ? (
            <ExpandMoreIcon fontSize="medium" />
          ) : (
            <ExpandLessIcon fontSize="medium" />
          )}
        </IconButton>
      </Box>

      {/* Notification list */}
      <Collapse in={expanded}>
        <Stack
          spacing={0}
          sx={{ overflow: "auto", maxHeight: panelHeight - HEADER_HEIGHT - 8 }}
        >
          {filteredNotifications.map((n) =>
            n.type === "error" || n.type === "warning" ? (
              <ValidationRow
                key={n.key}
                notification={n as ValidationNotification}
                translateMessage={translateMessage}
                onSelectCell={onSelectCell}
              />
            ) : n.type === "drift" || n.type === "conflict" ? (
              <DriftRow key={n.key} notification={n as DriftNotification} />
            ) : (
              <SecurityRow
                key={n.key}
                notification={n as SecurityNotification}
                onApply={onApply}
                onSelectCell={onSelectCell}
              />
            ),
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
};

// ==================== VALIDATION ROW ====================

interface ValidationRowProps {
  notification: ValidationNotification;
  translateMessage: (msg: string) => string;
  onSelectCell?: (cellId: string) => void;
}

const ValidationRow: React.FC<ValidationRowProps> = ({
  notification,
  translateMessage,
  onSelectCell,
}) => (
  <Box
    onClick={() =>
      notification.elementId && onSelectCell?.(notification.elementId)
    }
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      px: 1.5,
      py: 0.35,
      borderBottom: "1px solid",
      borderColor: "divider",
      "&:last-child": { borderBottom: "none" },
      bgcolor: notification.type === "error" ? "error.50" : "warning.50",
      flexWrap: "nowrap",
      minWidth: 0,
      cursor: notification.elementId ? "pointer" : "default",
      "&:hover": notification.elementId ? { filter: "brightness(0.96)" } : {},
    }}
  >
    {notification.type === "error" ? (
      <ErrorOutlineIcon
        sx={{ fontSize: 18, color: "error.main", flexShrink: 0 }}
      />
    ) : (
      <WarningAmberIcon
        sx={{ fontSize: 18, color: "warning.dark", flexShrink: 0 }}
      />
    )}

    {/* displayId-Chip — nur bei LP-Meldungen im |KEY|displayId|detail Format */}
    {notification.displayId && (
      <Chip
        label={notification.displayId}
        size="small"
        variant="outlined"
        color={notification.type === "error" ? "error" : "warning"}
        sx={{ height: 20, fontSize: "0.78rem", flexShrink: 0 }}
      />
    )}

    <Typography
      variant="caption"
      sx={{ color: "text.primary", minWidth: 0 }}
      noWrap
    >
      {translateMessage(notification.message)}
    </Typography>
  </Box>
);

// ==================== SECURITY ROW ====================

interface SecurityRowProps {
  notification: SecurityNotification;
  onApply?: DFDNotificationsPanelProps["onApply"];
  onSelectCell?: (cellId: string) => void;
}

const SecurityRow: React.FC<SecurityRowProps> = ({
  notification,
  onApply,
  onSelectCell,
}) => {
  const { t } = useTranslation();

  const mitigationLabel = useMemo(() => {
    const firstId = notification.coversMitigationIds[0];
    return firstId ? getLocalizedMitigation(firstId) : "";
  }, [notification.coversMitigationIds]);

  const additionalCount = notification.coversMitigationIds.length - 1;

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onApply?.(
      notification.elementId,
      notification.property,
      notification.expectedValue,
      notification.isConnection,
      notification.coversMitigationIds[0],
      notification.coversRiskIds[0],
    );
  };

  return (
    <Box
      onClick={() =>
        notification.elementId && onSelectCell?.(notification.elementId)
      }
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.35,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": { borderBottom: "none" },
        bgcolor: "warning.50",
        flexWrap: "nowrap",
        minWidth: 0,
        cursor: notification.elementId ? "pointer" : "default",
        "&:hover": notification.elementId ? { filter: "brightness(0.96)" } : {},
      }}
    >
      <SecurityIcon
        sx={{ fontSize: 18, color: "warning.dark", flexShrink: 0 }}
      />

      <Chip
        label={notification.elementDisplayId}
        size="small"
        variant="outlined"
        sx={{ height: 20, fontSize: "0.78rem", flexShrink: 0 }}
      />
      <Typography
        variant="caption"
        noWrap
        title={notification.elementName}
        sx={{
          color: "text.secondary",
          flexShrink: 0,
          maxWidth: 240,
        }}
      >
        {notification.elementName}
      </Typography>

      {/* Property: current → expected */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            fontFamily: "monospace",
            fontSize: "0.78rem",
          }}
        >
          {notification.property}
        </Typography>
        <Typography variant="caption" sx={{ color: "error.main" }}>
          {formatValue(notification.currentValue)}
        </Typography>
        <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{ color: "success.dark" }}
        >
          {formatValue(notification.expectedValue)}
        </Typography>
      </Box>

      {/* Heuristic badge */}
      {notification.inferenceConfidence === "heuristic" && (
        <Tooltip
          title={t("tabs.dfd.notifications.heuristic", {
            defaultValue: "Heuristic mapping — confirm before applying",
          })}
          placement="top"
        >
          <Chip
            label="~"
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontSize: "0.72rem",
              flexShrink: 0,
              cursor: "help",
            }}
          />
        </Tooltip>
      )}

      {/* Source mitigation */}
      <Tooltip
        title={
          additionalCount > 0
            ? `${mitigationLabel} +${additionalCount} more`
            : mitigationLabel
        }
        placement="top"
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            color: "text.disabled",
            fontStyle: "italic",
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          {mitigationLabel}
          {additionalCount > 0 && ` +${additionalCount}`}
        </Typography>
      </Tooltip>

      {/* Apply button — only rendered when onApply is provided */}
      {onApply && (
        <Tooltip
          title={t("tabs.dfd.notifications.applyTooltip", {
            defaultValue: "Apply suggestion to model",
          })}
          placement="top"
        >
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<CheckIcon sx={{ fontSize: "0.95rem !important" }} />}
            onClick={handleApply}
            sx={{
              height: 22,
              minWidth: 0,
              px: 0.75,
              fontSize: "0.78rem",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {t("tabs.dfd.notifications.applyLabel", { defaultValue: "Apply" })}
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};

export default DFDNotificationsPanel;

// ==================== DRIFT ROW ====================

interface DriftRowProps {
  notification: DriftNotification;
}

const DriftRow: React.FC<DriftRowProps> = ({ notification }) => {
  const { t } = useTranslation();
  const isConflict = notification.type === "conflict";

  const detail = notification.conflictDetail;
  const tooltipText = isConflict
    ? detail?.isManualOverride
      ? t("tabs.dfd.notifications.conflict.manualOverride", {
          defaultValue: "Property set manually but differs from Risk decision",
        })
      : t("tabs.dfd.notifications.conflict.staleRecord", {
          defaultValue: "Applied value no longer matches current requirement",
        })
    : t("tabs.dfd.notifications.drift.reverted", {
        property: notification.property,
        defaultValue: "Property was reverted after Apply",
      });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.35,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": { borderBottom: "none" },
        bgcolor: isConflict ? "error.50" : "warning.50",
        flexWrap: "nowrap",
        minWidth: 0,
      }}
    >
      {isConflict ? (
        <ErrorOutlineIcon
          sx={{ fontSize: 18, color: "error.main", flexShrink: 0 }}
        />
      ) : (
        <WarningAmberIcon
          sx={{ fontSize: 18, color: "warning.dark", flexShrink: 0 }}
        />
      )}

      <Chip
        label={notification.elementDisplayId}
        size="small"
        variant="outlined"
        color={isConflict ? "error" : "warning"}
        sx={{ height: 20, fontSize: "0.78rem", flexShrink: 0 }}
      />

      <Typography
        variant="caption"
        noWrap
        sx={{ color: "text.secondary", flexShrink: 0, maxWidth: 100 }}
      >
        {notification.elementName}
      </Typography>

      {/* property: IS → SHOULD */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            fontFamily: "monospace",
            fontSize: "0.78rem",
          }}
        >
          {notification.property}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: isConflict ? "error.main" : "warning.dark" }}
        >
          {String(notification.currentValue ?? "—")}
        </Typography>
        <ArrowForwardIcon sx={{ fontSize: 12, color: "text.disabled" }} />
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{ color: "success.dark" }}
        >
          {String(notification.expectedValue)}
        </Typography>
      </Box>

      {/* Status label with tooltip */}
      <Tooltip title={tooltipText} placement="top">
        <Chip
          label={
            isConflict
              ? t("tabs.dfd.notifications.conflict.label", {
                  defaultValue: "Conflict",
                })
              : t("tabs.dfd.notifications.drift.label", {
                  defaultValue: "Drift",
                })
          }
          size="small"
          color={isConflict ? "error" : "warning"}
          variant="outlined"
          sx={{
            height: 22,
            fontSize: "0.72rem",
            flexShrink: 0,
            cursor: "help",
          }}
        />
      </Tooltip>

      {/* When applied info */}
      {detail?.setAt && (
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            fontStyle: "italic",
            flexGrow: 1,
            textAlign: "right",
          }}
        >
          {t("tabs.dfd.notifications.drift.applied", {
            date: new Date(detail.setAt).toLocaleDateString(),
            defaultValue: "Applied {{date}}",
          })}
        </Typography>
      )}
    </Box>
  );
};