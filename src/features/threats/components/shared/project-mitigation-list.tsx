// features/threats/components/shared/project-mitigation-list.tsx
//
// Overview of the project mitigations M-C-nnn in the threat configuration
// dialog (custom mitigation catalog design CM-3): edit, merge into another
// entry, delete when unused. Changes apply at once (they touch threats, risks
// and attack trees, not only the configuration).

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { ProjectMitigation } from "../../models/threat-types";
import { ProjectMitigationForm } from "./project-mitigation-form";
import type { ProjectMitigationsApi } from "./project-mitigations-context";

export interface ProjectMitigationUsageSummary {
  threats: string[];
  risks: string[];
  attackTrees: string[];
}

export interface ProjectMitigationRefs {
  usage: (id: string) => ProjectMitigationUsageSummary;
  merge: (fromId: string, intoId: string) => void;
  remove: (id: string) => void;
}

export const ProjectMitigationList: React.FC<{
  api: ProjectMitigationsApi;
  refs?: ProjectMitigationRefs;
}> = ({ api, refs }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<ProjectMitigation | null>(null);

  return (
    <Box data-testid="project-mitigation-list">
      <Typography fontWeight="medium">
        {t("tabs.threats.projectMitigation.listTitle", { defaultValue: "Project mitigations" })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t("tabs.threats.projectMitigation.listHint", {
          defaultValue:
            "Your own mitigations (M-C-nnn), created in the threat dialogs. Changes here apply at once.",
        })}
      </Typography>
      {api.entries.length === 0 && <Typography color="text.secondary">–</Typography>}
      <Stack spacing={1}>
        {api.entries.map((m) => {
          const usage = refs?.usage(m.id);
          const used = usage ? usage.threats.length + usage.risks.length + usage.attackTrees.length > 0 : true;
          const usedBy = usage
            ? [
                ...usage.threats,
                ...usage.risks.map((r) => `${t("tabs.threats.projectMitigation.risk", { defaultValue: "Risk" })} ${r}`),
                ...usage.attackTrees,
              ]
            : [];
          return (
            <Paper key={m.id} variant="outlined" sx={{ p: 1 }} data-testid={`project-mitigation-${m.id}`}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={m.id} />
                <Chip size="small" variant="outlined" label={m.strideCategory} />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {m.text}
                </Typography>
                <Chip
                  size="small"
                  color={m.affectsProperties.length > 0 ? "success" : "default"}
                  variant="outlined"
                  label={t("tabs.threats.projectMitigation.effectCount", {
                    defaultValue: "{{count}} DFD effect(s)",
                    count: m.affectsProperties.length,
                  })}
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {usedBy.length > 0
                    ? `${t("tabs.threats.projectMitigation.usedBy", { defaultValue: "Used by" })}: ${usedBy.join(", ")}`
                    : t("tabs.threats.projectMitigation.unused", { defaultValue: "Not used" })}
                </Typography>
                <Button size="small" onClick={() => setEditing(m)} data-testid={`pm-edit-${m.id}`}>
                  {t("common.edit", { defaultValue: "Edit" })}
                </Button>
                {refs && api.entries.length > 1 && (
                  <TextField
                    select
                    size="small"
                    value=""
                    label={t("tabs.threats.projectMitigation.mergeInto", { defaultValue: "Merge into …" })}
                    onChange={(e) => refs.merge(m.id, e.target.value)}
                    sx={{ minWidth: 140 }}
                    inputProps={{ "data-testid": `pm-merge-${m.id}` }}
                  >
                    {api.entries
                      .filter((x) => x.id !== m.id)
                      .map((x) => (
                        <MenuItem key={x.id} value={x.id}>
                          {x.id}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
                {refs && (
                  <Tooltip
                    title={
                      used
                        ? t("tabs.threats.projectMitigation.deleteUsed", {
                            defaultValue: "Still used — remove it from the threats, risks and attack trees first, or merge it.",
                          })
                        : ""
                    }
                  >
                    <span>
                      <Button
                        size="small"
                        color="error"
                        disabled={used}
                        onClick={() => refs.remove(m.id)}
                        data-testid={`pm-delete-${m.id}`}
                      >
                        {t("common.delete", { defaultValue: "Delete" })}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
      <ProjectMitigationForm
        open={editing !== null}
        id={editing?.id}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (editing) api.update(editing.id, input);
          setEditing(null);
        }}
      />
    </Box>
  );
};
