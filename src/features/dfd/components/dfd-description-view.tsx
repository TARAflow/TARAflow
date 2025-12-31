// ==================== DFD DESCRIPTION VIEW ====================
// Single Responsibility: Display and edit DFD element descriptions grouped by type

import React, { useState, useMemo } from "react";
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
} from "@mui/icons-material";

import type { DFDElement, DFDConnection, DFDElementType } from "../models/dfd-types";
import { DFD_ELEMENT_CONFIG } from "../models/dfd-types";
import { ElementDescriptionForm, ConnectionDescriptionForm } from "./element-description-form";

// ==================== TYPES ====================

interface DFDDescriptionViewProps {
  elements: DFDElement[];
  connections: DFDConnection[];
  onElementUpdate: (elementId: string, updates: Partial<DFDElement>) => void;
  onConnectionUpdate: (connectionId: string, updates: Partial<DFDConnection>) => void;
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

// ==================== COMPONENT ====================

export const DFDDescriptionView: React.FC<DFDDescriptionViewProps> = ({
  elements,
  connections,
  onElementUpdate,
  onConnectionUpdate,
}) => {
  const { t } = useTranslation();
  const [expandedPanels, setExpandedPanels] = useState<string[]>([]);

  const groupedElements = useMemo(() => groupElementsByType(elements), [elements]);

  // Calculate completion stats
  const stats = useMemo(() => {
    const describedElements = elements.filter(isElementDescribed).length;
    const describedConnections = connections.filter(isConnectionDescribed).length;
    const totalElements = elements.length;
    const totalConnections = connections.length;
    const total = totalElements + totalConnections;
    const described = describedElements + describedConnections;
    
    return {
      describedElements,
      describedConnections,
      totalElements,
      totalConnections,
      total,
      described,
      percentage: total > 0 ? Math.round((described / total) * 100) : 0,
      isComplete: described === total && total > 0,
    };
  }, [elements, connections]);

  const handlePanelChange = (panel: string) => (
    _event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedPanels((prev) =>
      isExpanded ? [...prev, panel] : prev.filter((p) => p !== panel)
    );
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
        {/* Element Groups */}
        {Object.entries(groupedElements).map(([type, typeElements]) => {
          const elementType = type as DFDElementType;
          const config = DFD_ELEMENT_CONFIG[elementType];
          const describedCount = typeElements.filter(isElementDescribed).length;
          const totalCount = typeElements.length;

          return (
            <Accordion
              key={type}
              expanded={expandedPanels.includes(type)}
              onChange={handlePanelChange(type)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ width: "100%" }}
                >
                  <Typography variant="subtitle1">
                    {config.icon} {config.name}
                  </Typography>

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
                    isExpanded={expandedPanels.includes(element.id)}
                    onToggle={handlePanelChange(element.id)}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Data Flows / Connections */}
        {connections.length > 0 && (
          <Accordion
            expanded={expandedPanels.includes("connections")}
            onChange={handlePanelChange("connections")}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ width: "100%" }}
              >
                <Typography variant="subtitle1">
                  {DFD_ELEMENT_CONFIG.DataFlow.icon}{" "}
                  {t("tabs.dfd.element_description.dataFlows", {
                    defaultValue: "Data Flows",
                  })}
                </Typography>

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
                  isExpanded={expandedPanels.includes(connection.id)}
                  onToggle={handlePanelChange(connection.id)}
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
            {element.displayId ? `[${element.displayId}]` : ""} {element.name || "Unnamed"}
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
  
  // Find from/to element names
  const fromElement = elements.find((e) => e.id === connection.from);
  const toElement = elements.find((e) => e.id === connection.to);
  
  const label = connection.label || 
    `${fromElement?.name || "?"} → ${toElement?.name || "?"}`;

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
            {connection.displayId ? `[${connection.displayId}]` : ""} {label}
          </Typography>
        </Stack>
      </AccordionSummary>
      
      <AccordionDetails sx={{ bgcolor: "background.paper", p: 0 }}>
        <ConnectionDescriptionForm connection={connection} onChange={onUpdate} />
      </AccordionDetails>
    </Accordion>
  );
};

export default DFDDescriptionView;