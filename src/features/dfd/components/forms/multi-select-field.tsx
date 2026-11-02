// ==================== MULTI-SELECT FIELD ====================
// A control whose measures combine (release plan 0.18 MS-1): malware
// protection on Process / Multiprocess, physical path protection on a data
// flow. Checkboxes in the menu; an exclusive value ("none") replaces the
// others, any other value removes it. A stored value outside the offered ones
// (e.g. after a technology change) stays visible and can be unticked.

import React from "react";
import { Checkbox, FormControl, Grid, InputLabel, MenuItem, Select } from "@mui/material";
import { withSelected } from "../../models/element-properties";

export const MultiSelectField: React.FC<{
  label: string;
  /** Values offered for the element, in display order. */
  options: readonly string[];
  /** The stored value — a selection, or a single value of an older file. */
  value: unknown;
  onChange: (next: string[] | undefined) => void;
  optionLabel: (value: string) => string;
  /** Values that exclude every other one. */
  exclusive?: readonly string[];
  testId?: string;
}> = ({ label, options, value, onChange, optionLabel, exclusive = ["none"], testId }) => {
  const stored = [value].flat().filter((v): v is string => typeof v === "string" && v !== "");
  const offered = [...options, ...stored.filter((v) => !options.includes(v))];
  const selection = offered.filter((o) => stored.includes(o));

  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          multiple
          value={selection}
          onChange={(e) => {
            const chosen = (typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value) as string[];
            const added = chosen.find((v) => !selection.includes(v));
            const next = added ? withSelected(offered, chosen, added, exclusive) : chosen;
            onChange(next.length > 0 ? next : undefined);
          }}
          renderValue={(selected) => (selected as string[]).map(optionLabel).join(", ")}
          label={label}
          inputProps={testId ? { "data-testid": testId } : undefined}
        >
          {offered.map((opt) => (
            <MenuItem key={opt} value={opt}>
              <Checkbox size="small" checked={selection.includes(opt)} />
              {optionLabel(opt)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  );
};
