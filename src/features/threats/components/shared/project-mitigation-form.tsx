// features/threats/components/shared/project-mitigation-form.tsx
//
// New / edit a project mitigation M-C-nnn (custom mitigation catalog design
// CM-3): text, STRIDE category, optional attack vectors and the DFD effects
// that let the closed loop check it. Effects come from the vocabulary of the
// built-in catalog (target, property, value), always "heuristic". With an
// IEC 62443 edition active (IEC-8b) also the requirements the mitigation
// implements — for rows the model cannot show; those its effects meet already
// are listed, not stored.

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
import { ATTACK_VECTORS, type AttackVector, type StrideCategory } from "shared";
import { useMatrixRequirements } from "shared/hooks/matrix-requirements";
import type { MitigationPropertyEffect } from "../../models/threat-types";
import { getAllMitigations } from "../../services/threat-catalog-service";
import {
  effectVocabulary,
  projectEffect,
  type ProjectMitigationInput,
} from "../../services/project-mitigations";

const STRIDE: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];

const targetKey = (e: { targetType: string; role?: string }) => `${e.targetType}|${e.role ?? ""}`;
const valueLabel = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

export interface ProjectMitigationFormProps {
  open: boolean;
  /** Edit / convert: the values to start with. */
  initial?: Partial<ProjectMitigationInput>;
  /** Shown in the title when editing. */
  id?: string;
  onSave: (input: ProjectMitigationInput) => void;
  onClose: () => void;
}

