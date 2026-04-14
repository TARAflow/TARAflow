// ==================== EXTERNAL ENTITY DESCRIPTION FORM ====================
// STRIDE: S, R (Spoofing, Repudiation)
// Focus: Untrusted Actors — who they are, how dangerous they are
//
// Structure: Context → Security → Documentation (no accordions)

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
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
import type { ExternalEntityProperties } from "../../models/element-properties";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import { EXTERNAL_ENTITY_TYPE_DEFAULTS } from "../../models/element-property-defaults";

interface ExternalEntityFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

interface ExternalEntityGeneralTabProps {
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

function asExternalEntityProperties(props: any): ExternalEntityProperties {
  return props as ExternalEntityProperties;
}

const ExternalEntityGeneralTab: React.FC<ExternalEntityGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const props = asExternalEntityProperties(element.properties);
  const form = useElementForm<ExternalEntityProperties>(element, onChange);

  const [localAuthScope, setLocalAuthScope] = React.useState(
    props.authorizationScope || "",
  );
  const [localOwner, setLocalOwner] = React.useState(props.owner || "");

  React.useEffect(() => {
    setLocalAuthScope(props.authorizationScope || "");
  }, [props.authorizationScope]);
  React.useEffect(() => {
    setLocalOwner(props.owner || "");
  }, [props.owner]);

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
      let updatedProperties = { ...element.properties, [field]: value };

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
        updatedProperties = { ...updatedProperties, ...defaults };
      }

      onChange({ properties: updatedProperties });
    },
    [onChange, element.properties],
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        {/* ── Context ─────────────────────────────── */}
        <SectionLabel
          label={t("tabs.dfd.element_description.sections.context", {
            defaultValue: "Context",
          })}
        />

        <Grid container spacing={2}>
          {/* Entity Type */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.external_entity.fields.entityType.label",
                )}
              </InputLabel>
              <Select
                value={props.entityType || ""}
                onChange={(e) =>
                  handlePropertyChange("entityType", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.external_entity.fields.entityType.label",
                )}
              >
                <MenuItem value="">
                  <em>{t("common.not_specified")}</em>
                </MenuItem>
                {Object.keys(EXTERNAL_ENTITY_TYPE_DEFAULTS).map((type) => (
                  <MenuItem key={type} value={type}>
                    {t(
                      `tabs.dfd.element_description.external_entity.fields.entityType.options.${type}`,
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Trust Level */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
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
                  <em>{t("common.not_specified")}</em>
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

          {/* Ownership */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
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
                  <em>{t("common.not_specified")}</em>
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
        </Grid>

        {/* ── Security ─────────────────────────────── */}
        <SectionLabel
          label={t("tabs.dfd.element_description.sections.security", {
            defaultValue: "Security",
          })}
        />

        <Grid container spacing={2}>
          {/* Threat Actor */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
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
                <MenuItem value="">
                  <em>{t("common.not_specified")}</em>
                </MenuItem>
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

          {/* Authentication Method */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
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
                  <em>{t("common.not_specified")}</em>
                </MenuItem>
                {(
                  [
                    "none",
                    "password",
                    "mfa",
                    "oauth",
                    "saml",
                    "certificate",
                    "apikey",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.external_entity.fields.authenticationMethod.options.${opt}`,
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Rate Limited */}
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
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
          </Grid>

          {/* Contract Exists */}
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "center" }}
          >
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
          </Grid>

          {/* Authorization Scope */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.external_entity.fields.authorizationScope.label",
              )}
              value={localAuthScope}
              onChange={(e) => setLocalAuthScope(e.target.value)}
              onBlur={() => {
                if (localAuthScope !== props.authorizationScope)
                  handlePropertyChange("authorizationScope", localAuthScope);
              }}
              placeholder={t(
                "tabs.dfd.element_description.external_entity.fields.authorizationScope.placeholder",
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
          label={t(
            "tabs.dfd.element_description.external_entity.fields.owner.label",
          )}
          value={localOwner}
          onChange={(e) => setLocalOwner(e.target.value)}
          onBlur={() => {
            if (localOwner !== props.owner)
              handlePropertyChange("owner", localOwner);
          }}
          placeholder={t(
            "tabs.dfd.element_description.external_entity.fields.owner.placeholder",
          )}
        />

        <RichTextEditor
          value={form.localNotes}
          onChange={form.setLocalNotes}
          onBlur={form.commitNotes}
          label={t(
            "tabs.dfd.element_description.external_entity.fields.notes.label",
          )}
        />

        <RichTextEditor
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
          label={t(
            "tabs.dfd.element_description.external_entity.fields.description.label",
          )}
          required
          helperText={t(
            "tabs.dfd.element_description.external_entity.fields.description.helperText",
          )}
        />

        {/* STRIDE Hint */}
        <Alert severity="info">
          <Typography variant="body2" fontWeight="bold">
            {t(
              "tabs.dfd.element_description.external_entity.stride_hint.title",
            )}
          </Typography>
          <Typography variant="caption">
            {t(
              "tabs.dfd.element_description.external_entity.stride_hint.description",
            )}
          </Typography>
        </Alert>
      </Stack>
    </Box>
  );
};

export const ExternalEntityDescriptionForm =
  React.memo<ExternalEntityFormProps>(
    ({ element, onChange, availableAssets = [], onCreateAsset }) => (
      <ElementFormShell
        element={element}
        onChange={onChange}
        availableAssets={availableAssets}
        onCreateAsset={onCreateAsset}
        generalTab={
          <ExternalEntityGeneralTab element={element} onChange={onChange} />
        }
      />
    ),
    (prev, next) =>
      prev.element === next.element &&
      prev.availableAssets === next.availableAssets,
  );

export default ExternalEntityDescriptionForm;