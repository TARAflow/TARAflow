// ==================== DATA FLOW DESCRIPTION FORM ====================
// STRIDE: T, I, D (Transport & Communication attacks)
// Focus: Data in transit — encryption, integrity, endpoint authentication
//
// Shell (tabs, asset relations, safety summary) → ConnectionFormShell
// State logic → useConnectionForm
// This file: DataFlowGeneralTab content + React.memo wrapper

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import type { AssetGroup, DFDConnection } from "../../models/dfd-types";
import type {
  DataFlowProperties,
  ExposureLevel,
} from "../../models/element-properties";
import {
  EXPOSURE_LEVEL_LABELS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ConnectionFormShell } from "./connection-form-shell";
import { useConnectionForm } from "../../hooks/use-connection-form";

// ==================== PROPS ====================

interface DataFlowFormProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;
  /** Auto-detected from graph: this flow crosses at least one trust boundary */
  crossesTrustBoundary?: boolean;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== CONSTANTS ====================

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];

// ==================== GENERAL TAB ====================

interface DataFlowGeneralTabProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;
  crossesTrustBoundary: boolean;
}

const DataFlowGeneralTab: React.FC<DataFlowGeneralTabProps> = ({
  connection,
  onChange,
  crossesTrustBoundary,
}) => {
  const { t } = useTranslation();
  const form = useConnectionForm<DataFlowProperties>(connection, onChange);
  const { props } = form;

  const encryptionInTransit = props.encryptionInTransit ?? "";
  const showEncryptionWarning =
    crossesTrustBoundary &&
    (encryptionInTransit === "" || encryptionInTransit === "none");

  return (
    <Stack spacing={3}>
      {/* Trust Boundary Warning */}
      {crossesTrustBoundary && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <Typography variant="body2" fontWeight="bold">
            {t(
              "tabs.dfd.element_description.dataflow.trust_boundary_warning.title",
              { defaultValue: "This data flow crosses a Trust Boundary!" },
            )}
          </Typography>
          <Typography variant="caption">
            {t(
              "tabs.dfd.element_description.dataflow.trust_boundary_warning.hint",
              {
                defaultValue:
                  "High risk for: Tampering, Information Disclosure, Denial of Service",
              },
            )}
          </Typography>
        </Alert>
      )}

      <Box sx={{ overflow: "hidden", pt: 1 }}>
        <Grid container rowSpacing={3} columnSpacing={2}>
          {/* Protocol */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.dataflow.fields.protocol.label",
                  { defaultValue: "Protocol" },
                )}
              </InputLabel>
              <Select
                value={props.protocol ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("protocol", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.protocol.label",
                  { defaultValue: "Protocol" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.protocol.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  [
                    "http",
                    "https",
                    "grpc",
                    "mqtt",
                    "amqp",
                    "websocket",
                    "file",
                    "database",
                    "custom",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.dataflow.fields.protocol.options.${opt}`,
                      { defaultValue: opt.toUpperCase() },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Direction */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.dataflow.fields.direction.label",
                  { defaultValue: "Direction" },
                )}
              </InputLabel>
              <Select
                value={props.direction ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("direction", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.direction.label",
                  { defaultValue: "Direction" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.direction.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  [
                    "unidirectional",
                    "bidirectional",
                    "requestresponse",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.dataflow.fields.direction.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Encryption in Transit */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small" error={showEncryptionWarning}>
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.dataflow.fields.encryptionInTransit.label",
                  { defaultValue: "Encryption in Transit" },
                )}
              </InputLabel>
              <Select
                value={encryptionInTransit}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "encryptionInTransit",
                    e.target.value,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.encryptionInTransit.label",
                  { defaultValue: "Encryption in Transit" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.encryptionInTransit.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(["none", "tls", "mtls", "vpn", "custom"] as const).map(
                  (opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.dataflow.fields.encryptionInTransit.options.${opt}`,
                        { defaultValue: opt.toUpperCase() },
                      )}
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>
            {showEncryptionWarning && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 0.5, display: "block" }}
              >
                {t(
                  "tabs.dfd.element_description.dataflow.fields.encryptionInTransit.warning",
                  {
                    defaultValue:
                      "Unencrypted flow crosses trust boundary → Information Disclosure risk",
                  },
                )}
              </Typography>
            )}
          </Grid>

          {/* Endpoint Authentication */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.dataflow.fields.endpointAuthentication.label",
                  { defaultValue: "Authentication of Endpoints" },
                )}
              </InputLabel>
              <Select
                value={props.endpointAuthentication ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "endpointAuthentication",
                    e.target.value,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.endpointAuthentication.label",
                  { defaultValue: "Authentication of Endpoints" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.endpointAuthentication.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(
                  ["none", "token", "certificate", "apikey", "oauth"] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.dataflow.fields.endpointAuthentication.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Exposure Level (EN 50742 Annex B) */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
              </InputLabel>
              <Select
                value={props.exposureLevel ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("exposureLevel", e.target.value)
                }
                label={t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
                renderValue={(value) =>
                  value ? EXPOSURE_LEVEL_LABELS[value as ExposureLevel] : ""
                }
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.exposureLevel.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {EXPOSURE_LEVELS.map((el) => (
                  <MenuItem key={el} value={el}>
                    <Tooltip
                      title={t(EXPOSURE_LEVEL_DESCRIPTION_KEYS[el], {
                        defaultValue: "",
                      })}
                      placement="right"
                      arrow
                    >
                      <span style={{ width: "100%", display: "block" }}>
                        {EXPOSURE_LEVEL_LABELS[el]}
                      </span>
                    </Tooltip>
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
                "tabs.dfd.element_description.dataflow.fields.integrityProtection.label",
                { defaultValue: "Integrity Protection (HMAC, Signatures)" },
              )}
            />
          </Grid>

          {/* Data Types */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label={t(
                "tabs.dfd.element_description.dataflow.fields.dataTypes.label",
                { defaultValue: "Data Types" },
              )}
              value={props.dataTypes ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("dataTypes", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.dataflow.fields.dataTypes.placeholder",
                {
                  defaultValue: "e.g. PII, Credentials, Business Data, Secrets",
                },
              )}
              helperText={t(
                "tabs.dfd.element_description.dataflow.fields.dataTypes.helper",
                { defaultValue: "Separate multiple types with commas" },
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
            {/* Frequency */}
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.dataflow.fields.frequency.label",
                  { defaultValue: "Frequency" },
                )}
              </InputLabel>
              <Select
                value={props.frequency ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("frequency", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.frequency.label",
                  { defaultValue: "Frequency" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.dataflow.fields.frequency.options.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {(["continuous", "periodic", "ondemand", "batch"] as const).map(
                  (opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.dataflow.fields.frequency.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>

            {/* Volume */}
            <TextField
              fullWidth
              size="small"
              label={t(
                "tabs.dfd.element_description.dataflow.fields.volume.label",
                { defaultValue: "Size / Volume" },
              )}
              value={props.volume ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("volume", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.dataflow.fields.volume.placeholder",
                { defaultValue: "e.g. 100 MB/day, 1000 requests/sec" },
              )}
            />

            {/* Notes */}
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.dataflow.fields.notes.label",
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
          {t("tabs.dfd.element_description.dataflow.fields.description.label", {
            defaultValue: "Description",
          })}
        </Typography>
        <RichTextEditor
          label={t(
            "tabs.dfd.element_description.dataflow.fields.description.label",
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

export const DataFlowDescriptionForm = React.memo<DataFlowFormProps>(
  ({
    connection,
    onChange,
    crossesTrustBoundary = false,
    availableAssets = [],
    onCreateAsset,
  }) => (
    <ConnectionFormShell
      connection={connection}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={
        <DataFlowGeneralTab
          connection={connection}
          onChange={onChange}
          crossesTrustBoundary={crossesTrustBoundary}
        />
      }
    />
  ),
  (prev, next) =>
    prev.connection === next.connection &&
    prev.availableAssets === next.availableAssets &&
    prev.crossesTrustBoundary === next.crossesTrustBoundary,
);

export default DataFlowDescriptionForm;