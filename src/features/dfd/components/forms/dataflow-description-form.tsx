// ==================== DATA FLOW DESCRIPTION FORM ====================
// STRIDE: T, I, D (häufigster Schwachpunkt!)
// Focus: Transport & Angriffe auf Kommunikation

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
  Chip,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon, Warning as WarningIcon } from "@mui/icons-material";
import type { DFDConnection } from "../../models/dfd-types";
import { RichTextEditor } from "../shared/rich-text-editor";
import { AssetRelationSelector, type AvailableAsset } from "./asset-relation-selector";

interface DataFlowFormProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;
  crossesTrustBoundary?: boolean; // Auto-detected from parent
  availableAssets?: AvailableAsset[];
}

export const DataFlowDescriptionForm: React.FC<DataFlowFormProps> = ({
  connection,
  onChange,
  crossesTrustBoundary = false,
  availableAssets = [],
}) => {
  const { t } = useTranslation();

  const handlePropertyChange = useCallback(
    (field: string, value: any) => {
      onChange({
        properties: {
          ...(connection.properties ?? {}),
          [field]: value,
        },
      });
    },
    [onChange, connection.properties]
  );

  const encryptionInTransit = connection.properties?.encryptionInTransit || "";
  const showEncryptionWarning =
    crossesTrustBoundary &&
    (encryptionInTransit === "" || encryptionInTransit === "none");

  return (
    <Box sx={{ p: 2 }}>
      {/* Auto-Threat Hint */}
      {crossesTrustBoundary && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            ⚠️ This data flow crosses a Trust Boundary!
          </Typography>
          <Typography variant="caption">
            High risk for: Tampering, Information Disclosure, Denial of Service
          </Typography>
        </Alert>
      )}

      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Required Fields
      </Typography>

      <RichTextEditor
        value={connection.properties?.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label="Description"
        required
        helperText="What data is being transmitted?"
      />

      <TextField
        fullWidth
        label="Data Types"
        value={connection.properties?.dataTypes || ""}
        onChange={(e) => handlePropertyChange("dataTypes", e.target.value)}
        placeholder="e.g., PII, Credentials, Business Data, Secrets"
        helperText="Separate multiple types with commas"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />

      {/* Security Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Transport Security
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Protocol</InputLabel>
        <Select
          value={connection.properties?.protocol || ""}
          onChange={(e) => handlePropertyChange("protocol", e.target.value)}
          label="Protocol"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="http">HTTP</MenuItem>
          <MenuItem value="https">HTTPS</MenuItem>
          <MenuItem value="grpc">gRPC</MenuItem>
          <MenuItem value="mqtt">MQTT</MenuItem>
          <MenuItem value="amqp">AMQP / Message Queue</MenuItem>
          <MenuItem value="websocket">WebSocket</MenuItem>
          <MenuItem value="file">File Transfer</MenuItem>
          <MenuItem value="database">Database Protocol</MenuItem>
          <MenuItem value="custom">Custom Protocol</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Direction</InputLabel>
        <Select
          value={connection.properties?.direction || "unidirectional"}
          onChange={(e) => handlePropertyChange("direction", e.target.value)}
          label="Direction"
        >
          <MenuItem value="unidirectional">Uni-directional (One-way)</MenuItem>
          <MenuItem value="bidirectional">Bi-directional (Two-way)</MenuItem>
          <MenuItem value="requestresponse">Request-Response</MenuItem>
        </Select>
      </FormControl>

      <FormControl
        fullWidth
        sx={{ mb: 2 }}
        error={showEncryptionWarning}
      >
        <InputLabel>Encryption in Transit</InputLabel>
        <Select
          value={encryptionInTransit}
          onChange={(e) =>
            handlePropertyChange("encryptionInTransit", e.target.value)
          }
          label="Encryption in Transit"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="none">None (Plaintext)</MenuItem>
          <MenuItem value="tls">TLS</MenuItem>
          <MenuItem value="mtls">mTLS (Mutual TLS)</MenuItem>
          <MenuItem value="vpn">VPN / IPSec</MenuItem>
          <MenuItem value="custom">Custom Encryption</MenuItem>
        </Select>
      </FormControl>

      {showEncryptionWarning && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ⚠️ Unencrypted data flow crosses trust boundary → Information Disclosure risk!
        </Alert>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={connection.properties?.integrityProtection || false}
            onChange={(e) =>
              handlePropertyChange("integrityProtection", e.target.checked)
            }
          />
        }
        label="Integrity Protection (HMAC, Signatures)"
        sx={{ mb: 2 }}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Authentication of Endpoints</InputLabel>
        <Select
          value={connection.properties?.endpointAuthentication || ""}
          onChange={(e) =>
            handlePropertyChange("endpointAuthentication", e.target.value)
          }
          label="Authentication of Endpoints"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="token">Token / Bearer</MenuItem>
          <MenuItem value="certificate">Certificate (mTLS)</MenuItem>
          <MenuItem value="apikey">API Key</MenuItem>
          <MenuItem value="oauth">OAuth 2.0</MenuItem>
        </Select>
      </FormControl>

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
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={connection.properties?.frequency || ""}
                onChange={(e) =>
                  handlePropertyChange("frequency", e.target.value)
                }
                label="Frequency"
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="continuous">Continuous / Real-time</MenuItem>
                <MenuItem value="periodic">Periodic (Scheduled)</MenuItem>
                <MenuItem value="ondemand">On-demand</MenuItem>
                <MenuItem value="batch">Batch</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Size / Volume"
              value={connection.properties?.volume || ""}
              onChange={(e) => handlePropertyChange("volume", e.target.value)}
              placeholder="e.g., 100 MB/day, 1000 requests/sec"
            />

            <RichTextEditor
              value={connection.properties?.notes || ""}
              onChange={(value) => handlePropertyChange("notes", value)}
              label="Additional Notes"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Asset Relations Section */}
      <Divider sx={{ my: 3 }} />

      <AssetRelationSelector
        assetRelations={connection.assetRelations || []}
        elementType="DataFlow"
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
          Data flows are the most common vulnerability in threat models. Always encrypt sensitive data in transit!
        </Typography>
      </Alert>
    </Box>
  );
};