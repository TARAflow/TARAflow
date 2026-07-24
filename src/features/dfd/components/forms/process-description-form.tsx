// ==================== PROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, R, I, D, E (all)
//
// Structure: Context → Security → Documentation (no accordions)

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
  Tooltip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import type { ProcessProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { SecurityControlOwnershipDisplay } from "./security-control-ownership-display";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  updateProcessProperties,
  getProcessDefaults,
  isNoOsTechnology,
} from "../../models/element-property-defaults";

interface ProcessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface ProcessGeneralTabProps {
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

const EMBEDDED_RUNSAS_TOOLTIP =
  "Not applicable — embedded/bare-metal processes have no OS user context";

// Filtered malwareProtection options per technology.
// AV software requires an OS with a file system — not applicable to bare-metal/RTOS.
// code_signing requires a trusted bootloader or verifier — only meaningful for
// loadable code units, not for ISRs or state machines baked into the build.
const MALWARE_PROTECTION_OPTIONS: Partial<
  Record<NonNullable<ProcessProperties["technology"]>, ReadonlyArray<string>>
> = {
  rtos_task:      ["none", "code_signing", "custom"],
  bare_metal:     ["none", "code_signing", "custom"],
  isr:            ["none", "custom"],
  state_machine:  ["none", "custom"],
  bootloader:     ["none", "code_signing", "custom"],
  driver:         ["none", "code_signing", "nx_dep", "custom"],
  protocol_stack: ["none", "code_signing", "application_whitelist", "custom"],
  api:            ["none", "application_whitelist", "sandbox", "custom"],
  ui:             ["none", "av_software", "application_whitelist", "sandbox", "custom"],
  microservice:   ["none", "application_whitelist", "sandbox", "custom"],
  lambda:         ["none", "application_whitelist", "sandbox", "custom"],
  daemon:         ["none", "av_software", "application_whitelist", "nx_dep", "sandbox", "custom"],
  websocket:      ["none", "application_whitelist", "sandbox", "custom"],
  event:          ["none", "application_whitelist", "custom"],
  cli:            ["none", "av_software", "application_whitelist", "custom"],
  database:       ["none", "application_whitelist", "sandbox", "custom"],
  cron:           ["none", "av_software", "application_whitelist", "custom"],
  iot:            ["none", "code_signing", "application_whitelist", "custom"],
  batch:          ["none", "application_whitelist", "custom"],
};

// Shown when technology is not yet set — analyst can see all options
const ALL_MALWARE_OPTIONS: ReadonlyArray<string> = [
  "none", "av_software", "application_whitelist", "code_signing",
  "nx_dep", "sandbox", "custom",
];

const ProcessGeneralTab: React.FC<ProcessGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<ProcessProperties>(element, onChange);
  const { props } = form;

  const isEmbedded = isNoOsTechnology(props.technology);

