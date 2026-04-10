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
  Chip,
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
  defaultExposureLevel?: ExposureLevel;
}

// ==================== CONSTANTS ====================

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];
const EL_ORDER: Record<ExposureLevel, number> = {
  EL0: 0,
  EL1: 1,
  EL2: 2,
  EL3: 3,
  EL4: 4,
};

// ==================== GENERAL TAB ====================

interface DataFlowGeneralTabProps {
  connection: DFDConnection;
  onChange: (updates: Partial<DFDConnection>) => void;
  crossesTrustBoundary: boolean;
  defaultExposureLevel?: ExposureLevel;
}

const DataFlowGeneralTab: React.FC<DataFlowGeneralTabProps> = ({
  connection,
  onChange,
  crossesTrustBoundary,
  defaultExposureLevel,
}) => {
  const { t } = useTranslation();
  const form = useConnectionForm<DataFlowProperties>(connection, onChange);
  const { props } = form;

  // Show error immediately — field only appears after explicit checkbox click
  const rationaleError =
    !!props.excludeFromThreatGen &&
    !props.excludeFromThreatGenRationale?.trim();

  const isCurrentlyOverride = !!(
    defaultExposureLevel &&
    props.exposureLevel &&
    EL_ORDER[props.exposureLevel] < EL_ORDER[defaultExposureLevel]
  );

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
            <Stack spacing={1}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t("tabs.dfd.element_description.exposure_level.label", {
                    defaultValue: "Exposure Level",
                  })}
                </InputLabel>
                <Select
                  value={props.exposureLevel ?? ""}
                  sx={{
                    ...(isCurrentlyOverride && {
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#d32f2f !important",
                      },
                    }),
                  }}
                  onChange={(e) => {
                    const selected = e.target.value as ExposureLevel;
                    const isOverride =
                      defaultExposureLevel &&
                      selected &&
                      EL_ORDER[selected] < EL_ORDER[defaultExposureLevel];
                    onChange({
                      properties: {
                        ...connection.properties,
                        exposureLevel: selected || undefined,
                        exposureLevelSource: isOverride ? "manual" : undefined,
                      },
                    });
                  }}
                  label={t(
                    "tabs.dfd.element_description.exposure_level.label",
                    { defaultValue: "Exposure Level" },
                  )}
                  renderValue={(value) => {
                    if (!value) return "";
                    const isDefault =
                      defaultExposureLevel && value === defaultExposureLevel;
                    const isBelowTB =
                      defaultExposureLevel &&
                      EL_ORDER[value as ExposureLevel] <
                        EL_ORDER[defaultExposureLevel];
                    return (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <span
                          style={{ color: isBelowTB ? "#d32f2f" : "inherit" }}
                        >
                          {EXPOSURE_LEVEL_LABELS[value as ExposureLevel]}
                        </span>
                        {isDefault && (
                          <Chip
                            label="default"
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: "0.65rem",
                              height: 16,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </Stack>
                    );
                  }}
                >
                  <MenuItem value="">
                    <em>
                      {t(
                        "tabs.dfd.element_description.dataflow.fields.exposureLevel.not_specified",
                        { defaultValue: "Not specified" },
                      )}
                    </em>
                  </MenuItem>
                  {EXPOSURE_LEVELS.map((el) => {
                    const isBelowTB =
                      defaultExposureLevel &&
                      EL_ORDER[el] < EL_ORDER[defaultExposureLevel];
                    const baseTooltip = t(EXPOSURE_LEVEL_DESCRIPTION_KEYS[el], {
                      defaultValue: "",
                    });
                    const overrideHint = t(
                      "tabs.dfd.element_description.exposure_level.below_tb_hint",
                      {
                        defaultValue:
                          "Below Trust Boundary EL — override requires rationale",
                      },
                    );
                    return (
                      <MenuItem
                        key={el}
                        value={el}
                        sx={{ color: isBelowTB ? "error.main" : "inherit" }}
                      >
                        <Tooltip
                          title={
                            isBelowTB
                              ? `${baseTooltip} — ${overrideHint}`
                              : baseTooltip
                          }
                          placement="right"
                          arrow
                        >
                          <span style={{ width: "100%", display: "block" }}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.5}
                            >
                              <span>{EXPOSURE_LEVEL_LABELS[el]}</span>
                              {defaultExposureLevel &&
                                el === defaultExposureLevel && (
                                  <Chip
                                    label="default"
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: "0.65rem",
                                      height: 16,
                                      pointerEvents: "none",
                                    }}
                                  />
                                )}
                            </Stack>
                          </span>
                        </Tooltip>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              {isCurrentlyOverride && (
                <TextField
                  fullWidth
                  size="small"
                  label={t(
                    "tabs.dfd.element_description.exposure_level.rationale_label",
                    { defaultValue: "Override Rationale" },
                  )}
                  value={props.exposureLevelRationale ?? ""}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "exposureLevelRationale",
                      e.target.value,
                    )
                  }
                  placeholder={t(
                    "tabs.dfd.element_description.exposure_level.rationale_placeholder",
                    {
                      defaultValue:
                        "Why does this differ from the Trust Boundary EL?",
                    },
                  )}
                  multiline
                  rows={2}
                />
              )}
            </Stack>
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

      {/* Threat Analysis */}
      <Stack spacing={2} sx={{ px: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={props.excludeFromThreatGen || false}
              onChange={(e) =>
                form.handlePropertyChange(
                  "excludeFromThreatGen",
                  e.target.checked,
                )
              }
            />
          }
          label={t(
            "tabs.dfd.element_description.dataflow.fields.excludeFromThreatGen.label",
            { defaultValue: "Exclude from automated threat generation" },
          )}
        />
        {props.excludeFromThreatGen && (
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            error={rationaleError}
            label={t(
              "tabs.dfd.element_description.dataflow.fields.excludeFromThreatGenRationale.label",
              {
                defaultValue: "Exclusion Rationale (IEC 62443-4-1 audit trail)",
              },
            )}
            value={props.excludeFromThreatGenRationale ?? ""}
            onChange={(e) =>
              form.handlePropertyChange(
                "excludeFromThreatGenRationale",
                e.target.value,
              )
            }
            placeholder={t(
              "tabs.dfd.element_description.dataflow.fields.excludeFromThreatGenRationale.placeholder",
              {
                defaultValue:
                  "e.g. Internal sensor polling within trusted safety domain, no external access path exists",
              },
            )}
            helperText={
              rationaleError
                ? t(
                    "tabs.dfd.element_description.dataflow.fields.excludeFromThreatGenRationale.error",
                    {
                      defaultValue:
                        "Rationale required for IEC 62443-4-1 audit trail",
                    },
                  )
                : undefined
            }
          />
        )}
      </Stack>

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

            {/* Safety relevance */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.safetyRelevant || false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "safetyRelevant",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.dataflow.fields.safetyRelevant.label",
                {
                  defaultValue:
                    "Carries safety-relevant data / supports safety function (EN 50742)",
                },
              )}
            />

            {/* crossesSafetyBoundary — read-only, auto-derived */}
            {props.crossesSafetyBoundary && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  {t(
                    "tabs.dfd.element_description.dataflow.fields.crossesSafetyBoundary.hint",
                    {
                      defaultValue:
                        "This flow crosses a safety boundary (one side safety-relevant, other not). Extra scrutiny required for Tampering and Information Disclosure.",
                    },
                  )}
                </Typography>
              </Alert>
            )}

            {props.safetyRelevant && (
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label={t(
                  "tabs.dfd.element_description.dataflow.fields.safetyRationale.label",
                  { defaultValue: "Safety Rationale" },
                )}
                value={props.safetyRationale ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("safetyRationale", e.target.value)
                }
                placeholder={t(
                  "tabs.dfd.element_description.dataflow.fields.safetyRationale.placeholder",
                  {
                    defaultValue:
                      "e.g. Carries sensor data used by emergency stop logic",
                  },
                )}
                helperText={t(
                  "tabs.dfd.element_description.dataflow.fields.safetyRationale.helper",
                  { defaultValue: "Used in EN 50742 / MVO 2027 documentation" },
                )}
              />
            )}

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
};;

// ==================== MAIN COMPONENT ====================

export const DataFlowDescriptionForm = React.memo<DataFlowFormProps>(
  ({
    connection,
    onChange,
    crossesTrustBoundary = false,
    availableAssets = [],
    onCreateAsset,
    defaultExposureLevel,
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
          defaultExposureLevel={defaultExposureLevel}
        />
      }
    />
  ),
  (prev, next) =>
    prev.connection === next.connection &&
    prev.availableAssets === next.availableAssets &&
    prev.crossesTrustBoundary === next.crossesTrustBoundary &&
    prev.defaultExposureLevel === next.defaultExposureLevel,
);

export default DataFlowDescriptionForm;