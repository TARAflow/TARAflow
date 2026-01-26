// ==================== PROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, R, I, D, E (alle!)
// Focus: Logik, Ausführung, Angriffsfläche

import React, { useCallback, useMemo } from "react";
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
  Grid,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { DFDElement } from "../../models/dfd-types";
import type { ProcessProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import {
  AssetRelationSelector,
  type AvailableAsset,
} from "./asset-relation-selector";
import {
  updateProcessProperties,
  getProcessDefaults,
} from "../../hooks/use-dfd-ui-state";

interface ProcessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
}

function asProcessProperties(props: any): ProcessProperties {
  return props as ProcessProperties;
}

// ==================== OPTION CONSTANTS ====================

const RUNS_AS_OPTIONS = [
  "not_specified",
  "user",
  "admin_user",
  "root",
  "system",
  "service",
  "guest",
  "anonymous",
  "contractor",
] as const;

const PRIVILEGE_LEVEL_OPTIONS = [
  "not_specified",
  "low",
  "medium",
  "high",
  "root",
] as const;

const AUTHENTICATION_REQUIRED_OPTIONS = [
  "not_specified",
  "no",
  "yes",
  "optional",
  "oauth",
  "saml",
  "certificate",
  "apikey",
  "jwt",
  "mtls",
] as const;

const AUTHORIZATION_MODEL_OPTIONS = [
  "not_specified",
  "none",
  "rbac",
  "abac",
  "acl",
  "custom",
] as const;

const INPUT_VALIDATION_OPTIONS = [
  "not_specified",
  "none",
  "basic",
  "strict",
  "schema",
] as const;

const ERROR_HANDLING_OPTIONS = [
  "not_specified",
  "silent",
  "verbose",
  "sanitized",
] as const;

const TECHNOLOGY_OPTIONS = [
  "not_specified",
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
] as const;