export const ProjectMitigationForm: React.FC<ProjectMitigationFormProps> = ({ open, initial, id, onSave, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [stride, setStride] = useState<StrideCategory>("S");
  const [vectors, setVectors] = useState<AttackVector[]>([]);
  const [effects, setEffects] = useState<MitigationPropertyEffect[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const matrix = useMatrixRequirements();
  // effect row being composed
  const [target, setTarget] = useState("");
  const [property, setProperty] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setText(initial?.text ?? "");
    setDescription(initial?.description ?? "");
    setStride(initial?.strideCategory ?? "S");
    setVectors(initial?.attackVectors ?? []);
    setEffects(initial?.affectsProperties ?? []);
    setRequirements(initial?.iec62443 ?? []);
    setTarget("");
    setProperty("");
    setValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vocabulary = useMemo(() => effectVocabulary(getAllMitigations()), []);
  const targets = useMemo(
    () => [...new Map(vocabulary.map((v) => [targetKey(v), v])).values()],
    [vocabulary],
  );
  const properties = vocabulary.filter((v) => targetKey(v) === target);
  const chosen = properties.find((v) => v.property === property);
  const derived = useMemo(() => (matrix ? matrix.derivedFrom(effects) : []), [matrix, effects]);
  const optionLabel = (id: string) => matrix?.options.find((o) => o.id === id)?.label ?? id;

  const targetLabel = (v: { targetType: string; role?: string }) =>
    v.role
      ? `${v.targetType} (${t(`tabs.threats.projectMitigation.role.${v.role}`, { defaultValue: v.role })})`
      : v.targetType;

  const addEffect = () => {
    if (!chosen) return;
    const expected = chosen.values.find((x) => valueLabel(x) === value);
    if (expected === undefined) return;
    const next = projectEffect(chosen, expected);
    setEffects((p) => (p.some((e) => JSON.stringify(e) === JSON.stringify(next)) ? p : [...p, next]));
    setProperty("");
    setValue("");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="project-mitigation-form">
      <DialogTitle>
        {id
          ? t("tabs.threats.projectMitigation.editTitle", { defaultValue: "Project mitigation {{id}}", id })
          : t("tabs.threats.projectMitigation.newTitle", { defaultValue: "New project mitigation" })}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label={t("tabs.threats.projectMitigation.text", { defaultValue: "Mitigation *" })}
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            inputProps={{ "data-testid": "pm-text" }}
          />
          <TextField
            label={t("tabs.threats.projectMitigation.description", { defaultValue: "Description" })}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            fullWidth
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select
              size="small"
              label="STRIDE"
              value={stride}
              onChange={(e) => setStride(e.target.value as StrideCategory)}
              sx={{ minWidth: 100 }}
              inputProps={{ "data-testid": "pm-stride" }}
            >
              {STRIDE.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {t("tabs.threats.projectMitigation.vectors", { defaultValue: "Attack vectors (none = all)" })}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {ATTACK_VECTORS.map((v) => (
                  <Chip
                    key={v}
                    size="small"
                    label={v}
                    color={vectors.includes(v) ? "primary" : "default"}
                    variant={vectors.includes(v) ? "filled" : "outlined"}
                    onClick={() => setVectors((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2">
              {t("tabs.threats.projectMitigation.effects", { defaultValue: "Effect on the DFD (closed loop)" })}
            </Typography>
            {effects.length === 0 && (
              <Alert severity="info" sx={{ py: 0, my: 0.5 }}>
                {t("tabs.threats.projectMitigation.noEffects", {
                  defaultValue: "Without an effect the closed loop cannot check this mitigation.",
                })}
              </Alert>
            )}
            {effects.map((e, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={1} data-testid="pm-effect">
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {targetLabel(e)}: {e.property} = {valueLabel(e.expectedValue)}
                </Typography>
                <IconButton size="small" onClick={() => setEffects((p) => p.filter((_, j) => j !== i))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                select
                size="small"
                label={t("tabs.threats.projectMitigation.target", { defaultValue: "Element" })}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setProperty("");
                  setValue("");
                }}
                sx={{ minWidth: 150 }}
                inputProps={{ "data-testid": "pm-target" }}
              >
                {targets.map((v) => (
                  <MenuItem key={targetKey(v)} value={targetKey(v)}>
                    {targetLabel(v)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t("tabs.threats.projectMitigation.property", { defaultValue: "Property" })}
                value={property}
                disabled={!target}
                onChange={(e) => {
                  setProperty(e.target.value);
                  setValue("");
                }}
                sx={{ minWidth: 170, flexGrow: 1 }}
                inputProps={{ "data-testid": "pm-property" }}
              >
                {properties.map((v) => (
                  <MenuItem key={v.property} value={v.property}>
                    {v.property}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t("tabs.threats.projectMitigation.value", { defaultValue: "Value" })}
                value={value}
                disabled={!chosen}
                onChange={(e) => setValue(e.target.value)}
                sx={{ minWidth: 120 }}
                inputProps={{ "data-testid": "pm-value" }}
              >
                {(chosen?.values ?? []).map((x) => (
                  <MenuItem key={valueLabel(x)} value={valueLabel(x)}>
                    {valueLabel(x)}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton onClick={addEffect} disabled={!chosen || !value} data-testid="pm-add-effect">
                <AddIcon />
              </IconButton>
            </Stack>
          </Box>

          {matrix && (
            <Box data-testid="pm-requirements">
              <Typography variant="subtitle2">
                {t("tabs.threats.projectMitigation.requirements", { defaultValue: "IEC 62443-4-2 requirements it implements" })}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {t("tabs.threats.projectMitigation.requirementsHelp", {
                  defaultValue:
                    "For requirements the model cannot show (statements, documents, processes): chosen for a risk and done, the mitigation meets the row of the requirement matrix.",
                })}
              </Typography>
              <Autocomplete
                multiple
                size="small"
                options={matrix.options.map((o) => o.id)}
                value={requirements}
                onChange={(_, next) => setRequirements(next)}
                getOptionLabel={optionLabel}
                filterSelectedOptions
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("tabs.threats.projectMitigation.requirementsField", { defaultValue: "Requirements" })}
                    inputProps={{ ...params.inputProps, "data-testid": "pm-requirements-input" }}
                  />
                )}
              />
              {derived.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }} data-testid="pm-requirements-derived">
                  {t("tabs.threats.projectMitigation.requirementsDerived", { defaultValue: "Met through the effects already" })}:{" "}
                  {derived.map(optionLabel).join(", ")}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button
          variant="contained"
          disabled={!text.trim()}
          data-testid="pm-save"
          onClick={() =>
            onSave({
              text,
              strideCategory: stride,
              ...(description.trim() ? { description } : {}),
              ...(vectors.length ? { attackVectors: vectors } : {}),
              affectsProperties: effects,
              // Without an active 62443 edition the field is hidden: stored references stay.
              ...(matrix ? { iec62443: requirements } : {}),
            })
          }
        >
          {t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
