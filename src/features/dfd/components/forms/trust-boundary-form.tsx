// ==================== TRUST BOUNDARY DESCRIPTION FORM ====================
// STRIDE: All (Trust boundaries trigger automatic threat checks!)
// Focus: Explizite Sicherheitsannahmen

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
import { RichTextEditor } from "../shared/rich-text-editor";

interface TrustBoundaryFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

export const TrustBoundaryDescriptionForm: React.FC<TrustBoundaryFormProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();

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
      {/* Critical Info */}
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          ⚠️ Trust Boundaries are critical!
        </Typography>
        <Typography variant="caption">
          Any data flow crossing this boundary requires extra scrutiny for all STRIDE threats.
        </Typography>
      </Alert>

      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Required Fields
      </Typography>

      <RichTextEditor
        value={element.properties.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label="Description"
        required
        helperText="What does this boundary separate?"
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Boundary Type</InputLabel>
        <Select
          value={element.properties.boundaryType || ""}
          onChange={(e) => handlePropertyChange("boundaryType", e.target.value)}
          label="Boundary Type"
        >
          <MenuItem value="">
            <em>Not specified</em>
          </MenuItem>
          <MenuItem value="network">Network Boundary (DMZ, VPC)</MenuItem>
          <MenuItem value="privilege">Privilege Boundary (User/Admin)</MenuItem>
          <MenuItem value="organization">Organizational Boundary</MenuItem>
          <MenuItem value="cloud">Cloud Account / Tenant</MenuItem>
          <MenuItem value="physical">Physical Boundary</MenuItem>
          <MenuItem value="legal">Legal / Regulatory Boundary</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      {/* Security Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Security Controls & Assumptions
      </Typography>

      <TextField
        fullWidth
        label="Security Assumptions"
        value={element.properties.securityAssumptions || ""}
        onChange={(e) =>
          handlePropertyChange("securityAssumptions", e.target.value)
        }
        placeholder="e.g., Inside is trusted, outside is hostile"
        multiline
        rows={3}
        helperText="What do you assume about each side of this boundary?"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Controls at Boundary"
        value={element.properties.boundaryControls || ""}
        onChange={(e) =>
          handlePropertyChange("boundaryControls", e.target.value)
        }
        placeholder="e.g., Firewall, API Gateway, Authentication Layer"
        multiline
        rows={2}
        helperText="What enforces this boundary?"
        sx={{ mb: 2 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={element.properties.monitoringEnabled || false}
            onChange={(e) =>
              handlePropertyChange("monitoringEnabled", e.target.checked)
            }
          />
        }
        label="Monitoring / Logging Enabled"
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
            <TextField
              fullWidth
              label="Compliance Relevance"
              value={element.properties.complianceRelevance || ""}
              onChange={(e) =>
                handlePropertyChange("complianceRelevance", e.target.value)
              }
              placeholder="e.g., GDPR, ISO 27001, SOC 2, PCI-DSS"
              helperText="Which regulations apply to this boundary?"
            />

            <TextField
              fullWidth
              label="Owner / Responsible Team"
              value={element.properties.owner || ""}
              onChange={(e) => handlePropertyChange("owner", e.target.value)}
              placeholder="Who maintains this boundary?"
            />

            <RichTextEditor
              value={element.properties.notes || ""}
              onChange={(value) => handlePropertyChange("notes", value)}
              label="Additional Notes"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* STRIDE Hint */}
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          STRIDE Relevance: ALL (S, T, R, I, D, E)
        </Typography>
        <Typography variant="caption">
          Trust boundaries automatically trigger threat analysis for any crossing data flows. 
          Ensure all crossings have proper authentication, encryption, and monitoring!
        </Typography>
      </Alert>
    </Box>
  );
};