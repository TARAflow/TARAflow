// ==================== EXTERNAL ENTITY DESCRIPTION FORM ====================
// STRIDE: S, R (Spoofing, Repudiation)
// Focus: Untrusted Actors

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
import type { ExternalEntityProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import {
  AssetRelationSelector,
  type AvailableAsset,
} from "./asset-relation-selector";

import { EXTERNAL_ENTITY_TYPE_DEFAULTS } from "../../models/element-property-defaults";

interface ExternalEntityFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
}

function asExternalEntityProperties(props: any): ExternalEntityProperties {
  return props as ExternalEntityProperties;
}

export const ExternalEntityDescriptionForm: React.FC<ExternalEntityFormProps> = ({
  element,
  onChange,
  availableAssets = [],
}) => {
  const { t } = useTranslation();
  const props = asExternalEntityProperties(element.properties);

  // Local state for multiline fields
  const [localDescription, setLocalDescription] = React.useState(
    element.description || "",
  );
  const [localAuthScope, setLocalAuthScope] = React.useState(
    props.authorizationScope || "",
  );
  const [localOwner, setLocalOwner] = React.useState(props.owner || "");
  const [localNotes, setLocalNotes] = React.useState(
    element.properties.notes || "",
  );

  // Sync when element changes
  React.useEffect(() => {
    setLocalDescription(element.description || "");
  }, [element.description]);

  React.useEffect(() => {
    setLocalAuthScope(props.authorizationScope || "");
  }, [props.authorizationScope]);

  React.useEffect(() => {
    setLocalOwner(props.owner || "");
  }, [props.owner]);

  React.useEffect(() => {
    setLocalNotes(element.properties.notes || "");
  }, [element.properties.notes]);

  const threatActorOptions: ExternalEntityProperties["threatActor"][] = [
    "benign",
    "curious",
    "malicious",
    "advanced",
    "insider",
    "compromised",
  ];

  const handlePropertyChange = useCallback(
    (field: string, value: any) => {
      let updatedProperties = {
        ...element.properties,
        [field]: value,
      };

      if (field === "entityType" && !value) {
        updatedProperties = {
          entityType: undefined,
          trustLevel: undefined,
          authenticationMethod: undefined,
          threatActor: undefined,
          ownership: undefined,
        };
      } else if (field === "entityType" && typeof value === "string") {
        const defaults = EXTERNAL_ENTITY_TYPE_DEFAULTS[value] ?? {};
        // Überschreibt nur die Werte aus defaults, behält alles andere
        updatedProperties = {
          ...updatedProperties,
          ...defaults,
        };
      }

      onChange({
        properties: updatedProperties,
      });
    },
    [onChange, element.properties],
  );

  return (
    <Box sx={{ p: 2 }}>
      {/* Required Section */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.external_entity.sections.required")}
      </Typography>

      <RichTextEditor
        value={localDescription}
        onChange={setLocalDescription}
        onBlur={() => {
          if (localDescription !== element.description) {
            handlePropertyChange("description", localDescription);
          }
        }}
        label={t(
          "tabs.dfd.element_description.external_entity.fields.description.label",
        )}
        required
        helperText={t(
          "tabs.dfd.element_description.external_entity.fields.description.helperText",
        )}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>
          {t(
            "tabs.dfd.element_description.external_entity.fields.entityType.label",
          )}
        </InputLabel>
        <Select
          value={props.entityType || ""}
          onChange={(e) => handlePropertyChange("entityType", e.target.value)}
          label={t(
            "tabs.dfd.element_description.external_entity.fields.entityType.label",
          )}
        >
          {/* "Not specified" Option */}
          <MenuItem value="">
            <em>
              {t(
                "tabs.dfd.element_description.external_entity.fields.entityType.options.not_specified",
              )}
            </em>
          </MenuItem>

          {/* All available Entity Types dynamic */}
          {Object.keys(EXTERNAL_ENTITY_TYPE_DEFAULTS).map((type) => (
            <MenuItem key={type} value={type}>
              {t(
                `tabs.dfd.element_description.external_entity.fields.entityType.options.${type}`,
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      {/* Security Section - 2-column Grid with Authorization Scope below */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t("tabs.dfd.element_description.external_entity.sections.security")}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.external_entity.fields.trustLevel.label",
              )}
            </InputLabel>
            <Select
              value={props.trustLevel || ""}
              onChange={(e) =>
                handlePropertyChange("trustLevel", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.trustLevel.label",
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.external_entity.fields.trustLevel.options.not_specified",
                  )}
                </em>
              </MenuItem>
              <MenuItem value="low">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.trustLevel.options.low",
                )}
              </MenuItem>
              <MenuItem value="medium">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.trustLevel.options.medium",
                )}
              </MenuItem>
              <MenuItem value="high">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.trustLevel.options.high",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.external_entity.fields.authenticationMethod.label",
              )}
            </InputLabel>
            <Select
              value={props.authenticationMethod || ""}
              onChange={(e) =>
                handlePropertyChange("authenticationMethod", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.authenticationMethod.label",
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.not_specified",
                  )}
                </em>
              </MenuItem>
              <MenuItem value="none">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.none",
                )}
              </MenuItem>
              <MenuItem value="password">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.password",
                )}
              </MenuItem>
              <MenuItem value="mfa">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.mfa",
                )}
              </MenuItem>
              <MenuItem value="oauth">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.oauth",
                )}
              </MenuItem>
              <MenuItem value="saml">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.saml",
                )}
              </MenuItem>
              <MenuItem value="certificate">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.certificate",
                )}
              </MenuItem>
              <MenuItem value="apikey">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.apikey",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.external_entity.fields.ownership.label",
              )}
            </InputLabel>
            <Select
              value={props.ownership || ""}
              onChange={(e) =>
                handlePropertyChange("ownership", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.ownership.label",
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.external_entity.fields.ownership.options.not_specified",
                  )}
                </em>
              </MenuItem>
              <MenuItem value="internal">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.ownership.options.internal",
                )}
              </MenuItem>
              <MenuItem value="external">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.ownership.options.external",
                )}
              </MenuItem>
              <MenuItem value="partner">
                {t(
                  "tabs.dfd.element_description.external_entity.fields.ownership.options.partner",
                )}
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>
              {t(
                "tabs.dfd.element_description.external_entity.fields.threatActor.label",
              )}
            </InputLabel>
            <Select
              value={props.threatActor || ""}
              onChange={(e) =>
                handlePropertyChange("threatActor", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.threatActor.label",
              )}
            >
              {/* "Not specified" */}
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.external_entity.fields.threatActor.options.not_specified",
                  )}
                </em>
              </MenuItem>

              {/* Alle threatActor Optionen dynamisch */}
              {threatActorOptions.map((actor) => (
                <MenuItem key={actor} value={actor}>
                  {t(
                    `tabs.dfd.element_description.external_entity.fields.threatActor.options.${actor}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TextField
        fullWidth
        label={t(
          "tabs.dfd.element_description.external_entity.fields.authorizationScope.label",
        )}
        value={localAuthScope}
        onChange={(e) => setLocalAuthScope(e.target.value)}
        onBlur={() => {
          if (localAuthScope !== props.authorizationScope) {
            handlePropertyChange("authorizationScope", localAuthScope);
          }
        }}
        placeholder={t(
          "tabs.dfd.element_description.external_entity.fields.authorizationScope.placeholder",
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
            {t(
              "tabs.dfd.element_description.external_entity.sections.advanced",
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.contractExists || false}
                  onChange={(e) =>
                    handlePropertyChange("contractExists", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.contractExists.label",
              )}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={props.rateLimited || false}
                  onChange={(e) =>
                    handlePropertyChange("rateLimited", e.target.checked)
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.external_entity.fields.rateLimited.label",
              )}
            />

            <TextField
              fullWidth
              label={t(
                "tabs.dfd.element_description.external_entity.fields.owner.label",
              )}
              value={localOwner}
              onChange={(e) => setLocalOwner(e.target.value)}
              onBlur={() => {
                if (localOwner !== props.owner) {
                  handlePropertyChange("owner", localOwner);
                }
              }}
              placeholder={t(
                "tabs.dfd.element_description.external_entity.fields.owner.placeholder",
              )}
            />

            <RichTextEditor
              value={localNotes}
              onChange={setLocalNotes}
              onBlur={() => {
                if (localNotes !== element.properties.notes) {
                  handlePropertyChange("notes", localNotes);
                }
              }}
              label={t(
                "tabs.dfd.element_description.external_entity.fields.notes.label",
              )}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* STRIDE Hint */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2" fontWeight="bold">
          {t("tabs.dfd.element_description.external_entity.stride_hint.title")}
        </Typography>
        <Typography variant="caption">
          {t(
            "tabs.dfd.element_description.external_entity.stride_hint.description",
          )}
        </Typography>
      </Alert>
    </Box>
  );
};;