// ==================== CHIP BOUNDARY DESCRIPTION FORM ====================
// Hardware chip boundary — MCU, SOM, FPGA, SE, HSM, DSP
//
// STRIDE relevance:
//   S — Debug interface impersonation
//   T — Firmware / bitstream / key material tampering
//   I — Readback / side-channel disclosure
//   D — Debug halt, firmware brick
//   E — Elevation via unrestricted JTAG
//
// Structure: Context → Hardware Security → Documentation (no accordions)

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { BufferedTextField } from "../shared/buffered-text-field";
import type { AssetGroup } from "shared";
import type { DFDElement } from "../../models/dfd-types";
import type { ChipBoundaryProperties } from "../../models/element-properties";
import type { ExposureLevel } from "../../models/element-shared-types";
import {
  EXPOSURE_LEVEL_LABEL_KEYS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { useElementForm } from "../../hooks/use-element-form";
import {
  CHIP_TYPE_DEFAULTS,
  CHIP_TYPE_DRIVEN_FIELDS,
  CHIP_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS,
  applyCascadeDefaults,
  buildClearPatch,
} from "../../models/element-property-defaults";

// ==================== PROPS ====================

interface ChipBoundaryFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
  availableAssets?: AvailableAsset[];
  onCreateAsset?: (name: string, assetGroup: AssetGroup) => AvailableAsset;
}

// ==================== HELPERS ====================

const EXPOSURE_LEVELS: ExposureLevel[] = ["EL0", "EL1", "EL2", "EL3", "EL4"];

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

// ==================== COMPONENT ====================

