// ==================== INTERFACE CAPABILITY REGISTRY (SHARED) ====================
// Security-relevant capability axes per InterfaceType, and the applicability
// check derived from them.
//
// Lives in src/shared because both features/dfd (form gating) and
// features/threats (threat-gen suppression, stride-modifier.ts) need it, and
// those two features must never import each other directly.
//
// UI-only metadata (group, labelKey, riskLevel, validConnectors, ...) stays in
// features/dfd/models/interface-type-registry.ts, which imports
// INTERFACE_CAPABILITY from here and spreads it into its richer
// INTERFACE_TYPE_META — single source of truth for the axis VALUES, no
// duplication.
//
// NOTE: `InterfaceType` is duplicated here (structurally, not nominally) from
// features/dfd/models/element-properties.ts, since shared must not import
// from a feature. Keep the two lists in sync until element-properties.ts is
// changed to re-export this one. TODO: verify this file is wired into
// src/shared's barrel export (index.ts) if the project's convention is to
// import only from the bare "shared" specifier — the rest of the codebase
// imports like `from "shared"`, not `from "shared/models/..."`.

export type InterfaceType =
  | "ethernet"
  | "wifi"
  | "bluetooth"
  | "nfc"
  | "fiber"
  | "uart"
  | "rs232"
  | "rs485"
  | "can"
  | "i2c"
  | "spi"
  | "lin"
  | "usb"
  | "jtag"
  | "swd"
  | "swd_swo"
  | "jtag_trace"
  | "gpio"
  | "analog_in"
  | "analog_out"
  | "pwm"
  | "touchscreen"
  | "custom";

export interface InterfaceCapability {
  /** Physical access required to reach this interface. Gates physicalAccessProtection. */
  requiresPhysicalAccess?: boolean;
  /** IS a dedicated debug/programming interface (JTAG/SWD family). */
  isDebug?: boolean;
  /** CAN carry a debug/bootloader console (broader than isDebug — e.g. uart/usb). Gates debugProtection. */
  debugCapable?: boolean;
  /** Has a physical conductor/cable medium whose signal can be shielded/tapped. Gates signalProtection. */
  cabled: boolean;
  /** Carries a link-layer authentication concept (WPA, pairing). Gates linkAuthentication. */
  hasLinkAuth: boolean;
}

export const INTERFACE_CAPABILITY: Record<InterfaceType, InterfaceCapability> = {
  ethernet: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  wifi: { requiresPhysicalAccess: false, cabled: false, hasLinkAuth: true },
  bluetooth: {
    requiresPhysicalAccess: false,
    cabled: false,
    hasLinkAuth: true,
  },
  // OQ1 resolved: NFC's ~10cm range means an attacker must be physically
  // present at the device, so physicalAccessProtection IS applicable (physical
  // tamper threats stand). Still not `cabled` — no conductor to shield/tap, so
  // signalProtection stays n/a.
  nfc: { requiresPhysicalAccess: true, cabled: false, hasLinkAuth: true },
  fiber: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  uart: {
    requiresPhysicalAccess: true,
    debugCapable: true, // bootloader console, e.g. u-boot
    cabled: true,
    hasLinkAuth: false,
  },
  rs232: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  rs485: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  can: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  i2c: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  spi: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  lin: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  usb: {
    requiresPhysicalAccess: true,
    debugCapable: true, // DFU / debug console
    cabled: true,
    hasLinkAuth: false,
  },
  jtag: {
    requiresPhysicalAccess: true,
    isDebug: true,
    debugCapable: true,
    cabled: true,
    hasLinkAuth: false,
  },
  swd: {
    requiresPhysicalAccess: true,
    isDebug: true,
    debugCapable: true,
    cabled: true,
    hasLinkAuth: false,
  },
  swd_swo: {
    requiresPhysicalAccess: true,
    isDebug: true,
    debugCapable: true,
    cabled: true,
    hasLinkAuth: false,
  },
  jtag_trace: {
    requiresPhysicalAccess: true,
    isDebug: true,
    debugCapable: true,
    cabled: true,
    hasLinkAuth: false,
  },
  gpio: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  analog_in: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  analog_out: {
    requiresPhysicalAccess: true,
    cabled: true,
    hasLinkAuth: false,
  },
  pwm: { requiresPhysicalAccess: true, cabled: true, hasLinkAuth: false },
  touchscreen: {
    // Operating the touch surface requires physical presence at the device.
    requiresPhysicalAccess: true,
    // Integrated surface — no external conductor to shield/tap.
    cabled: false,
    // No link-layer auth; auth lives in the Process behind the surface.
    hasLinkAuth: false,
  },
  // Permissive defaults — unknown type, keep all controls available.
  custom: {
    requiresPhysicalAccess: true,
    debugCapable: true,
    cabled: true,
    hasLinkAuth: true,
  },
};

/**
 * The subset of interface controls whose applicability is a pure function of
 * type (capability), not of current property values (usage). Shared between
 * form gating (features/dfd) and threat-gen suppression (features/threats).
 *
 * `serviceAccessPolicy` / `monitoringControl` are NOT here — their gating
 * (integrated-HMI-surface exclusion) depends on UI-only `group` metadata and
 * currently has no threat-gen consumer; kept local to
 * features/dfd/models/interface-type-registry.ts.
 *
 * `abuseProtection` is intentionally absent — its home (interface vs.
 * flow/protocol terminus) is open question OQ3.
 */
export type InterfaceControlKey =
  | "physicalAccessProtection"
  | "signalProtection"
  | "debugProtection"
  | "linkAuthentication";

/**
 * Is `key` a meaningful control for interfaces of `type`?
 * Single source of truth for both form field gating and threat-gen
 * suppression (n/a must never emit a control-gap threat).
 */
export function isControlApplicable(
  type: InterfaceType,
  key: InterfaceControlKey,
): boolean {
  const cap = INTERFACE_CAPABILITY[type];
  switch (key) {
    case "physicalAccessProtection":
      return cap.requiresPhysicalAccess === true;
    case "signalProtection":
      return cap.cabled === true;
    case "debugProtection":
      return cap.debugCapable === true;
    case "linkAuthentication":
      return cap.hasLinkAuth === true;
    default:
      // Exhaustiveness guard — a new key must extend this switch.
      return ((_: never) => false)(key);
  }
}