  const handlePropertyChange = useCallback(
    (field: keyof ProcessProperties, value: unknown) => {
      const currentProps = element.properties as ProcessProperties;

      if (field === "runsAs") {
        if (!value) {
          const newProps: Partial<ProcessProperties> = {
            ...currentProps,
            runsAs: undefined,
            privilegeLevel: undefined,
          };
          if (!currentProps.technology)
            newProps.authenticationRequired = undefined;
          onChange({ properties: newProps });
          return;
        }
        onChange({
          properties: getProcessDefaults(currentProps, {
            runsAs: value as ProcessProperties["runsAs"],
          }),
        });
        return;
      }

      if (field === "technology") {
        if (!value) {
          const newProps: Partial<ProcessProperties> = {
            ...currentProps,
            technology: undefined,
            authorizationModel: undefined,
            inputValidation: undefined,
            errorHandling: undefined,
          };
          if (!currentProps.runsAs) newProps.authenticationRequired = undefined;
          onChange({ properties: newProps });
          return;
        }
        onChange({
          properties: getProcessDefaults(currentProps, {
            technology: value as ProcessProperties["technology"],
          }),
        });
        return;
      }

      onChange({
        properties: updateProcessProperties(currentProps, {
          [field]: value,
        } as Partial<ProcessProperties>),
      });
    },
    [element.properties, onChange],
  );

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
                "tabs.dfd.element_description.process.fields.technology.label",
              )}
            </InputLabel>
            <Select
              value={props.technology ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "technology",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.technology.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(
                [
                  "api",
                  "batch",
                  "ui",
                  "microservice",
                  "lambda",
                  "daemon",
                  "websocket",
                  "event",
                  "cli",
                  "database",
                  "cron",
                  "iot",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.technology.options.${opt}`,
                  )}
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — In-Process Module —
              </MenuItem>
              <MenuItem value="logic_module">
                {t(
                  "tabs.dfd.element_description.process.fields.technology.options.logic_module",
                  { defaultValue: "Logic Module" },
                )}
              </MenuItem>
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Embedded / RTOS —
              </MenuItem>
              {(
                [
                  "rtos_task",
                  "bare_metal",
                  "isr",
                  "state_machine",
                  "bootloader",
                  "driver",
                  "protocol_stack",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.technology.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        {/* Process Semantic — only relevant for embedded technologies.
            For web/cloud/IT processes the semantic is always execution_unit
            (OS-enforced isolation), so the field adds no value and would
            confuse analysts working on non-embedded systems. */}
        {isEmbedded && (
          <>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.processSemantic.label",
                    { defaultValue: "Process Semantic" },
                  )}
                </InputLabel>

                <Select
                  value={(props as any).processSemantic ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "processSemantic" as any,
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.processSemantic.label",
                    { defaultValue: "Process Semantic" },
                  )}
                >
                  <MenuItem value="">
                    <em>
                      {t("common.not_specified", {
                        defaultValue: "Not specified",
                      })}
                    </em>
                  </MenuItem>

                  <MenuItem value="execution_unit">
                    {t(
                      "tabs.dfd.element_description.process.fields.processSemantic.options.execution_unit",
                      {
                        defaultValue: "Execution Unit (OS/RTOS-isolated)",
                      },
                    )}
                  </MenuItem>

                  <MenuItem value="functional_block">
                    {t(
                      "tabs.dfd.element_description.process.fields.processSemantic.options.functional_block",
                      {
                        defaultValue:
                          "Functional Block (logical, no OS isolation)",
                      },
                    )}
                  </MenuItem>

                  <MenuItem value="security_boundary">
                    {t(
                      "tabs.dfd.element_description.process.fields.processSemantic.options.security_boundary",
                      {
                        defaultValue:
                          "Security Boundary (HSM, TEE, Crypto Engine)",
                      },
                    )}
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {(props as any).processSemantic === "functional_block" && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "info.50",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "info.200",
                  }}
                >
                  <Typography variant="caption" color="info.dark">
                    {t(
                      "tabs.dfd.element_description.process.fields.processSemantic.hint_functional_block",
                      {
                        defaultValue:
                          "This process represents a functional block, not an OS process. No hardware isolation boundary exists — trust assumptions must be explicit.",
                      },
                    )}
                  </Typography>
                </Box>
              </Grid>
            )}
          </>
        )}{" "}
        {/* end isEmbedded conditional for processSemantic */}
        {/* Runs As */}
        <Grid item xs={12} sm={6}>
          <Tooltip
            title={isEmbedded ? EMBEDDED_RUNSAS_TOOLTIP : ""}
            placement="top"
            arrow
          >
            <span style={{ display: "block" }}>
              <FormControl fullWidth size="small" disabled={isEmbedded}>
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.runsAs.label",
                  )}
                </InputLabel>
                <Select
                  value={isEmbedded ? "" : (props.runsAs ?? "")}
                  onChange={(e) =>
                    handlePropertyChange(
                      "runsAs",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.runsAs.label",
                  )}
                >
                  <MenuItem value="">
                    <em>{t("common.not_specified")}</em>
                  </MenuItem>
                  {(
                    [
                      "user",
                      "admin_user",
                      "root",
                      "system",
                      "service",
                      "guest",
                      "anonymous",
                      "contractor",
                    ] as const
                  ).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.runsAs.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </span>
          </Tooltip>
        </Grid>
        {/* Privilege Level */}
        <Grid item xs={12} sm={6}>
          <Tooltip
            title={isEmbedded ? EMBEDDED_RUNSAS_TOOLTIP : ""}
            placement="top"
            arrow
          >
            <span style={{ display: "block" }}>
              <FormControl fullWidth size="small" disabled={isEmbedded}>
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.privilegeLevel.label",
                  )}
                </InputLabel>
                <Select
                  value={isEmbedded ? "" : (props.privilegeLevel ?? "")}
                  onChange={(e) =>
                    handlePropertyChange(
                      "privilegeLevel",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.privilegeLevel.label",
                  )}
                >
                  <MenuItem value="">
                    <em>{t("common.not_specified")}</em>
                  </MenuItem>
                  {(["low", "medium", "high", "root"] as const).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {t(
                        `tabs.dfd.element_description.process.fields.privilegeLevel.options.${opt}`,
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </span>
          </Tooltip>
        </Grid>
      </Grid>

      {/* ── Security ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* Authentication Required */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.authenticationRequired.label",
              )}
            </InputLabel>
            <Select
              value={props.authenticationRequired ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "authenticationRequired",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.authenticationRequired.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(
                [
                  "no",
                  "yes",
                  "optional",
                  "oauth",
                  "saml",
                  "certificate",
                  "apikey",
                  "jwt",
                  "mtls",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.authenticationRequired.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* TLS Termination — capability, decoupled from auth */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.tlsTermination.label",
              )}
            </InputLabel>
            <Select
              value={props.tlsTermination ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "tlsTermination",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.tlsTermination.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(["none", "server", "mutual"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.tlsTermination.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Authorization Model */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.authorizationModel.label",
              )}
            </InputLabel>
            <Select
              value={props.authorizationModel ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "authorizationModel",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.authorizationModel.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(["none", "rbac", "abac", "acl", "custom"] as const).map(
                (opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.process.fields.authorizationModel.options.${opt}`,
                    )}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
        </Grid>

        {/* Input Validation */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.inputValidation.label",
              )}
            </InputLabel>
            <Select
              value={props.inputValidation ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "inputValidation",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.inputValidation.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(["none", "basic", "strict", "schema"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.inputValidation.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Error Handling */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.errorHandling.label",
              )}
            </InputLabel>
            <Select
              value={props.errorHandling ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "errorHandling",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.errorHandling.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(["silent", "verbose", "sanitized"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.errorHandling.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Malware Protection — CR 3.2 / EDR 3.2 */}
        {/* Options filtered per technology: AV requires OS, code_signing requires loader */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.malwareProtection.label",
                { defaultValue: "Malware Protection" },
              )}
            </InputLabel>
            <Select
              value={props.malwareProtection ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "malwareProtection",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.malwareProtection.label",
                { defaultValue: "Malware Protection" },
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(props.technology != null
                ? (MALWARE_PROTECTION_OPTIONS[props.technology] ??
                  ALL_MALWARE_OPTIONS)
                : ALL_MALWARE_OPTIONS
              ).map((opt: string) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.malwareProtection.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Account Management — CR 1.3 — not applicable for embedded (no user account concept) */}
        {!isEmbedded && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.process.fields.accountManagement.label",
                  { defaultValue: "Account Management" },
                )}
              </InputLabel>
              <Select
                value={props.accountManagement ?? ""}
                onChange={(e) =>
                  handlePropertyChange(
                    "accountManagement",
                    e.target.value === "" ? undefined : e.target.value,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.process.fields.accountManagement.label",
                  { defaultValue: "Account Management" },
                )}
              >
                <MenuItem value="">
                  <em>{t("common.not_specified")}</em>
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
                      `tabs.dfd.element_description.process.fields.accountManagement.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Authenticator Storage — CR 1.5 RE(1) */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.authenticatorStorage.label",
                { defaultValue: "Authenticator Storage" },
              )}
            </InputLabel>
            <Select
              value={props.authenticatorStorage ?? ""}
              onChange={(e) =>
                handlePropertyChange(
                  "authenticatorStorage",
                  e.target.value === "" ? undefined : e.target.value,
                )
              }
              label={t(
                "tabs.dfd.element_description.process.fields.authenticatorStorage.label",
                { defaultValue: "Authenticator Storage" },
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(
                [
                  "software_only",
                  "tpm",
                  "secure_element",
                  "hsm",
                  "keychain_os",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.process.fields.authenticatorStorage.options.${opt}`,
                    { defaultValue: opt },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Non-Repudiation — CR 2.12 — only for UI/API/websocket */}
        {props.technology != null &&
          (["ui", "api", "websocket", "cli"] as const).includes(
            props.technology as "ui" | "api" | "websocket" | "cli",
          ) && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t(
                    "tabs.dfd.element_description.process.fields.nonRepudiation.label",
                    { defaultValue: "Non-Repudiation" },
                  )}
                </InputLabel>
                <Select
                  value={props.nonRepudiation ?? ""}
                  onChange={(e) =>
                    handlePropertyChange(
                      "nonRepudiation",
                      e.target.value === "" ? undefined : e.target.value,
                    )
                  }
                  label={t(
                    "tabs.dfd.element_description.process.fields.nonRepudiation.label",
                    { defaultValue: "Non-Repudiation" },
                  )}
                >
                  <MenuItem value="">
                    <em>{t("common.not_specified")}</em>
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
                        `tabs.dfd.element_description.process.fields.nonRepudiation.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

        {/* Fail-Safe Output State — CR 3.6 — only for functional_block / safetyRelevant */}
        {((props as any).processSemantic === "functional_block" ||
          (props as any).safetyRelevant) && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.process.fields.failSafeOutputState.label",
                  { defaultValue: "Fail-Safe Output State" },
                )}
              </InputLabel>
              <Select
                value={props.failSafeOutputState ?? ""}
                onChange={(e) =>
                  handlePropertyChange(
                    "failSafeOutputState",
                    e.target.value === "" ? undefined : e.target.value,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.process.fields.failSafeOutputState.label",
                  { defaultValue: "Fail-Safe Output State" },
                )}
              >
                <MenuItem value="">
                  <em>{t("common.not_specified")}</em>
                </MenuItem>
                {(
                  [
                    "not_defined",
                    "unpowered",
                    "hold_last_value",
                    "fixed_value",
                    "dynamic",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.process.fields.failSafeOutputState.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {/* Exposed to Internet — not applicable for embedded processes (no network stack) */}
        {!isEmbedded && (
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.exposedToInternet || false}
                  onChange={(e) =>
                    handlePropertyChange("exposedToInternet", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.process.fields.exposedToInternet.label",
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

      <TextField
        fullWidth
        size="small"
        label={t("tabs.dfd.element_description.process.fields.owner.label")}
        value={(props.owner as string) ?? ""}
        onChange={(e) => handlePropertyChange("owner", e.target.value)}
        placeholder={t(
          "tabs.dfd.element_description.process.fields.owner.placeholder",
        )}
      />

      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t("tabs.dfd.element_description.process.fields.notes.label")}
        value={form.localNotes}
        onChange={(e) => form.setLocalNotes(e.target.value)}
        onBlur={form.commitNotes}
      />

      <SecurityControlOwnershipDisplay
        records={(props as any).securityControlOwnership ?? []}
      />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("tabs.dfd.element_description.process.fields.description.label")}
        </Typography>
        <RichTextEditor
          label={t(
            "tabs.dfd.element_description.process.fields.description.label",
          )}
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
        />
      </Box>
    </Stack>
  );
};

export const ProcessDescriptionForm = React.memo<ProcessFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={<ProcessGeneralTab element={element} onChange={onChange} />}
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default ProcessDescriptionForm;