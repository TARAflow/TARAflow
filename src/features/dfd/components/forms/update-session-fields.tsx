// ==================== UPDATE / SESSION FIELDS ====================
// Update mechanism and session control — on the Process AND the Multiprocess
// form (iec-62443-4-2-cra-coverage.md P-2). Grid items for the caller's
// <Grid container>; labels under `${i18nBase}.updateMechanism` and
// `${i18nBase}.sessionControl`.
//
// The session switches are three-valued (not specified / yes / no): the
// IEC 62443 matrix reads an unset value as unknown, an explicit "no" as not
// met — a checkbox could not tell them apart.

import React from "react";
import { useTranslation } from "react-i18next";
import { FormControl, Grid, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { UPDATE_MECHANISM_OPTIONS, type SessionControl, type UpdateMechanism } from "../../models/element-properties";

export const UpdateMechanismField: React.FC<{
  i18nBase: string;
  value: UpdateMechanism | undefined;
  onChange: (value: UpdateMechanism | undefined) => void;
}> = ({ i18nBase, value, onChange }) => {
  const { t } = useTranslation();
  const label = t(`${i18nBase}.updateMechanism.label`, { defaultValue: "Update Mechanism" });
  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          value={value ?? ""}
          onChange={(e) => onChange((e.target.value || undefined) as UpdateMechanism | undefined)}
          label={label}
        >
          <MenuItem value="">
            <em>{t("common.not_specified", { defaultValue: "Not specified" })}</em>
          </MenuItem>
          {UPDATE_MECHANISM_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {t(`${i18nBase}.updateMechanism.options.${opt}`, { defaultValue: opt })}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );
};

type Switch = "sessionLockEnabled" | "remoteTerminationEnabled";

/** The session control without empty keys; undefined when nothing is set. */
function withSession(current: SessionControl | undefined, key: keyof SessionControl, value: boolean | number | undefined) {
  const next: SessionControl = { ...current, [key]: value };
  if (value === undefined) delete next[key];
  return Object.keys(next).length ? next : undefined;
}

export const SessionControlFields: React.FC<{
  i18nBase: string;
  value: SessionControl | undefined;
  onChange: (value: SessionControl | undefined) => void;
}> = ({ i18nBase, value, onChange }) => {
  const { t } = useTranslation();
  const base = `${i18nBase}.sessionControl`;

  const switchField = (key: Switch, defaultLabel: string) => {
    const label = t(`${base}.${key}.label`, { defaultValue: defaultLabel });
    const current = value?.[key];
    return (
      <Grid item xs={12} sm={6} key={key}>
        <FormControl fullWidth size="small">
          <InputLabel>{label}</InputLabel>
          <Select
            value={current === undefined ? "" : current ? "yes" : "no"}
            onChange={(e) => onChange(withSession(value, key, e.target.value === "" ? undefined : e.target.value === "yes"))}
            label={label}
          >
            <MenuItem value="">
              <em>{t("common.not_specified", { defaultValue: "Not specified" })}</em>
            </MenuItem>
            <MenuItem value="yes">{t("common.yes", { defaultValue: "Yes" })}</MenuItem>
            <MenuItem value="no">{t("common.no", { defaultValue: "No" })}</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    );
  };

  return (
    <>
      {switchField("sessionLockEnabled", "Session Lock after Inactivity")}
      {switchField("remoteTerminationEnabled", "Remote Session Termination")}
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          size="small"
          type="number"
          inputProps={{ min: 0, step: 1 }}
          label={t(`${base}.maxConcurrentSessions.label`, { defaultValue: "Max. Concurrent Sessions (0 = unlimited)" })}
          value={value?.maxConcurrentSessions ?? ""}
          onChange={(e) => {
            const n = e.target.value === "" ? undefined : Math.max(0, Math.floor(Number(e.target.value)));
            onChange(withSession(value, "maxConcurrentSessions", Number.isFinite(n) ? n : undefined));
          }}
        />
      </Grid>
    </>
  );
};
