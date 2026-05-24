// ==================== MULTIPROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, D, E (system-boundary level — R and I are handled at DataFlow/DataStore)
//
// Structure: Context → Security → Documentation (no accordions)
//
// Primary field: systemClass — drives conditional visibility of all other fields.
// When systemClass is not yet set, all fields are shown (same pattern as ProcessForm
// showing all fields before technology is selected).

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Checkbox,
  Divider,
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
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type { MultiprocessProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { SecurityControlOwnershipDisplay } from "./security-control-ownership-display";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  getMultiprocessDefaults,
  buildClearPatch,
  MULTIPROCESS_SYSTEMCLASS_DRIVEN_FIELDS,
} from "../../models/element-property-defaults";

// ==================== TYPES ====================

interface MultiprocessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface MultiprocessGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

type SystemClass = NonNullable<MultiprocessProperties["systemClass"]>;

// ==================== VISIBILITY MAPS ====================
// Based on the conditional visibility table in analyse-dokument-a-multiprocess.md.
// Each Set contains the systemClass values for which the property is shown.

/** operatingSystem: all except cloud_platform (no OS concept — PaaS/Serverless managed) */
const SHOW_OPERATING_SYSTEM = new Set<SystemClass>([
  "embedded_controller",
  "scada_hmi",
  "backend_application",
  "gateway",
  "mobile_device",
  "workstation",
  "safety_system",
]);

/** certificationLevel: relevant where formal security/safety certifications are issued */
const SHOW_CERTIFICATION = new Set<SystemClass>([
  "embedded_controller",
  "cloud_platform",   // SOC2, ISO 27017
  "safety_system",
]);

/** airGapped: only for systems that can be physically isolated from the network */
const SHOW_AIR_GAPPED = new Set<SystemClass>([
  "embedded_controller",
  "scada_hmi",
  "safety_system",
]);

/** remoteAccessEnabled: all except mobile_device (remote access is inherent to mobile) */
const SHOW_REMOTE_ACCESS = new Set<SystemClass>([
  "embedded_controller",
  "scada_hmi",
  "backend_application",
  "gateway",
  "cloud_platform",
  "workstation",
  "safety_system",
]);

/** multiTenant: cloud and backend systems that may serve multiple tenants */
const SHOW_MULTI_TENANT = new Set<SystemClass>([
  "backend_application",
  "cloud_platform",
]);

/** authorizationModel: systems with a definable access control model at the boundary */
const SHOW_AUTHORIZATION_MODEL = new Set<SystemClass>([
  "embedded_controller",
  "scada_hmi",
  "backend_application",
  "gateway",
  "cloud_platform",
  "workstation",
  // mobile_device: — (authorization is app-internal, not boundary-level)
  // safety_system: — (access model is hardware-enforced, not configurable)
]);

/** safetyRelevant / safetyRationale: systems that can fulfil a safety function */
const SHOW_SAFETY = new Set<SystemClass>([
  "embedded_controller",
  "scada_hmi",
  "safety_system",
]);

// ── New fields (Phase 1 / Compliance) ────────────────────────────────────────

/** malwareProtection: all systems — but options filtered per systemClass below */
const SHOW_MALWARE_PROTECTION = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation", "safety_system",
]);

/** accountManagement: systems with a manageable user account concept.
 *  safety_system: hardware-enforced access, no account management concept.
 */
const SHOW_ACCOUNT_MANAGEMENT = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation",
]);

/** authenticatorStorage: all systems that store or handle credentials/keys */
const SHOW_AUTHENTICATOR_STORAGE = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "mobile_device", "cloud_platform", "workstation", "safety_system",
]);

/** backupMechanism: systems with persistent state worth backing up.
 *  mobile_device: managed via MDM, no classical backup concept.
 */
const SHOW_BACKUP_MECHANISM = new Set<SystemClass>([
  "embedded_controller", "scada_hmi", "backend_application",
  "gateway", "cloud_platform", "workstation", "safety_system",
]);

