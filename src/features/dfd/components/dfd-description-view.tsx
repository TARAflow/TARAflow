// ==================== DFD DESCRIPTION VIEW ====================
// Single Responsibility: Display and edit DFD element descriptions grouped by type
// Accordion state is controlled from parent via props for persistence

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  Stack,
  Alert,
  Paper,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Security as TrustBoundaryIcon,
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  SwapHoriz as DataFlowIcon,
  DeviceHub as InterfaceIcon,
  MonetizationOnOutlined as AssetIcon,
  Cable as PhysicalInterfaceIcon,
} from "@mui/icons-material";

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
  DFDElementType,
} from "../models/dfd-types";
import { DFD_ELEMENT_CONFIG } from "../models/dfd-types";
import {
  ElementDescriptionForm,
  ConnectionDescriptionForm,
} from "./element-description-form";

// ==================== TYPES ====================

interface DFDDescriptionViewProps {
  elements: DFDElement[];
  assets: DFDAsset[];
  connections: DFDConnection[];
  onElementUpdate: (elementId: string, updates: Partial<DFDElement>) => void;
  onAssetUpdate: (assetId: string, updates: Partial<DFDAsset>) => void;
  onConnectionUpdate: (
    connectionId: string,
    updates: Partial<DFDConnection>,
  ) => void;
  // Accordion state controlled from parent
  expandedGroups: string[];
  onToggleGroup: (groupKey: string) => void;
  expandedElements: string[];
  onToggleElement: (elementId: string) => void;
}

interface GroupedElements {
  [key: string]: DFDElement[];
}

// ==================== HELPER FUNCTIONS ====================

const groupElementsByType = (elements: DFDElement[]): GroupedElements => {
  return elements.reduce((acc, element) => {
    if (!acc[element.type]) {
      acc[element.type] = [];
    }
    acc[element.type].push(element);
    return acc;
  }, {} as GroupedElements);
};

const isElementDescribed = (element: DFDElement): boolean => {
  return (
    !!element.properties.description &&
    element.properties.description.trim().length > 0
  );
};

const isConnectionDescribed = (connection: DFDConnection): boolean => {
  return (
    !!connection.properties?.description &&
    connection.properties?.description.trim().length > 0
  );
};

// ID Label patterns for different element types
const ID_PATTERNS: Record<string, RegExp> = {
  Process: /^P-\d+$/i,
  Multiprocess: /^MP-\d+$/i,
  DataStore: /^DS-\d+$/i,
  ExternalEntity: /^EE-\d+$/i,
  TrustBoundary: /^TB-\d+$/i,
  Asset: /^A-\d+$/i,
  Interface: /^IF-\d+$/i,
  PhysicalInterface: /^PI-\d+$/i,
  DataFlow: /^DF-\d+$/i,
};

// Generic pattern to match any ID label
const GENERIC_ID_PATTERN = /^(P|MP|DS|EE|TB|A|IF|PI|DF)-\d+$/i;

/**
 * Intelligently extract displayId and name from element data.
 * Handles cases where:
 * - displayId is properly set
 * - displayId is missing but embedded in name
 * - name contains both ID and actual name
 * - name ends with custom ID in brackets like "My Trust Boundary [MTB]"
 */
const formatElementLabel = (
  element: DFDElement
): { displayId: string; name: string } => {
  let displayId = element.displayId || "";
  let name = element.name || "";

  // Case 1: displayId is already set correctly and name doesn't contain ID patterns
  if (
    displayId &&
    !GENERIC_ID_PATTERN.test(name) &&
    !name.includes(`[${displayId}]`)
  ) {
    return { displayId, name };
  }

  // Case 2: name IS the ID (e.g., Asset with label="A-1")
  if (!displayId && GENERIC_ID_PATTERN.test(name)) {
    return { displayId: name, name: element.type };
  }

  // Case 3: name contains standard ID at start (e.g., "P-1 My Process")
  const startMatch = name.match(/^((?:P|MP|DS|EE|TB|A|IF|PI|DF)-\d+)\s+(.+)$/i);
  if (startMatch) {
    return { displayId: startMatch[1], name: startMatch[2] };
  }

  // Case 4: name contains standard ID at end (e.g., "My Process P-1")
  const endMatch = name.match(/^(.+?)\s+((?:P|MP|DS|EE|TB|A|IF|PI|DF)-\d+)$/i);
  if (endMatch) {
    return { displayId: endMatch[2], name: endMatch[1] };
  }

  // Case 5: name ends with custom ID in brackets (e.g., "My Trust Boundary [MTB]")
  const bracketMatch = name.match(/^(.+?)\s*\[([^\]]+)\]$/);
  if (bracketMatch) {
    return { displayId: bracketMatch[2], name: bracketMatch[1] };
  }

  // Case 6: displayId embedded in name - clean it up
  if (displayId && name.includes(displayId)) {
    const cleanedName = name
      .replace(new RegExp(`\\[?${displayId}\\]?`, "gi"), "")
      .trim();
    return { displayId, name: cleanedName || element.type };
  }

  // Default: return as-is
  return { displayId, name: name || element.type };
};

