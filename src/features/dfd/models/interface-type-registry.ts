import type { InterfaceType } from "./element-properties";
import type { InterfaceProperties } from "./element-properties";
import {
  INTERFACE_CAPABILITY,
  isControlApplicable as isSharedControlApplicable,
  type InterfaceControlKey as SharedInterfaceControlKey,
} from "shared/models/interface-capability-registry";

/** Subset of connectorType values valid for a given interface type. */
export type ConnectorType = NonNullable<InterfaceProperties["connectorType"]>;

// ==================== INTERFACE TYPE REGISTRY ====================
// Modelled after protocol-registry.ts — same pattern, same shape.
// Used by interface-description-form.tsx to render grouped Select options
// and by validators to access type metadata (riskLevel, isDebug, etc.).
//
// Phase A0 (capability axes): this registry is the SINGLE SOURCE OF TRUTH for
// which interface controls apply to a given type. Two axes already existed
// (requiresPhysicalAccess, isDebug); cabled and hasLinkAuth were added in A0.
// debugCapable was added later to separate "IS a dedicated debug interface"
// (isDebug — drives grouping/labeling) from "CAN carry a debug console"
// (debugCapable — gates the debugProtection field; broader, e.g. uart/usb
// bootloader consoles). `isControlApplicable` (bottom of file) reads all five.

export type InterfaceTypeGroup =
  | "network" // Wired/wireless network interfaces
  | "serial" // Serial bus interfaces (industrial + embedded)
  | "usb" // USB (all classes)
  | "debug" // Debug / programming interfaces (JTAG, SWD)
  | "io" // Digital and analog I/O
  | "hmi" // Human-machine interface (touch, keypad)
  | "other"; // Custom / not listed

/**
 * UI-only metadata per interface type — grouping, labels, risk defaults,
 * connector options. The security-relevant capability axes (requiresPhysicalAccess,
 * cabled, isDebug, debugCapable, hasLinkAuth) are NOT duplicated here — they're
 * spread in from `INTERFACE_CAPABILITY` (src/shared), the single source of
 * truth shared with features/threats' stride-modifier.ts.
 */
