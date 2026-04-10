// ==================== TRUST BOUNDARY DESCRIPTION FORM ====================
// STRIDE: All (Trust boundaries trigger automatic threat checks!)
// Focus: Zone definition, exposure level, security assumptions
//
// Structure: Context → Security → Documentation (no accordions)

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
import type { AssetGroup, DFDElement } from "../../models/dfd-types";
import type {
  TrustBoundaryProperties,
  ExposureLevel,
} from "../../models/element-properties";
import {
  EXPOSURE_LEVEL_LABELS,
  EXPOSURE_LEVEL_DESCRIPTION_KEYS,
} from "../../models/dfd-constants";
import { RichTextEditor } from "../shared/rich-text-editor";
import { type AvailableAsset } from "./asset-relation-selector";
import { useElementForm } from "../../hooks/use-element-form";

// ==================== PROPS ====================

interface TrustBoundaryFormProps {
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

export const TrustBoundaryDescriptionForm = React.memo<TrustBoundaryFormProps>(
  ({ element, onChange }) => {
    const { t } = useTranslation();
    const form = useElementForm<TrustBoundaryProperties>(element, onChange);
    const { props } = form;

    return (
      <Box p={1}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Zone Warning */}
          <Alert severity="warning">
            <Typography variant="body2" fontWeight="bold">
              {t("tabs.dfd.element_description.trustboundary.warning.title", {
                defaultValue: "Trust Boundaries are critical!",
              })}
            </Typography>
            <Typography variant="caption">
              {t("tabs.dfd.element_description.trustboundary.warning.hint", {
                defaultValue:
                  "Any data flow crossing this boundary requires extra scrutiny for all STRIDE threats.",
              })}
            </Typography>
          </Alert>

          {/* ── Context ─────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.context", {
              defaultValue: "Context",
            })}
          />

          {/* Boundary Type */}
          <FormControl fullWidth size="small">
            <InputLabel>
              {t(
                "tabs.dfd.element_description.trustboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            </InputLabel>
            <Select
              value={props.boundaryType ?? ""}
              onChange={(e) =>
                form.handlePropertyChange("boundaryType", e.target.value)
              }
              label={t(
                "tabs.dfd.element_description.trustboundary.fields.boundaryType.label",
                { defaultValue: "Boundary Type" },
              )}
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.trustboundary.fields.boundaryType.options.not_specified",
                    { defaultValue: "Not specified" },
                  )}
                </em>
              </MenuItem>
              {(
                [
                  "network",
                  "privilege",
                  "organization",
                  "cloud",
                  "physical",
                  "legal",
                  "device",
                ] as const
              ).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.trustboundary.fields.boundaryType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryType.options.${opt}`,
                        { defaultValue: opt },
                      )}
                    </span>
                  </Tooltip>
                </MenuItem>
              ))}
              <MenuItem disabled sx={{ opacity: 0.5, fontSize: "0.75rem" }}>
                — Embedded-specific —
              </MenuItem>
              {(["peripheral", "boot", "debug"] as const).map((opt) => (
                <MenuItem key={opt} value={opt}>
                  <Tooltip
                    title={t(
                      `tabs.dfd.element_description.trustboundary.fields.boundaryType.tooltips.${opt}`,
                      { defaultValue: "" },
                    )}
                    placement="right"
                    arrow
                  >
                    <span style={{ width: "100%", display: "block" }}>
                      {t(
                        `tabs.dfd.element_description.trustboundary.fields.boundaryType.options.${opt}`,
                        { defaultValue: opt },
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
                value ? EXPOSURE_LEVEL_LABELS[value as ExposureLevel] : ""
              }
            >
              <MenuItem value="">
                <em>
                  {t(
                    "tabs.dfd.element_description.trustboundary.fields.exposureLevel.not_specified",
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

          {/* ── Security ─────────────────────────────── */}
          <SectionLabel
            label={t("tabs.dfd.element_description.sections.security", {
              defaultValue: "Security",
            })}
          />

          {/* Security Assumptions */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={3}
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.label",
              { defaultValue: "Security Assumptions" },
            )}
            value={props.securityAssumptions ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("securityAssumptions", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.placeholder",
              { defaultValue: "e.g. Inside is trusted, outside is hostile" },
            )}
            helperText={t(
              "tabs.dfd.element_description.trustboundary.fields.securityAssumptions.helper",
              {
                defaultValue:
                  "What do you assume about each side of this boundary?",
              },
            )}
          />

          {/* Boundary Controls */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.boundaryControls.label",
              { defaultValue: "Controls at Boundary" },
            )}
            value={props.boundaryControls ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("boundaryControls", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.boundaryControls.placeholder",
              {
                defaultValue:
                  "e.g. Firewall, API Gateway, Authentication Layer",
              },
            )}
            helperText={t(
              "tabs.dfd.element_description.trustboundary.fields.boundaryControls.helper",
              { defaultValue: "What enforces this boundary?" },
            )}
          />

          {/* Monitoring */}
          <FormControlLabel
            control={
              <Checkbox
                checked={props.monitoringEnabled || false}
                onChange={(e) =>
                  form.handlePropertyChange(
                    "monitoringEnabled",
                    e.target.checked,
                  )
                }
              />
            }
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.monitoringEnabled.label",
              { defaultValue: "Monitoring / Logging Enabled" },
            )}
          />

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
              "tabs.dfd.element_description.trustboundary.fields.complianceRelevance.label",
              { defaultValue: "Compliance Relevance" },
            )}
            value={props.complianceRelevance ?? ""}
            onChange={(e) =>
              form.handlePropertyChange("complianceRelevance", e.target.value)
            }
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.complianceRelevance.placeholder",
              {
                defaultValue: "e.g. GDPR, ISO 27001, SOC 2, PCI-DSS, IEC 62443",
              },
            )}
          />

          <TextField
            fullWidth
            size="small"
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.owner.label",
              { defaultValue: "Owner / Responsible Team" },
            )}
            value={props.owner ?? ""}
            onChange={(e) => form.handlePropertyChange("owner", e.target.value)}
            placeholder={t(
              "tabs.dfd.element_description.trustboundary.fields.owner.placeholder",
              { defaultValue: "Who maintains this boundary?" },
            )}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              "tabs.dfd.element_description.trustboundary.fields.notes.label",
              { defaultValue: "Notes" },
            )}
            value={form.localNotes}
            onChange={(e) => form.setLocalNotes(e.target.value)}
            onBlur={form.commitNotes}
          />

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t(
                "tabs.dfd.element_description.trustboundary.fields.description.label",
                { defaultValue: "Description" },
              )}
            </Typography>
            <RichTextEditor
              label={t(
                "tabs.dfd.element_description.trustboundary.fields.description.label",
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

export default TrustBoundaryDescriptionForm;