// ==================== TRANSDUCER FORM — SHARED FIELDS ====================
// Presentational building blocks shared by the Sensor and Actuator description
// forms. Both transducers share TransducerBaseProperties (location, physical
// exposure, secondary channels, owner/notes/description) plus a Safety block, so
// those render identically here. Element-specific Context/Security/Safety fields
// stay in each form. Every t() carries a defaultValue so the forms render before
// the i18n keys (tabs.dfd.element_description.{sensor,actuator}.*) are added.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Checkbox,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { RichTextEditor } from "../shared/rich-text-editor";
import { SecurityControlOwnershipDisplay } from "./security-control-ownership-display";
import type {
  TransducerLocation,
  LocationProvenance,
  SecondaryChannelCapability,
  SafetyClassification,
} from "../../models/transducer-properties";
import type {
  PhysicalExposureLevel,
  SecurityControlRecord,
} from "../../models/element-shared-types";

export type Ns = "sensor" | "actuator";

/** "source_authenticated" → "Source authenticated" (fallback label until i18n). */
export const humanize = (s: string): string =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
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

// ── Generic single-select enum field. value "" = not specified. ──────────────
export const EnumField: React.FC<{
  ns: Ns;
  field: string;
  label: string;
  value: string;
  options: ReadonlyArray<string>;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
  sm?: number;
}> = ({ ns, field, label, value, options, onChange, disabled, sm = 6 }) => {
  const { t } = useTranslation();
  const labelText = t(
    `tabs.dfd.element_description.${ns}.fields.${field}.label`,
    { defaultValue: label },
  );
  return (
    <Grid item xs={12} sm={sm}>
      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={value}
          label={labelText}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : (e.target.value as string))
          }
        >
          <MenuItem value="">
            <em>{t("common.not_specified", { defaultValue: "Not specified" })}</em>
          </MenuItem>
          {options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(
                `tabs.dfd.element_description.${ns}.fields.${field}.options.${opt}`,
                { defaultValue: humanize(opt) },
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );
};

// ── Tri-state safety relevance: "" = unassessed (validator finding) ──────────
export const SafetyRelevantField: React.FC<{
  ns: Ns;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}> = ({ ns, value, onChange }) => {
  const { t } = useTranslation();
  const labelText = t(
    `tabs.dfd.element_description.${ns}.fields.safetyRelevant.label`,
    { defaultValue: "Safety relevant" },
  );
  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={value === undefined ? "" : value ? "yes" : "no"}
          label={labelText}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : v === "yes");
          }}
        >
          <MenuItem value="">
            <em>{t("common.unassessed", { defaultValue: "Unassessed" })}</em>
          </MenuItem>
          <MenuItem value="yes">{t("common.yes", { defaultValue: "Yes" })}</MenuItem>
          <MenuItem value="no">{t("common.no", { defaultValue: "No" })}</MenuItem>
        </Select>
      </FormControl>
    </Grid>
  );
};

// ── Location — normally DERIVED from PhysicalBoundary containment ────────────
// A manual pick is an override; clearing returns to auto.
export const LOCATION_OPTIONS: TransducerLocation[] = [
  "internal",
  "external",
  "boundary_spanning",
];

export const LocationField: React.FC<{
  ns: Ns;
  value: TransducerLocation | undefined;
  provenance: LocationProvenance | undefined;
  onChange: (v: TransducerLocation | undefined) => void;
}> = ({ ns, value, provenance, onChange }) => {
  const { t } = useTranslation();
  const labelText = t(
    `tabs.dfd.element_description.${ns}.fields.location.label`,
    { defaultValue: "Location" },
  );
  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={value ?? ""}
          label={labelText}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? undefined
                : (e.target.value as TransducerLocation),
            )
          }
        >
          <MenuItem value="">
            <em>
              {t(`tabs.dfd.element_description.${ns}.fields.location.auto`, {
                defaultValue: "Auto (derived)",
              })}
            </em>
          </MenuItem>
          {LOCATION_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(
                `tabs.dfd.element_description.${ns}.fields.location.options.${opt}`,
                { defaultValue: humanize(opt) },
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
        {provenance === "override"
          ? t(`tabs.dfd.element_description.${ns}.fields.location.overridden`, {
              defaultValue: "Overridden — clear to return to auto",
            })
          : t(`tabs.dfd.element_description.${ns}.fields.location.derivedHint`, {
              defaultValue: "Derived from PhysicalBoundary containment",
            })}
      </Typography>
    </Grid>
  );
};

