// ==================== DFD DESCRIPTION VIEW ====================
// Single Responsibility: Display and edit DFD element descriptions grouped by type
// Now uses element-specific forms with asset relation support

import React, { useMemo, useCallback } from "react";
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
  Cable as InterfaceIcon,
  MonetizationOnOutlined as AssetIcon,
} from "@mui/icons-material";

import type {
  DFDAsset,
  DFDElement,
  DFDConnection,
  DFDElementType,
} from "../models/dfd-types";
import { DFD_ELEMENT_CONFIG } from "../models/dfd-constants";

// Import element-specific forms
import { ProcessDescriptionForm } from "./forms/process-description-form";
import { DataFlowDescriptionForm } from "./forms/dataflow-description-form";
import { DataStoreDescriptionForm } from "./forms/datastore-description-form";
import { ExternalEntityDescriptionForm } from "./forms/external-entity-form";
import { InterfaceDescriptionForm } from "./forms/interface-description-form";
import { TrustBoundaryDescriptionForm } from "./forms/trust-boundary-form";
import { AssetDescriptionForm } from "./forms/asset-description-form";
import type { AvailableAsset } from "./forms/asset-relation-selector";

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
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
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

const GENERIC_ID_PATTERN = /^(P|MP|DS|EE|TB|A|IF|PI|DF)-\d+$/i;

const formatElementLabel = (
  element: DFDElement
): { displayId: string; name: string } => {
  let displayId = element.displayId || "";
  let name = element.name || "";

  if (
    displayId &&
    !GENERIC_ID_PATTERN.test(name) &&
    !name.includes(displayId)
  ) {
    return { displayId, name };
  }

  if (!displayId && GENERIC_ID_PATTERN.test(name)) {
    return { displayId: name, name: element.type };
  }

  const startMatch = name.match(/^((?:P|MP|DS|EE|TB|A|IF|PI|DF)-\d+)\s+(.+)$/i);
  if (startMatch) {
    return { displayId: startMatch[1], name: startMatch[2] };
  }

  const endMatch = name.match(/^(.+?)\s+((?:P|MP|DS|EE|TB|A|IF|PI|DF)-\d+)$/i);
  if (endMatch) {
    return { displayId: endMatch[2], name: endMatch[1] };
  }

  const bracketMatch = name.match(/^(.+?)\s*\[([^\]]+)\]$/);
  if (bracketMatch) {
    return { displayId: bracketMatch[2], name: bracketMatch[1] };
  }

  return { displayId: displayId || "", name: name || element.type };
};

const formatConnectionLabel = (
  connection: DFDConnection,
  elements: DFDElement[]
): { displayId: string; label: string } => {
  const sourceElem = elements.find((e) => e.id === connection.from);
  const targetElem = elements.find((e) => e.id === connection.to);

  const sourceName = sourceElem?.name || "Unknown";
  const targetName = targetElem?.name || "Unknown";

  const displayId = connection.displayId || connection.id;
  const label = `${sourceName} → ${targetName}`;

  return { displayId, label };
};

/**
 * Get the appropriate Material-UI icon for a DFD element type
 */
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
    case "Interface":
      return <InterfaceIcon {...iconProps} />;
    case "TrustBoundary":
      return <TrustBoundaryIcon {...iconProps} />;
    default:
      return null;
  }
};

/**
 * Convert DFDAsset[] to AvailableAsset[] for form dropdowns
 */
const assetsToAvailableAssets = (assets: DFDAsset[]): AvailableAsset[] => {
  return assets.map((asset) => {
    const { displayId, name } = formatElementLabel(asset as unknown as DFDElement);
    return {
      id: asset.id,
      name: name || "Unnamed Asset",
      displayId: displayId || asset.id,
      protectionNeed: asset.properties?.protectionNeed,
    };
  });
};

// ==================== MAIN COMPONENT ====================

