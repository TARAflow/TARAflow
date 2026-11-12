// ==================== MODEL FIELDS UNDER THEIR FORM LABELS ====================
// FX-21 / 0.19 i18n follow-up: a model path ("authenticatorStorage",
// "implementedControls.linkAuthentication") named under the DFD form's label
// in a language — the tab (UI language) and the report (document language)
// share the lookup. Keys of the dfd namespace; a path without a label falls
// back to its words.

import { words } from "./describe-requirement";

/** Element type → its block under tabs.dfd.element_description (dfd namespace). */
const DESCRIPTION_KEY: Readonly<Record<string, string>> = {
  ExternalEntity: "external_entity",
  DataFlow: "dataflow",
  DataStore: "datastore",
};

export interface DfdLabels {
  /** The text of a dfd-namespace key. */
  t: (key: string) => string;
  /** Whether the dfd namespace has the key. */
  exists: (key: string) => boolean;
}

/** A model path under the DFD form's label — of the given element types (the first that has one). */
export function fieldLabel(path: string, types: readonly string[], labels: DfdLabels): string {
  const last = path.split(".").pop() ?? path;
  const keys = [
    `tabs.dfd.modelFields.${last}.label`,
    ...types.flatMap((type) => {
      const block = `tabs.dfd.element_description.${DESCRIPTION_KEY[type] ?? type.toLowerCase()}.fields`;
      // implementedControls.linkAuthentication → the form's field linkAuthentication
      return [`${block}.${path}.label`, `${block}.${last}.label`];
    }),
    // a shared form section (exposureLevel → exposure_level)
    `tabs.dfd.element_description.${path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}.label`,
  ];
  const key = keys.find((k) => labels.exists(k));
  return key ? labels.t(key) : words(path);
}

/** An element type in a language (dfd namespace), as is without a text. */
export function elementTypeName(type: string, labels: DfdLabels): string {
  const key = `dfdValidation.elementTypes.${type}`;
  return labels.exists(key) ? labels.t(key) : type;
}

/** "MP-1 Controller (Password lifetime limit)" — an unknown element with the fields it lacks. */
export function unknownWithFields(name: string, fields: readonly string[], type: string | undefined, labels: DfdLabels): string {
  return fields.length > 0 ? `${name} (${fields.map((f) => fieldLabel(f, type ? [type] : [], labels)).join(", ")})` : name;
}
