// ==================== CONTROL VALUE SEMANTICS ====================
// Closed-loop review CL-1 (doc/Done/Threat/closed-loop-review.md): when
// does a DFD property value meet a control's expected value? One answer for
// the SHOULD derivation, the drift check, the coverage badge and the DFD
// notification panel (each used to carry its own isEmptyValue).
//
//   met    the value is the expected one, or one listed as meeting it
//          (a stronger or equivalent control — decision 2)
//   empty  nothing is set: undefined, "", "none", "not_*", "unknown", "no", false
//   other  something else is set (weaker or different)
//
// Equality is checked first, so an expected value that is itself an "empty"
// word ("none", false) can be met (finding 4).

export type ControlValueState = "met" | "empty" | "other";

const EMPTY_VALUES = new Set<unknown>([
  undefined,
  null,
  "",
  "none",
  "no",
  "unknown",
  "not_specified",
  "not_defined",
  "not_assessed",
  false,
]);

export function isEmptyControlValue(value: unknown): boolean {
  return EMPTY_VALUES.has(value);
}

/**
 * property → expected value → further values that meet it. Only where the
 * order is unambiguous (decision 2); everything else needs the exact value.
 * Keyed by the property name (the leaf of "implementedControls.x"), the
 * same scale wherever the property occurs. Proposed in CL-1 for review; the
 * catalog test checks every value against the DFD options.
 */
export const CONTROL_VALUE_MEETS: Readonly<Record<string, Readonly<Record<string, readonly unknown[]>>>> = {
  integrityProtection: {
    // a MAC or better; aead authenticates too. A signature needs a signature
    // (non-repudiation), aead does not give it.
    hmac: ["signature", "aead"],
  },
  encryptionInTransit: {
    tls: ["mtls"],
    custom: ["tls", "mtls", "vpn"],
  },
  endpointAuthentication: {
    certificate: ["mutual_tls"],
  },
  authenticatorStorage: {
    tpm: ["secure_element", "hsm"],
    secure_element: ["hsm"],
  },
  authenticationRequired: {
    yes: ["oauth", "saml", "certificate", "apikey", "jwt", "mtls"],
    certificate: ["mtls"],
  },
  accessControlMechanism: {
    process_enforced: ["mpu_protected"],
  },
  firmwareProtection: {
    rdp_level1: ["rdp_level2"],
  },
  tamperProtection: {
    switch: ["mesh", "active_detection"],
  },
  physicalAccessControl: {
    badge_pin: ["biometric"],
  },
  physicalPathProtection: {
    cable_duct: ["conduit", "armored_cable", "buried"],
  },
  debugProtection: {
    auth_required: ["fused_off"],
    readout_protection: ["fused_off"],
  },
  linkAuthentication: {
    pre_shared_key: ["certificate_based", "mutual_pairing"],
  },
  physicalAccessProtection: {
    inside_enclosure: ["locked_panel", "sealed"],
  },
  operationalState: {
    hw_disabled: ["permanent_disabled"],
  },
  monitoringControl: {
    alerted: ["active_response"],
  },
  backupMechanism: {
    automated_remote: ["redundant_system"],
  },
  inputValidation: {
    strict: ["schema"],
  },
  failSafeOutputState: {
    // a deterministic output state (CR 3.6); "dynamic" is not one
    fixed_value: ["unpowered", "hold_last_value"],
  },
  authorizationModel: {
    acl: ["rbac", "abac"],
    rbac: ["abac"],
  },
  cryptoStandard: {
    nist_approved: ["fips_140_2", "fips_140_3"],
  },
  defaultDenyPolicy: {
    deny_all_permit_exception: ["island_mode"],
  },
};

const leaf = (property: string) => property.slice(property.lastIndexOf(".") + 1);

export function controlValueState(property: string, current: unknown, expected: unknown): ControlValueState {
  if (current === expected) return "met";
  if (typeof expected === "string" && (CONTROL_VALUE_MEETS[leaf(property)]?.[expected] ?? []).includes(current)) {
    return "met";
  }
  return isEmptyControlValue(current) ? "empty" : "other";
}

export const meetsExpected = (property: string, current: unknown, expected: unknown): boolean =>
  controlValueState(property, current, expected) === "met";

// ==================== NESTED PROPERTIES ====================
// Interface controls live in `properties.implementedControls.<key>` while the
// catalog names them "implementedControls.<key>" (finding 8: they were read and
// applied as one flat key, so the form never saw an applied value and the
// closed loop read its own stray key).

type Props = Record<string, unknown> | null | undefined;

/** The value at a dotted property path; a legacy flat key as fallback. */
export function readControlValue(props: Props, property: string): unknown {
  if (!props) return undefined;
  if (!property.includes(".")) return props[property];
  let node: unknown = props;
  for (const key of property.split(".")) {
    node = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
  }
  return node !== undefined ? node : props[property];
}

/** The properties update that sets a (dotted) property, keeping its siblings. */
export function controlValuePatch(props: Props, property: string, value: unknown): Record<string, unknown> {
  const keys = property.split(".");
  const build = (node: unknown, i: number): unknown => {
    if (i === keys.length) return value;
    const base = node && typeof node === "object" ? (node as Record<string, unknown>) : {};
    return { ...base, [keys[i]]: build(base[keys[i]], i + 1) };
  };
  return { [keys[0]]: build(props?.[keys[0]], 1) };
}