export const DFDDescriptionView: React.FC<DFDDescriptionViewProps> = ({
  elements,
  assets,
  connections,
  onElementUpdate,
  onAssetUpdate,
  onConnectionUpdate,
  onAssetFeatureUpdate,
  expandedGroups,
  onToggleGroup,
  expandedElements,
  onToggleElement,
}) => {
  const { t } = useTranslation();

  // Convert assets to AvailableAsset format for forms
  const availableAssets = useMemo(
    () => assetsToAvailableAssets(assets),
    [assets],
  );

  // Group elements by type for better organization
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

    return {
      totalElements: elements.length,
      describedElements,
      totalConnections: connections.length,
      describedConnections,
      totalAssets: assets.length,
      describedAssets,
    };
  }, [elements, connections, assets]);

  // Handler wrappers to maintain typing
  const handleGroupChange = useCallback(
    (groupKey: string) =>
      (event: React.SyntheticEvent, isExpanded: boolean) => {
        onToggleGroup(groupKey);
      },
    [onToggleGroup],
  );

  const handleElementChange = useCallback(
    (elementId: string) =>
      (event: React.SyntheticEvent, isExpanded: boolean) => {
        onToggleElement(elementId);
      },
    [onToggleElement],
  );

  // Stable callback for element updates
  const handleElementUpdate = useCallback(
    (elementId: string) => (updates: Partial<DFDElement>) => {
      onElementUpdate(elementId, updates);
    },
    [onElementUpdate],
  );

  // ==================== RENDER ====================

  // Define element type order for grouping
  const elementTypeOrder: DFDElementType[] = [
    "Process",
    "Multiprocess",
    "ExternalEntity",
    "DataStore",
    "Interface",
    "TrustBoundary",
  ];

  return (
    <Box sx={{ height: "100%", overflow: "auto" }}>
      <Box sx={{ p: 2 }}>
        {/* Header with overall stats */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t("tabs.dfd.element_description.title", {
              defaultValue: "Element Descriptions",
            })}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Chip
              label={`Elements: ${stats.describedElements} / ${stats.totalElements}`}
              color={
                stats.describedElements === stats.totalElements
                  ? "success"
                  : "default"
              }
              size="small"
            />
            <Chip
              label={`Data Flows: ${stats.describedConnections} / ${stats.totalConnections}`}
              color={
                stats.describedConnections === stats.totalConnections
                  ? "success"
                  : "default"
              }
              size="small"
            />
            <Chip
              label={`Assets: ${stats.describedAssets} / ${stats.totalAssets}`}
              color={
                stats.describedAssets === stats.totalAssets
                  ? "success"
                  : "default"
              }
              size="small"
            />
          </Stack>
        </Paper>

        {/* Element Type Groups */}
        {elementTypeOrder.map((type) => {
          const elementsOfType = groupedElements[type] || [];
          if (elementsOfType.length === 0) return null;

          const config = DFD_ELEMENT_CONFIG[type];
          const describedCount =
            elementsOfType.filter(isElementDescribed).length;
          const groupKey = `type-${type}`;

          return (
            <Accordion
              key={type}
              expanded={expandedGroups.includes(groupKey)}
              onChange={handleGroupChange(groupKey)}
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
                    {getElementTypeIcon(type)}
                    <Typography variant="subtitle1">{config.name}</Typography>
                  </Box>

                  <Chip
                    size="small"
                    label={`${describedCount} / ${elementsOfType.length}`}
                    color={
                      describedCount === elementsOfType.length
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                {elementsOfType.map((element) => (
                  <ElementAccordion
                    key={element.id}
                    element={element}
                    availableAssets={availableAssets}
                    onUpdate={handleElementUpdate(element.id)}
                    isExpanded={expandedElements.includes(element.id)}
                    onToggle={handleElementChange(element.id)}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Assets Group */}
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
                  <Typography variant="subtitle1">
                    {t("tabs.dfd.element_description.assets", {
                      defaultValue: "Assets",
                    })}
                  </Typography>
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
                <AssetAccordion
                  key={asset.id}
                  asset={asset}
                  elements={elements}
                  connections={connections}
                  onUpdate={(updates) => onAssetUpdate(asset.id, updates)}
                  onAssetFeatureUpdate={onAssetFeatureUpdate}
                  isExpanded={expandedElements.includes(asset.id)}
                  onToggle={handleElementChange(asset.id)}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Data Flows Group */}
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
                  availableAssets={availableAssets}
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
};;;

// ==================== SUB-COMPONENTS ====================

interface ElementAccordionProps {
  element: DFDElement;
  availableAssets: AvailableAsset[];
  onUpdate: (updates: Partial<DFDElement>) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

const ElementAccordion: React.FC<ElementAccordionProps> = React.memo(
  ({ element, availableAssets, onUpdate, isExpanded, onToggle }) => {
    const isDescribed = isElementDescribed(element);
    const { displayId, name } = formatElementLabel(element);

    // Select correct form based on element type
    const renderForm = () => {
      switch (element.type) {
        case "Process":
        case "Multiprocess":
          return (
            <ProcessDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
            />
          );
        case "DataStore":
          return (
            <DataStoreDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
            />
          );
        case "ExternalEntity":
          return (
            <ExternalEntityDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
            />
          );
        case "Interface":
          return (
            <InterfaceDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
            />
          );
        case "TrustBoundary":
          return (
            <TrustBoundaryDescriptionForm
              element={element}
              onChange={onUpdate}
            />
          );
        default:
          return (
            <Box sx={{ p: 2 }}>
              <Alert severity="info">
                No specific form available for {element.type}. Please add the
                form or use generic description.
              </Alert>
            </Box>
          );
      }
    };

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
              {displayId ? `[${displayId}]` : ""} {name}
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails sx={{ bgcolor: "background.paper", p: 0 }}>
          {renderForm()}
        </AccordionDetails>
      </Accordion>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if relevant data changed
    return (
      prevProps.element.id === nextProps.element.id &&
      prevProps.element.displayId === nextProps.element.displayId &&
      prevProps.element.name === nextProps.element.name &&
      JSON.stringify(prevProps.element.properties) ===
        JSON.stringify(nextProps.element.properties) &&
      JSON.stringify(prevProps.element.assetRelations) ===
        JSON.stringify(nextProps.element.assetRelations) &&
      prevProps.isExpanded === nextProps.isExpanded &&
      prevProps.availableAssets.length === nextProps.availableAssets.length
    );
  },
);

interface ConnectionAccordionProps {
  connection: DFDConnection;
  elements: DFDElement[];
  availableAssets: AvailableAsset[];
  onUpdate: (updates: Partial<DFDConnection>) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

const ConnectionAccordion: React.FC<ConnectionAccordionProps> = ({
  connection,
  elements,
  availableAssets,
  onUpdate,
  isExpanded,
  onToggle,
}) => {
  const isDescribed = isConnectionDescribed(connection);
  const { displayId, label } = formatConnectionLabel(connection, elements);

  // TODO: Implement auto-detection if connection crosses trust boundary
  const crossesTrustBoundary = false; // Placeholder

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
        <DataFlowDescriptionForm
          connection={connection}
          onChange={onUpdate}
          crossesTrustBoundary={crossesTrustBoundary}
          availableAssets={availableAssets}
        />
      </AccordionDetails>
    </Accordion>
  );
};

interface AssetAccordionProps {
  asset: DFDAsset;
  elements: DFDElement[];
  connections: DFDConnection[];
  onUpdate: (updates: Partial<DFDAsset>) => void;
  onAssetFeatureUpdate?: (
    assetId: string,
    updates: { name?: string; properties?: any },
  ) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
}

const AssetAccordion: React.FC<AssetAccordionProps> = ({
  asset,
  elements,
  connections,
  onUpdate,
  onAssetFeatureUpdate,
  isExpanded,
  onToggle,
}) => {
  const isDescribed = !!asset.properties?.description?.trim();
  const { displayId, name } = formatElementLabel(
    asset as unknown as DFDElement,
  );

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
            {displayId ? `[${displayId}]` : ""} {name || "Unnamed Asset"}
          </Typography>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ bgcolor: "background.paper", p: 0 }}>
        <AssetDescriptionForm
          asset={asset}
          onChange={onUpdate}
          onAssetFeatureUpdate={onAssetFeatureUpdate}
          elements={elements}
          connections={connections}
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default DFDDescriptionView;