/**
 * Format connection label similarly
 */
const formatConnectionLabel = (
  connection: DFDConnection,
  elements: DFDElement[]
): { displayId: string; label: string } => {
  let displayId = connection.displayId || "";
  let label = connection.label || "";

  // If no label, build from source/target
  if (!label) {
    const fromElement = elements.find((e) => e.id === connection.from);
    const toElement = elements.find((e) => e.id === connection.to);
    label = `${fromElement?.name || "?"} → ${toElement?.name || "?"}`;
  }

  // Check if label is actually just an ID
  if (!displayId && GENERIC_ID_PATTERN.test(label)) {
    const fromElement = elements.find((e) => e.id === connection.from);
    const toElement = elements.find((e) => e.id === connection.to);
    return {
      displayId: label,
      label: `${fromElement?.name || "?"} → ${toElement?.name || "?"}`,
    };
  }

  // Check if label contains ID
  const startMatch = label.match(/^(DF-\d+)\s+(.+)$/i);
  if (startMatch) {
    return { displayId: startMatch[1], label: startMatch[2] };
  }

  return { displayId, label };
};

// Icon mapping for DFD element types
const getElementTypeIcon = (type: DFDElementType): React.ReactNode => {
  const iconProps = { fontSize: "small" as const, sx: { mr: 1 } };

  switch (type) {
    case "ExternalEntity":
      return <ExternalEntityIcon {...iconProps} />;
    case "Process":
      return <ProcessIcon {...iconProps} />;
    case "Multiprocess":
      return <MultiProcessIcon {...iconProps} />;
    case "DataStore":
      return <DataStoreIcon {...iconProps} />;
    case "DataFlow":
      return <DataFlowIcon {...iconProps} />;
    case "TrustBoundary":
      return <TrustBoundaryIcon {...iconProps} />;
    case "PhysicalInterface":
      return <PhysicalInterfaceIcon {...iconProps} />;
    case "Interface":
      return <InterfaceIcon {...iconProps} />;
    default:
      return null;
  }
};

// ==================== COMPONENT ====================

