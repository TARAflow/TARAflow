// ==================== DFD ELEMENT DESCRIPTION ====================
// Single Responsibility: Route to correct form based on element type
// Type-safe wrapper around all element description forms

import React from "react";
import { Box, Alert, Typography } from "@mui/material";
import type { AssetGroup } from "shared";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";
import type { AvailableAsset } from "./forms/asset-relation-selector";

// Import all element forms
import { ProcessDescriptionForm } from "./forms/process-description-form";
import { MultiprocessDescriptionForm } from "./forms/multiprocess-description-form";
import { ExternalEntityDescriptionForm } from "./forms/external-entity-form";
import { DataStoreDescriptionForm } from "./forms/datastore-description-form";
import { InterfaceDescriptionForm } from "./forms/interface-description-form";
import { TrustBoundaryDescriptionForm } from "./forms/trust-boundary-form";
import { DataFlowDescriptionForm } from "./forms/dataflow-description-form";
import { ChipBoundaryDescriptionForm } from "./forms/chip-boundary-form";
import { PhysicalBoundaryDescriptionForm } from "./forms/physical-boundary-form";
import { SensorDescriptionForm } from "./forms/sensor-description-form";
import { ActuatorDescriptionForm } from "./forms/actuator-description-form";

// ==================== PROPS ====================

interface DFDElementFormProps {
  element?: DFDElement;
  connection?: DFDConnection;
  onChange: (updates: Partial<DFDElement> | Partial<DFDConnection>) => void;
  availableAssets?: AvailableAsset[];
  crossesTrustBoundary?: boolean; // For DataFlow
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  graphContext?: DFDGraphAnalysisContext | null;
}

// ==================== COMPONENT ====================

export const DFDElementForm: React.FC<DFDElementFormProps> = ({
  element,
  connection,
  onChange,
  availableAssets = [],
  crossesTrustBoundary = false,
  onCreateAsset,
  graphContext,
}) => {
  // ==================== DATA FLOW (Connection) ====================

  if (connection) {
    return (
      <DataFlowDescriptionForm
        connection={connection}
        onChange={onChange as (updates: Partial<DFDConnection>) => void}
        crossesTrustBoundary={crossesTrustBoundary}
        availableAssets={availableAssets}
        defaultExposureLevel={
          graphContext?.getEffectiveDefaultExposureLevel(connection.id) ??
          undefined
        }
      />
    );
  }

  // ==================== ELEMENTS ====================

  if (!element) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          <Typography variant="body2">
            No element selected. Click on an element in the DFD or select from
            the list.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Type-based rendering
  switch (element.type) {
    case "Process":
      return (
        <ProcessDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
          onCreateAsset={onCreateAsset}
        />
      );

    case "Multiprocess":
      return (
        <MultiprocessDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
          onCreateAsset={onCreateAsset}
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
          onChange={onChange as (updates: Partial<DFDElement>) => void}
        />
      );

    case "ChipBoundary":
      return (
        <ChipBoundaryDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
        />
      );

    case "PhysicalBoundary":
      return (
        <PhysicalBoundaryDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
        />
      );

    case "Sensor":
      return (
        <SensorDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
          onCreateAsset={onCreateAsset}
        />
      );

    case "Actuator":
      return (
        <ActuatorDescriptionForm
          element={element}
          onChange={onChange as (updates: Partial<DFDElement>) => void}
          availableAssets={availableAssets}
          onCreateAsset={onCreateAsset}
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

export default DFDElementForm;