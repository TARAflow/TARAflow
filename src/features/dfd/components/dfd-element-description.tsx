// ==================== DFD ELEMENT DESCRIPTION ====================
// Single Responsibility: Route to correct form based on element type
// Type-safe wrapper around all element description forms

import React from "react";
import { Box, Alert, Typography } from "@mui/material";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import type { AvailableAsset } from "./forms/asset-relation-selector";

// Import all element forms
import { ProcessDescriptionForm } from "./forms/process-description-form";
import { ExternalEntityDescriptionForm } from "./forms/external-entity-form";
import { DataStoreDescriptionForm } from "./forms/datastore-description-form";
import { InterfaceDescriptionForm } from "./forms/interface-description-form";
import { TrustBoundaryDescriptionForm } from "./forms/trust-boundary-form";
import { DataFlowDescriptionForm } from "./forms/dataflow-description-form";

// ==================== PROPS ====================

interface DFDElementDescriptionProps {
  element?: DFDElement;
  connection?: DFDConnection;
  onChange: (updates: Partial<DFDElement> | Partial<DFDConnection>) => void;
  availableAssets?: AvailableAsset[];
  crossesTrustBoundary?: boolean; // For DataFlow
}

// ==================== COMPONENT ====================

export const DFDElementDescription: React.FC<DFDElementDescriptionProps> = ({
  element,
  connection,
  onChange,
  availableAssets = [],
  crossesTrustBoundary = false,
}) => {
  // ==================== DATA FLOW (Connection) ====================
  
  if (connection) {
    return (
      <DataFlowDescriptionForm
        connection={connection}
        onChange={onChange as (updates: Partial<DFDConnection>) => void}
        crossesTrustBoundary={crossesTrustBoundary}
        availableAssets={availableAssets}
      />
    );
  }

  // ==================== ELEMENTS ====================

  if (!element) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          <Typography variant="body2">
            No element selected. Click on an element in the DFD or select from the list.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Type-based rendering
  switch (element.type) {
    case "Process":
    case "Multiprocess":
      return (
        <ProcessDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
        />
      );

    case "ExternalEntity":
      return (
        <ExternalEntityDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
        />
      );

    case "DataStore":
      return (
        <DataStoreDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
        />
      );

    case "Interface":
      return (
        <InterfaceDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
        />
      );

    case "TrustBoundary":
      return (
        <TrustBoundaryDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
        />
      );

    default:
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="warning">
            <Typography variant="body2" fontWeight="bold">
              Unknown element type: {element.type}
            </Typography>
            <Typography variant="caption">
              No description form available for this element type.
            </Typography>
          </Alert>
        </Box>
      );
  }
};

export default DFDElementDescription;