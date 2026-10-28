// ==================== TRUST BOUNDARY ASSUMPTIONS ====================
// The Item Definition assumptions a trust boundary relies on (ISO/SAE 21434
// RQ-09-02 NOTE 8; conformance plan Phase 1 stage A, A-3, decision 12):
// linked by id, created from the boundary's free text with "Convert to
// assumption" (the text stays). An assumption marked invalid flags the
// boundary for review. Renders nothing without an AssumptionsProvider.

import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Autocomplete, Box, Button, Chip, TextField } from "@mui/material";
import type { Assumption } from "shared";
import { useAssumptions } from "../../contexts/assumptions-context";

interface TrustBoundaryAssumptionsProps {
  /** The boundary's free-text security assumptions. */
  text: string;
  assumptionIds: readonly string[];
  onChange: (assumptionIds: string[]) => void;
}

const STATUS_COLOR: Record<Assumption["status"], "default" | "success" | "error"> = {
  open: "default",
  confirmed: "success",
  invalid: "error",
};

export const TrustBoundaryAssumptions: React.FC<TrustBoundaryAssumptionsProps> = ({
  text,
  assumptionIds,
  onChange,
}) => {
  const { t } = useTranslation();
  const access = useAssumptions();
  if (!access) return null;

  const byId = new Map(access.assumptions.map((a) => [a.id, a]));
  const linked = assumptionIds.map(
    (id) => byId.get(id) ?? ({ id, displayId: "?", text: id, status: "open" } as Assumption),
  );
  const invalid = linked.filter((a) => a.status === "invalid");
  const statusLabel = (s: Assumption["status"]) =>
    t(`itemDefinition.assumptions.status.${s}`, { defaultValue: s });

  const convert = () => {
    const created = access.create(text);
    onChange([...assumptionIds, created.id]);
  };

  return (
    <Box data-testid="tb-assumptions">
      <Autocomplete
        multiple
        size="small"
        options={[...access.assumptions]}
        value={linked}
        getOptionLabel={(a) => `${a.displayId} ${a.text}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, v) => onChange(v.map((a) => a.id))}
        renderTags={(value, getTagProps) =>
          value.map((a, i) => {
            const { key, ...tagProps } = getTagProps({ index: i });
            return (
              <Chip
                key={key}
                {...tagProps}
                size="small"
                color={byId.has(a.id) ? STATUS_COLOR[a.status] : "warning"}
                label={
                  byId.has(a.id)
                    ? `${a.displayId} · ${statusLabel(a.status)}`
                    : t("itemDefinition.modelRefs.missing", { defaultValue: "removed ({{id}})", id: a.id })
                }
                title={a.text}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={t("tabs.dfd.element_description.trustboundary.fields.assumptionIds.label", {
              defaultValue: "Assumptions (Item Definition)",
            })}
            inputProps={{ ...params.inputProps, "data-testid": "tb-assumptions-input" }}
          />
        )}
      />
      <Button
        size="small"
        sx={{ mt: 0.5 }}
        disabled={!text.trim()}
        onClick={convert}
        data-testid="tb-convert-assumption"
      >
        {t("tabs.dfd.element_description.trustboundary.fields.assumptionIds.convert", {
          defaultValue: "Convert to assumption",
        })}
      </Button>
      {invalid.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }} data-testid="tb-assumption-invalid">
          {t("tabs.dfd.element_description.trustboundary.fields.assumptionIds.invalid", {
            defaultValue: "{{ids}} marked invalid — review this boundary.",
            ids: invalid.map((a) => a.displayId).join(", "),
          })}
        </Alert>
      )}
    </Box>
  );
};
