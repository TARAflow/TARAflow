import type { Protocol } from "./element-properties";

export type ProtocolGroup =
  | "it"
  | "embedded"
  | "fieldbus"
  | "secure_ot"
  | "wireless"
  | "electrical"
  | "hmi"
  | "in_process";

export const PROTOCOL_META: Record<
  Protocol,
  {
    group: ProtocolGroup;
    labelKey: string;
    riskLevel?: "low" | "medium" | "high";
    safetyRelevant?: boolean;
  }
> = {
  // ── IT / Cloud ───────────────────────────────────────────────────────────
  http: { group: "it", labelKey: "http", riskLevel: "medium" },
  https: { group: "it", labelKey: "https", riskLevel: "low" },
  grpc: { group: "it", labelKey: "grpc" },
  mqtt: { group: "it", labelKey: "mqtt" },
  amqp: { group: "it", labelKey: "amqp" },
  websocket: { group: "it", labelKey: "websocket" },
  file: { group: "it", labelKey: "file", riskLevel: "medium" },
  database: { group: "it", labelKey: "database", riskLevel: "medium" },

  // ── In-Process ───────────────────────────────────────────────────────────
  // No network transport (like human_input) — low remote risk, no
  // encryption-in-transit relevance.
  in_process_call: {
    group: "in_process",
    labelKey: "in_process_call",
    riskLevel: "low",
  },

  // ── Embedded bus ─────────────────────────────────────────────────────────
  can: { group: "embedded", labelKey: "can", riskLevel: "high" },
  lin: { group: "embedded", labelKey: "lin", riskLevel: "high" },
  modbus_rtu: { group: "embedded", labelKey: "modbus_rtu", riskLevel: "high" },
  modbus_tcp: { group: "embedded", labelKey: "modbus_tcp", riskLevel: "high" },
  modbus_sec: { group: "embedded", labelKey: "modbus_sec", riskLevel: "low" },
  uart: { group: "embedded", labelKey: "uart" },
  spi: { group: "embedded", labelKey: "spi" },
  i2c: { group: "embedded", labelKey: "i2c" },

  // ── Fieldbus ─────────────────────────────────────────────────────────────
  profibus: { group: "fieldbus", labelKey: "profibus", riskLevel: "high" },
  foundation_fieldbus: { group: "fieldbus", labelKey: "foundation_fieldbus" },
  dnp3: { group: "fieldbus", labelKey: "dnp3", riskLevel: "high" },
  controlnet: { group: "fieldbus", labelKey: "controlnet" },
  devicenet: { group: "fieldbus", labelKey: "devicenet" },
  ethernet_ip: { group: "fieldbus", labelKey: "ethernet_ip" },
  profinet: { group: "fieldbus", labelKey: "profinet" },
  hart: { group: "fieldbus", labelKey: "hart" },
  lontalk: { group: "fieldbus", labelKey: "lontalk" },
  bacnet: { group: "fieldbus", labelKey: "bacnet" },
  bacnet_ip: { group: "fieldbus", labelKey: "bacnet_ip" },
  hart_ip: { group: "fieldbus", labelKey: "hart_ip" },
  opc_da: { group: "fieldbus", labelKey: "opc_da", riskLevel: "high" },
  canopen: { group: "fieldbus", labelKey: "canopen", riskLevel: "high" },
  s7comm: { group: "fieldbus", labelKey: "s7comm", riskLevel: "high" },
  iec61850: { group: "fieldbus", labelKey: "iec61850", riskLevel: "high" },

  // ── Secure OT ────────────────────────────────────────────────────────────
  opc_ua: { group: "secure_ot", labelKey: "opc_ua", riskLevel: "low" },

  // ── Wireless ─────────────────────────────────────────────────────────────
  wireless_hart: { group: "wireless", labelKey: "wireless_hart" },
  isa100: { group: "wireless", labelKey: "isa100" },
  zigbee: { group: "wireless", labelKey: "zigbee" },
  bluetooth: { group: "wireless", labelKey: "bluetooth", riskLevel: "medium" },

  // ── Electrical / Hardwired IO ─────────────────────────────────────────────
  digital_io: {
    group: "electrical",
    labelKey: "digital_io",
    riskLevel: "medium",
  },
  dry_contact: {
    group: "electrical",
    labelKey: "dry_contact",
    riskLevel: "high",
    safetyRelevant: true,
  },
  relay_output: {
    group: "electrical",
    labelKey: "relay_output",
    riskLevel: "high",
    safetyRelevant: true,
  },
  analog_voltage: {
    group: "electrical",
    labelKey: "analog_voltage",
    riskLevel: "high",
  },
  analog_current: {
    group: "electrical",
    labelKey: "analog_current",
    riskLevel: "high",
  },
  pulse: { group: "electrical", labelKey: "pulse", riskLevel: "medium" },
  pwm: { group: "electrical", labelKey: "pwm", riskLevel: "medium" },

  // ── Human-Machine Interaction ─────────────────────────────────────────────
  // Local operator action (touch/keypad/buttons). No network transport, so
  // network-cyber threats do not apply; threat focus is unauthorized local
  // operation and input spoofing (requires physical presence — low remote risk).
  human_input: { group: "hmi", labelKey: "human_input", riskLevel: "low" },

  // ── Other ────────────────────────────────────────────────────────────────
  custom: { group: "it", labelKey: "custom" },
};