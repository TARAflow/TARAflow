// features/hazards/components/imported-data-section.tsx
//
// Hazard import HI-4: read-only "Imported data" block in the hazard dialog —
// how the source file rated the hazard and what else it said about it.
// Nothing here is editable: it documents the source, the analysis lives in
// the fields and the bowtie above.

import React from "react";
import { Alert, Box, Button, Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { HazardItem } from "shared";
import { MULTI_VALUE_IMPORT_KEYS, importedDataRows } from "../utils/imported-data-rows";

export const ImportedDataSection: React.FC<{
  item: HazardItem;
  /** Clear the re-import flag after the analyst reviewed the item (HI-10). */
  onReviewed?: () => void;
}> = ({ item, onReviewed }) => {
  const { t } = useTranslation();
  const rows = importedDataRows(item);
  if (rows.length === 0 && !item.externalRef) return null;
  const status = item.importMeta?.importStatus;

  const value = (key: string, raw: string): React.ReactNode =>
    key === "probability"
      ? t(`tabs.hazards.imported.probabilityLevel.${raw}`, { defaultValue: raw })
      : key === "protectiveMeasureType"
        ? t(`tabs.hazards.imported.measureType.${raw}`, { defaultValue: raw })
        : MULTI_VALUE_IMPORT_KEYS.includes(key)
          ? raw
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
              .map((v) => <Chip key={v} size="small" label={v} sx={{ mr: 0.5, mb: 0.5 }} />)
          : raw;

  return (
    <Box data-testid="hazard-imported-data" sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
      <Typography variant="subtitle2">
        {t("tabs.hazards.imported.title", { defaultValue: "Imported data" })}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {t("tabs.hazards.imported.hint", {
          defaultValue: "As read from the source file — read-only.",
        })}
      </Typography>
      {(status === "changed" || status === "removed") && (
        <Alert
          severity={status === "removed" ? "warning" : "info"}
          sx={{ mb: 1, py: 0 }}
          data-testid="hazard-import-status"
          action={
            onReviewed && (
              <Button size="small" onClick={onReviewed}>
                {t("tabs.hazards.imported.reviewed", { defaultValue: "Reviewed" })}
              </Button>
            )
          }
        >
          {status === "removed"
            ? t("tabs.hazards.imported.status.removed", {
                defaultValue: "No longer in the source file (re-import {{since}}). Kept — delete it or keep it on purpose.",
                since: item.importMeta?.importStatusSince?.slice(0, 10) ?? "",
              })
            : t("tabs.hazards.imported.status.changed", {
                defaultValue: "Changed in the source file (re-import {{since}}) — check the item and its edges.",
                since: item.importMeta?.importStatusSince?.slice(0, 10) ?? "",
              })}
        </Alert>
      )}
      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 2, rowGap: 0.5, m: 0 }}>
        {item.externalRef && (
          <>
            <Typography component="dt" variant="body2" color="text.secondary">
              {t("tabs.hazards.imported.key.externalRef", { defaultValue: "Source row" })}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {item.externalRef}
            </Typography>
          </>
        )}
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {r.labelKey ? t(r.labelKey, { defaultValue: r.defaultLabel }) : r.defaultLabel}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
              {value(r.key, r.value)}
            </Typography>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};
