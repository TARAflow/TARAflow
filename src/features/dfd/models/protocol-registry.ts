import type { Protocol } from "./element-properties";

export type ProtocolGroup =
  | "it"
  | "embedded"
  | "fieldbus"
  | "secure_ot"
  | "wireless";

export const PROTOCOL_META: Record<
  Protocol,
  { group: ProtocolGroup; labelKey: string; riskLevel?: "low" | "medium" | "high" }
> = {
  http: { group: "it", labelKey: "http", riskLevel: "medium" },
  https: { group: "it", labelKey: "https", riskLevel: "low" },
  grpc: { group: "it", labelKey: "grpc" },
  mqtt: { group: "it", labelKey: "mqtt" },
  amqp: { group: "it", labelKey: "amqp" },
  websocket: { group: "it", labelKey: "websocket" },
  file: { group: "it", labelKey: "file", riskLevel: "medium" },
  database: { group: "it", labelKey: "database", riskLevel: "medium" },

  can: { group: "embedded", labelKey: "can", riskLevel: "high" },
  modbus_rtu: { group: "embedded", labelKey: "modbus_rtu", riskLevel: "high" },
  modbus_tcp: { group: "embedded", labelKey: "modbus_tcp", riskLevel: "high" },
  modbus_sec: { group: "embedded", labelKey: "modbus_sec", riskLevel: "low" },
  uart: { group: "embedded", labelKey: "uart" },
  spi: { group: "embedded", labelKey: "spi" },
  i2c: { group: "embedded", labelKey: "i2c" },

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

  opc_ua: { group: "secure_ot", labelKey: "opc_ua", riskLevel: "low" },

  wireless_hart: { group: "wireless", labelKey: "wireless_hart" },
  isa100: { group: "wireless", labelKey: "isa100" },
  zigbee: { group: "wireless", labelKey: "zigbee" },

  custom: { group: "it", labelKey: "custom" },
};