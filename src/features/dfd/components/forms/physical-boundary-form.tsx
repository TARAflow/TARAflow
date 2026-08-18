// ==================== PHYSICAL BOUNDARY DESCRIPTION FORM ====================
// Spatial physical access barrier — device enclosure, cabinet, room, building,
// vehicle, tamper zone.
//
// STRIDE relevance:
//   S — Relay attack (badge cloning), maintenance impersonation
//   T — Cable tampering, USB insertion, sensor spoofing, debug attachment
//   R — No physical audit trail (monitoringType: none)
//   I — Side-channel preparation, debug port access, removable media
//   D — Device theft, physical destruction, power disruption
//   E — Debug access, JTAG attachment, bypassing logical controls physically
//
// Structure: Context → Physical Security → Documentation (no accordions)
// Cascade: boundaryType drives physicalExposureLevel + accessibility +
//          physicalAccessControl + tamperProtection + monitoringType

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
import type { DFDElement } from "../../models/dfd-types";
import type { PhysicalBoundaryProperties } from "../../models/element-properties";
import {
  PHYSICAL_EXPOSURE_LEVEL_LABEL_KEYS,
  PHYSICAL_EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { useElementForm } from "../../hooks/use-element-form";
import {
  PHYSICAL_BOUNDARY_TYPE_DEFAULTS,
  PHYSICAL_BOUNDARY_TYPE_DRIVEN_FIELDS,
  PHYSICAL_BOUNDARY_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS,
  applyCascadeDefaults,
  buildClearPatch,
} from "../../models/element-property-defaults";
import type { PhysicalExposureLevel } from "../../models/element-shared-types";

// ==================== PROPS ====================

interface PhysicalBoundaryFormProps {
  element: DFDElement;
  onChange: (updates: Partial<DFDElement>) => void;
}

// ==================== HELPERS ====================

const PEL_LEVELS: PhysicalExposureLevel[] = ["PEL0", "PEL1", "PEL2", "PEL3", "PEL4"];

// Mobility options — only shown for boundaryType: device_enclosure | vehicle
const MOBILITY_BOUNDARY_TYPES = ["device_enclosure", "vehicle"] as const;
const MOBILITY_OPTIONS = ["fixed", "removable", "portable", "vehicle_mounted"] as const;

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

export const PhysicalBoundaryDescriptionForm = React.memo<PhysicalBoundaryFormProps>(
  ({ element, onChange }) => {
    const { t } = useTranslation();
    const form = useElementForm<PhysicalBoundaryProperties>(element, onChange);
    const { props } = form;

    // ── Cascade: boundaryType driver ──────────────────────────────────────────
    const handleBoundaryTypeChange = (value: string) => {
      if (!value) {
        onChange({
          properties: {
            ...props,
            boundaryType: undefined,
            ...buildClearPatch<PhysicalBoundaryProperties>(
              PHYSICAL_BOUNDARY_TYPE_DRIVEN_FIELDS,
            ),
          } as PhysicalBoundaryProperties,
        });
        return;
      }
      const typeKey = value as NonNullable<
        PhysicalBoundaryProperties["boundaryType"]
      >;
      const defaults = PHYSICAL_BOUNDARY_TYPE_DEFAULTS[typeKey] ?? {};
      const cascaded = applyCascadeDefaults<PhysicalBoundaryProperties>(
        props,
        defaults,
      );
      onChange({
        properties: {
          ...props,
          boundaryType: typeKey,
          ...cascaded,
        } as PhysicalBoundaryProperties,
      });
    };

    // Dynamic placeholder for notes
    const notesPlaceholder =
      props.boundaryType != null
        ? (PHYSICAL_BOUNDARY_TYPE_SECURITY_ASSUMPTIONS_PLACEHOLDERS[
            props.boundaryType
          ] ?? "")
        : "Select a boundary type for context-specific security guidance.";

    return (
      <Box p={1}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Warning */}
          <Alert severity="warning">
            <Typography variant="body2" fontWeight="bold">
              {t(
                "tabs.dfd.element_description.physicalboundary.warning.title",
                {
                  defaultValue: "Physical boundary — attack surface modelling!",
                },
              )}
            </Typography>
            <Typography variant="caption">
              {t("tabs.dfd.element_description.physicalboundary.warning.hint", {
                defaultValue:
                  "Interfaces that cross or lie inside this boundary inherit its physical access preconditions. Verify tamper protection and access control before deployment.",
              })}
            </Typography>
          </Alert>

          {/* ── Context ───────────────────────────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.context", {
              defaultValue: "Context",
            })}
          />

          {/* Boundary Type */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            </InputLabel>
            <Select
              value={props.boundaryType ?? ""}
              onChange={(e) => handleBoundaryTypeChange(e.target.value)}
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(
                [
                  "device_enclosure",
                  "cabinet",
                  "room",
                  "building",
                  "vehicle",
                  "tamper_zone",
                  "custom",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.physicalboundary.fields.boundaryType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.physicalboundary.fields.boundaryType.options.${opt}`,
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

          {/* Physical Exposure Level (PEL) */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.physicalExposureLevel.label",
                { defaultValue: "Physical Exposure Level" },
              )}
            </InputLabel>
            <Select
              value={props.physicalExposureLevel ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "physicalExposureLevel",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.physicalExposureLevel.label",
                { defaultValue: "Physical Exposure Level" },
              )}
              renderValue={(value) =>
                value
                  ? t(
                      PHYSICAL_EXPOSURE_LEVEL_LABEL_KEYS[
                        value as PhysicalExposureLevel
                      ],
                    )
                  : ""
              }
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {PEL_LEVELS.map((pel) => (
                <MenuItem key={pel} value={pel}>
                  <Tooltip
                    title={t(PHYSICAL_EXPOSURE_LEVEL_DESCRIPTION_KEYS[pel], {
                      defaultValue: "",
                    })}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(PHYSICAL_EXPOSURE_LEVEL_LABEL_KEYS[pel])}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* physicalMobility — only shown for device_enclosure and vehicle */}
          {MOBILITY_BOUNDARY_TYPES.includes(
            props.boundaryType as (typeof MOBILITY_BOUNDARY_TYPES)[number],
          ) && (
            <FormControl fullWidth size="small">
              <InputLabel>
                {t(
                  "tabs.dfd.element_description.physicalboundary.fields.physicalMobility.label",
                  { defaultValue: "Device Mobility" },
                )}
              </InputLabel>
              <Select
                value={props.physicalMobility ?? ""}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "physicalMobility",
                    e.target.value || undefined,
                  )
                }
                label={t(
                  "tabs.dfd.element_description.physicalboundary.fields.physicalMobility.label",
                  { defaultValue: "Device Mobility" },
                )}
              >
                <MenuItem value="">
                  <em>
                    {t("common.not_specified", {
                      defaultValue: "Not specified",
                    })}
                  </em>
                </MenuItem>
                {MOBILITY_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    <Tooltip
                      title={t(
                        `tabs.dfd.element_description.physicalboundary.fields.physicalMobility.tooltips.${opt}`,
                        { defaultValue: "" },
                      )}
                      placement="right"
                      arrow
                    >
                      <span style={{ width: "100%", display: "block" }}>
                        {t(
                          `tabs.dfd.element_description.physicalboundary.fields.physicalMobility.options.${opt}`,
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
          )}

          {/* Accessibility */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.accessibility.label",
                { defaultValue: "Accessibility" },
              )}
            </InputLabel>
            <Select
              value={props.accessibility ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "accessibility",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.accessibility.label",
                { defaultValue: "Accessibility" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t("common.not_specified", { defaultValue: "Not specified" })}
                </em>
              </MenuItem>
              {(["public", "controlled", "guarded"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.physicalboundary.fields.accessibility.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.physicalboundary.fields.accessibility.options.${opt}`,
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

          {/* ── Physical Security ─────────────────────────────────────────── */}
          <SectionLabel
            label={t(
              "tabs.dfd.element_description.sections.physical_security",
              { defaultValue: "Physical Security" },
            )}
          />

          {/* Physical Access Control */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.physicalAccessControl.label",
                { defaultValue: "Physical Access Control" },
              )}
            </InputLabel>
            <Select
              value={props.physicalAccessControl ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "physicalAccessControl",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.physicalAccessControl.label",
                { defaultValue: "Physical Access Control" },
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
                  "key",
                  "badge",
                  "badge_pin",
                  "biometric",
                  "guard",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.physicalboundary.fields.physicalAccessControl.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.physicalboundary.fields.physicalAccessControl.options.${opt}`,
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

          {/* Tamper Protection */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.tamperProtection.label",
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
                "tabs.dfd.element_description.physicalboundary.fields.tamperProtection.label",
                { defaultValue: "Tamper Protection" },
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
                  "seal",
                  "switch",
                  "mesh",
                  "potting",
                  "active_detection",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.physicalboundary.fields.tamperProtection.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.physicalboundary.fields.tamperProtection.options.${opt}`,
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

          {/* Monitoring Type */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.monitoringType.label",
                { defaultValue: "Monitoring" },
              )}
            </InputLabel>
            <Select
              value={props.monitoringType ?? ""}
              onChange={(e) =>
                form.handlePropertyChange(
                  "monitoringType",
                  e.target.value || undefined,
                )
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.monitoringType.label",
                { defaultValue: "Monitoring" },
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
                  "camera",
                  "alarm",
                  "soc",
                  "guard_patrol",
                  "tamper_monitoring",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.physicalboundary.fields.monitoringType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.physicalboundary.fields.monitoringType.options.${opt}`,
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

          {/* Attack Surface Hints — boundary-type conditional */}

          {/* requiresToolAccess: device_enclosure, vehicle, cabinet */}
          {(["device_enclosure", "vehicle", "cabinet"] as const).includes(
            props.boundaryType as "device_enclosure" | "vehicle" | "cabinet",
          ) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.requiresToolAccess ?? false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "requiresToolAccess",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.requiresToolAccess.label",
                {
                  defaultValue:
                    "Requires tool access to open (screwdriver, hex key)",
                },
              )}
            />
          )}

          {/* debugInterfaceAccessible: device_enclosure, vehicle, tamper_zone */}
          {(["device_enclosure", "vehicle", "tamper_zone"] as const).includes(
            props.boundaryType as
              | "device_enclosure"
              | "vehicle"
              | "tamper_zone",
          ) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.debugInterfaceAccessible ?? false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "debugInterfaceAccessible",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.debugInterfaceAccessible.label",
                {
                  defaultValue:
                    "Debug / programming port accessible inside (JTAG, SWD, UART)",
                },
              )}
            />
          )}

          {/* removableMediaAccessible: device_enclosure, vehicle */}
          {(["device_enclosure", "vehicle"] as const).includes(
            props.boundaryType as "device_enclosure" | "vehicle",
          ) && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.removableMediaAccessible ?? false}
                  onChange={(e) =>
                    form.handlePropertyChange(
                      "removableMediaAccessible",
                      e.target.checked,
                    )
                  }
                />
              }
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.removableMediaAccessible.label",
                {
                  defaultValue: "Removable media accessible (USB, SD card)",
                },
              )}
            />
          )}

          {/* Safety Relevance — all boundary types */}
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
              "tabs.dfd.element_description.physicalboundary.fields.safetyRelevant.label",
              {
                defaultValue: "Protects safety-relevant hardware or functions",
              },
            )}
          />

          {props.safetyRelevant && (
            <BufferedTextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.safetyRationale.label",
                { defaultValue: "Safety Rationale" },
              )}
              value={props.safetyRationale ?? ""}
              onCommit={(v) => form.handlePropertyChange("safetyRationale", v)}
              placeholder="e.g. Schaltschrank houses SIL-2 certified Safety PLC — physical access restricted to authorised personnel only"
              helperText={t(
                "tabs.dfd.element_description.physicalboundary.fields.safetyRationale.helper",
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

          <BufferedTextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.physicalboundary.fields.owner.label",
              { defaultValue: "Owner / Responsible" },
            )}
            value={props.owner ?? ""}
            onCommit={(v) => form.handlePropertyChange("owner", v || undefined)}
            placeholder="e.g. Facility Management, OT Team"
          />

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              "tabs.dfd.element_description.physicalboundary.fields.notes.label",
              { defaultValue: "Security Assumptions / Notes" },
            )}
            value={form.localNotes}
            onChange={(e) => form.setLocalNotes(e.target.value)}
            onBlur={form.commitNotes}
            placeholder={notesPlaceholder}
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t(
                "tabs.dfd.element_description.physicalboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
            </Typography>
            <RichTextEditor
              label={t(
                "tabs.dfd.element_description.physicalboundary.fields.description.label",
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

export default PhysicalBoundaryDescriptionForm;
