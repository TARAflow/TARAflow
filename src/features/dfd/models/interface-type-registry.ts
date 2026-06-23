import type { InterfaceType } from "./element-properties";
import type { InterfaceProperties } from "./element-properties";

/** Subset of connectorType values valid for a given interface type. */
export type ConnectorType = NonNullable<InterfaceProperties["connectorType"]>;

// ==================== INTERFACE TYPE REGISTRY ====================
// Modelled after protocol-registry.ts — same pattern, same shape.
// Used by interface-description-form.tsx to render grouped Select options
// and by validators to access type metadata (riskLevel, isDebug, etc.).

export type InterfaceTypeGroup =
  | "network" // Wired/wireless network interfaces
  | "serial" // Serial bus interfaces (industrial + embedded)
  | "usb" // USB (all classes)
  | "debug" // Debug / programming interfaces (JTAG, SWD)
  | "io" // Digital and analog I/O
  | "hmi" // Human-machine interface (touch, keypad)
  | "other";     // Custom / not listed

export const INTERFACE_TYPE_META: Record<
  InterfaceType,
  {
    group: InterfaceTypeGroup;
    labelKey: string;
    riskLevel?: "low" | "medium" | "high";
    /** True = physical access required to reach this interface */
    requiresPhysicalAccess?: boolean;
    /** True = used for debug/programming — generates debug-specific threats */
    isDebug?: boolean;
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
    validConnectors: ["rj45", "sfp", "m12"],
  },
  wifi: {
    group: "network",
    labelKey: "wifi",
    riskLevel: "high",
    requiresPhysicalAccess: false,
    validConnectors: [],
  },
  bluetooth: {
    group: "network",
    labelKey: "bluetooth",
    riskLevel: "high",
    requiresPhysicalAccess: false,
    validConnectors: [],
  },
  nfc: {
    group: "network",
    labelKey: "nfc",
    riskLevel: "medium",
    requiresPhysicalAccess: false,
    validConnectors: [],
  },
  fiber: {
    group: "network",
    labelKey: "fiber",
    riskLevel: "low",
    requiresPhysicalAccess: true,
    validConnectors: ["sfp"],
  },

  // ── Serial / Bus ──────────────────────────────────────────────────────────
  uart: {
    group: "serial",
    labelKey: "uart",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    validConnectors: ["db9", "terminal", "gpio_header"],
  },
  rs232: {
    group: "serial",
    labelKey: "rs232",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    validConnectors: ["db9", "db25"],
  },
  rs485: {
    group: "serial",
    labelKey: "rs485",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  can: {
    group: "serial",
    labelKey: "can",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal", "db9", "m12"],
  },
  i2c: {
    group: "serial",
    labelKey: "i2c",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    validConnectors: ["gpio_header", "terminal"],
  },
  spi: {
    group: "serial",
    labelKey: "spi",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    validConnectors: ["gpio_header"],
  },
  lin: {
    group: "serial",
    labelKey: "lin",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal"],
  },

  // ── USB ───────────────────────────────────────────────────────────────────
  usb: {
    group: "usb",
    labelKey: "usb",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    validConnectors: ["usb_a", "usb_c", "micro_usb"],
  },

  // ── Debug / Programming ───────────────────────────────────────────────────
  jtag: {
    group: "debug",
    labelKey: "jtag",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    validConnectors: ["jtag_20pin", "gpio_header"],
  },
  swd: {
    group: "debug",
    labelKey: "swd",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  swd_swo: {
    group: "debug",
    labelKey: "swd_swo",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    validConnectors: ["swd_10pin", "gpio_header"],
  },
  jtag_trace: {
    group: "debug",
    labelKey: "jtag_trace",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    isDebug: true,
    validConnectors: ["jtag_20pin", "gpio_header"],
  },

  // ── Digital / Analog I/O ─────────────────────────────────────────────────
  gpio: {
    group: "io",
    labelKey: "gpio",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    validConnectors: ["gpio_header", "terminal"],
  },
  analog_in: {
    group: "io",
    labelKey: "analog_in",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  analog_out: {
    group: "io",
    labelKey: "analog_out",
    riskLevel: "high",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },
  pwm: {
    group: "io",
    labelKey: "pwm",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    safetyRelevant: true,
    validConnectors: ["terminal", "gpio_header"],
  },

  // ── Human-Machine Interface ───────────────────────────────────────────────
  touchscreen: {
    group: "hmi",
    labelKey: "touchscreen",
    riskLevel: "low",
    // Operating the touch surface requires physical presence at the device.
    requiresPhysicalAccess: true,
    // Integrated surface — no pluggable connector (like wifi/nfc).
    validConnectors: [],
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  custom: {
    group: "other",
    labelKey: "custom",
    riskLevel: "medium",
    requiresPhysicalAccess: true,
    validConnectors: ["custom"],
  },
};