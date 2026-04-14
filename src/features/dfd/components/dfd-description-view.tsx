// ==================== DFD DESCRIPTION VIEW (REFACTORED) ====================
// Single Responsibility: Display and edit DFD element descriptions grouped by type
// Performance Optimizations:
// 1. Memoized update handlers for stable function references (prevents re-renders)
// 2. Inline toggle callbacks with closures (simpler than memoized maps)
// 3. Improved React.memo with shallow equality instead of JSON.stringify
// 4. Eliminated unnecessary re-renders through stable dependencies

import React, { useMemo, useCallback, useEffect } from "react";
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
  AssetGroup,
  DFDElement,
  DFDConnection,
  DFDElementType,
} from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import { DFD_ELEMENT_CONFIG } from "../models/dfd-constants";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";

// Import element-specific forms
import { ProcessDescriptionForm } from "./forms/process-description-form";
import { MultiprocessDescriptionForm } from "./forms/multiprocess-description-form";
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
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  expandedGroups: string[];
  onToggleGroup: (groupKey: string) => void;
  expandedElements: string[];
  onToggleElement: (elementId: string) => void;
  graphContext?: DFDGraphAnalysisContext | null;
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
  return !!element.description && element.description.trim().length > 0;
};

const isConnectionDescribed = (connection: DFDConnection): boolean => {
  return !!connection.description && connection.description.trim().length > 0;
};

const GENERIC_ID_PATTERN = /^(P|MP|DS|EE|TB|A|IF|PI|DF)-\d+$/i;

const formatElementLabel = (
  element: DFDElement,
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
  elements: DFDElement[],
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
 * Convert DFDAsset[] to AvailableAsset[] for form dropdowns.
 * assetGroup is required by AssetRelationSelector for group-filtered dropdowns.
 */
const assetsToAvailableAssets = (assets: DFDAsset[]): AvailableAsset[] => {
  return assets.map((asset) => ({
    id: asset.id,
    displayId: asset.displayId || asset.id,
    name: asset.name || "Unnamed Asset",
    assetGroup: asset.assetGroup,
    protectionNeed: asset.protectionNeed ?? asset.properties?.protectionNeed,
  }));
};

/**
 * Shallow equality check for objects (faster than JSON.stringify)
 */
function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => obj1[key] === obj2[key]);
}

/**
 * Check if two arrays have the same elements (by reference)
 */
function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
}

// ==================== MAIN COMPONENT ====================