export const DFDDescriptionView: React.FC<DFDDescriptionViewProps> = ({
  elements,
  assets,
  connections,
  onElementUpdate,
  onAssetUpdate,
  onConnectionUpdate,
  expandedGroups,
  onToggleGroup,
  expandedElements,
  onToggleElement,
}) => {
  const { t } = useTranslation();

  const groupedElements = useMemo(
    () => groupElementsByType(elements),
    [elements],
  );

  // Calculate completion stats
  const stats = useMemo(() => {
    const describedElements = elements.filter(isElementDescribed).length;
    const describedConnections = connections.filter(
      isConnectionDescribed,
    ).length;
    const describedAssets = assets.filter(
      (a) => !!a.properties?.description?.trim(),
    ).length;

    const totalElements = elements.length;
    const totalConnections = connections.length;
    const totalAssets = assets.length;

    const total = totalElements + totalConnections + totalAssets;
    const described =
      describedElements + describedConnections + describedAssets;

    return {
      describedElements,
      describedConnections,
      describedAssets,
      totalElements,
      totalConnections,
      totalAssets,
      total,
      described,
      percentage: total > 0 ? Math.round((described / total) * 100) : 0,
      isComplete: described === total && total > 0,
    };
  }, [elements, connections, assets]);

  // Handler for group accordion
  const handleGroupChange =
    (groupKey: string) =>
    (_event: React.SyntheticEvent, isExpanded: boolean) => {
      onToggleGroup(groupKey);
    };

  // Handler for element accordion
  const handleElementChange =
    (elementId: string) =>
    (_event: React.SyntheticEvent, isExpanded: boolean) => {
      onToggleElement(elementId);
    };

  // No elements yet
  if (elements.length === 0 && connections.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          {t("tabs.dfd.element_description.noElements", {
            defaultValue: "No elements found. Please draw your DFD first.",
          })}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", bgcolor: "grey.50" }}>
      {/* Header with Stats */}
      <Paper sx={{ p: 2, m: 2, mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">
            {t("tabs.dfd.element_description.title", {
              defaultValue: "DFD Element Descriptions",
            })}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {stats.isComplete ? (
            <Chip
              icon={<CheckCircleIcon />}
              label={t("tabs.dfd.element_description.complete", {
                defaultValue: "All Described",
              })}
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              icon={<WarningIcon />}
              label={`${stats.described} / ${stats.total} (${stats.percentage}%)`}
              color="warning"
              variant="outlined"
            />
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t("tabs.dfd.element_description.subtitle", {
            defaultValue:
              "Describe each element and data flow for better threat analysis.",
          })}
        </Typography>
      </Paper>

      <Box sx={{ p: 2, pt: 0 }}>
        {/* Assets */}
        {assets.length > 0 && (
          <Accordion
            expanded={expandedGroups.includes("assets")}
            onChange={handleGroupChange("assets")}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ width: "100%" }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <AssetIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1">Assets</Typography>
                </Box>

                <Chip
                  size="small"
                  label={`${stats.describedAssets} / ${stats.totalAssets}`}
                  color={
                    stats.describedAssets === stats.totalAssets
                      ? "success"
                      : "default"
                  }
                  variant="outlined"
                />
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
              {assets.map((asset) => (
                <ElementAccordion
                  key={asset.id}
                  element={asset as unknown as DFDElement}
                  onUpdate={(updates) =>
                    onAssetUpdate(asset.id, updates as Partial<DFDAsset>)
                  }
                  isExpanded={expandedElements.includes(asset.id)}
                  onToggle={handleElementChange(asset.id)}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Element Groups */}
        {Object.entries(groupedElements).map(([type, typeElements]) => {
          const elementType = type as DFDElementType;
          const config = DFD_ELEMENT_CONFIG[elementType];
          const describedCount = typeElements.filter(isElementDescribed).length;
          const totalCount = typeElements.length;

          return (
            <Accordion
              key={type}
              expanded={expandedGroups.includes(type)}
              onChange={handleGroupChange(type)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ width: "100%" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {getElementTypeIcon(elementType)}
                    <Typography variant="subtitle1">{config.name}</Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={`${describedCount} / ${totalCount}`}
                    color={
                      describedCount === totalCount ? "success" : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                {typeElements.map((element) => (
                  <ElementAccordion
                    key={element.id}
                    element={element}
                    onUpdate={(updates) => onElementUpdate(element.id, updates)}
                    isExpanded={expandedElements.includes(element.id)}
                    onToggle={handleElementChange(element.id)}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Data Flows / Connections */}
        {connections.length > 0 && (
          <Accordion
            expanded={expandedGroups.includes("connections")}
            onChange={handleGroupChange("connections")}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ width: "100%" }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <DataFlowIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1">
                    {t("tabs.dfd.element_description.dataFlows", {
                      defaultValue: "Data Flows",
                    })}
                  </Typography>
                </Box>

                <Chip
                  size="small"
                  label={`${stats.describedConnections} / ${stats.totalConnections}`}
                  color={
                    stats.describedConnections === stats.totalConnections
                      ? "success"
                      : "default"
                  }
                  variant="outlined"
                />
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
              {connections.map((connection) => (
                <ConnectionAccordion
                  key={connection.id}
                  connection={connection}
                  elements={elements}
                  onUpdate={(updates) =>
                    onConnectionUpdate(connection.id, updates)
                  }
                  isExpanded={expandedElements.includes(connection.id)}
                  onToggle={handleElementChange(connection.id)}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
};

// ==================== SUB-COMPONENTS ====================

interface ElementAccordionProps {
  element: DFDElement;
  onUpdate: (updates: Partial<DFDElement>) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

const ElementAccordion: React.FC<ElementAccordionProps> = ({
  element,
  onUpdate,
  isExpanded,
  onToggle,
}) => {
  const isDescribed = isElementDescribed(element);
  const { displayId, name } = formatElementLabel(element);

  return (
    <Accordion
      expanded={isExpanded}
      onChange={onToggle}
      sx={{
        "&:before": { display: "none" },
        boxShadow: "none",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          {isDescribed ? (
            <CheckCircleIcon fontSize="small" color="success" />
          ) : (
            <WarningIcon fontSize="small" color="warning" />
          )}
          <Typography variant="body2">
            {displayId ? `[${displayId}]` : ""} {name || "Unnamed"}
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: "background.paper", p: 0 }}>
        <ElementDescriptionForm element={element} onChange={onUpdate} />
      </AccordionDetails>
    </Accordion>
  );
};

interface ConnectionAccordionProps {
  connection: DFDConnection;
  elements: DFDElement[];
  onUpdate: (updates: Partial<DFDConnection>) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

const ConnectionAccordion: React.FC<ConnectionAccordionProps> = ({
  connection,
  elements,
  onUpdate,
  isExpanded,
  onToggle,
}) => {
  const isDescribed = isConnectionDescribed(connection);
  const { displayId, label } = formatConnectionLabel(connection, elements);

  return (
    <Accordion
      expanded={isExpanded}
      onChange={onToggle}
      sx={{
        "&:before": { display: "none" },
        boxShadow: "none",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          {isDescribed ? (
            <CheckCircleIcon fontSize="small" color="success" />
          ) : (
            <WarningIcon fontSize="small" color="warning" />
          )}
          <Typography variant="body2">
            {displayId ? `[${displayId}]` : ""} {label}
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: "background.paper", p: 0 }}>
        <ConnectionDescriptionForm
          connection={connection}
          onChange={onUpdate}
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default DFDDescriptionView;