export const ProcessDescriptionForm: React.FC<ProcessFormProps> = ({
  element,
  onChange,
  availableAssets = [],
}) => {
  const { t } = useTranslation();
  const props = asProcessProperties(element.properties);

  // const handlePropertyChange = useCallback(
  //   (field: keyof ProcessProperties, value: any) => {
  //     let updatedProps: ProcessProperties;

  //     if (field === "runsAs" || field === "technology") {
  //       updatedProps = getProcessDefaults(
  //         element.properties as ProcessProperties,
  //         { [field]: value },
  //       );
  //     } else {
  //       updatedProps = updateProcessProperties(
  //         element.properties as ProcessProperties,
  //         { [field]: value },
  //       );
  //     }

  //     onChange({ properties: updatedProps });
  //   },
  //   [element.properties, onChange],
  // );

  const handlePropertyChange = useCallback(
    (field: keyof ProcessProperties, value: any) => {
      const currentProps = element.properties as ProcessProperties;

      if (field === "runsAs") {
        // runAs wird unspecified → privilegeLevel clearen
        if (!value) {
          const newProps: Partial<ProcessProperties> = {
            ...currentProps,
            runsAs: undefined,
            privilegeLevel: undefined,
          };

          // Wenn technology AUCH unspecified → authenticationRequired clearen
          if (!currentProps.technology) {
            newProps.authenticationRequired = undefined;
          }

          onChange({ properties: newProps });
          return;
        }

        // Defaults anwenden
        const updatedProps = getProcessDefaults(currentProps, {
          runsAs: value,
        });
        onChange({ properties: updatedProps });
        return;
      }

      if (field === "technology") {
        // technology wird unspecified → technology-Felder clearen
        if (!value) {
          const newProps: Partial<ProcessProperties> = {
            ...currentProps,
            technology: undefined,
            authorizationModel: undefined,
            inputValidation: undefined,
            errorHandling: undefined,
          };

          if (!currentProps.runsAs) {
            newProps.authenticationRequired = undefined;
            newProps.exposedToInternet = undefined;
          }

          onChange({ properties: newProps });
          return;
        }

        const updatedProps = getProcessDefaults(currentProps, {
          technology: value,
        });
        onChange({ properties: updatedProps });
        return;
      }

      const updatedProps = updateProcessProperties(currentProps, {
        [field]: value,
      });
      onChange({ properties: updatedProps });
    },
    [element.properties, onChange],
  );

  // Generate translated option arrays
  const runsAsOptions = useMemo(
    () =>
      RUNS_AS_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.runsAs.options.${value}`,
        ),
      })),
    [t],
  );

  const privilegeLevelOptions = useMemo(
    () =>
      PRIVILEGE_LEVEL_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.privilegeLevel.options.${value}`,
        ),
      })),
    [t],
  );

  const authenticationRequiredOptions = useMemo(
    () =>
      AUTHENTICATION_REQUIRED_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.authenticationRequired.options.${value}`,
        ),
      })),
    [t],
  );

  const authorizationModelOptions = useMemo(
    () =>
      AUTHORIZATION_MODEL_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.authorizationModel.options.${value}`,
        ),
      })),
    [t],
  );

  const inputValidationOptions = useMemo(
    () =>
      INPUT_VALIDATION_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.inputValidation.options.${value}`,
        ),
      })),
    [t],
  );

  const errorHandlingOptions = useMemo(
    () =>
      ERROR_HANDLING_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.errorHandling.options.${value}`,
        ),
      })),
    [t],
  );

  const technologyOptions = useMemo(
    () =>
      TECHNOLOGY_OPTIONS.map((value) => ({
        value: value === "not_specified" ? "" : value,
        label: t(
          `tabs.dfd.element_description.process.fields.technology.options.${value}`,
        ),
      })),
    [t],
  );

  // Memoize label strings
  const labels = useMemo(
    () => ({
      runsAs: t("tabs.dfd.element_description.process.fields.runsAs.label"),
      privilegeLevel: t(
        "tabs.dfd.element_description.process.fields.privilegeLevel.label",
      ),
      authenticationRequired: t(
        "tabs.dfd.element_description.process.fields.authenticationRequired.label",
      ),
      authorizationModel: t(
        "tabs.dfd.element_description.process.fields.authorizationModel.label",
      ),
      inputValidation: t(
        "tabs.dfd.element_description.process.fields.inputValidation.label",
      ),
      errorHandling: t(
        "tabs.dfd.element_description.process.fields.errorHandling.label",
      ),
      technology: t(
        "tabs.dfd.element_description.process.fields.technology.label",
      ),
    }),
    [t],
  );

  return (
    <Box sx={{ p: 2 }}>
      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.process.sections.required")}
      </Typography>

      <RichTextEditor
        value={element.properties.description || ""}
        onChange={(value) => handlePropertyChange("description", value)}
        label={t(
          "tabs.dfd.element_description.process.fields.description.label",
        )}
        required
        helperText={t(
          "tabs.dfd.element_description.process.fields.description.helperText",
        )}
      />

      <Divider sx={{ my: 3 }} />

      {/* Security Section - 2-column Grid */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.process.sections.security")}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.runsAs}</InputLabel>
            <Select
              value={props.runsAs || ""}
              onChange={(e) => handlePropertyChange("runsAs", e.target.value)}
              label={labels.runsAs}
            >
              {runsAsOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Technology */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.technology}</InputLabel>
            <Select
              value={props.technology || ""}
              onChange={(e) =>
                handlePropertyChange("technology", e.target.value)
              }
              label={labels.technology}
            >
              {technologyOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.privilegeLevel}</InputLabel>
            <Select
              value={props.privilegeLevel || ""}
              onChange={(e) =>
                handlePropertyChange("privilegeLevel", e.target.value)
              }
              label={labels.privilegeLevel}
            >
              {privilegeLevelOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.authenticationRequired}</InputLabel>
            <Select
              value={props.authenticationRequired || ""}
              onChange={(e) =>
                handlePropertyChange("authenticationRequired", e.target.value)
              }
              label={labels.authenticationRequired}
            >
              {authenticationRequiredOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.authorizationModel}</InputLabel>
            <Select
              value={props.authorizationModel || ""}
              onChange={(e) =>
                handlePropertyChange("authorizationModel", e.target.value)
              }
              label={labels.authorizationModel}
            >
              {authorizationModelOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.inputValidation}</InputLabel>
            <Select
              value={props.inputValidation || ""}
              onChange={(e) =>
                handlePropertyChange("inputValidation", e.target.value)
              }
              label={labels.inputValidation}
            >
              {inputValidationOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>{labels.errorHandling}</InputLabel>
            <Select
              value={props.errorHandling || ""}
              onChange={(e) =>
                handlePropertyChange("errorHandling", e.target.value)
              }
              label={labels.errorHandling}
            >
              {errorHandlingOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.value === "" ? <em>{option.label}</em> : option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* NEU: Exposed to Internet */}
        <Grid item xs={12} md={6}>
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
            sx={{ mt: 2 }}
          />
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label={t(
          "tabs.dfd.element_description.process.fields.securityControls.label",
        )}
        value={props.securityControls || ""}
        onChange={(e) =>
          handlePropertyChange("securityControls", e.target.value)
        }
        placeholder={t(
          "tabs.dfd.element_description.process.fields.securityControls.placeholder",
        )}
        multiline
        rows={2}
        sx={{ mb: 2 }}
      />

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

      <Divider sx={{ my: 3 }} />

      {/* Advanced / Optional Section */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            {t("tabs.dfd.element_description.process.sections.advanced")}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label={t(
                "tabs.dfd.element_description.process.fields.owner.label",
              )}
              value={props.owner || ""}
              onChange={(e) => handlePropertyChange("owner", e.target.value)}
              placeholder={t(
                "tabs.dfd.element_description.process.fields.owner.placeholder",
              )}
            />

            <RichTextEditor
              value={element.properties.notes || ""}
              onChange={(value) => handlePropertyChange("notes", value)}
              label={t(
                "tabs.dfd.element_description.process.fields.notes.label",
              )}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* STRIDE Hint */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          {t("tabs.dfd.element_description.process.stride_hint.title")}
        </Typography>
        <Typography variant="caption">
          {t("tabs.dfd.element_description.process.stride_hint.description")}
        </Typography>
      </Alert>
    </Box>
  );
};;;;;