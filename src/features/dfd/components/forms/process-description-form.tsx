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
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type { ProcessProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  updateProcessProperties,
  getProcessDefaults,
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

const EMBEDDED_TECHNOLOGIES = new Set([
  "rtos_task",
  "bare_metal",
  "isr",
  "state_machine",
  "bootloader",
  "driver",
  "protocol_stack",
]);

const EMBEDDED_RUNSAS_TOOLTIP =
  "Not applicable — embedded/bare-metal processes have no OS user context";

const ProcessGeneralTab: React.FC<ProcessGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<ProcessProperties>(element, onChange);
  const { props } = form;

  const isEmbedded = EMBEDDED_TECHNOLOGIES.has(props.technology ?? "");

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
                <em>
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.not_specified",
                  )}
                </em>
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

        {/* Process Semantic */}
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
                  {t(
                    "tabs.dfd.element_description.process.fields.processSemantic.options.not_specified",
                    { defaultValue: "Not specified" },
                  )}
                </em>
              </MenuItem>
              <MenuItem value="execution_unit">
                {t(
                  "tabs.dfd.element_description.process.fields.processSemantic.options.execution_unit",
                  { defaultValue: "Execution Unit (OS/RTOS-isolated)" },
                )}
              </MenuItem>
              <MenuItem value="functional_block">
                {t(
                  "tabs.dfd.element_description.process.fields.processSemantic.options.functional_block",
                  {
                    defaultValue: "Functional Block (logical, no OS isolation)",
                  },
                )}
              </MenuItem>
              <MenuItem value="security_boundary">
                {t(
                  "tabs.dfd.element_description.process.fields.processSemantic.options.security_boundary",
                  {
                    defaultValue: "Security Boundary (HSM, TEE, Crypto Engine)",
                  },
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Hint for functional_block */}
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
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.runsAs.options.not_specified",
                      )}
                    </em>
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
                    <em>
                      {t(
                        "tabs.dfd.element_description.process.fields.privilegeLevel.options.not_specified",
                      )}
                    </em>
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
                <em>
                  {t(
                    "tabs.dfd.element_description.process.fields.authenticationRequired.options.not_specified",
                  )}
                </em>
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
                <em>
                  {t(
                    "tabs.dfd.element_description.process.fields.authorizationModel.options.not_specified",
                  )}
                </em>
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
                <em>
                  {t(
                    "tabs.dfd.element_description.process.fields.inputValidation.options.not_specified",
                  )}
                </em>
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
                <em>
                  {t(
                    "tabs.dfd.element_description.process.fields.errorHandling.options.not_specified",
                  )}
                </em>
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

        {/* Exposed to Internet */}
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