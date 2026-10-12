// features/dfd/asset-graph/asset-graph-link-form.tsx
//
// Edit mode (phase 3, FR-E6): the optional attributes of an asset link,
// edited in the link card — step order, rationale, notes, and for
// `depends_on` the degraded mode with its description. Same rule as the
// relation dialog: a degraded mode needs a description. Saving sends one
// `update` operation; a cleared field is removed from the link.

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField } from "@mui/material";
import type { A2ARelation, A2ARelationAttributes } from "shared";

export interface LinkDraft {
  readonly stepOrder: string;
  readonly rationale: string;
  readonly notes: string;
  readonly degradationMode: boolean;
  readonly degradationDescription: string;
}

export function draftOf(rel: A2ARelation): LinkDraft {
  return {
    stepOrder: rel.stepOrder !== undefined ? String(rel.stepOrder) : "",
    rationale: rel.rationale ?? "",
    notes: rel.notes ?? "",
    degradationMode: rel.degradationMode ?? false,
    degradationDescription: rel.degradationDescription ?? "",
  };
}

export interface LinkDraftResult {
  /** Changed attributes; `undefined` removes the attribute. */
  readonly attributes: Partial<A2ARelationAttributes>;
  readonly changed: boolean;
  /** Why the draft cannot be saved, if it cannot. */
  readonly error?: "stepOrder" | "degradationDescription";
}

/** Pure: what saving the draft would change on the link, and whether it may. */
export function linkDraftResult(rel: A2ARelation, draft: LinkDraft): LinkDraftResult {
  const attributes: Record<string, unknown> = {};
  const step = draft.stepOrder.trim();
  let error: LinkDraftResult["error"];
  if (step && !/^\d+$/.test(step)) error = "stepOrder";
  const stepValue = step ? Number(step) : undefined;
  if (stepValue !== rel.stepOrder) attributes.stepOrder = stepValue;
  const text = (v: string) => (v.trim() ? v.trim() : undefined);
  if (text(draft.rationale) !== rel.rationale) attributes.rationale = text(draft.rationale);
  if (text(draft.notes) !== rel.notes) attributes.notes = text(draft.notes);
  if (rel.relationType === "depends_on" || rel.degradationMode !== undefined) {
    const mode = draft.degradationMode;
    if (mode !== (rel.degradationMode ?? false)) attributes.degradationMode = mode;
    const desc = mode ? text(draft.degradationDescription) : undefined;
    if (desc !== rel.degradationDescription) attributes.degradationDescription = desc;
    if (mode && !desc) error = error ?? "degradationDescription";
  }
  return { attributes, changed: Object.keys(attributes).length > 0, ...(error ? { error } : {}) };
}

export interface LinkAttributesFormProps {
  readonly relation: A2ARelation;
  readonly onSave: (relationId: string, attributes: Partial<A2ARelationAttributes>) => void;
}

export const LinkAttributesForm: React.FC<LinkAttributesFormProps> = ({ relation, onSave }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LinkDraft>(() => draftOf(relation));
  // Another link selected, or the link changed elsewhere: start from it.
  useEffect(() => setDraft(draftOf(relation)), [relation]);
  const result = linkDraftResult(relation, draft);
  const set = (patch: Partial<LinkDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const showDegradation = relation.relationType === "depends_on" || relation.degradationMode !== undefined;
  const label = (key: string, def: string) => t(`tabs.dfd.assetGraph.inspector.${key}`, { defaultValue: def });

  return (
    <Box data-testid="asset-graph-link-form" sx={{ mt: 1 }}>
      <Stack spacing={1}>
        <TextField
          size="small"
          label={label("stepOrder", "Step")}
          value={draft.stepOrder}
          onChange={(e) => set({ stepOrder: e.target.value })}
          error={result.error === "stepOrder"}
          helperText={result.error === "stepOrder" ? label("stepOrderInvalid", "Whole number ≥ 0") : undefined}
          inputProps={{ "data-testid": "asset-graph-link-step", inputMode: "numeric" }}
        />
        <TextField
          size="small"
          multiline
          minRows={2}
          label={label("rationale", "Rationale")}
          value={draft.rationale}
          onChange={(e) => set({ rationale: e.target.value })}
          inputProps={{ "data-testid": "asset-graph-link-rationale" }}
        />
        <TextField
          size="small"
          multiline
          minRows={1}
          label={label("notes", "Notes")}
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
          inputProps={{ "data-testid": "asset-graph-link-notes" }}
        />
        {showDegradation && (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={draft.degradationMode}
                  onChange={(e) => set({ degradationMode: e.target.checked })}
                  inputProps={{ "data-testid": "asset-graph-link-degradation" } as never}
                />
              }
              label={label("degradation", "Degraded mode")}
            />
            {draft.degradationMode && (
              <TextField
                size="small"
                required
                label={label("degradationDescription", "What still works")}
                value={draft.degradationDescription}
                onChange={(e) => set({ degradationDescription: e.target.value })}
                error={result.error === "degradationDescription"}
                helperText={
                  result.error === "degradationDescription"
                    ? label("degradationRequired", "Required with degraded mode")
                    : undefined
                }
                inputProps={{ "data-testid": "asset-graph-link-degradation-description" }}
              />
            )}
          </>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            disabled={!result.changed || !!result.error}
            onClick={() => onSave(relation.id, result.attributes)}
            data-testid="asset-graph-link-save"
          >
            {t("common.save", { defaultValue: "Save" })}
          </Button>
          <Button size="small" disabled={!result.changed} onClick={() => setDraft(draftOf(relation))}>
            {t("common.reset", { defaultValue: "Reset" })}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
