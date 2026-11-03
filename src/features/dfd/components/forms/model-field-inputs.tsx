// ==================== MODEL FIELD INPUTS ====================
// The model coverage fields of an element (shared/models/property-visibility.ts,
// model-coverage-implementation-plan.md §3): rendered from the registry into
// the Security sub-tabs (security-tabs.tsx), shown only when the field's
// predicate holds for the element in its model — its flows and neighbours
// included, which the element form alone does not know. The DFD tab provides
// the model (ModelFieldProvider); without it no field is shown. A hidden
// field keeps its value in the file (K-7).
//
// Values: only those that fit the element (ModelField.valuesFor); a stored
// value outside them stays selectable so it can be seen and changed.
// Texts: dfd.json tabs.dfd.modelFields.<property>.{label, help, values.*}.

import React, { createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormControl, Grid, InputLabel, MenuItem, Select, Tooltip } from "@mui/material";
import type { SecurityEntry } from "./security-tabs";
import {
  isFieldShown,
  isUnset,
  MODEL_FIELDS,
  visibilityContexts,
  type ModelField,
  type VisibilityContext,
  type VisibilityElement,
  type VisibilityFlowInput,
} from "shared";

type ContextOf = (id: string) => VisibilityContext | undefined;

const ModelFieldContext = createContext<ContextOf | null>(null);

/** Gives the element forms below it the model the field predicates read. */
export const ModelFieldProvider: React.FC<{
  elements: readonly VisibilityElement[];
  connections: readonly VisibilityFlowInput[];
  /** Component under evaluation (Compliance tab): settings of the whole component are asked on it. */
  componentId?: string;
  /** Multiprocesses with a child page (leveled DFD) — the others are black boxes (D-30c). */
  decomposed?: ReadonlySet<string>;
  children: React.ReactNode;
}> = ({ elements, connections, componentId, decomposed, children }) => {
  const contextOf = useMemo(
    () => visibilityContexts(elements, connections, { componentId, decomposed }),
    [elements, connections, componentId, decomposed],
  );
  return <ModelFieldContext.Provider value={contextOf}>{children}</ModelFieldContext.Provider>;
};

/**
 * The element in its model, with the properties the form currently shows;
 * undefined without the DFD tab's model (then no model field is shown).
 */
export function useElementVisibilityContext(element: VisibilityElement): VisibilityContext | undefined {
  const contextOf = useContext(ModelFieldContext);
  return useMemo(() => {
    const base = contextOf?.(element.id);
    return base ? { ...base, element: { id: element.id, type: element.type, properties: element.properties } } : undefined;
  }, [contextOf, element.id, element.type, element.properties]);
}

/** Values the select offers: the fitting ones, plus a stored one outside them. */
function offeredValues(field: ModelField, context: VisibilityContext, stored: unknown): string[] {
  const fitting = [...(field.valuesFor?.(context) ?? field.values.slice(1))];
  const storedValues = (Array.isArray(stored) ? stored : [stored]).filter((v): v is string => typeof v === "string" && !isUnset(v));
  for (const v of storedValues) if (!fitting.includes(v)) fitting.push(v);
  return fitting;
}

type FieldChange = (property: string, value: string | string[] | undefined) => void;

const ModelFieldSelect: React.FC<{
  field: ModelField;
  context: VisibilityContext;
  stored: unknown;
  onChange: FieldChange;
}> = ({ field, context, stored, onChange }) => {
  const { t } = useTranslation();
  const base = `tabs.dfd.modelFields.${field.property}`;
  const label = t(`${base}.label`, { defaultValue: field.property });
  const values = offeredValues(field, context, stored);
  const valueLabel = (v: string) => t(`${base}.values.${v}`, { defaultValue: v });
  return (
    <Grid item xs={12} sm={6}>
      <Tooltip title={t(`${base}.help`, { defaultValue: "" })} placement="top" arrow>
        <FormControl fullWidth size="small" data-testid={`model-field-${field.property}`}>
          <InputLabel>{label}</InputLabel>
          {field.multiple ? (
            <Select
              multiple
              value={Array.isArray(stored) ? (stored as string[]) : []}
              onChange={(e) => {
                const next = e.target.value as string[];
                onChange(field.property, next.length ? next : undefined);
              }}
              renderValue={(selected) => (selected as string[]).map(valueLabel).join(", ")}
              label={label}
            >
              {values.map((v) => (
                <MenuItem key={v} value={v}>
                  {valueLabel(v)}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Select
              value={typeof stored === "string" && !isUnset(stored) ? stored : ""}
              onChange={(e) => onChange(field.property, (e.target.value as string) || undefined)}
              label={label}
            >
              <MenuItem value="">
                <em>{t("common.not_specified", { defaultValue: "Not specified" })}</em>
              </MenuItem>
              {values.map((v) => (
                <MenuItem key={v} value={v}>
                  {valueLabel(v)}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Tooltip>
    </Grid>
  );
};

/**
 * The registry's fields as entries of the Security sub-tabs (CM-5d): every
 * field of the element's type, visible where its predicate holds.
 */
export function useModelFieldEntries(element: VisibilityElement, onChange: FieldChange): SecurityEntry[] {
  const context = useElementVisibilityContext(element);
  if (!context) return [];
  return MODEL_FIELDS.filter((f) => f.elementTypes.includes(element.type)).map((field) => {
    const stored = element.properties?.[field.property];
    return {
      key: field.property,
      group: field.group,
      visible: isFieldShown(field, context),
      set: !isUnset(stored),
      node: <ModelFieldSelect field={field} context={context} stored={stored} onChange={onChange} />,
    };
  });
}