export const INTERFACE_TYPE_META: Record<
  InterfaceType,
  (typeof INTERFACE_CAPABILITY)[InterfaceType] & {
    group: InterfaceTypeGroup;
    labelKey: string;
    riskLevel?: "low" | "medium" | "high";
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
    ...INTERFACE_CAPABILITY.ethernet,
    group: "network",
    labelKey: "ethernet",
    riskLevel: "medium",
    validConnectors: ["rj45", "sfp", "m12"],
  },
  wifi: {
    ...INTERFACE_CAPABILITY.wifi,
    group: "network",
    labelKey: "wifi",
    riskLevel: "high",
    validConnectors: [],
  },
  bluetooth: {
    ...INTERFACE_CAPABILITY.bluetooth,
    group: "network",
    labelKey: "bluetooth",
    riskLevel: "high",
    validConnectors: [],
  },
  nfc: {
    ...INTERFACE_CAPABILITY.nfc,
    group: "network",
    labelKey: "nfc",
    riskLevel: "medium",
    validConnectors: [],
  },
  fiber: {
    ...INTERFACE_CAPABILITY.fiber,
    group: "network",
    labelKey: "fiber",
    riskLevel: "low",
    validConnectors: ["sfp"],
  },

  // ── Serial / Bus ──────────────────────────────────────────────────────────
  uart: {
    ...INTERFACE_CAPABILITY.uart,
    group: "serial",
    labelKey: "uart",
    riskLevel: "high",
    validConnectors: ["db9", "terminal", "gpio_header"],
  },
  rs232: {
    ...INTERFACE_CAPABILITY.rs232,
    group: "serial",
    labelKey: "rs232",
    riskLevel: "high",
    validConnectors: ["db9", "db25"],
  },
  rs485: {
    ...INTERFACE_CAPABILITY.rs485,
    group: "serial",
    labelKey: "rs485",
    riskLevel: "high",
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  can: {
    ...INTERFACE_CAPABILITY.can,
    group: "serial",
    labelKey: "can",
    riskLevel: "high",
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  i2c: {
    ...INTERFACE_CAPABILITY.i2c,
    group: "serial",
    labelKey: "i2c",
    riskLevel: "medium",
    validConnectors: ["gpio_header", "terminal"],
  },
  spi: {
    ...INTERFACE_CAPABILITY.spi,
    group: "serial",
    labelKey: "spi",
    riskLevel: "medium",
    validConnectors: ["gpio_header"],
  },
  lin: {
    ...INTERFACE_CAPABILITY.lin,
    group: "serial",
    labelKey: "lin",
    riskLevel: "high",
    safetyRelevant: true,
    validConnectors: ["terminal"],
  },

  // ── USB ───────────────────────────────────────────────────────────────────
  usb: {
    ...INTERFACE_CAPABILITY.usb,
    group: "usb",
    labelKey: "usb",
    riskLevel: "high",
    validConnectors: ["usb_a", "usb_c", "micro_usb"],
  },

  // ── Debug / Programming ───────────────────────────────────────────────────
  jtag: {
    ...INTERFACE_CAPABILITY.jtag,
    group: "debug",
    labelKey: "jtag",
    riskLevel: "high",
    validConnectors: ["jtag_20pin", "gpio_header"],
  },
  swd: {
    ...INTERFACE_CAPABILITY.swd,
    group: "debug",
    labelKey: "swd",
    riskLevel: "high",
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  swd_swo: {
    ...INTERFACE_CAPABILITY.swd_swo,
    group: "debug",
    labelKey: "swd_swo",
    riskLevel: "high",
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  jtag_trace: {
    ...INTERFACE_CAPABILITY.jtag_trace,
    group: "debug",
    labelKey: "jtag_trace",
    riskLevel: "high",
    validConnectors: ["jtag_20pin", "gpio_header"],
  },

  // ── Digital / Analog I/O ─────────────────────────────────────────────────
  gpio: {
    ...INTERFACE_CAPABILITY.gpio,
    group: "io",
    labelKey: "gpio",
    riskLevel: "medium",
    validConnectors: ["gpio_header", "terminal"],
  },
  analog_in: {
    ...INTERFACE_CAPABILITY.analog_in,
    group: "io",
    labelKey: "analog_in",
    riskLevel: "medium",
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  analog_out: {
    ...INTERFACE_CAPABILITY.analog_out,
    group: "io",
    labelKey: "analog_out",
    riskLevel: "high",
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  pwm: {
    ...INTERFACE_CAPABILITY.pwm,
    group: "io",
    labelKey: "pwm",
    riskLevel: "medium",
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },

  // ── Human-Machine Interface ───────────────────────────────────────────────
  touchscreen: {
    ...INTERFACE_CAPABILITY.touchscreen,
    group: "hmi",
    labelKey: "touchscreen",
    riskLevel: "low",
    validConnectors: [],
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  custom: {
    ...INTERFACE_CAPABILITY.custom,
    group: "other",
    labelKey: "custom",
    riskLevel: "medium",
    validConnectors: ["custom"],
  },
};


// ==================== CONTROL APPLICABILITY ====================
//
// Applicability is DERIVED from capability data — never stored on the element,
// never expressed as an "n/a" enum value. A control is `n/a` for a given
// interface type iff `isControlApplicable(type, key) === false`.
//
// Four of the six keys delegate to the SHARED registry (src/shared), which is
// also consumed by features/threats/utils/stride-modifier.ts for threat-gen
// suppression — single source of truth, no drift between form and generator.
// `serviceAccessPolicy` / `monitoringControl` stay local: their gating uses
// UI-only `group` metadata that has no reason to live in shared (no
// threat-gen consumer today).
//
// `abuseProtection` is intentionally NOT gated here — its home (interface vs.
// flow/protocol terminus) is open question OQ3, resolved in Phase A2.
// `logicalAccessControl` is intentionally absent — it was removed in Phase A1
// (auth lives on Flow.endpointAuthentication + Process.authenticationRequired;
// link-layer auth on Interface.linkAuthentication).

export type InterfaceControlKey =
  | SharedInterfaceControlKey
  | "serviceAccessPolicy"
  | "monitoringControl";

/**
 * Is `key` a meaningful control for interfaces of `type`?
 * Callers (form, threat-gen) must check this before showing a field or
 * emitting a control-gap threat, so that a non-applicable control is treated
 * as `n/a` (no threat) rather than `none` (gap → threat).
 */
export function isControlApplicable(
  type: InterfaceType,
  key: InterfaceControlKey,
): boolean {
  switch (key) {
    case "physicalAccessProtection":
    case "signalProtection":
    case "debugProtection":
    case "linkAuthentication":
      return isSharedControlApplicable(type, key);
    case "serviceAccessPolicy":
      // No gateable "service state" concept for an integrated HMI surface
      // (no maintenance/factory mode in which touch is off), nor for passive
      // analog/digital I/O (no protocol/service to gate — prior NO_AUTH_INTERFACES).
      return (
        INTERFACE_TYPE_META[type].group !== "hmi" &&
        INTERFACE_TYPE_META[type].group !== "io"
      );
    case "monitoringControl":
      // hmi: would overlap with physicalAccessProtection's tamper_evident
      // rather than covering anything distinct.
      // io: passive analog/digital I/O has no logical protocol to monitor
      // (prior NO_AUTH_INTERFACES).
      return (
        INTERFACE_TYPE_META[type].group !== "hmi" &&
        INTERFACE_TYPE_META[type].group !== "io"
      );
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
  "serviceAccessPolicy",
  "monitoringControl",
];