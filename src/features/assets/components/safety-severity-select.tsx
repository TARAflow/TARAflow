// ==================== SAFETY SEVERITY SELECT ====================
// Dropdown for the "safety" impact criterion in the asset dialog.
//
// Offers the canonical 5-level person-harm scale (SAFETY_IMPACT_SCALE). The
// categorical severity is the source of truth; the caller stores the derived
// 4-level factor as ImpactRating.value. When the value is derived (no manual
// override) the select is disabled and shows the derived severity greyed out.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, MenuItem, Select, Stack, Typography } from "@mui/material";
import { safetyImpactI18nKey, type SafetySeverity } from "shared";
import {
  SAFETY_IMPACT_SCALE,
  type SafetyImpactLevel,
} from "../models/asset-impact-types";

export type SafetySeverityValue = SafetySeverity | "na" | null;

export interface SafetySeveritySelectProps {
  /** Selected value (manual mode). */
  value: SafetySeverityValue;
  /** Derived severity shown when not in manual mode. */
  derived?: SafetySeverity;
  /** true = manual override active → editable. */
  manual: boolean;
  onChange: (value: SafetySeverityValue) => void;
}

const NA_COLOR = "#94a3b8";

function Dot({ color }: { color: string }): React.ReactElement {
  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export const SafetySeveritySelect: React.FC<SafetySeveritySelectProps> = ({
  value,
  derived,
  manual,
  onChange,
}) => {
  const { t } = useTranslation();

  const levelOf = (s: SafetySeverity | undefined): SafetyImpactLevel | undefined =>
    SAFETY_IMPACT_SCALE.find((l) => l.severity === s);

  const renderLevel = (level: SafetyImpactLevel): React.ReactElement => (
    <Stack direction="row" spacing={1} alignItems="center">
      <Dot color={level.color} />
      <span>
        {level.factor} – {t(level.labelKey)}{" "}
        <Typography component="span" variant="caption" color="text.secondary">
          ({t(safetyImpactI18nKey(level.severity))})
        </Typography>
      </span>
    </Stack>
  );

  const notApplicable = (
    <Stack direction="row" spacing={1} alignItems="center">
      <Dot color={NA_COLOR} />
      <span>
        {t("common.notApplicable", { defaultValue: "N/A – Not applicable" })}
      </span>
    </Stack>
  );

  return (
    <Select<string>
      value={manual && value ? value : ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : (v as SafetySeverity | "na"));
      }}
      size="small"
      fullWidth
      displayEmpty
      disabled={!manual}
      renderValue={(val) => {
        if (!val) {
          const derivedLevel = manual ? undefined : levelOf(derived);
          if (derivedLevel) {
            return (
              <em style={{ color: "#9e9e9e" }}>
                {t(derivedLevel.labelKey)} (
                {t(safetyImpactI18nKey(derivedLevel.severity))}){" — "}
                {t("tabs.assets.dialog.derivedFromDFD", {
                  defaultValue: "derived from DFD",
                })}
              </em>
            );
          }
          return (
            <em style={{ color: "#9e9e9e" }}>
              {t("tabs.assets.dialog.notRated", { defaultValue: "Not rated" })}
            </em>
          );
        }
        if (val === "na") return notApplicable;
        const level = levelOf(val as SafetySeverity);
        return level ? renderLevel(level) : String(val);
      }}
    >
      <MenuItem value="">
        <em>
          {t("tabs.assets.dialog.notRated", { defaultValue: "Not rated" })}
        </em>
      </MenuItem>
      <MenuItem value="na">{notApplicable}</MenuItem>
      {SAFETY_IMPACT_SCALE.map((level) => (
        <MenuItem key={level.severity} value={level.severity}>
          {renderLevel(level)}
        </MenuItem>
      ))}
    </Select>
  );
};
