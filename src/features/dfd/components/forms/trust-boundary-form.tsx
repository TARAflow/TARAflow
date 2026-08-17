// ==================== TRUST BOUNDARY DESCRIPTION FORM ====================
// STRIDE: All (Trust boundaries trigger automatic threat checks!)
// Focus: Zone definition, exposure level, security assumptions
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
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import type { TrustBoundaryProperties } from "../../models/element-properties";
import type {
  ExposureLevel,
  BoundaryControlType,
} from "../../models/element-shared-types";
import {
  EXPOSURE_LEVEL_LABEL_KEYS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { useElementForm } from "../../hooks/use-element-form";
import {
  TB_TYPE_DEFAULTS,
  TB_TYPE_DRIVEN_FIELDS,
  TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS,
  applyCascadeDefaults,
  buildClearPatch,
} from "../../models/element-property-defaults";
import {
  TRUST_BOUNDARY_CORE_TYPE_OPTIONS,
  TRUST_BOUNDARY_EMBEDDED_TYPE_OPTIONS,
} from "../../models/element-properties";

// ==================== PROPS ====================

interface TrustBoundaryFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== HELPERS ====================

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];

// "platform" is intentionally NOT included here: boundaryControlTypes
// (firewall, VPN gateway, authentication gateway, ...) are controls the
// analyst configures on infrastructure they operate. A platform boundary
// is OS-vendor-controlled (app sandbox ↔ browser broker, keychain/keystore) —
// there is nothing here for the analyst to configure. Revisit if a
// platform-specific control vocabulary (e.g. "os_sandboxing", "code_signing")
// is ever added to BoundaryControlType.
const SHOW_BOUNDARY_CONTROLS = new Set([
  "network",
  "privilege",
  "organization",
  "cloud",
  "device",
]);

// "platform" excluded: the app has no logging/monitoring visibility into
// OS-vendor-controlled components, so a monitoringEnabled toggle here would
// be meaningless.
const SHOW_MONITORING = new Set([
  "network",
  "privilege",
  "organization",
  "cloud",
  "device",
  "debug",
]);

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

// ==================== COMPONENT ====================

