import {
  INTERFACE_TYPE_META,
  type InterfaceTypeGroup,
} from "../../models/interface-type-registry";
// ==================== INTERFACE DESCRIPTION FORM ====================
// STRIDE: T, I, D (Transport & Communication attacks)
// Focus: Physical/Logical interfaces (USB, UART, Ethernet, APIs, etc.)
//
// Structure: Context → Security → Documentation (no accordions)

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  ListSubheader,
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
  InterfaceLocation,
} from "../../models/element-properties";
import {
  EXPOSURE_LEVEL_LABELS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { SecurityControlOwnershipDisplay } from "./security-control-ownership-display";
import { type AvailableAsset } from "./asset-relation-selector";
import { ElementFormShell } from "./element-form-shell";
import { useElementForm } from "../../hooks/use-element-form";
import {
  INTERFACE_TYPE_DEFAULTS,
  INTERFACE_TYPE_DRIVEN_FIELDS,
  INTERFACE_TYPE_SAFETY_HINTS,
  applyCascadeDefaults,
  buildClearPatch,
} from "../../models/element-property-defaults";

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

  const TYPE_LIST = Object.keys(
    INTERFACE_TYPE_META,
  ) as import("../../models/element-properties").InterfaceType[];
  const TYPE_GROUPS = groupBy(TYPE_LIST, (t) => INTERFACE_TYPE_META[t].group);

  // ── Cascade: type driver ─────────────────────────────────────────────────
  const handleTypeChange = (value: string) => {
    if (!value) {
      // Clear driver + all driven fields
      onChange({
        properties: {
          ...props,
          type: undefined,
          ...buildClearPatch<InterfaceProperties>(INTERFACE_TYPE_DRIVEN_FIELDS),
        } as InterfaceProperties,
      });
      return;
    }
    const typeKey = value as NonNullable<InterfaceProperties["type"]>;
    const defaults = INTERFACE_TYPE_DEFAULTS[typeKey] ?? {};
    const cascaded = applyCascadeDefaults<InterfaceProperties>(props, defaults);
    onChange({
      properties: {
        ...props,
        type: typeKey,
        ...cascaded,
      } as InterfaceProperties,
    });
  };

  // ── Derived states ───────────────────────────────────────────────────────

  const isCurrentlyOverride = !!(
    defaultExposureLevel &&
    props.exposureLevel &&
    EL_ORDER[props.exposureLevel] < EL_ORDER[defaultExposureLevel]
  );

  // Safety hint for embedded attack-surface interfaces (usb, serial, gpio)
  const safetyHintKey =
    props.type != null ? INTERFACE_TYPE_SAFETY_HINTS[props.type] : undefined;

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
              onChange={(e) => handleTypeChange(e.target.value)}
              label={t(
                "tabs.dfd.element_description.interface.fields.type.label",
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {Object.entries(TYPE_GROUPS).map(([group, types]) => [
                <ListSubheader
                  key={`group-${group}`}
                  sx={{ lineHeight: "28px", fontSize: "0.7rem" }}
                >
                  {t(
                    `tabs.dfd.element_description.interface.fields.type.groups.${group}`,
                    { defaultValue: group },
                  )}
                </ListSubheader>,
                types!.map((opt) => (
                  <MenuItem key={opt} value={opt} sx={{ pl: 3 }}>
                    {t(
                      `tabs.dfd.element_description.interface.fields.type.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>
        </Grid>

        {/* Location — structured enum, mirrors DataFlow.location semantics */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.interface.fields.location.label",
                { defaultValue: "Physical Location" },
              )}
            </InputLabel>
            <Select
              value={props.location ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "location",
                  (e.target.value as InterfaceLocation) || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.location.label",
                { defaultValue: "Physical Location" },
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(
                [
                  "on_chip",
                  "on_board",
                  "in_enclosure",
                  "external_panel",
                  "field_accessible",
                  "network_port",
                  "wireless",
                  "internet_facing",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.interface.fields.location.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.interface.fields.location.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Operational State */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.interface.fields.operationalState.label",
                { defaultValue: "Operational State" },
              )}
            </InputLabel>
            <Select
              value={props.operationalState ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "operationalState",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.operationalState.label",
                { defaultValue: "Operational State" },
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(
                [
                  "enabled",
                  "enabled_read_only",
                  "sw_disabled",
                  "hw_disabled",
                  "permanent_disabled",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.interface.fields.operationalState.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.interface.fields.operationalState.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Connector Type — filtered by interface type via INTERFACE_TYPE_META.validConnectors */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.interface.fields.connectorType.label",
                { defaultValue: "Connector Type" },
              )}
            </InputLabel>
            <Select
              value={props.connectorType ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "connectorType",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.interface.fields.connectorType.label",
                { defaultValue: "Connector Type" },
              )}
            >
              <MenuItem value="">
                <em>{t("common.not_specified")}</em>
              </MenuItem>
              {(() => {
                // Derive valid connectors from selected interface type.
                // When no type is selected, show all connectors.
                const selectedType = props.type;
                const validConnectors = selectedType
                  ? (INTERFACE_TYPE_META[selectedType]?.validConnectors ?? [])
                  : null; // null = show all

                // All known connectors in display order
                const ALL_CONNECTORS: NonNullable<
                  InterfaceProperties["connectorType"]
                >[] = [
                  "rj45",
                  "sfp",
                  "m12",
                  "usb_a",
                  "usb_c",
                  "micro_usb",
                  "db9",
                  "db25",
                  "terminal",
                  "swd_10pin",
                  "jtag_20pin",
                  "gpio_header",
                  "pcie",
                  "custom",
                ];

                const visible =
                  validConnectors === null
                    ? ALL_CONNECTORS
                    : validConnectors.length === 0
                      ? [] // wireless — no connector applicable
                      : ALL_CONNECTORS.filter((c) =>
                          validConnectors.includes(c),
                        );

                if (visible.length === 0 && selectedType) {
                  return (
                    <MenuItem disabled>
                      <em>
                        {t(
                          "tabs.dfd.element_description.interface.fields.connectorType.not_applicable",
                          {
                            defaultValue:
                              "Not applicable for this interface type",
                          },
                        )}
                      </em>
                    </MenuItem>
                  );
                }

                return visible.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {t(
                      `tabs.dfd.element_description.interface.fields.connectorType.options.${opt}`,
                      { defaultValue: opt },
                    )}
                  </MenuItem>
                ));
              })()}
            </Select>
          </FormControl>
        </Grid>

        {/* Exposure Level — Context field (physical/logical position → attack surface) */}
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
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
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
      </Grid>

      {/* Safety hint for embedded attack-surface interface types */}
      {safetyHintKey && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          <Typography variant="caption">
            {t(safetyHintKey, {
              defaultValue:
                "This interface type is a common attack surface on embedded systems. Consider setting safetyRelevant if connected to safety-critical components.",
            })}
          </Typography>
        </Alert>
      )}

      {/* ── Security ─────────────────────────────── */}
      <SectionLabel
        label={t("tabs.dfd.element_description.sections.security", {
          defaultValue: "Security",
        })}
      />

      <Grid container rowSpacing={2} columnSpacing={2}>
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
                <em>{t("common.not_specified")}</em>
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

      <SecurityControlOwnershipDisplay
        records={(props as any).securityControlOwnership ?? []}
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

function groupBy<T, K extends string | number | symbol>(
  arr: T[],
  key: (item: T) => K,
): Partial<Record<K, T[]>> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      (acc[k] = acc[k] ?? []).push(item);
      return acc;
    },
    {} as Partial<Record<K, T[]>>,
  );
}

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
