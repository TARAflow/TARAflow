// ==================== INTERFACE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Transport & Communication attacks)
// Focus: Physical/Logical interfaces (USB, UART, Ethernet, APIs, etc.)
//
// Structure: Context → Security → Documentation (no accordions)

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type {
  InterfaceProperties,
  ExposureLevel,
} from "../../models/element-properties";
import {
  EXPOSURE_LEVEL_LABELS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";

interface InterfaceFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
  defaultExposureLevel?: ExposureLevel;
}

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];
const EL_ORDER: Record<ExposureLevel, number> = {
  EL0: 0,
  EL1: 1,
  EL2: 2,
  EL3: 3,
  EL4: 4,
};

interface InterfaceGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  defaultExposureLevel?: ExposureLevel;
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

const InterfaceGeneralTab: React.FC<InterfaceGeneralTabProps> = ({
  element,
  onChange,
  defaultExposureLevel,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<InterfaceProperties>(element, onChange);
  const { props } = form;

  const isCurrentlyOverride = !!(
    defaultExposureLevel &&
    props.exposureLevel &&
    EL_ORDER[props.exposureLevel] < EL_ORDER[defaultExposureLevel]
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
        {/* Interface Type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t("tabs.dfd.element_description.interface.fields.type.label")}
            </InputLabel>
            <Select
              value={props.type ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("type", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.type.label",
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.interface.fields.type.options.not_specified",
                  )}
                </em>
              </MenuItem>
              {(
                [
                  "ethernet",
                  "serial",
                  "usb",
                  "gpio",
                  "bluetooth",
                  "wifi",
                  "nfc",
                  "fiber",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.interface.fields.type.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Location */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.interface.fields.location.label",
            )}
            value={props.location ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("location", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.interface.fields.location.placeholder",
              { defaultValue: "e.g. Server Room, Manufacturing Floor, Field" },
            )}
          />
        </Grid>
      </Grid>

      {/* ── Security ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
        {/* Exposure Level */}
        <Grid item xs={12} sm={6}>
          <Stack spacing={1}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
              </InputLabel>
              <Select
                value={props.exposureLevel ?? ""}
                sx={{
                  ...(isCurrentlyOverride && {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#d32f2f !important",
                    },
                  }),
                }}
                onChange={(e) => {
                  const selected = e.target.value as ExposureLevel;
                  const isOverride =
                    defaultExposureLevel &&
                    selected &&
                    EL_ORDER[selected] < EL_ORDER[defaultExposureLevel];
                  onChange({
                    properties: {
                      ...element.properties,
                      exposureLevel: selected || undefined,
                      exposureLevelSource: isOverride ? "manual" : undefined,
                    } as InterfaceProperties,
                  });
                }}
                label={t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
                renderValue={(value) => {
                  if (!value) return "";
                  const isDefault =
                    defaultExposureLevel && value === defaultExposureLevel;
                  const isBelowTB =
                    defaultExposureLevel &&
                    EL_ORDER[value as ExposureLevel] <
                      EL_ORDER[defaultExposureLevel];
                  return (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <span
                        style={{ color: isBelowTB ? "#d32f2f" : "inherit" }}
                      >
                        {EXPOSURE_LEVEL_LABELS[value as ExposureLevel]}
                      </span>
                      {isDefault && (
                        <Chip
                          label="default"
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: "0.65rem",
                            height: 16,
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </Stack>
                  );
                }}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.interface.fields.exposureLevel.not_specified",
                      { defaultValue: "Not specified" },
                    )}
                  </em>
                </MenuItem>
                {EXPOSURE_LEVELS.map((el) => {
                  const isBelowTB =
                    defaultExposureLevel &&
                    EL_ORDER[el] < EL_ORDER[defaultExposureLevel];
                  return (
                    <MenuItem
                      key={el}
                      value={el}
                      sx={{ color: isBelowTB ? "error.main" : "inherit" }}
                    >
                      <Tooltip
                        title={`${t(EXPOSURE_LEVEL_DESCRIPTION_KEYS[el], { defaultValue: "" })}${isBelowTB ? " — " + t("tabs.dfd.element_description.exposure_level.below_tb_hint", { defaultValue: "Below Trust Boundary EL — override requires rationale" }) : ""}`}
                        placement="right"
                        arrow
                      >
                        <span style={{ width: "100%", display: "block" }}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                          >
                            <span>{EXPOSURE_LEVEL_LABELS[el]}</span>
                            {defaultExposureLevel &&
                              el === defaultExposureLevel && (
                                <Chip
                                  label="default"
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: "0.65rem",
                                    height: 16,
                                    pointerEvents: "none",
                                  }}
                                />
                              )}
                          </Stack>
                        </span>
                      </Tooltip>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {isCurrentlyOverride && (
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label={t(
                  "tabs.dfd.element_description.exposure_level.rationale_label",
                  { defaultValue: "Override Rationale" },
                )}
                value={props.exposureLevelRationale ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "exposureLevelRationale",
                    e.target.value,
                  )
                }
                placeholder={t(
                  "tabs.dfd.element_description.exposure_level.rationale_placeholder",
                  {
                    defaultValue:
                      "Why does this differ from the Trust Boundary EL?",
                  },
                )}
              />
            )}
          </Stack>
        </Grid>

        {/* Access Control */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.interface.fields.accessControl.label",
              )}
            </InputLabel>
            <Select
              value={props.accessControl ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("accessControl", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.accessControl.label",
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.interface.fields.accessControl.options.not_specified",
                  )}
                </em>
              </MenuItem>
              {(
                [
                  "none",
                  "physical_lock",
                  "credentials",
                  "card",
                  "certificate",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.interface.fields.accessControl.options.${opt}`,
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Safety Relevant */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={props.safetyRelevant || false}
                onChange={(e) =>
                  form.handlePropertyChange("safetyRelevant", e.target.checked)
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.interface.fields.safetyRelevant.label",
              {
                defaultValue:
                  "Safety-relevant interface (EN 50742 — e.g. programming port on Safety PLC)",
              },
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
                "tabs.dfd.element_description.interface.fields.safetyRationale.label",
                { defaultValue: "Safety Rationale" },
              )}
              value={props.safetyRationale ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("safetyRationale", e.target.value)
              }
              placeholder={t(
                "tabs.dfd.element_description.interface.fields.safetyRationale.placeholder",
                {
                  defaultValue:
                    "e.g. Direct access to safety-critical programming interface",
                },
              )}
              helperText={t(
                "tabs.dfd.element_description.interface.fields.safetyRationale.helper",
                { defaultValue: "Used in EN 50742 / MVO 2027 documentation" },
              )}
            />
          </Grid>
        )}

        {/* Shielded Cable */}
        <Grid
          item
          xs={12}
          sm={6}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={props.isShieldedCable || false}
                onChange={(e) =>
                  form.handlePropertyChange("isShieldedCable", e.target.checked)
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.interface.fields.isShieldedCable.label",
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
        multiline
        rows={2}
        label={t("tabs.dfd.element_description.interface.fields.notes.label")}
        value={form.localNotes}
        onChange={(e) => form.setLocalNotes(e.target.value)}
        onBlur={form.commitNotes}
      />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("tabs.dfd.element_description.interface.fields.description.label")}
        </Typography>
        <RichTextEditor
          label={t(
            "tabs.dfd.element_description.interface.fields.description.label",
          )}
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
        />
      </Box>
    </Stack>
  );
};

export const InterfaceDescriptionForm = React.memo<InterfaceFormProps>(
  ({
    element,
    onChange,
    availableAssets = [],
    onCreateAsset,
    defaultExposureLevel,
  }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={
        <InterfaceGeneralTab
          element={element}
          onChange={onChange}
          defaultExposureLevel={defaultExposureLevel}
        />
      }
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets &&
    prev.defaultExposureLevel === next.defaultExposureLevel,
);

export default InterfaceDescriptionForm;