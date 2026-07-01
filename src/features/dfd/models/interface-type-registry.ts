import type { InterfaceType } from "./element-properties";
import type { InterfaceProperties } from "./element-properties";

/** Subset of connectorType values valid for a given interface type. */
export type ConnectorType = NonNullable<InterfaceProperties["connectorType"]>;

// ==================== INTERFACE TYPE REGISTRY ====================
// Modelled after protocol-registry.ts — same pattern, same shape.
// Used by interface-description-form.tsx to render grouped Select options
// and by validators to access type metadata (riskLevel, isDebug, etc.).
//
// Phase A0 (capability axes): this registry is the SINGLE SOURCE OF TRUTH for
// which interface controls apply to a given type. Two axes already existed
// (requiresPhysicalAccess, isDebug); two were added (cabled, hasLinkAuth) so
// that control applicability is fully derivable here — no property comments,
// no parallel table. `isControlApplicable` (bottom of file) reads all four.

export type InterfaceTypeGroup =
  | "network" // Wired/wireless network interfaces
  | "serial" // Serial bus interfaces (industrial + embedded)
  | "usb" // USB (all classes)
  | "debug" // Debug / programming interfaces (JTAG, SWD)
  | "io" // Digital and analog I/O
  | "hmi" // Human-machine interface (touch, keypad)
  | "other"; // Custom / not listed

export const INTERFACE_TYPE_META: Record<
  InterfaceType,
  {
    group: InterfaceTypeGroup;
    labelKey: string;
    riskLevel?: "low" | "medium" | "high";
    /**
     * Capability axis — physicalReach.
     * True = physical access required to reach this interface.
     * Gates `physicalAccessProtection` applicability.
     */
    requiresPhysicalAccess?: boolean;
    /**
     * Capability axis — debuggable.
     * True = debug/programming interface — generates debug-specific threats.
     * Gates `debugProtection` applicability.
     */
    isDebug?: boolean;
    /**
     * Capability axis — cabled (NEW, A0).
     * True = the interface has a physical conductor/cable medium whose signal
     * can be shielded/isolated/tapped. Gates `signalProtection` applicability.
     * False for wireless (wifi/bluetooth/nfc) and for the integrated touch
     * surface (touchscreen).
     */
    cabled: boolean;
    /**
     * Capability axis — hasLinkAuth (NEW, A0).
     * True = the interface type itself carries a link-layer authentication
     * concept (WPA on wifi, pairing on bluetooth/nfc). Gates
     * `linkAuthentication` applicability. False for all wired/serial/debug/io
     * types — there authentication lives on the endpoint (Process /
     * Flow.endpointAuthentication), not on the link.
     */
    hasLinkAuth: boolean;
    safetyRelevant?: boolean;
    /**
     * Valid physical connectors for this interface type.
     * Empty array = no physical connector (wireless, NFC).
     * Used to filter the connectorType dropdown and validate combinations.
     * First entry = cascade default when type is selected.
     */
    validConnectors: ConnectorType[];
  }
