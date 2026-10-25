// features/hazards/components/value-map-editor.tsx
//
// Hazard import HI-1: maps the values found in one source column onto the
// canonical options of a field ("4" → irreversible_major, "Quetschen" →
// mechanical). One row per distinct value; "—" leaves a value unmapped, so it
// is read as it is (and a severity it does not know creates no edge, HI-11).

import React from "react";
import { Box, Chip, MenuItem, Select, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Per value: pre-filled from keywords, or ambiguous and left to the analyst (HI-8). */
export type ValueHint =
  | { kind: "suggested" }
  | { kind: "ambiguous"; candidates: readonly string[] };

export interface ValueMapEditorProps {
  /** Distinct values of the source column. */
  values: string[];
  /** Canonical options of the field. */
  options: readonly string[];
  valueMap: Record<string, string> | undefined;
  onChange: (valueMap: Record<string, string>) => void;
  optionLabel: (option: string) => string;
  hints?: Readonly<Record<string, ValueHint>>;
}

export const ValueMapEditor: React.FC<ValueMapEditorProps> = ({
  values,
  options,
  valueMap,
  onChange,
  optionLabel,
  hints,
}) => {
  const { t } = useTranslation();
  if (values.length === 0) return null;

  const set = (source: string, target: string) => {
    const next = { ...(valueMap ?? {}) };
    if (target) next[source] = target;
    else delete next[source];
    onChange(next);
  };

  return (
    <Box data-testid="value-map-editor" sx={{ mt: 1, pl: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {t("tabs.hazards.import.valueMap.title", { defaultValue: "Map the values of this column" })}
      </Typography>
      {values.map((v) => (
        <Box key={v} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Typography variant="body2" sx={{ minWidth: 80, fontFamily: "monospace" }}>
            {v}
          </Typography>
          <Select
            size="small"
            displayEmpty
            value={valueMap?.[v] ?? ""}
            onChange={(e) => set(v, String(e.target.value))}
            sx={{ minWidth: 180 }}
            inputProps={{ "aria-label": v }}
          >
            <MenuItem value="">
              <em>{t("tabs.hazards.import.valueMap.unmapped", { defaultValue: "— (as it is)" })}</em>
            </MenuItem>
            {options.map((o) => (
              <MenuItem key={o} value={o}>
                {optionLabel(o)}
              </MenuItem>
            ))}
          </Select>
          {hints?.[v]?.kind === "suggested" && (
            <Chip
              size="small"
              variant="outlined"
              color="info"
              label={t("tabs.hazards.import.valueMap.suggested", { defaultValue: "suggested" })}
              sx={{ height: 20, fontSize: "0.7rem" }}
              data-testid={`value-hint-${v}`}
            />
          )}
          {hints?.[v]?.kind === "ambiguous" && (
            <Typography variant="caption" color="warning.main" data-testid={`value-hint-${v}`}>
              {t("tabs.hazards.import.valueMap.ambiguous", {
                defaultValue: "ambiguous ({{candidates}}) — assign by hand",
                candidates: (hints[v] as { candidates: readonly string[] }).candidates.map(optionLabel).join(" / "),
              })}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
};