/** nonRepudiation: only systems with human operator interaction */
const SHOW_NON_REPUDIATION = new Set<SystemClass>([
  "scada_hmi", "backend_application", "cloud_platform", "workstation",
]);

// Filtered malwareProtection options per systemClass.
// AV software requires a general-purpose OS — not applicable to embedded controllers
// or safety systems. code_signing is the embedded equivalent.
const MALWARE_PROTECTION_OPTIONS_MP: Record<SystemClass, readonly string[]> = {
  embedded_controller: ["none", "code_signing", "application_whitelist", "custom"],
  scada_hmi:           ["none", "av_software", "application_whitelist", "custom"],
  backend_application: ["none", "av_software", "application_whitelist", "sandbox", "custom"],
  gateway:             ["none", "code_signing", "application_whitelist", "custom"],
  mobile_device:       ["none", "sandbox", "application_whitelist", "custom"],
  cloud_platform:      ["none", "sandbox", "application_whitelist", "custom"],
  workstation:         ["none", "av_software", "application_whitelist", "nx_dep", "sandbox", "custom"],
  safety_system:       ["none", "code_signing", "custom"],
};

/**
 * Returns true if the field should be shown for the given systemClass.
 * When systemClass is undefined (not yet selected), always returns true
 * so the user can see all available fields.
 */
function isVisible(cls: SystemClass | undefined, set: Set<SystemClass>): boolean {
  if (cls === undefined) return true;
  return set.has(cls);
}

// ==================== SHARED UI ====================

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

// ==================== MAIN TAB COMPONENT ====================

