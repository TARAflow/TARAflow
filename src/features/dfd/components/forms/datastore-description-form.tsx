// ==================== DATA STORE DESCRIPTION FORM ====================
// STRIDE: T, I, D
// Focus: Ruhende Daten & Zugriff

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
import type {DataStoreProperties} from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { AssetRelationSelector, type AvailableAsset } from "./asset-relation-selector";

interface DataStoreFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
}

function asDataStoreProperties(
  props: any
): DataStoreProperties {
  return props as DataStoreProperties;
}

export const DataStoreDescriptionForm: React.FC<DataStoreFormProps> = ({
  element,
  onChange,
  availableAssets = [],
}) => {
  const { t } = useTranslation();
  const props = asDataStoreProperties(element.properties);

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
        helperText="What data is stored here?"
      />

      <TextField
        fullWidth
        label="Stored Data Types"
        value={props.storedDataTypes || ""}
        onChange={(e) => handlePropertyChange("storedDataTypes", e.target.value)}
        placeholder="e.g., User credentials, Transaction logs, Configuration"
        helperText="Separate multiple types with commas"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />

      {/* Security Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Data Protection & Access Control
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Data Classification</InputLabel>
        <Select
          value={props.dataClassification || ""}
          onChange={(e) =>
            handlePropertyChange("dataClassification", e.target.value)
          }
          label="Data Classification"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="public">Public</MenuItem>
          <MenuItem value="internal">Internal</MenuItem>
          <MenuItem value="confidential">Confidential</MenuItem>
          <MenuItem value="restricted">Restricted</MenuItem>
          <MenuItem value="secret">Secret</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Encryption at Rest</InputLabel>
        <Select
          value={props.encryptionAtRest || ""}
          onChange={(e) =>
            handlePropertyChange("encryptionAtRest", e.target.value)
          }
          label="Encryption at Rest"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="none">None (Plaintext)</MenuItem>
          <MenuItem value="yes">Yes (Algorithm not specified)</MenuItem>
          <MenuItem value="aes256">AES-256</MenuItem>
          <MenuItem value="tde">TDE (Transparent Data Encryption)</MenuItem>
          <MenuItem value="kms">KMS (Key Management Service)</MenuItem>
          <MenuItem value="custom">Custom Encryption</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Access Control"
        value={props.accessControl || ""}
        onChange={(e) => handlePropertyChange("accessControl", e.target.value)}
        placeholder="Who can read/write? e.g., Admin only, Service account X"
        multiline
        rows={2}
        sx={{ mb: 2 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={props.integrityProtection || false}
            onChange={(e) =>
              handlePropertyChange("integrityProtection", e.target.checked)
            }
          />
        }
        label="Integrity Protection (Checksums, Signatures)"
        sx={{ mb: 2 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={props.backupEnabled || false}
            onChange={(e) =>
              handlePropertyChange("backupEnabled", e.target.checked)
            }
          />
        }
        label="Backup & Retention Policy Exists"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Deletion Policy"
        value={props.deletionPolicy || ""}
        onChange={(e) => handlePropertyChange("deletionPolicy", e.target.value)}
        placeholder="e.g., Soft delete with 30-day retention, GDPR-compliant"
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
            <FormControl fullWidth>
              <InputLabel>Technology</InputLabel>
              <Select
                value={props.technology || ""}
                onChange={(e) =>
                  handlePropertyChange("technology", e.target.value)
                }
                label="Technology"
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="database">Database (SQL/NoSQL)</MenuItem>
                <MenuItem value="filesystem">Filesystem</MenuItem>
                <MenuItem value="cloud">Cloud Storage (S3, Blob)</MenuItem>
                <MenuItem value="cache">Cache (Redis, Memcached)</MenuItem>
                <MenuItem value="queue">Message Queue</MenuItem>
                <MenuItem value="blockchain">Blockchain</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={props.multiTenant || false}
                  onChange={(e) =>
                    handlePropertyChange("multiTenant", e.target.checked)
                  }
                />
              }
              label="Multi-tenant (Shared by multiple customers)"
            />

            <TextField
              fullWidth
              label="Owner"
              value={props.owner || ""}
              onChange={(e) => handlePropertyChange("owner", e.target.value)}
              placeholder="Team or person responsible"
            />

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
          Data stores are high-value targets. Ensure encryption at rest and strict access controls!
        </Typography>
      </Alert>
    </Box>
  );
};