export const TrustBoundaryDescriptionForm = React.memo<TrustBoundaryFormProps>(
  ({ element, onChange }) => {
    const { t } = useTranslation();
    const form = useElementForm<TrustBoundaryProperties>(element, onChange);
    const { props } = form;

    // ── Cascade: boundaryType driver ─────────────────────────────────────────
    const handleBoundaryTypeChange = (value: string) => {
      if (!value) {
        // Clear driver + all driven fields
        onChange({
          properties: {
            ...props,
            boundaryType: undefined,
            ...buildClearPatch<TrustBoundaryProperties>(TB_TYPE_DRIVEN_FIELDS),
          } as TrustBoundaryProperties,
        });
        return;
      }
      const typeKey = value as NonNullable<
        TrustBoundaryProperties["boundaryType"]
      >;
      const defaults = TB_TYPE_DEFAULTS[typeKey] ?? {};
      const cascaded = applyCascadeDefaults<TrustBoundaryProperties>(
        props,
        defaults,
      );
      onChange({
        properties: {
          ...props,
          boundaryType: typeKey,
          ...cascaded,
        } as TrustBoundaryProperties,
      });
    };

    // Dynamic placeholder for securityAssumptions — hint only, never overwrites analyst text
    const securityAssumptionsPlaceholder =
      props.boundaryType != null
        ? (TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS[props.boundaryType] ??
          t(
            "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.placeholder",
            { defaultValue: "e.g. Inside is trusted, outside is hostile" },
          ))
        : t(
            "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.placeholder",
            { defaultValue: "e.g. Inside is trusted, outside is hostile" },
          );

    return (
      <Box p={1}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Zone Warning */}
          <Alert severity="warning">
            <Typography variant="body2" fontWeight="bold">
              {t("tabs.dfd.element_description.trustboundary.warning.title", {
                defaultValue: "Trust Boundaries are critical!",
              })}
            </Typography>
            <Typography variant="caption">
              {t("tabs.dfd.element_description.trustboundary.warning.hint", {
                defaultValue:
                  "Any data flow crossing this boundary requires extra scrutiny for all STRIDE threats.",
              })}
            </Typography>
          </Alert>

          {/* ── Context ─────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.context", {
              defaultValue: "Context",
            })}
          />

          {/* Boundary Type */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.trustboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            </InputLabel>
            <Select
              value={props.boundaryType ?? ""}
              onChange={(e) => handleBoundaryTypeChange(e.target.value)}
              label={t(
                "tabs.dfd.element_description.trustboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {TRUST_BOUNDARY_CORE_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.trustboundary.fields.boundaryType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryType.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Embedded-specific —
              </MenuItem>
              {TRUST_BOUNDARY_EMBEDDED_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.trustboundary.fields.boundaryType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryType.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Exposure Level */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t("tabs.dfd.element_description.exposure_level.label", {
                defaultValue: "Exposure Level",
              })}
            </InputLabel>
            <Select
              value={props.defaultExposureLevel ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "defaultExposureLevel",
                  e.target.value,
                )
              }
              label={t("tabs.dfd.element_description.exposure_level.label", {
                defaultValue: "Exposure Level",
              })}
              renderValue={(value) =>
                value
                  ? t(EXPOSURE_LEVEL_LABEL_KEYS[value as ExposureLevel])
                  : ""
              }
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
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
                      {t(EXPOSURE_LEVEL_LABEL_KEYS[el])}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── Security ─────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.security", {
              defaultValue: "Security",
            })}
          />

          {/* Boundary Control Types — structured multi-select */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.trustboundary.fields.boundaryControlTypes.label",
                { defaultValue: "Boundary Controls" },
              )}
            </InputLabel>
            <Select
              multiple
              value={
                (props.boundaryControlTypes ?? []) as BoundaryControlType[]
              }
              onChange={(e) => {
                const val = e.target.value;
                form.handlePropertyChange(
                  "boundaryControlTypes",
                  typeof val === "string" ? val.split(",") : val,
                );
              }}
              input={
                <OutlinedInput
                  label={t(
                    "tabs.dfd.element_description.trustboundary.fields.boundaryControlTypes.label",
                    { defaultValue: "Boundary Controls" },
                  )}
                />
              }
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as BoundaryControlType[]).map((val) => (
                    <Chip
                      key={val}
                      label={t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryControlTypes.options.${val}`,
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
                  "firewall",
                  "ids_ips",
                  "data_diode",
                  "vpn_gateway",
                  "dmz",
                  "authentication_gateway",
                  "unidirectional_gateway",
                  "network_segmentation",
                  "jump_host",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Checkbox
                    checked={(
                      (props.boundaryControlTypes ??
                        []) as BoundaryControlType[]
                    ).includes(opt)}
                    size="small"
                    sx={{ py: 0 }}
                  />
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.trustboundary.fields.boundaryControlTypes.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryControlTypes.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Custom Boundary Controls — vendor/domain-specific free text */}
          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.customBoundaryControls.label",
              { defaultValue: "Additional Controls" },
            )}
            value={props.customBoundaryControls ?? ""}
            onChange={(e) =>
              form.handlePropertyChange(
                "customBoundaryControls",
                e.target.value,
              )
            }
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.customBoundaryControls.placeholder",
              {
                defaultValue:
                  "e.g. Siemens SCALANCE S615, OPC UA Reverse Proxy with allowlist",
              },
            )}
            helperText={t(
              "tabs.dfd.element_description.trustboundary.fields.customBoundaryControls.helper",
              {
                defaultValue:
                  "Vendor-specific or domain-specific controls not in the list above",
              },
            )}
          />

          {/* Monitoring — not applicable for legal/peripheral/boot */}
          {(props.boundaryType == null ||
            SHOW_MONITORING.has(props.boundaryType)) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.monitoringEnabled || false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "monitoringEnabled",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.trustboundary.fields.monitoringEnabled.label",
                { defaultValue: "Monitoring / Logging Enabled" },
              )}
            />
          )}

          {/* Default Deny Policy — NDR 5.2 RE(1)/(2)/(3) — only for network/cloud */}
          {(props.boundaryType === "network" ||
            props.boundaryType === "cloud") && (
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.trustboundary.fields.defaultDenyPolicy.label",
                  { defaultValue: "Default Traffic Policy" },
                )}
              </InputLabel>
              <Select
                value={props.defaultDenyPolicy ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "defaultDenyPolicy",
                    e.target.value || undefined,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.trustboundary.fields.defaultDenyPolicy.label",
                  { defaultValue: "Default Traffic Policy" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                {(
                  [
                    "allow_all",
                    "deny_all_permit_exception",
                    "island_mode",
                    "fail_close",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    <Tooltip
                      title={t(
                        `tabs.dfd.element_description.trustboundary.fields.defaultDenyPolicy.tooltips.${opt}`,
                        { defaultValue: "" },
                      )}
                      placement="right"
                      arrow
                    >
                      <span style={{ width: "100%", display: "block" }}>
                        {t(
                          `tabs.dfd.element_description.trustboundary.fields.defaultDenyPolicy.options.${opt}`,
                          { defaultValue: opt },
                        )}
                      </span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Security Assumptions — dynamic placeholder driven by boundaryType */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={3}
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.label",
              { defaultValue: "Security Assumptions" },
            )}
            value={props.securityAssumptions ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("securityAssumptions", e.target.value)
            }
            placeholder={securityAssumptionsPlaceholder}
            helperText={t(
              "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.helper",
              {
                defaultValue:
                  "What do you assume about each side of this boundary?",
              },
            )}
          />

          {/* ── Documentation ───────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.documentation", {
              defaultValue: "Documentation",
            })}
          />

          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.complianceRelevance.label",
              { defaultValue: "Compliance Relevance" },
            )}
            value={props.complianceRelevance ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("complianceRelevance", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.complianceRelevance.placeholder",
              {
                defaultValue: "e.g. GDPR, ISO 27001, SOC 2, PCI-DSS, IEC 62443",
              },
            )}
          />

          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.owner.label",
              { defaultValue: "Owner / Responsible Team" },
            )}
            value={props.owner ?? ""}
            onChange={(e) => form.handlePropertyChange("owner", e.target.value)}
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.owner.placeholder",
              { defaultValue: "Who maintains this boundary?" },
            )}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.notes.label",
              { defaultValue: "Notes" },
            )}
            value={form.localNotes}
            onChange={(e) => form.setLocalNotes(e.target.value)}
            onBlur={form.commitNotes}
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t(
                "tabs.dfd.element_description.trustboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
            </Typography>
            <RichTextEditor
              label={t(
                "tabs.dfd.element_description.trustboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
              value={form.localDescription}
              onChange={form.setLocalDescription}
              onBlur={form.commitDescription}
            />
          </Box>
        </Stack>
      </Box>
    );
  },
  (prev, next) => prev.element === next.element,
);

export default TrustBoundaryDescriptionForm;