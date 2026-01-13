// ==================== RISK FORMATTING UTILS ====================
// Pure formatting functions for risk display
// Extracted from risk-table.tsx for reusability
// TS-only version: returns React components instead of JSX

import React from "react";
import {
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Security as TrustBoundaryIcon,
  Layers as MultiProcessIcon,
  Dashboard as ProcessIcon,
  Storage as DataStoreIcon,
  Person as ExternalEntityIcon,
  SwapHoriz as DataFlowIcon,
  SettingsInputComponent as InterfaceIcon,
  Cable as CableIcon,
} from "@mui/icons-material";
import { SvgIconProps } from "@mui/material";

/**
 * Format element ID with hyphen (e.g., EE1 -> EE-1)
 */
export function formatElementId(elementId: string): string {
  const match = elementId.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return elementId;
}

/**
 * Get element icon component based on type
 * Returns a React component, rendering must be done in a .tsx file
 */
export function getElementIconComponent(
  elementType: string
): React.ComponentType<SvgIconProps> {
  switch (elementType?.toLowerCase()) {
    case "dataflow":
      return DataFlowIcon;
    case "process":
      return ProcessIcon;
    case "multiprocess":
      return MultiProcessIcon;
    case "datastore":
    case "data store":
      return DataStoreIcon;
    case "externalentity":
    case "external entity":
      return ExternalEntityIcon;
    case "physicalinterface":
      return CableIcon;
    case "interface":
      return InterfaceIcon;
    default:
      return ProcessIcon;
  }
}


/**
 * Check if a ThreatReference is an Interface threat
 * Interface threats have "Physical Interfaces" in their trustBoundaryName
 */
export function isInterfaceThreat(
  trustBoundaryName: string | undefined | null
): boolean {
  return trustBoundaryName?.includes("Physical Interfaces") ?? false;
}