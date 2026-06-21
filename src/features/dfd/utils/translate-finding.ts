// ==================== VALIDATION FINDING TRANSLATION ====================
// Single Responsibility: turn a ValidationFinding (raw i18n key + params)
// into a human-readable, language-reactive string.
//
// Extracted out of dfd-notification-panel.tsx so every consumer of
// ValidationFinding[] (the DFD notification panel, the General/Overview
// tab summary, future exports, ...) shares the exact same resolution
// rules instead of re-implementing them. Adding a new validation rule
// never requires touching this file: as long as its param names match an
// existing convention below (or need no resolution at all), it just
// works. Only a genuinely new *kind* of identifier needs a new entry in
// PARAM_RESOLVERS.
//
// `params` are i18next interpolation values — almost always passed
// straight through. A small, fixed set of param *names* additionally
// needs a second i18n lookup, because the value itself is an identifier
// (an element type, a field name, an enum option) rather than already
// human-readable text:
//
//   type / elementType / targetType / interfaceType / connectorType
//       → dfdValidation.elementTypes.<value>
//   field  (always paired with a sibling `elementType` param)
//       → tabs.dfd.element_description.<ns(elementType)>.fields.<field>.label
//   expectedFrequency / gotFrequency
//       → tabs.dfd.element_description.dataflow.fields.frequency.options.<value>
//   expectedMessageType / gotMessageType
//       → tabs.dfd.element_description.dataflow.fields.messageType.options.<value>

import type { ValidationFinding } from "../models/dfd-types";

// DFD element type -> i18n namespace key under element_description
const ELEMENT_TYPE_NS: Record<string, string> = {
  Process: "process",
  Multiprocess: "multiprocess",
  DataStore: "datastore",
  ExternalEntity: "external_entity",
  TrustBoundary: "trustboundary",
  ChipBoundary: "chipboundary",
  PhysicalBoundary: "physicalboundary",
  Interface: "interface",
  Sensor: "sensor",
  Actuator: "actuator",
};

// Shared field label keys — same as fieldTranslationKeys in
// dataflow-description-form.tsx. Checked first; per-type lookup is fallback.
const FIELD_SHARED_LABEL: Record<string, string> = {
  exposureLevel: "tabs.dfd.element_description.exposure_level.label",
  defaultExposureLevel: "tabs.dfd.element_description.exposure_level.label",
};

/** Minimal shape of react-i18next's `t` — avoids importing react-i18next here. */
export type TFn = (key: string, opts?: Record<string, unknown>) => string;

function elementTypeLabel(t: TFn, value: string): string {
  return t(`dfdValidation.elementTypes.${value}`, { defaultValue: value });
}

function fieldLabel(t: TFn, elementType: string, field: string): string {
  const sharedPath = FIELD_SHARED_LABEL[field];
  if (sharedPath) return t(sharedPath, { defaultValue: field });
  const ns = ELEMENT_TYPE_NS[elementType] ?? elementType.toLowerCase();
  return t(`tabs.dfd.element_description.${ns}.fields.${field}.label`, {
    defaultValue: field,
  });
}

function frequencyOptionLabel(t: TFn, value: string): string {
  return t(
    `tabs.dfd.element_description.dataflow.fields.frequency.options.${value}`,
    { defaultValue: value },
  );
}

function messageTypeOptionLabel(t: TFn, value: string): string {
  return t(
    `tabs.dfd.element_description.dataflow.fields.messageType.options.${value}`,
    { defaultValue: value },
  );
}

// Generic dispatch table: param name -> resolver. No message-shape
// branching, no parts.length guessing — just "does this param name need a
// second i18n lookup, and if so, which dictionary?"
const PARAM_RESOLVERS: Record<string, (t: TFn, value: string) => string> = {
  type: elementTypeLabel,
  elementType: elementTypeLabel,
  targetType: elementTypeLabel,
  interfaceType: elementTypeLabel,
  connectorType: elementTypeLabel,
  expectedFrequency: frequencyOptionLabel,
  gotFrequency: frequencyOptionLabel,
  expectedMessageType: messageTypeOptionLabel,
  gotMessageType: messageTypeOptionLabel,
};

function resolveParamValue(
  t: TFn,
  key: string,
  value: string,
  allParams: Record<string, unknown>,
): string {
  if (key === "field") {
    return fieldLabel(t, String(allParams.elementType ?? ""), value);
  }
  const resolver = PARAM_RESOLVERS[key];
  return resolver ? resolver(t, value) : value;
}

function resolveParams(
  t: TFn,
  finding: ValidationFinding,
): Record<string, string> {
  const raw = finding.params ?? {};
  const out: Record<string, string> = {};
  for (const [paramKey, value] of Object.entries(raw)) {
    out[paramKey] = Array.isArray(value)
      ? value.map((v) => resolveParamValue(t, paramKey, String(v), raw)).join(", ")
      : resolveParamValue(t, paramKey, String(value), raw);
  }
  return out;
}

/** Translate a single ValidationFinding into a human-readable string in the current language. */
export function translateFinding(t: TFn, finding: ValidationFinding): string {
  return t(finding.key, { ...resolveParams(t, finding), defaultValue: finding.key });
}

/** Translate a list of findings — convenience for places that just need string[] (e.g. the General/Overview tab summary). */
export function translateFindings(t: TFn, findings: ValidationFinding[]): string[] {
  return findings.map((f) => translateFinding(t, f));
}
