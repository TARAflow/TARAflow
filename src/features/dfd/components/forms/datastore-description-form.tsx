// ==================== DATA STORE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Tampering, Information Disclosure, Denial of Service)
// Focus: Data at rest — classification, encryption, access control
//
// Structure: Context → Security → Documentation (no accordions)

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type {
  DataStoreProperties,
  StoredDataType,
} from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { SecurityControlOwnershipDisplay } from "./security-control-ownership-display";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  DATASTORE_TECH_DEFAULTS,
  DATASTORE_TECH_DRIVEN_FIELDS,
  applyCascadeDefaults,
  buildClearPatch,
} from "../../models/element-property-defaults";

interface DataStoreFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface DataStoreGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ pt: 1 }}>
    <Typography
      variant="overline"
      sx={{ color: "text.disabled", fontSize: "0.65rem", letterSpacing: 1.5 }}
    >
      {label}
    </Typography>
    <Divider sx={{ mt: 0.5, mb: 2 }} />
  </Box>
);

const DataStoreGeneralTab: React.FC<DataStoreGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<DataStoreProperties>(element, onChange);
  const { props } = form;

  // ── Cascade: technology driver ───────────────────────────────────────────
  const handleTechnologyChange = (value: string) => {
    if (!value) {
      // Clear driver + all driven fields
      onChange({
        properties: {
          ...props,
          technology: undefined,
          ...buildClearPatch<DataStoreProperties>(DATASTORE_TECH_DRIVEN_FIELDS),
        } as DataStoreProperties,
      });
      return;
    }
    const techKey = value as NonNullable<DataStoreProperties["technology"]>;
    const defaults = DATASTORE_TECH_DEFAULTS[techKey] ?? {};
    const cascaded = applyCascadeDefaults<DataStoreProperties>(props, defaults);
    onChange({
      properties: {
        ...props,
        technology: techKey,
        ...cascaded,
      } as DataStoreProperties,
    });
  };

  // ── Derived warning states ───────────────────────────────────────────────

  // dataClassification SECRET/RESTRICTED without encryption → Information Disclosure risk
  const isHighClassification =
    props.dataClassification === "secret" ||
    props.dataClassification === "restricted";
  const showEncryptionClassificationWarning =
    isHighClassification &&
    (props.encryptionAtRest === "none" || props.encryptionAtRest == null);

  // Safety-relevant data without integrity protection → Tampering threat
  const showSafetyIntegrityWarning =
    (props.containsSafetyRelevantData === true &&
      props.integrityProtection == null) ||
    props.integrityProtection === "none";

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {/* ── Context ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.context", {
          defaultValue: "Context",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* Technology */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.datastore.fields.technology.label",
                { defaultValue: "Technology" },
              )}
            </InputLabel>
            <Select
              value={props.technology ?? ""}
              onChange={(e) => handleTechnologyChange(e.target.value)}
              label={t(
                "tabs.dfd.element_description.datastore.fields.technology.label",
                { defaultValue: "Technology" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
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
              {/* ↓ neu */}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Embedded storage —
              </MenuItem>
              {(["flash", "eeprom", "nvram"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.datastore.fields.technology.options.${opt}`,
                    { defaultValue: opt.toUpperCase() },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

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
                form.handlePropertyChange("dataClassification", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.dataClassification.label",
                { defaultValue: "Data Classification" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
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

        {/* Stored Data Types — multi-select */}
        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.datastore.fields.storedDataTypes.label",
                { defaultValue: "Stored Data Types" },
              )}
            </InputLabel>
            <Select
              multiple
              value={(props.storedDataTypes ?? []) as StoredDataType[]}
              onChange={(e) => {
                const val = e.target.value;
                form.handlePropertyChange(
                  "storedDataTypes",
                  typeof val === "string" ? val.split(",") : val,
                );
              }}
              input={
                <OutlinedInput
                  label={t(
                    "tabs.dfd.element_description.datastore.fields.storedDataTypes.label",
                    { defaultValue: "Stored Data Types" },
                  )}
                />
              }
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as StoredDataType[]).map((val) => (
                    <Chip
                      key={val}
                      label={t(
                        `tabs.dfd.element_description.datastore.fields.storedDataTypes.options.${val}`,
                        { defaultValue: val },
                      )}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            >
              {(
                [
                  "credentials",
                  "keys_certificates",
                  "firmware",
                  "pii",
                  "safety_params",
                  "calibration",
                  "config",
                  "audit_logs",
                  "telemetry",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Checkbox
                    checked={(
                      (props.storedDataTypes ?? []) as StoredDataType[]
                    ).includes(opt)}
                    size="small"
                    sx={{ py: 0 }}
                  />
                  {t(
                    `tabs.dfd.element_description.datastore.fields.storedDataTypes.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* ── Security ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* Encryption at Rest */}
        <Grid item xs={12} sm={6}>
          <FormControl
            fullWidth
            size="small"
            error={showEncryptionClassificationWarning}
          >
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
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(["none", "yes", "aes256", "tde", "kms", "custom"] as const).map(
                (opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.datastore.fields.encryptionAtRest.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
          {showEncryptionClassificationWarning && (
            <Typography
              variant="caption"
              color="error"
              sx={{ mt: 0.5, display: "block" }}
            >
              {t(
                "tabs.dfd.element_description.datastore.warnings.classification_no_encryption",
                {
                  defaultValue:
                    "Data classified as SECRET/RESTRICTED without encryption at rest — high Information Disclosure risk",
                },
              )}
            </Typography>
          )}
        </Grid>

        {/* Access Control Mechanism */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.datastore.fields.accessControlMechanism.label",
                { defaultValue: "Access Control Mechanism" },
              )}
            </InputLabel>
            <Select
              value={props.accessControlMechanism ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "accessControlMechanism",
                  e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.accessControlMechanism.label",
                { defaultValue: "Access Control Mechanism" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(
                [
                  "none",
                  "process_enforced",
                  "mpu_protected",
                  "os_permissions",
                  "crypto_erase",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.datastore.fields.accessControlMechanism.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Access Control Policy */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.datastore.fields.accessControl.label",
              { defaultValue: "Access Control Policy" },
            )}
            value={props.accessControl ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("accessControl", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.datastore.fields.accessControl.placeholder",
              {
                defaultValue:
                  "Which processes may read/write and under what conditions?",
              },
            )}
          />
        </Grid>

        {/* Integrity Protection */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.datastore.fields.integrityProtection.label",
                { defaultValue: "Integrity Protection" },
              )}
            </InputLabel>
            <Select
              value={props.integrityProtection ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("integrityProtection", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.datastore.fields.integrityProtection.label",
                { defaultValue: "Integrity Protection" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(
                ["none", "crc", "hash", "hmac", "signature", "custom"] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.datastore.fields.integrityProtection.options.${opt}`,
                    { defaultValue: opt.toUpperCase() },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Multi-tenant */}
        <Grid
          item
          xs={12}
          sm={6}
          sx={{ display: "flex", alignItems: "center" }}
        >
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

        {/* Contains Safety-Relevant Data */}
        <Grid
          item
          xs={12}
          sm={6}
          sx={{ display: "flex", alignItems: "center" }}
        >
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
        </Grid>

        {/* Safety integrity warning — shown when safety flag is set but integrity protection is off */}
        {showSafetyIntegrityWarning && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ py: 0.5 }}>
              <Typography variant="caption">
                {t(
                  "tabs.dfd.element_description.datastore.warnings.safety_no_integrity",
                  {
                    defaultValue:
                      "Safety-relevant data without integrity protection — Tampering threat (EN 50742)",
                  },
                )}
              </Typography>
            </Alert>
          </Grid>
        )}

        {props.containsSafetyRelevantData && (
          <Grid item xs={12}>
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
          </Grid>
        )}
      </Grid>

      {/* ── Documentation ───────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.documentation", {
          defaultValue: "Documentation",
        })}
      />

      <FormControl fullWidth size="small">
        <InputLabel>
          {t(
            "tabs.dfd.element_description.datastore.fields.deletionMechanism.label",
            { defaultValue: "Deletion Mechanism" },
          )}
        </InputLabel>
        <Select
          value={props.deletionMechanism ?? ""}
          onChange={(e) =>
            form.handlePropertyChange("deletionMechanism", e.target.value)
          }
          label={t(
            "tabs.dfd.element_description.datastore.fields.deletionMechanism.label",
            { defaultValue: "Deletion Mechanism" },
          )}
        >
          <MenuItem value="">
            <em>
              {t("common.not_specified", { defaultValue: "Not specified" })}
            </em>
          </MenuItem>
          {(
            [
              "none",
              "overwrite",
              "factory_reset",
              "crypto_erase",
              "physical",
              "retention_period",
              "custom",
            ] as const
          ).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(
                `tabs.dfd.element_description.datastore.fields.deletionMechanism.options.${opt}`,
                { defaultValue: opt },
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
              "e.g. Factory Reset clears config and logs. Firmware retained — requires service tool.",
          },
        )}
      />

      <TextField
        fullWidth
        size="small"
        label={t("tabs.dfd.element_description.datastore.fields.owner.label", {
          defaultValue: "Owner",
        })}
        value={props.owner ?? ""}
        onChange={(e) => form.handlePropertyChange("owner", e.target.value)}
        placeholder={t(
          "tabs.dfd.element_description.datastore.fields.owner.placeholder",
          { defaultValue: "Team or person responsible" },
        )}
      />

      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t("tabs.dfd.element_description.datastore.fields.notes.label", {
          defaultValue: "Notes",
        })}
        value={form.localNotes}
        onChange={(e) => form.setLocalNotes(e.target.value)}
        onBlur={form.commitNotes}
      />

      <SecurityControlOwnershipDisplay
        records={(props as any).securityControlOwnership ?? []}
      />

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
}

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