const MultiprocessGeneralTab: React.FC<MultiprocessGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<MultiprocessProperties>(element, onChange);
  const { props } = form;

  const sc = props.systemClass;

  const handlePropertyChange = useCallback(
    (field: keyof MultiprocessProperties, value: unknown) => {
      const currentProps = element.properties as MultiprocessProperties;
      onChange({
        properties: {
          ...currentProps,
          [field]: value === "" ? undefined : value,
        },
      });
    },
    [element.properties, onChange],
  );

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {/* ── CONTEXT ─────────────────────────────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.context", {
          defaultValue: "Context",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* System Class — primary field, always full-width */}
        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.multiprocess.fields.systemClass.label",
                { defaultValue: "System Class" },
              )}
            </InputLabel>
            <Select
              value={props.systemClass ?? ""}
              onChange={(e) =>
                handlePropertyChange("systemClass", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.systemClass.label",
                { defaultValue: "System Class" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", {
                    defaultValue: "Not specified",
                  })}
                </em>
              </MenuItem>
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Embedded / OT —
              </MenuItem>
              {(
                [
                  "embedded_controller",
                  "scada_hmi",
                  "gateway",
                  "safety_system",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.multiprocess.fields.systemClass.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — IT / Cloud —
              </MenuItem>
              {(
                [
                  "backend_application",
                  "cloud_platform",
                  "workstation",
                  "mobile_device",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.multiprocess.fields.systemClass.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Operating System — hidden for cloud_platform */}
        {isVisible(sc, SHOW_OPERATING_SYSTEM) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.operatingSystem.label",
                  { defaultValue: "Operating System" },
                )}
              </InputLabel>
              <Select
                value={props.operatingSystem ?? ""}
                onChange={(e) =>
                  handlePropertyChange("operatingSystem", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.operatingSystem.label",
                  { defaultValue: "Operating System" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — Embedded / RTOS —
                </MenuItem>
                {(["none", "rtos", "custom"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.operatingSystem.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — Linux —
                </MenuItem>
                {(["linux_hardened", "linux_standard"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.operatingSystem.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — Windows —
                </MenuItem>
                {(["windows_hardened", "windows_standard"] as const).map(
                  (opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.multiprocess.fields.operatingSystem.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </MenuItem>
                  ),
                )}
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — Mobile —
                </MenuItem>
                {(["ios", "android"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.operatingSystem.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Certification Level — embedded_controller, cloud_platform, safety_system */}
        {isVisible(sc, SHOW_CERTIFICATION) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.certificationLevel.label",
                  { defaultValue: "Certification Level" },
                )}
              </InputLabel>
              <Select
                value={props.certificationLevel ?? ""}
                onChange={(e) =>
                  handlePropertyChange("certificationLevel", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.certificationLevel.label",
                  { defaultValue: "Certification Level" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                <MenuItem value="none">
                  {t(
                    "tabs.dfd.element_description.multiprocess.fields.certificationLevel.options.none",
                    { defaultValue: "None" },
                  )}
                </MenuItem>
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — IEC 62443 Security Level —
                </MenuItem>
                {(
                  ["iec62443_sl1", "iec62443_sl2", "iec62443_sl3"] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.certificationLevel.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — IEC 61508 / SIL —
                </MenuItem>
                {(["sil1", "sil2", "sil3"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.certificationLevel.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
                <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                  — Other —
                </MenuItem>
                {(["iso21434", "fips140_2", "cc_eal2", "cc_eal4"] as const).map(
                  (opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.multiprocess.fields.certificationLevel.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </MenuItem>
                  ),
                )}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Update Mechanism — always shown */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.multiprocess.fields.updateMechanism.label",
                { defaultValue: "Update Mechanism" },
              )}
            </InputLabel>
            <Select
              value={props.updateMechanism ?? ""}
              onChange={(e) =>
                handlePropertyChange("updateMechanism", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.updateMechanism.label",
                { defaultValue: "Update Mechanism" },
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
                  "none",
                  "manual_local",
                  "signed_local",
                  "signed_ota",
                  "vendor_only",
                  "mdm_managed",
                  "ci_cd",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.multiprocess.fields.updateMechanism.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Exposed to Internet — always shown */}
        <Grid
          item
          xs={12}
          sm={6}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={props.exposedToInternet ?? false}
                onChange={(e) =>
                  handlePropertyChange("exposedToInternet", e.target.checked)
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.multiprocess.fields.exposedToInternet.label",
              { defaultValue: "Exposed to Internet" },
            )}
          />
        </Grid>

        {/* Remote Access Enabled — all except mobile_device */}
        {isVisible(sc, SHOW_REMOTE_ACCESS) && (
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.remoteAccessEnabled ?? false}
                  onChange={(e) =>
                    handlePropertyChange(
                      "remoteAccessEnabled",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.remoteAccessEnabled.label",
                { defaultValue: "Remote Access Enabled" },
              )}
            />
          </Grid>
        )}

        {/* Air-Gapped — embedded_controller, scada_hmi, safety_system */}
        {isVisible(sc, SHOW_AIR_GAPPED) && (
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.airGapped ?? false}
                  onChange={(e) =>
                    handlePropertyChange("airGapped", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.airGapped.label",
                { defaultValue: "Air-Gapped" },
              )}
            />
          </Grid>
        )}

        {/* Multi-Tenant — backend_application, cloud_platform */}
        {isVisible(sc, SHOW_MULTI_TENANT) && (
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.multiTenant ?? false}
                  onChange={(e) =>
                    handlePropertyChange("multiTenant", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.multiTenant.label",
                { defaultValue: "Multi-Tenant" },
              )}
            />
          </Grid>
        )}
      </Grid>

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* Boundary Authentication — always shown */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.multiprocess.fields.boundaryAuthentication.label",
                { defaultValue: "Boundary Authentication" },
              )}
            </InputLabel>
            <Select
              value={props.boundaryAuthentication ?? ""}
              onChange={(e) =>
                handlePropertyChange("boundaryAuthentication", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.multiprocess.fields.boundaryAuthentication.label",
                { defaultValue: "Boundary Authentication" },
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
                  "none",
                  "password",
                  "mfa",
                  "certificate",
                  "mtls",
                  "oauth",
                  "apikey",
                  "hardware_token",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.multiprocess.fields.boundaryAuthentication.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Authorization Model — all except mobile_device, safety_system */}
        {isVisible(sc, SHOW_AUTHORIZATION_MODEL) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.authorizationModel.label",
                  { defaultValue: "Authorization Model" },
                )}
              </InputLabel>
              <Select
                value={props.authorizationModel ?? ""}
                onChange={(e) =>
                  handlePropertyChange("authorizationModel", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.authorizationModel.label",
                  { defaultValue: "Authorization Model" },
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
                  ["none", "rbac", "abac", "acl", "capability_based"] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.authorizationModel.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Safety Relevant + Rationale — embedded_controller, scada_hmi, safety_system */}
        {isVisible(sc, SHOW_SAFETY) && (
          <>
            <Grid
              item
              xs={12}
              sm={6}
              sx={{ display: "flex", alignItems: "center" }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={props.safetyRelevant ?? false}
                    onChange={(e) =>
                      handlePropertyChange("safetyRelevant", e.target.checked)
                    }
                  />
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.safetyRelevant.label",
                  { defaultValue: "Safety-Relevant System" },
                )}
              />
            </Grid>

            {props.safetyRelevant && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  label={t(
                    "tabs.dfd.element_description.multiprocess.fields.safetyRationale.label",
                    { defaultValue: "Safety Rationale" },
                  )}
                  value={props.safetyRationale ?? ""}
                  onChange={(e) =>
                    handlePropertyChange("safetyRationale", e.target.value)
                  }
                  placeholder={t(
                    "tabs.dfd.element_description.multiprocess.fields.safetyRationale.placeholder",
                    {
                      defaultValue:
                        "e.g. Controls emergency stop. SIL-2 certified per IEC 61508. Hardware watchdog, no remote update in production.",
                    },
                  )}
                />
              </Grid>
            )}
          </>
        )}
        {/* Malware Protection — CR 3.2 / EDR/HDR/NDR 3.2
             Options filtered per systemClass: AV requires general-purpose OS */}
        {isVisible(sc, SHOW_MALWARE_PROTECTION) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.malwareProtection.label",
                  { defaultValue: "Malware Protection" },
                )}
              </InputLabel>
              <Select
                value={props.malwareProtection ?? ""}
                onChange={(e) =>
                  handlePropertyChange("malwareProtection", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.malwareProtection.label",
                  { defaultValue: "Malware Protection" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                {(sc != null
                  ? MALWARE_PROTECTION_OPTIONS_MP[sc]
                  : ([
                      "none",
                      "av_software",
                      "application_whitelist",
                      "code_signing",
                      "nx_dep",
                      "sandbox",
                      "custom",
                    ] as const)
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.malwareProtection.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Account Management — CR 1.3 — not applicable for safety_system */}
        {isVisible(sc, SHOW_ACCOUNT_MANAGEMENT) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.accountManagement.label",
                  { defaultValue: "Account Management" },
                )}
              </InputLabel>
              <Select
                value={props.accountManagement ?? ""}
                onChange={(e) =>
                  handlePropertyChange("accountManagement", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.accountManagement.label",
                  { defaultValue: "Account Management" },
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
                    "local_only",
                    "ldap",
                    "active_directory",
                    "radius",
                    "iam",
                    "custom",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.accountManagement.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Authenticator Storage — CR 1.5 RE(1) */}
        {isVisible(sc, SHOW_AUTHENTICATOR_STORAGE) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.authenticatorStorage.label",
                  { defaultValue: "Authenticator Storage" },
                )}
              </InputLabel>
              <Select
                value={props.authenticatorStorage ?? ""}
                onChange={(e) =>
                  handlePropertyChange("authenticatorStorage", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.authenticatorStorage.label",
                  { defaultValue: "Authenticator Storage" },
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
                    "system_software",
                    "tpm",
                    "secure_element",
                    "hsm",
                    "custom",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.authenticatorStorage.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Backup Mechanism — CR 7.3 / CR 7.4 — not applicable for mobile_device */}
        {isVisible(sc, SHOW_BACKUP_MECHANISM) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.backupMechanism.label",
                  { defaultValue: "Backup Mechanism" },
                )}
              </InputLabel>
              <Select
                value={props.backupMechanism ?? ""}
                onChange={(e) =>
                  handlePropertyChange("backupMechanism", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.backupMechanism.label",
                  { defaultValue: "Backup Mechanism" },
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
                    "none",
                    "manual_local",
                    "automated_local",
                    "automated_remote",
                    "redundant_system",
                    "vendor_managed",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.backupMechanism.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Non-Repudiation — CR 2.12 — only for systems with human operator interaction */}
        {isVisible(sc, SHOW_NON_REPUDIATION) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.multiprocess.fields.nonRepudiation.label",
                  { defaultValue: "Non-Repudiation" },
                )}
              </InputLabel>
              <Select
                value={props.nonRepudiation ?? ""}
                onChange={(e) =>
                  handlePropertyChange("nonRepudiation", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.multiprocess.fields.nonRepudiation.label",
                  { defaultValue: "Non-Repudiation" },
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
                    "none",
                    "audit_log",
                    "digital_signature",
                    "hardware_backed",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.multiprocess.fields.nonRepudiation.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      {/* ── DOCUMENTATION ─────────────────────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.documentation", {
          defaultValue: "Documentation",
        })}
      />

      {/* Internal Components — informative, not used for threat generation */}
      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t(
          "tabs.dfd.element_description.multiprocess.fields.internalComponents.label",
          { defaultValue: "Internal Components" },
        )}
        value={props.internalComponents ?? ""}
        onChange={(e) =>
          handlePropertyChange("internalComponents", e.target.value)
        }
        placeholder={t(
          "tabs.dfd.element_description.multiprocess.fields.internalComponents.placeholder",
          {
            defaultValue:
              "e.g. RTOS Tasks: motion_ctrl, comm_stack, safety_monitor + Bootloader",
          },
        )}
      />

      {/* Security Summary — free text, system-level controls overview */}
      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t(
          "tabs.dfd.element_description.multiprocess.fields.securitySummary.label",
          { defaultValue: "Security Summary" },
        )}
        value={props.securitySummary ?? ""}
        onChange={(e) =>
          handlePropertyChange("securitySummary", e.target.value)
        }
        placeholder={t(
          "tabs.dfd.element_description.multiprocess.fields.securitySummary.placeholder",
          {
            defaultValue:
              "e.g. SIL-2 certified, Hardware watchdog, no remote update, signed firmware only",
          },
        )}
      />

      <TextField
        fullWidth
        size="small"
        label={t(
          "tabs.dfd.element_description.multiprocess.fields.owner.label",
          { defaultValue: "Owner" },
        )}
        value={props.owner ?? ""}
        onChange={(e) => handlePropertyChange("owner", e.target.value)}
        placeholder={t(
          "tabs.dfd.element_description.multiprocess.fields.owner.placeholder",
          { defaultValue: "e.g. OT Security Team" },
        )}
      />

      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t(
          "tabs.dfd.element_description.multiprocess.fields.notes.label",
          { defaultValue: "Notes" },
        )}
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
            "tabs.dfd.element_description.multiprocess.fields.description.label",
            { defaultValue: "Description" },
          )}
        </Typography>
        <RichTextEditor
          label={t(
            "tabs.dfd.element_description.multiprocess.fields.description.label",
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

// ==================== EXPORT ====================

export const MultiprocessDescriptionForm = React.memo<MultiprocessFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={
        <MultiprocessGeneralTab element={element} onChange={onChange} />
      }
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default MultiprocessDescriptionForm;