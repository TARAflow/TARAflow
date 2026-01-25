// ==================== PROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, R, I, D, E (alle!)
// Focus: Logik, Ausführung, Angriffsfläche

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

interface ProcessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
}

function asProcessProperties(props: any): ProcessProperties {
  return props as ProcessProperties;
}

export const ProcessDescriptionForm: React.FC<ProcessFormProps> = ({
  element,
  onChange,
  availableAssets = [],
}) => {
  const { t } = useTranslation();
  const props = asProcessProperties(element.properties);

  const handlePropertyChange = useCallback(
    (field: string, value: any) => {
      onChange({
        properties: {
          ...element.properties,
          [field]: value,
        },
      });
    },
    [onChange, element.properties],
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
            <InputLabel>
              {t("tabs.dfd.element_description.process.fields.runsAs.label")}
            </InputLabel>
            <Select
              value={props.runsAs || ""}
              onChange={(e) => handlePropertyChange("runsAs", e.target.value)}
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
              <MenuItem value="user">
                {t(
                  "tabs.dfd.element_description.process.fields.runsAs.options.user",
                )}
              </MenuItem>
              <MenuItem value="service">
                {t(
                  "tabs.dfd.element_description.process.fields.runsAs.options.service",
                )}
              </MenuItem>
              <MenuItem value="system">
                {t(
                  "tabs.dfd.element_description.process.fields.runsAs.options.system",
                )}
              </MenuItem>
              <MenuItem value="container">
                {t(
                  "tabs.dfd.element_description.process.fields.runsAs.options.container",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.privilegeLevel.label",
              )}
            </InputLabel>
            <Select
              value={props.privilegeLevel || ""}
              onChange={(e) =>
                handlePropertyChange("privilegeLevel", e.target.value)
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
              <MenuItem value="low">
                {t(
                  "tabs.dfd.element_description.process.fields.privilegeLevel.options.low",
                )}
              </MenuItem>
              <MenuItem value="medium">
                {t(
                  "tabs.dfd.element_description.process.fields.privilegeLevel.options.medium",
                )}
              </MenuItem>
              <MenuItem value="high">
                {t(
                  "tabs.dfd.element_description.process.fields.privilegeLevel.options.high",
                )}
              </MenuItem>
              <MenuItem value="root">
                {t(
                  "tabs.dfd.element_description.process.fields.privilegeLevel.options.root",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.authenticationRequired.label",
              )}
            </InputLabel>
            <Select
              value={props.authenticationRequired || ""}
              onChange={(e) =>
                handlePropertyChange("authenticationRequired", e.target.value)
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
              <MenuItem value="no">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.no",
                )}
              </MenuItem>
              <MenuItem value="yes">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.yes",
                )}
              </MenuItem>
              <MenuItem value="optional">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.optional",
                )}
              </MenuItem>
              <MenuItem value="oauth">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.oauth",
                )}
              </MenuItem>
              <MenuItem value="saml">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.saml",
                )}
              </MenuItem>
              <MenuItem value="certificate">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.certificate",
                )}
              </MenuItem>
              <MenuItem value="apikey">
                {t(
                  "tabs.dfd.element_description.process.fields.authenticationRequired.options.apikey",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.authorizationModel.label",
              )}
            </InputLabel>
            <Select
              value={props.authorizationModel || ""}
              onChange={(e) =>
                handlePropertyChange("authorizationModel", e.target.value)
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
              <MenuItem value="none">
                {t(
                  "tabs.dfd.element_description.process.fields.authorizationModel.options.none",
                )}
              </MenuItem>
              <MenuItem value="rbac">
                {t(
                  "tabs.dfd.element_description.process.fields.authorizationModel.options.rbac",
                )}
              </MenuItem>
              <MenuItem value="abac">
                {t(
                  "tabs.dfd.element_description.process.fields.authorizationModel.options.abac",
                )}
              </MenuItem>
              <MenuItem value="acl">
                {t(
                  "tabs.dfd.element_description.process.fields.authorizationModel.options.acl",
                )}
              </MenuItem>
              <MenuItem value="custom">
                {t(
                  "tabs.dfd.element_description.process.fields.authorizationModel.options.custom",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.inputValidation.label",
              )}
            </InputLabel>
            <Select
              value={props.inputValidation || ""}
              onChange={(e) =>
                handlePropertyChange("inputValidation", e.target.value)
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
              <MenuItem value="none">
                {t(
                  "tabs.dfd.element_description.process.fields.inputValidation.options.none",
                )}
              </MenuItem>
              <MenuItem value="basic">
                {t(
                  "tabs.dfd.element_description.process.fields.inputValidation.options.basic",
                )}
              </MenuItem>
              <MenuItem value="strict">
                {t(
                  "tabs.dfd.element_description.process.fields.inputValidation.options.strict",
                )}
              </MenuItem>
              <MenuItem value="schema">
                {t(
                  "tabs.dfd.element_description.process.fields.inputValidation.options.schema",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.process.fields.errorHandling.label",
              )}
            </InputLabel>
            <Select
              value={props.errorHandling || ""}
              onChange={(e) =>
                handlePropertyChange("errorHandling", e.target.value)
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
              <MenuItem value="silent">
                {t(
                  "tabs.dfd.element_description.process.fields.errorHandling.options.silent",
                )}
              </MenuItem>
              <MenuItem value="verbose">
                {t(
                  "tabs.dfd.element_description.process.fields.errorHandling.options.verbose",
                )}
              </MenuItem>
              <MenuItem value="sanitized">
                {t(
                  "tabs.dfd.element_description.process.fields.errorHandling.options.sanitized",
                )}
              </MenuItem>
            </Select>
          </FormControl>
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

            <FormControl fullWidth>
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.process.fields.technology.label",
                )}
              </InputLabel>
              <Select
                value={props.technology || ""}
                onChange={(e) =>
                  handlePropertyChange("technology", e.target.value)
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
                <MenuItem value="api">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.api",
                  )}
                </MenuItem>
                <MenuItem value="batch">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.batch",
                  )}
                </MenuItem>
                <MenuItem value="ui">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.ui",
                  )}
                </MenuItem>
                <MenuItem value="microservice">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.microservice",
                  )}
                </MenuItem>
                <MenuItem value="lambda">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.lambda",
                  )}
                </MenuItem>
                <MenuItem value="daemon">
                  {t(
                    "tabs.dfd.element_description.process.fields.technology.options.daemon",
                  )}
                </MenuItem>
              </Select>
            </FormControl>

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
};