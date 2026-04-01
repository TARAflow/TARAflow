// ==================== DATA STORE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Tampering, Information Disclosure, Denial of Service)
// Focus: Data at rest — encryption, access control, integrity
//
// Shell (tabs, asset relations, safety summary) → ElementFormShell
// State logic → useElementForm
// This file: DataStoreGeneralTab content + React.memo wrapper

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type { DataStoreProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";

// ==================== PROPS ====================

interface DataStoreFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== GENERAL TAB ====================

interface DataStoreGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

const DataStoreGeneralTab: React.FC<DataStoreGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<DataStoreProperties>(element, onChange);
  const { props } = form;

  return (
    <Stack spacing={3}>
      <Box sx={{ overflow: "hidden", pt: 1 }}>
        <Grid container rowSpacing={3} columnSpacing={2}>
          {/* Data Classification */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.datastore.fields.dataClassification.label",
                  { defaultValue: "Data Classification" },
                )}
              </InputLabel>
              <Select
                value={props.dataClassification ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "dataClassification",
                    e.target.value,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.datastore.fields.dataClassification.label",
                  { defaultValue: "Data Classification" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.datastore.fields.dataClassification.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  [
                    "public",
                    "internal",
                    "confidential",
                    "restricted",
                    "secret",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.datastore.fields.dataClassification.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Encryption at Rest */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.datastore.fields.encryptionAtRest.label",
                  { defaultValue: "Encryption at Rest" },
                )}
              </InputLabel>
              <Select
                value={props.encryptionAtRest ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("encryptionAtRest", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.datastore.fields.encryptionAtRest.label",
                  { defaultValue: "Encryption at Rest" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.datastore.fields.encryptionAtRest.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  ["none", "yes", "aes256", "tde", "kms", "custom"] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.datastore.fields.encryptionAtRest.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Integrity Protection */}
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.integrityProtection || false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "integrityProtection",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.integrityProtection.label",
                {
                  defaultValue: "Integrity Protection (Checksums, Signatures)",
                },
              )}
            />
          </Grid>

          {/* Backup Enabled */}
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.backupEnabled || false}
                  onChange={(e) =>
                    form.handlePropertyChange("backupEnabled", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.backupEnabled.label",
                { defaultValue: "Backup & Retention Policy Exists" },
              )}
            />
          </Grid>

          {/* Stored Data Types */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label={t(
                "tabs.dfd.element_description.datastore.fields.storedDataTypes.label",
                { defaultValue: "Stored Data Types" },
              )}
              value={props.storedDataTypes ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("storedDataTypes", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.datastore.fields.storedDataTypes.placeholder",
                {
                  defaultValue:
                    "e.g. User credentials, Transaction logs, Configuration",
                },
              )}
              helperText={t(
                "tabs.dfd.element_description.datastore.fields.storedDataTypes.helper",
                { defaultValue: "Separate multiple types with commas" },
              )}
            />
          </Grid>

          {/* Access Control */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.datastore.fields.accessControl.label",
                { defaultValue: "Access Control" },
              )}
              value={props.accessControl ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("accessControl", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.datastore.fields.accessControl.placeholder",
                {
                  defaultValue:
                    "Who can read/write? e.g. Admin only, Service account X",
                },
              )}
            />
          </Grid>

          {/* Deletion Policy */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label={t(
                "tabs.dfd.element_description.datastore.fields.deletionPolicy.label",
                { defaultValue: "Deletion Policy" },
              )}
              value={props.deletionPolicy ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("deletionPolicy", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.datastore.fields.deletionPolicy.placeholder",
                {
                  defaultValue:
                    "e.g. Soft delete with 30-day retention, GDPR-compliant",
                },
              )}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Advanced */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            {t("tabs.dfd.element_description.sections.advanced", {
              defaultValue: "Advanced / Optional",
            })}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* Technology */}
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.datastore.fields.technology.label",
                  { defaultValue: "Technology" },
                )}
              </InputLabel>
              <Select
                value={props.technology ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("technology", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.datastore.fields.technology.label",
                  { defaultValue: "Technology" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.datastore.fields.technology.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  [
                    "database",
                    "filesystem",
                    "cloud",
                    "cache",
                    "queue",
                    "blockchain",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.datastore.fields.technology.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Multi-tenant */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.multiTenant || false}
                  onChange={(e) =>
                    form.handlePropertyChange("multiTenant", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.multiTenant.label",
                { defaultValue: "Multi-tenant (Shared by multiple customers)" },
              )}
            />

            {/* Safety-relevant data */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.containsSafetyRelevantData || false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "containsSafetyRelevantData",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.containsSafetyRelevantData.label",
                {
                  defaultValue:
                    "Contains safety-relevant configuration data (EN 50742)",
                },
              )}
            />

            {props.containsSafetyRelevantData && (
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label={t(
                  "tabs.dfd.element_description.datastore.fields.safetyRationale.label",
                  { defaultValue: "Safety Rationale" },
                )}
                value={props.safetyRationale ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("safetyRationale", e.target.value)
                }
                placeholder={t(
                  "tabs.dfd.element_description.datastore.fields.safetyRationale.placeholder",
                  {
                    defaultValue:
                      "e.g. Manipulation could disable emergency stop function",
                  },
                )}
                helperText={t(
                  "tabs.dfd.element_description.datastore.fields.safetyRationale.helper",
                  { defaultValue: "Used in EN 50742 / MVO 2027 documentation" },
                )}
              />
            )}

            {/* Owner */}
            <TextField
              fullWidth
              size="small"
              label={t(
                "tabs.dfd.element_description.datastore.fields.owner.label",
                { defaultValue: "Owner" },
              )}
              value={props.owner ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("owner", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.datastore.fields.owner.placeholder",
                { defaultValue: "Team or person responsible" },
              )}
            />

            {/* Notes */}
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.datastore.fields.notes.label",
                { defaultValue: "Notes" },
              )}
              value={form.localNotes}
              onChange={(e) => form.setLocalNotes(e.target.value)}
              onBlur={form.commitNotes}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Description */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t(
            "tabs.dfd.element_description.datastore.fields.description.label",
            { defaultValue: "Description" },
          )}
        </Typography>
        <RichTextEditor
          label={t(
            "tabs.dfd.element_description.datastore.fields.description.label",
            { defaultValue: "Description" },
          )}
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
        />
      </Box>
    </Stack>
  );
};

// ==================== MAIN COMPONENT ====================

export const DataStoreDescriptionForm = React.memo<DataStoreFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={<DataStoreGeneralTab element={element} onChange={onChange} />}
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default DataStoreDescriptionForm;