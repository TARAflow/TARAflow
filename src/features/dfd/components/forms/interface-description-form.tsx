// ==================== INTERFACE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Transport & Communication attacks)
// Focus: Physical/Logical interfaces (USB, UART, Ethernet, APIs, etc.)

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { DFDElement } from "../../models/dfd-types";
import type {InterfaceProperties} from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { AssetRelationSelector, type AvailableAsset } from "./asset-relation-selector";

interface InterfaceFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
}

function asInterfaceProperties(
  props: any
): InterfaceProperties {
  return props as InterfaceProperties;
}

export const InterfaceDescriptionForm: React.FC<InterfaceFormProps> = ({
  element,
  onChange,
  availableAssets = [],
}) => {
  const { t } = useTranslation();
  const props = asInterfaceProperties(element.properties);

  const handlePropertyChange = useCallback(
    (field: string, value: any) => {
      onChange({
        properties: {
          ...element.properties,
          [field]: value,
        },
      });
    },
    [onChange, element.properties]
  );

  return (
    <Box sx={{ p: 2 }}>
      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Required Fields
      </Typography>

      <RichTextEditor
        value={element.properties.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label="Description"
        required
        helperText="What does this interface do?"
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Interface Type</InputLabel>
        <Select
          value={props.type || ""}
          onChange={(e) => handlePropertyChange("type", e.target.value)}
          label="Interface Type"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="ethernet">Ethernet</MenuItem>
          <MenuItem value="serial">Serial (RS-232, UART)</MenuItem>
          <MenuItem value="usb">USB</MenuItem>
          <MenuItem value="gpio">GPIO</MenuItem>
          <MenuItem value="bluetooth">Bluetooth</MenuItem>
          <MenuItem value="wifi">Wi-Fi</MenuItem>
          <MenuItem value="nfc">NFC</MenuItem>
          <MenuItem value="fiber">Fiber Optic</MenuItem>
          <MenuItem value="custom">Custom Interface</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      {/* Security Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Access Control & Security
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Access Control</InputLabel>
        <Select
          value={props.accessControl || ""}
          onChange={(e) => handlePropertyChange("accessControl", e.target.value)}
          label="Access Control"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="physical_lock">Physical Lock</MenuItem>
          <MenuItem value="credentials">Credentials</MenuItem>
          <MenuItem value="card">Magnetic/Card Access</MenuItem>
          <MenuItem value="certificate">Certificate-based</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Connection Speed</InputLabel>
        <Select
          value={props.connectionSpeed || ""}
          onChange={(e) =>
            handlePropertyChange("connectionSpeed", e.target.value)
          }
          label="Connection Speed"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="low">Low (e.g., Serial, GPIO)</MenuItem>
          <MenuItem value="medium">Medium (e.g., USB 2.0, Wi-Fi)</MenuItem>
          <MenuItem value="high">High (e.g., USB 3.0, Fiber, Ethernet 1Gbps+)</MenuItem>
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={props.isShieldedCable || false}
            onChange={(e) =>
              handlePropertyChange("isShieldedCable", e.target.checked)
            }
          />
        }
        label="Shielded Cable / Secured Connection"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Physical Location"
        value={props.location || ""}
        onChange={(e) => handlePropertyChange("location", e.target.value)}
        placeholder="e.g., Server Room, Manufacturing Floor, Field"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />

      {/* Advanced / Optional Section */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            Advanced / Optional
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <RichTextEditor
              value={element.properties.notes || ""}
              onChange={(value) => handlePropertyChange("notes", value)}
              label="Additional Notes"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Asset Relations Section */}
      <Divider sx={{ my: 3 }} />

      <AssetRelationSelector
        assetRelations={element.assetRelations || []}
        elementType={element.type}
        availableAssets={availableAssets}
        onChange={(relations) => {
          onChange({ assetRelations: relations });
        }}
      />

      {/* STRIDE Hint */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          STRIDE Relevance: T (Tampering), I (Information Disclosure), D (Denial of Service)
        </Typography>
        <Typography variant="caption">
          Interfaces (physical/logical) can transport, process, and cache assets. 
          Protect them with access controls and monitoring to prevent unauthorized access!
        </Typography>
      </Alert>
    </Box>
  );
};