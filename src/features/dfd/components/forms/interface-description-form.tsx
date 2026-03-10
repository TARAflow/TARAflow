// ==================== INTERFACE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Transport & Communication attacks)
// Focus: Physical/Logical interfaces (USB, UART, Ethernet, APIs, etc.)
//
// Shell (tabs, asset relations, safety summary) → ElementFormShell
// State logic → useElementForm
// This file: InterfaceGeneralTab content + React.memo wrapper

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
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
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
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

// ==================== PROPS ====================

interface InterfaceFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== CONSTANTS ====================

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];

// ==================== GENERAL TAB ====================

interface InterfaceGeneralTabProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

const InterfaceGeneralTab: React.FC<InterfaceGeneralTabProps> = ({
  element,
  onChange,
}) => {
  const { t } = useTranslation();
  const form = useElementForm<InterfaceProperties>(element, onChange);
  const { props } = form;

  return (
    <Stack spacing={3}>
      <Box sx={{ overflow: "hidden", pt: 1 }}>
        <Grid container rowSpacing={3} columnSpacing={2}>
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

          {/* Exposure Level (EN 50742 Annex B) */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
              </InputLabel>
              <Select
                value={props.exposureLevel ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("exposureLevel", e.target.value)
                }
                label={t("tabs.dfd.element_description.exposure_level.label", {
                  defaultValue: "Exposure Level",
                })}
                renderValue={(value) =>
                  value ? EXPOSURE_LEVEL_LABELS[value as ExposureLevel] : ""
                }
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.interface.fields.exposureLevel.not_specified",
                      { defaultValue: "Not specified" },
                    )}
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
                        {EXPOSURE_LEVEL_LABELS[el]}
                      </span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

          {/* Connection Speed */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.interface.fields.connectionSpeed.label",
                )}
              </InputLabel>
              <Select
                value={props.connectionSpeed ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange("connectionSpeed", e.target.value)
                }
                label={t(
                  "tabs.dfd.element_description.interface.fields.connectionSpeed.label",
                )}
              >
                <MenuItem value="">
                  <em>
                    {t(
                      "tabs.dfd.element_description.interface.fields.connectionSpeed.options.not_specified",
                    )}
                  </em>
                </MenuItem>
                {(["low", "medium", "high"] as const).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.interface.fields.connectionSpeed.options.${opt}`,
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Physical Location */}
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
                {
                  defaultValue: "e.g. Server Room, Manufacturing Floor, Field",
                },
              )}
            />
          </Grid>

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
                    form.handlePropertyChange(
                      "isShieldedCable",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.isShieldedCable.label",
              )}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Advanced */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" color="text.secondary">
            {t("tabs.dfd.element_description.sections.advanced", {
              defaultValue: "Advanced / Optional",
            })}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.interface.fields.notes.label",
              )}
              value={form.localNotes}
              onChange={(e) => form.setLocalNotes(e.target.value)}
              onBlur={form.commitNotes}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Description */}
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

// ==================== MAIN COMPONENT ====================

export const InterfaceDescriptionForm = React.memo<InterfaceFormProps>(
  ({ element, onChange, availableAssets = [], onCreateAsset }) => (
    <ElementFormShell
      element={element}
      onChange={onChange}
      availableAssets={availableAssets}
      onCreateAsset={onCreateAsset}
      generalTab={<InterfaceGeneralTab element={element} onChange={onChange} />}
    />
  ),
  (prev, next) =>
    prev.element === next.element &&
    prev.availableAssets === next.availableAssets,
);

export default InterfaceDescriptionForm;
