// ==================== PROCESS DESCRIPTION FORM ====================
// STRIDE: S, T, R, I, D, E (all)
//
// Shell (tabs, asset relations, safety summary) → ElementFormShell
// State logic (local state, handlePropertyChange) → useElementForm
// This file: ProcessGeneralTab content + React.memo wrapper

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type { ProcessProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  updateProcessProperties,
  getProcessDefaults,
} from "../../hooks/use-dfd-ui-state";

// ==================== PROPS ====================

interface ProcessFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== GENERAL TAB ====================

interface ProcessGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

const ProcessGeneralTab: React.FC<ProcessGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<ProcessProperties>(element, onChange);
  const { props } = form;

  // Process-specific: runsAs and technology trigger defaults cascade
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
          if (!currentProps.technology) newProps.authenticationRequired = undefined;
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
    <Stack spacing={3}>
      <Box sx={{ overflow: "hidden", pt: 1 }}>
        <Grid container rowSpacing={3} columnSpacing={2}>

          {/* runsAs */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.runsAs.label")}
              </InputLabel>
              <Select
                value={props.runsAs ?? ""}
                onChange={(e) => handlePropertyChange("runsAs", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.runsAs.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.runsAs.options.not_specified")}</em></MenuItem>
                {(["user", "admin_user", "root", "system", "service", "guest", "anonymous", "contractor"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.runsAs.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* technology */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.technology.label")}
              </InputLabel>
              <Select
                value={props.technology ?? ""}
                onChange={(e) => handlePropertyChange("technology", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.technology.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.technology.options.not_specified")}</em></MenuItem>
                {(["api", "batch", "ui", "microservice", "lambda", "daemon", "websocket", "event", "cli", "database", "cron", "iot"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.technology.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* privilegeLevel */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.privilegeLevel.label")}
              </InputLabel>
              <Select
                value={props.privilegeLevel ?? ""}
                onChange={(e) => handlePropertyChange("privilegeLevel", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.privilegeLevel.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.privilegeLevel.options.not_specified")}</em></MenuItem>
                {(["low", "medium", "high", "root"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.privilegeLevel.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* authenticationRequired */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.authenticationRequired.label")}
              </InputLabel>
              <Select
                value={props.authenticationRequired ?? ""}
                onChange={(e) => handlePropertyChange("authenticationRequired", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.authenticationRequired.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.authenticationRequired.options.not_specified")}</em></MenuItem>
                {(["no", "yes", "optional", "oauth", "saml", "certificate", "apikey", "jwt", "mtls"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.authenticationRequired.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* authorizationModel */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.authorizationModel.label")}
              </InputLabel>
              <Select
                value={props.authorizationModel ?? ""}
                onChange={(e) => handlePropertyChange("authorizationModel", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.authorizationModel.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.authorizationModel.options.not_specified")}</em></MenuItem>
                {(["none", "rbac", "abac", "acl", "custom"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.authorizationModel.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* inputValidation */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.inputValidation.label")}
              </InputLabel>
              <Select
                value={props.inputValidation ?? ""}
                onChange={(e) => handlePropertyChange("inputValidation", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.inputValidation.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.inputValidation.options.not_specified")}</em></MenuItem>
                {(["none", "basic", "strict", "schema"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.inputValidation.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* errorHandling */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.process.fields.errorHandling.label")}
              </InputLabel>
              <Select
                value={props.errorHandling ?? ""}
                onChange={(e) => handlePropertyChange("errorHandling", e.target.value === "" ? undefined : e.target.value)}
                label={t("tabs.dfd.element_description.process.fields.errorHandling.label")}
              >
                <MenuItem value=""><em>{t("tabs.dfd.element_description.process.fields.errorHandling.options.not_specified")}</em></MenuItem>
                {(["silent", "verbose", "sanitized"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(`tabs.dfd.element_description.process.fields.errorHandling.options.${opt}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* exposedToInternet */}
          <Grid item xs={12} sm={6} sx={{ display: "flex", alignItems: "center" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.exposedToInternet || false}
                  onChange={(e) => handlePropertyChange("exposedToInternet", e.target.checked)}
                />
              }
              label={t("tabs.dfd.element_description.process.fields.exposedToInternet.label")}
            />
          </Grid>

        </Grid>
      </Box>

      {/* Advanced */}
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
              size="small"
              multiline
              rows={2}
              label={t("tabs.dfd.element_description.process.fields.securityControls.label")}
              value={(props.securityControls as string) ?? ""}
              onChange={(e) => handlePropertyChange("securityControls", e.target.value)}
              placeholder={t("tabs.dfd.element_description.process.fields.securityControls.placeholder")}
            />
            <TextField
              fullWidth
              size="small"
              label={t("tabs.dfd.element_description.process.fields.owner.label")}
              value={(props.owner as string) ?? ""}
              onChange={(e) => handlePropertyChange("owner", e.target.value)}
              placeholder={t("tabs.dfd.element_description.process.fields.owner.placeholder")}
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
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider />

      {/* Description */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("tabs.dfd.element_description.process.fields.description.label")}
        </Typography>
        <RichTextEditor
          label={t("tabs.dfd.element_description.process.fields.description.label")}
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
        />
      </Box>
    </Stack>
  );
};

// ==================== MAIN COMPONENT ====================

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