export const DFDDescriptionView: React.FC<DFDDescriptionViewProps> = ({
  elements,
  assets,
  connections,
  onElementUpdate,
  onAssetUpdate,
  onConnectionUpdate,
  onAssetFeatureUpdate,
  onCreateAsset,
  expandedGroups,
  onToggleGroup,
  expandedElements,
  onToggleElement,
  graphContext,
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
      (a) => !!a.description?.trim(),
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

  // ==================== OPTIMIZED CALLBACKS ====================

  // Define element type order for grouping
  const elementTypeOrder: DFDElementType[] = [
    "ExternalEntity",
    "Process",
    "Multiprocess",
    "DataStore",
    "Interface",
    "TrustBoundary",
  ];

  /**
   * ✅ Memoized update handlers (stable function references)
   * Creates a Map of stable callback functions, one per element/connection/asset
   * Only recreates when IDs change, not on every render
   */
  const elementIds = useMemo(
    () => elements.map((e) => e.id).join(","),
    [elements],
  );
  const connectionIds = useMemo(
    () => connections.map((c) => c.id).join(","),
    [connections],
  );
  const assetIds = useMemo(() => assets.map((a) => a.id).join(","), [assets]);

  const elementUpdateHandlers = useMemo(() => {
    const handlers = new Map<string, (updates: Partial<DFDElement>) => void>();
    elements.forEach((elem) => {
      handlers.set(elem.id, (updates) => onElementUpdate(elem.id, updates));
    });
    return handlers;
  }, [elementIds, onElementUpdate]);

  const connectionUpdateHandlers = useMemo(() => {
    const handlers = new Map<
      string,
      (updates: Partial<DFDConnection>) => void
    >();
    connections.forEach((conn) => {
      handlers.set(conn.id, (updates) => onConnectionUpdate(conn.id, updates));
    });
    return handlers;
  }, [connectionIds, onConnectionUpdate]);

  const assetUpdateHandlers = useMemo(() => {
    const handlers = new Map<string, (updates: Partial<DFDAsset>) => void>();
    assets.forEach((asset) => {
      handlers.set(asset.id, (updates) => onAssetUpdate(asset.id, updates));
    });
    return handlers;
  }, [assetIds, onAssetUpdate]);

  // ==================== RENDER ====================

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: "background.default" }}>
        <Typography variant="h6" gutterBottom>
          {t("tabs.dfd.descriptionView.title", {
            defaultValue: "DFD Element Descriptions",
          })}
        </Typography>
        <Stack direction="row" spacing={2}>
          <Chip
            label={`${stats.describedElements}/${stats.totalElements} Elements`}
            color={
              stats.describedElements === stats.totalElements
                ? "success"
                : "default"
            }
            variant="outlined"
          />
          <Chip
            label={`${stats.describedConnections}/${stats.totalConnections} Connections`}
            color={
              stats.describedConnections === stats.totalConnections
                ? "success"
                : "default"
            }
            variant="outlined"
          />
          <Chip
            label={`${stats.describedAssets}/${stats.totalAssets} Assets`}
            color={
              stats.describedAssets === stats.totalAssets
                ? "success"
                : "default"
            }
            variant="outlined"
          />
        </Stack>
      </Paper>

      {/* Element Groups */}
      <Box>
        {elementTypeOrder.map((type) => {
          const typeElements = groupedElements[type] || [];
          if (typeElements.length === 0) return null;

          const groupKey = type;
          const config = DFD_ELEMENT_CONFIG[type];
          const describedCount = typeElements.filter(isElementDescribed).length;

          return (
            <Accordion
              key={groupKey}
              expanded={expandedGroups.includes(groupKey)}
              onChange={(event, isExpanded) => onToggleGroup(groupKey)} // ✅ Inline callback with closure!
              sx={{ mb: 2 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  bgcolor: "background.paper",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  {getElementTypeIcon(type)}
                  <Typography variant="subtitle1">{config.name}</Typography>
                  <Chip
                    label={`${describedCount}/${typeElements.length}`}
                    size="small"
                    color={
                      describedCount === typeElements.length
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0 }}>
                {typeElements.map((element) => (
                  <ElementAccordion
                    key={element.id}
                    graphContext={graphContext}
                    element={element}
                    availableAssets={availableAssets}
                    onUpdate={elementUpdateHandlers.get(element.id)!}
                    onCreateAsset={onCreateAsset}
                    isExpanded={expandedElements.includes(element.id)}
                    onToggle={(event, isExpanded) =>
                      onToggleElement(element.id)
                    }
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Assets */}
        {assets.length > 0 && (
          <Accordion
            expanded={expandedGroups.includes("assets")}
            onChange={(event, isExpanded) => onToggleGroup("assets")} // ✅ Inline callback!
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <AssetIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Assets</Typography>
                <Chip
                  label={`${stats.describedAssets}/${stats.totalAssets}`}
                  size="small"
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
                  onUpdate={assetUpdateHandlers.get(asset.id)!} // ✅ Stable function!
                  onAssetFeatureUpdate={onAssetFeatureUpdate}
                  isExpanded={expandedElements.includes(asset.id)}
                  onToggle={(event, isExpanded) => onToggleElement(asset.id)} // ✅ Inline callback!
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <Accordion
            expanded={expandedGroups.includes("connections")}
            onChange={(event, isExpanded) => onToggleGroup("connections")} // ✅ Inline callback!
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: "background.paper",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <DataFlowIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Data Flows</Typography>
                <Chip
                  label={`${stats.describedConnections}/${stats.totalConnections}`}
                  size="small"
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
                  graphContext={graphContext}
                  connection={connection}
                  elements={elements}
                  availableAssets={availableAssets}
                  onUpdate={connectionUpdateHandlers.get(connection.id)!} // ✅ Stable function!
                  isExpanded={expandedElements.includes(connection.id)}
                  onToggle={(event, isExpanded) =>
                    onToggleElement(connection.id)
                  } // ✅ Inline callback!
                />
              ))}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
};;

// ==================== SUB-COMPONENTS ====================

interface ElementAccordionProps {
  element: DFDElement;
  availableAssets: AvailableAsset[];
  onUpdate: (updates: Partial<DFDElement>) => void;
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void;
  graphContext?: DFDGraphAnalysisContext | null;
}

/**
 * ✅ FIX 3: Improved React.memo with shallow equality
 * Replaced expensive JSON.stringify with fast shallow comparison
 */
const ElementAccordion: React.FC<ElementAccordionProps> = React.memo(
  ({
    element,
    availableAssets,
    onUpdate,
    onCreateAsset,
    isExpanded,
    onToggle,
    graphContext,
  }) => {
    const isDescribed = isElementDescribed(element);
    const { displayId, name } = formatElementLabel(element);

    // Select correct form based on element type
    const renderForm = () => {
      switch (element.type) {
        case "Process":
          return (
            <ProcessDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
              onCreateAsset={onCreateAsset}
            />
          );
        case "Multiprocess":
          return (
            <MultiprocessDescriptionForm
              element={element}
              onChange={onUpdate}
              availableAssets={availableAssets}
              onCreateAsset={onCreateAsset}
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
              defaultExposureLevel={
                graphContext?.getEffectiveDefaultExposureLevel(element.id) ??
                undefined
              }
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
        onChange={onToggle} // ✅ Direct callback, no data-attribute needed
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
          {/* Render form only when expanded — prevents all Selects/Tooltips from
              creating Popper instances simultaneously (observed: 103+ resize listeners
              from collapsed accordions). Cost: slight re-mount delay on first open. */}
          {isExpanded && renderForm()}
        </AccordionDetails>
      </Accordion>
    );
  },
  (prevProps, nextProps) => {
    // ✅ Fast primitive checks first
    if (
      prevProps.element.id !== nextProps.element.id ||
      prevProps.element.displayId !== nextProps.element.displayId ||
      prevProps.element.name !== nextProps.element.name ||
      prevProps.isExpanded !== nextProps.isExpanded ||
      prevProps.onUpdate !== nextProps.onUpdate ||
      prevProps.onCreateAsset !== nextProps.onCreateAsset ||
      prevProps.onToggle !== nextProps.onToggle
    ) {
      return false; // Re-render needed
    }

    // ✅ Check availableAssets length (cheap)
    if (prevProps.availableAssets.length !== nextProps.availableAssets.length) {
      return false;
    }

    // ✅ Shallow comparison instead of JSON.stringify (much faster!)
    if (
      !shallowEqual(prevProps.element.properties, nextProps.element.properties)
    ) {
      return false;
    }

    // ✅ Check assetRelations with shallow comparison
    if (
      !arraysEqual(
        prevProps.element.assetRelations || [],
        nextProps.element.assetRelations || [],
      )
    ) {
      return false;
    }

    return true; // No re-render needed
  },
);

ElementAccordion.displayName = "ElementAccordion";

interface ConnectionAccordionProps {
  connection: DFDConnection;
  elements: DFDElement[];
  availableAssets: AvailableAsset[];
  onUpdate: (updates: Partial<DFDConnection>) => void;
  isExpanded: boolean;
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void; // ✅ Direct callback
  graphContext?: DFDGraphAnalysisContext | null;
}

const ConnectionAccordion: React.FC<ConnectionAccordionProps> = React.memo(
  ({
    connection,
    elements,
    availableAssets,
    onUpdate,
    isExpanded,
    onToggle,
    graphContext,
  }) => {
    const isDescribed = isConnectionDescribed(connection);
    const { displayId, label } = formatConnectionLabel(connection, elements);

    // TODO: Implement auto-detection if connection crosses trust boundary
    const crossesTrustBoundary = false; // Placeholder

    return (
      <Accordion
        expanded={isExpanded}
        onChange={onToggle} // ✅ Direct callback
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
          {isExpanded && (
            <DataFlowDescriptionForm
              connection={connection}
              onChange={onUpdate}
              crossesTrustBoundary={crossesTrustBoundary}
              availableAssets={availableAssets}
              defaultExposureLevel={
                graphContext?.getEffectiveDefaultExposureLevel(connection.id) ??
                undefined
              }
            />
          )}
        </AccordionDetails>
      </Accordion>
    );
  },
  (prevProps, nextProps) => {
    // ✅ Optimized comparison for ConnectionAccordion
    if (
      prevProps.connection.id !== nextProps.connection.id ||
      prevProps.connection.displayId !== nextProps.connection.displayId ||
      prevProps.connection.from !== nextProps.connection.from ||
      prevProps.connection.to !== nextProps.connection.to ||
      prevProps.isExpanded !== nextProps.isExpanded ||
      prevProps.onUpdate !== nextProps.onUpdate ||
      prevProps.onToggle !== nextProps.onToggle ||
      prevProps.availableAssets.length !== nextProps.availableAssets.length
    ) {
      return false;
    }

    // Shallow check properties
    if (
      !shallowEqual(
        prevProps.connection.properties || {},
        nextProps.connection.properties || {},
      )
    ) {
      return false;
    }

    return true;
  },
);

ConnectionAccordion.displayName = "ConnectionAccordion";

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
  onToggle: (event: React.SyntheticEvent, isExpanded: boolean) => void; // ✅ Direct callback
}

const AssetAccordion: React.FC<AssetAccordionProps> = React.memo(
  ({
    asset,
    elements,
    connections,
    onUpdate,
    onAssetFeatureUpdate,
    isExpanded,
    onToggle,
  }) => {
    const isDescribed = !!asset.description?.trim();
    const { displayId, name } = formatElementLabel(
      asset as unknown as DFDElement,
    );

    return (
      <Accordion
        expanded={isExpanded}
        onChange={onToggle} // ✅ Direct callback
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
          {isExpanded && (
            <AssetDescriptionForm
              asset={asset}
              onChange={onUpdate}
              onAssetFeatureUpdate={onAssetFeatureUpdate}
              elements={elements}
              connections={connections}
            />
          )}
        </AccordionDetails>
      </Accordion>
    );
  },
  (prevProps, nextProps) => {
    // ✅ Optimized comparison for AssetAccordion
    if (
      prevProps.asset.id !== nextProps.asset.id ||
      prevProps.asset.displayId !== nextProps.asset.displayId ||
      prevProps.asset.name !== nextProps.asset.name ||
      prevProps.asset.description !== nextProps.asset.description ||
      prevProps.asset.assetGroup !== nextProps.asset.assetGroup ||
      prevProps.asset.protectionNeed !== nextProps.asset.protectionNeed ||
      prevProps.isExpanded !== nextProps.isExpanded ||
      prevProps.onUpdate !== nextProps.onUpdate ||
      prevProps.onToggle !== nextProps.onToggle ||
      prevProps.onAssetFeatureUpdate !== nextProps.onAssetFeatureUpdate ||
      prevProps.elements.length !== nextProps.elements.length ||
      prevProps.connections.length !== nextProps.connections.length
    ) {
      return false;
    }

    // ✅ Check assetRelations
    if (
      !arraysEqual(
        prevProps.asset.linkedElements || [],
        nextProps.asset.linkedElements || [],
      )
    ) {
      return false;
    }

    // Shallow check properties
    if (
      !shallowEqual(
        prevProps.asset.properties || {},
        nextProps.asset.properties || {},
      )
    ) {
      return false;
    }

    return true;
  }
);

AssetAccordion.displayName = "AssetAccordion";

export default DFDDescriptionView;