export const ChipBoundaryDescriptionForm = React.memo<ChipBoundaryFormProps>(
  ({ element, onChange }) => {
    const { t } = useTranslation();
    const form = useElementForm<ChipBoundaryProperties>(element, onChange);
    const { props } = form;

    // ── Cascade: chipType driver ──────────────────────────────────────────────
    const handleChipTypeChange = (value: string) => {
      if (!value) {
        onChange({
          properties: {
            ...props,
            chipType: undefined,
            ...buildClearPatch<ChipBoundaryProperties>(CHIP_TYPE_DRIVEN_FIELDS),
          } as ChipBoundaryProperties,
        });
        return;
      }
      const typeKey = value as NonNullable<ChipBoundaryProperties["chipType"]>;
      const defaults = CHIP_TYPE_DEFAULTS[typeKey] ?? {};
      const cascaded = applyCascadeDefaults<ChipBoundaryProperties>(
        props,
        defaults,
      );
      onChange({
        properties: {
          ...props,
          chipType: typeKey,
          ...cascaded,
        } as ChipBoundaryProperties,
      });
    };

    // Conditionally show bitstreamEncryption only for FPGA
    const isFpga = props.chipType === "fpga";
    // Conditionally show firmwareProtection only for non-FPGA, non-SE, non-HSM
    const showFirmwareProtection =
      props.chipType != null &&
      !["se", "hsm", "fpga"].includes(props.chipType);

    // Dynamic placeholder for notes — hint only, never overwrites analyst text
    const notesPlaceholder =
      props.chipType != null
        ? (CHIP_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS[props.chipType] ?? "")
        : "Select a chip type for context-specific guidance.";

    return (
      <Box p={1}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Warning */}
          <Alert severity="warning">
            <Typography variant="body2" fontWeight="bold">
              {t("tabs.dfd.element_description.chipboundary.warning.title", {
                defaultValue: "Hardware boundary — physical attack surface!",
              })}
            </Typography>
            <Typography variant="caption">
              {t("tabs.dfd.element_description.chipboundary.warning.hint", {
                defaultValue:
                  "Debug interfaces, firmware protection, and supply chain trust must be explicitly verified before production release.",
              })}
            </Typography>
          </Alert>

          {/* ── Context ───────────────────────────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.context", {
              defaultValue: "Context",
            })}
          />

          {/* Chip Type */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.chipboundary.fields.chipType.label",
                { defaultValue: "Chip Type" },
              )}
            </InputLabel>
            <Select
              value={props.chipType ?? ""}
              onChange={(e) => handleChipTypeChange(e.target.value)}
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.chipType.label",
                { defaultValue: "Chip Type" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(["mcu", "som", "fpga", "dsp"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.chipboundary.fields.chipType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.chipboundary.fields.chipType.options.${opt}`,
                        { defaultValue: opt.toUpperCase() },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Security Chips —
              </MenuItem>
              {(["se", "hsm"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.chipboundary.fields.chipType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.chipboundary.fields.chipType.options.${opt}`,
                        { defaultValue: opt.toUpperCase() },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Exposure Level */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t("tabs.dfd.element_description.exposure_level.label", {
                defaultValue: "Exposure Level",
              })}
            </InputLabel>
            <Select
              value={props.defaultExposureLevel ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "defaultExposureLevel",
                  e.target.value,
                )
              }
              label={t("tabs.dfd.element_description.exposure_level.label", {
                defaultValue: "Exposure Level",
              })}
              renderValue={(value) =>
                value
                  ? t(EXPOSURE_LEVEL_LABEL_KEYS[value as ExposureLevel])
                  : ""
              }
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
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
                      {t(EXPOSURE_LEVEL_LABEL_KEYS[el])}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── Hardware Security ─────────────────────────────────────────── */}
          <SectionLabel
            label={t(
              "tabs.dfd.element_description.sections.hardware_security",
              { defaultValue: "Hardware Security" },
            )}
          />

          {/* Debug Interface */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.chipboundary.fields.debugInterfacePresent.label",
                { defaultValue: "Debug Interface" },
              )}
            </InputLabel>
            <Select
              value={props.debugInterfacePresent ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "debugInterfacePresent",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.debugInterfacePresent.label",
                { defaultValue: "Debug Interface" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(
                [
                  "none",
                  "jtag",
                  "swd",
                  "swd_swo",
                  "jtag_trace",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.chipboundary.fields.debugInterfacePresent.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.chipboundary.fields.debugInterfacePresent.options.${opt}`,
                        { defaultValue: opt.toUpperCase().replace("_", " ") },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Debug Interface Locked */}
          {props.debugInterfacePresent != null &&
            props.debugInterfacePresent !== "none" && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={props.debugInterfaceLocked ?? false}
                    onChange={(e) =>
                      form.handlePropertyChange(
                        "debugInterfaceLocked",
                        e.target.checked,
                      )
                    }
                  />
                }
                label={t(
                  "tabs.dfd.element_description.chipboundary.fields.debugInterfaceLocked.label",
                  {
                    defaultValue:
                      "Debug interface locked / disabled in production (Fuse / OTP)",
                  },
                )}
              />
            )}

          {/* Secure Boot */}
          <FormControlLabel
            control={
              <Checkbox
                checked={props.secureBootEnabled ?? false}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "secureBootEnabled",
                    e.target.checked,
                  )
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.chipboundary.fields.secureBootEnabled.label",
              { defaultValue: "Secure Boot enabled" },
            )}
          />

          {/* Firmware Protection — MCU / SOM / DSP only */}
          {showFirmwareProtection && (
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.chipboundary.fields.firmwareProtection.label",
                  { defaultValue: "Firmware Protection" },
                )}
              </InputLabel>
              <Select
                value={props.firmwareProtection ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "firmwareProtection",
                    e.target.value || undefined,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.chipboundary.fields.firmwareProtection.label",
                  { defaultValue: "Firmware Protection" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                {(
                  [
                    "none",
                    "rdp_level1",
                    "rdp_level2",
                    "locked",
                    "encrypted",
                  ] as const
                ).map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    <Tooltip
                      title={t(
                        `tabs.dfd.element_description.chipboundary.fields.firmwareProtection.tooltips.${opt}`,
                        { defaultValue: "" },
                      )}
                      placement="right"
                      arrow
                    >
                      <span style={{ width: "100%", display: "block" }}>
                        {t(
                          `tabs.dfd.element_description.chipboundary.fields.firmwareProtection.options.${opt}`,
                          {
                            defaultValue: opt
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase()),
                          },
                        )}
                      </span>
                    </Tooltip>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Bitstream Encryption — FPGA only */}
          {isFpga && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.bitstreamEncryption ?? false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "bitstreamEncryption",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.bitstreamEncryption.label",
                { defaultValue: "Bitstream encryption enabled" },
              )}
            />
          )}

          {/* Tamper Protection */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.chipboundary.fields.tamperProtection.label",
                { defaultValue: "Tamper Protection" },
              )}
            </InputLabel>
            <Select
              value={props.tamperProtection ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "tamperProtection",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.tamperProtection.label",
                { defaultValue: "Tamper Protection" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(["none", "basic", "active"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.chipboundary.fields.tamperProtection.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.chipboundary.fields.tamperProtection.options.${opt}`,
                        {
                          defaultValue:
                            opt.charAt(0).toUpperCase() + opt.slice(1),
                        },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Supply Chain Trust */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.chipboundary.fields.supplyChainTrust.label",
                { defaultValue: "Supply Chain Trust" },
              )}
            </InputLabel>
            <Select
              value={props.supplyChainTrust ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "supplyChainTrust",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.supplyChainTrust.label",
                { defaultValue: "Supply Chain Trust" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(["verified", "unverified", "unknown"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {t(
                    `tabs.dfd.element_description.chipboundary.fields.supplyChainTrust.options.${opt}`,
                    {
                      defaultValue: opt.charAt(0).toUpperCase() + opt.slice(1),
                    },
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Safety Relevance */}
          <FormControlLabel
            control={
              <Checkbox
                checked={props.safetyRelevant ?? false}
                onChange={(e) =>
                  form.handlePropertyChange("safetyRelevant", e.target.checked)
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.chipboundary.fields.safetyRelevant.label",
              { defaultValue: "Safety-relevant hardware" },
            )}
          />

          {props.safetyRelevant && (
            <BufferedTextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.safetyRationale.label",
                { defaultValue: "Safety Rationale" },
              )}
              value={props.safetyRationale ?? ""}
              onCommit={(v) => form.handlePropertyChange("safetyRationale", v)}
              placeholder="e.g. SIL-2 certified MCU controlling emergency stop function"
              helperText={t(
                "tabs.dfd.element_description.chipboundary.fields.safetyRationale.helper",
                {
                  defaultValue:
                    "Required for EN 50742 / MVO 2027 documentation",
                },
              )}
            />
          )}

          {/* ── Documentation ─────────────────────────────────────────────── */}
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
            label={t(
              "tabs.dfd.element_description.chipboundary.fields.notes.label",
              { defaultValue: "Notes" },
            )}
            value={form.localNotes}
            onChange={(e) => form.setLocalNotes(e.target.value)}
            onBlur={form.commitNotes}
            placeholder={notesPlaceholder}
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t(
                "tabs.dfd.element_description.chipboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
            </Typography>
            <RichTextEditor
              label={t(
                "tabs.dfd.element_description.chipboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
              value={form.localDescription}
              onChange={form.setLocalDescription}
              onBlur={form.commitDescription}
            />
          </Box>
        </Stack>
      </Box>
    );
  },
  (prev, next) => prev.element === next.element,
);

export default ChipBoundaryDescriptionForm;