// ── Physical exposure (device-tamper reachability) ──────────────────────────
// NOTE: PEL literal list assumed PEL0–PEL4 — typed against PhysicalExposureLevel,
// so a wrong literal is a compile error. Fix here if the enum differs.
export const PEL_OPTIONS: PhysicalExposureLevel[] = [
  "PEL0",
  "PEL1",
  "PEL2",
  "PEL3",
  "PEL4",
];

export const PhysicalExposureField: React.FC<{
  ns: Ns;
  value: PhysicalExposureLevel | undefined;
  onChange: (v: PhysicalExposureLevel | undefined) => void;
}> = ({ ns, value, onChange }) => {
  const { t } = useTranslation();
  const labelText = t(
    `tabs.dfd.element_description.${ns}.fields.physicalExposureLevel.label`,
    { defaultValue: "Physical exposure (tamper)" },
  );
  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{labelText}</InputLabel>
        <Select
          value={value ?? ""}
          label={labelText}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? undefined
                : (e.target.value as PhysicalExposureLevel),
            )
          }
        >
          <MenuItem value="">
            <em>{t("common.not_specified", { defaultValue: "Not specified" })}</em>
          </MenuItem>
          {PEL_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );
};

// ── Secondary (reverse) channel capabilities — multi-select ─────────────────
export const SECONDARY_CHANNEL_OPTIONS: SecondaryChannelCapability[] = [
  "calibration",
  "config",
  "diagnostics",
  "firmware_update",
  "health_status",
];

export const SecondaryChannelsField: React.FC<{
  ns: Ns;
  value: SecondaryChannelCapability[] | undefined;
  onChange: (v: SecondaryChannelCapability[]) => void;
}> = ({ ns, value, onChange }) => {
  const { t } = useTranslation();
  const selected = value ?? [];
  const labelText = t(
    `tabs.dfd.element_description.${ns}.fields.secondaryChannelCapabilities.label`,
    { defaultValue: "Secondary channels" },
  );
  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{labelText}</InputLabel>
        <Select
          multiple
          value={selected}
          input={<OutlinedInput label={labelText} />}
          renderValue={(sel) => (sel as string[]).map(humanize).join(", ")}
          onChange={(e) => {
            const v = e.target.value;
            onChange(
              (typeof v === "string" ? v.split(",") : v) as SecondaryChannelCapability[],
            );
          }}
        >
          {SECONDARY_CHANNEL_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              <Checkbox checked={selected.includes(opt)} />
              <ListItemText
                primary={t(
                  `tabs.dfd.element_description.${ns}.fields.secondaryChannelCapabilities.options.${opt}`,
                  { defaultValue: humanize(opt) },
                )}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );
};

export const SAFETY_CLASSIFICATION_OPTIONS: SafetyClassification[] = [
  "unassessed",
  "minor",
  "major",
  "severe",
  "catastrophic",
];

// ── Documentation block: owner, notes, security-control ownership, description ─
interface NotesDescApi {
  localNotes: string;
  setLocalNotes: (v: string) => void;
  commitNotes: () => void;
  localDescription: string;
  setLocalDescription: (v: string) => void;
  commitDescription: () => void;
}

export const TransducerDocumentationSection: React.FC<{
  ns: Ns;
  owner: string | undefined;
  onOwnerChange: (v: string | undefined) => void;
  securityControlOwnership: SecurityControlRecord[];
  form: NotesDescApi;
}> = ({ ns, owner, onOwnerChange, securityControlOwnership, form }) => {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        fullWidth
        size="small"
        label={t(`tabs.dfd.element_description.${ns}.fields.owner.label`, {
          defaultValue: "Owner",
        })}
        value={owner ?? ""}
        onChange={(e) => onOwnerChange(e.target.value || undefined)}
        placeholder={t(
          `tabs.dfd.element_description.${ns}.fields.owner.placeholder`,
          { defaultValue: "Team or person responsible" },
        )}
      />

      <TextField
        fullWidth
        size="small"
        multiline
        rows={2}
        label={t(`tabs.dfd.element_description.${ns}.fields.notes.label`, {
          defaultValue: "Notes",
        })}
        value={form.localNotes}
        onChange={(e) => form.setLocalNotes(e.target.value)}
        onBlur={form.commitNotes}
      />

      <SecurityControlOwnershipDisplay records={securityControlOwnership ?? []} />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t(`tabs.dfd.element_description.${ns}.fields.description.label`, {
            defaultValue: "Description",
          })}
        </Typography>
        <RichTextEditor
          label={t(`tabs.dfd.element_description.${ns}.fields.description.label`, {
            defaultValue: "Description",
          })}
          value={form.localDescription}
          onChange={form.setLocalDescription}
          onBlur={form.commitDescription}
        />
      </Box>
    </>
  );
};