> = {
  // ── Network / Wireless ────────────────────────────────────────────────────
  ethernet: {
    group: "network",
    labelKey: "ethernet",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["rj45", "sfp", "m12"],
  },
  wifi: {
    group: "network",
    labelKey: "wifi",
    riskLevel: "high",
    requiresPhysicalAccess: false,
    cabled: false,
    hasLinkAuth: true,
    validConnectors: [],
  },
  bluetooth: {
    group: "network",
    labelKey: "bluetooth",
    riskLevel: "high",
    requiresPhysicalAccess: false,
    cabled: false,
    hasLinkAuth: true,
    validConnectors: [],
  },
  nfc: {
    group: "network",
    labelKey: "nfc",
    riskLevel: "medium",
    // Proximity (~10 cm) — treated as physical reach for now (OQ1 open).
    requiresPhysicalAccess: false,
    cabled: false,
    hasLinkAuth: true,
    validConnectors: [],
  },
  fiber: {
    group: "network",
    labelKey: "fiber",
    riskLevel: "low",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["sfp"],
  },

  // ── Serial / Bus ──────────────────────────────────────────────────────────
  uart: {
    group: "serial",
    labelKey: "uart",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["db9", "terminal", "gpio_header"],
  },
  rs232: {
    group: "serial",
    labelKey: "rs232",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["db9", "db25"],
  },
  rs485: {
    group: "serial",
    labelKey: "rs485",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  can: {
    group: "serial",
    labelKey: "can",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  i2c: {
    group: "serial",
    labelKey: "i2c",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["gpio_header", "terminal"],
  },
  spi: {
    group: "serial",
    labelKey: "spi",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["gpio_header"],
  },
  lin: {
    group: "serial",
    labelKey: "lin",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal"],
  },

  // ── USB ───────────────────────────────────────────────────────────────────
  usb: {
    group: "usb",
    labelKey: "usb",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["usb_a", "usb_c", "micro_usb"],
  },

  // ── Debug / Programming ───────────────────────────────────────────────────
  jtag: {
    group: "debug",
    labelKey: "jtag",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["jtag_20pin", "gpio_header"],
  },
  swd: {
    group: "debug",
    labelKey: "swd",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  swd_swo: {
    group: "debug",
    labelKey: "swd_swo",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  jtag_trace: {
    group: "debug",
    labelKey: "jtag_trace",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["jtag_20pin", "gpio_header"],
  },

  // ── Digital / Analog I/O ─────────────────────────────────────────────────
  gpio: {
    group: "io",
    labelKey: "gpio",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    validConnectors: ["gpio_header", "terminal"],
  },
  analog_in: {
    group: "io",
    labelKey: "analog_in",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  analog_out: {
    group: "io",
    labelKey: "analog_out",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  pwm: {
    group: "io",
    labelKey: "pwm",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },

  // ── Human-Machine Interface ───────────────────────────────────────────────
  touchscreen: {
    group: "hmi",
    labelKey: "touchscreen",
    riskLevel: "low",
    // Operating the touch surface requires physical presence at the device.
    // → physicalAccessProtection APPLICABLE (lockable housing).
    requiresPhysicalAccess: true,
    // Integrated surface — no external conductor to shield/tap.
    // → signalProtection n/a.
    cabled: false,
    // No link-layer auth; any auth lives in the Process behind the surface.
    hasLinkAuth: false,
    // Integrated surface — no pluggable connector (like wifi/nfc).
    validConnectors: [],
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  custom: {
    group: "other",
    labelKey: "custom",
    riskLevel: "medium",
    // Permissive defaults — unknown type, keep all controls available.
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: true,
    validConnectors: ["custom"],
  },
};

// ==================== CONTROL APPLICABILITY (Phase A0) ====================
//
// Applicability is DERIVED from the capability axes above — never stored on the
// element, never expressed as an "n/a" enum value. A control is `n/a` for a
// given interface type iff `isControlApplicable(type, key) === false`.
//
// `abuseProtection` is intentionally NOT gated here — its home (interface vs.
// flow/protocol terminus) is open question OQ3, resolved in Phase A2.
// `logicalAccessControl` is intentionally absent — it is removed in Phase A1
// (auth lives on Flow.endpointAuthentication + Process.authenticationRequired;
// link-layer auth on the new Interface.linkAuthentication).

export type InterfaceControlKey =
  | "physicalAccessProtection"
  | "signalProtection"
  | "debugProtection"
  | "linkAuthentication";

/**
 * Is `key` a meaningful control for interfaces of `type`?
 * Reads the four capability axes on INTERFACE_TYPE_META — the single source of
 * truth. Callers (form, threat-gen) must check this before showing a field or
 * emitting a control-gap threat, so that a non-applicable control is treated as
 * `n/a` (no threat) rather than `none` (gap → threat).
 */
export function isControlApplicable(
  type: InterfaceType,
  key: InterfaceControlKey,
): boolean {
  const meta = INTERFACE_TYPE_META[type];
  switch (key) {
    case "physicalAccessProtection":
      return meta.requiresPhysicalAccess === true;
    case "signalProtection":
      return meta.cabled === true;
    case "debugProtection":
      return meta.isDebug === true;
    case "linkAuthentication":
      return meta.hasLinkAuth === true;
    default:
      // Exhaustiveness guard — a new key must extend this switch.
      return ((_: never) => false)(key);
  }
}

/** All interface control keys, for iteration in tests and the form view model. */
export const INTERFACE_CONTROL_KEYS: InterfaceControlKey[] = [
  "physicalAccessProtection",
  "signalProtection",
  "debugProtection",
  "linkAuthentication",
];