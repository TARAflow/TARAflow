// ==================== EXTERNAL ENTITY TYPE REGISTRY ====================
// Modelled after interface-type-registry.ts — same pattern, same shape.
// Used by external-entity-description-form.tsx to render grouped Select options
// and by threat generators to access type metadata.

import type { ExternalEntityProperties } from "./element-properties";

export type ExternalEntityType = NonNullable<ExternalEntityProperties["entityType"]>;

// ==================== GROUPS ====================

export type ExternalEntityGroup =
  | "human"         // Human actors — operators, admins, contractors
  | "system"        // Automated IT/OT systems — services, SCADA, gateways
  | "infrastructure"// Network infrastructure — switches, VPN, wireless APs
  | "field_device"  // Embedded / field devices — PLCs, sensors, actuators
  | "engineering"   // Engineering / debug access — probes, workstations, tools
  | "other";        // Generic / unclassified

// ==================== REGISTRY ====================

export const EXTERNAL_ENTITY_TYPE_META: Record<
  ExternalEntityType,
  {
    group: ExternalEntityGroup;
    labelKey: string;
    /** Primary attack surface category — drives Attack Tree expansion */
    attackSurfaceCategory:
      | "physical"      // Requires physical proximity or access
      | "adjacent"      // Requires local network / field access
      | "network"       // Reachable via network (LAN/WAN)
      | "supply_chain"  // Trust from supply chain / vendor relationship
      | "identity"      // Identity / credential abuse
      | "firmware"      // Firmware / software supply chain
      | "safety";       // Safety-system interaction
    /** Default threat actor profile */
    defaultThreatActor: NonNullable<ExternalEntityProperties["threatActor"]>;
    /** Default trust level */
    defaultTrustLevel: NonNullable<ExternalEntityProperties["trustLevel"]>;
    /** Default authentication method */
    defaultAuthMethod: NonNullable<ExternalEntityProperties["authenticationMethod"]>;
    /** True = physical access to device required */
    requiresPhysicalAccess: boolean;
    /** True = typically reachable remotely without physical presence */
    remoteReachable: boolean;
    /** True = this entity type can interact with safety-relevant functions */
    safetyRelevant?: boolean;
    /** True = entity type is typically privileged (admin, root, debug access) */
    typicallyPrivileged?: boolean;
  }
> = {

  // ── Human ─────────────────────────────────────────────────────────────────

  user: {
    group: "human",
    labelKey: "user",
    attackSurfaceCategory: "identity",
    defaultThreatActor: "curious",
    defaultTrustLevel: "low",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
  },

  admin_user: {
    group: "human",
    labelKey: "admin_user",
    attackSurfaceCategory: "identity",
    defaultThreatActor: "insider",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "mfa",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    typicallyPrivileged: true,
  },

  operator: {
    group: "human",
    labelKey: "operator",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "curious",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    safetyRelevant: true,
  },

  maintenance: {
    group: "human",
    labelKey: "maintenance",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "insider",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    typicallyPrivileged: true,
    // IEC 62443: maintenance is the weakest link —
    // temporarily privileged, often uses vendor laptops + USB.
  },

  contractor: {
    group: "human",
    labelKey: "contractor",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "curious",
    defaultTrustLevel: "low",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: true,
    remoteReachable: false,
  },

  device_owner: {
    group: "human",
    labelKey: "device_owner",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "curious",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    typicallyPrivileged: true,
    // Asset/device owner — e.g. building owner (smoke detector), restaurant operator
    // (coffee machine), facility manager (HVAC). Higher rights than user:
    // can manage user accounts + device config. Cannot: flash firmware, change
    // safety parameters, debug access. IEC 62443: "Asset Owner" role (CR 1.3).
  },

  // ── System ────────────────────────────────────────────────────────────────

  service: {
    group: "system",
    labelKey: "service",
    attackSurfaceCategory: "network",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
  },

  remote_service: {
    group: "system",
    labelKey: "remote_service",
    attackSurfaceCategory: "supply_chain",
    defaultThreatActor: "advanced",
    defaultTrustLevel: "low",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // Cloud diagnostics, vendor remote monitoring, predictive maintenance.
    // Threat-technically different from service: supply_chain + internet exposure.
  },

  scada_hmi: {
    group: "system",
    labelKey: "scada_hmi",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    safetyRelevant: true,
  },

  historian: {
    group: "system",
    labelKey: "historian",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
  },

  gateway: {
    group: "system",
    labelKey: "gateway",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // OPC-UA Gateway, MQTT Bridge, Modbus/TCP Proxy, Protocol Converter.
    // Key risk: trust pivoting, protocol downgrade, multi-zone exposure.
  },

  update_server: {
    group: "system",
    labelKey: "update_server",
    attackSurfaceCategory: "supply_chain",
    defaultThreatActor: "advanced",
    defaultTrustLevel: "high",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // OTA/Firmware update server. Trust anchor for firmware integrity chain.
  },

  identity_provider: {
    group: "system",
    labelKey: "identity_provider",
    attackSurfaceCategory: "identity",
    defaultThreatActor: "advanced",
    defaultTrustLevel: "high",
    defaultAuthMethod: "saml",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // IdP, OAuth Server, AD/LDAP. Own Spoofing/Token-Theft threat path.
  },

  external_system: {
    group: "system",
    labelKey: "external_system",
    attackSurfaceCategory: "network",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "low",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
  },

  bot: {
    group: "system",
    labelKey: "bot",
    attackSurfaceCategory: "network",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "low",
    defaultAuthMethod: "apikey",
    requiresPhysicalAccess: false,
    remoteReachable: true,
  },

  // ── Infrastructure ────────────────────────────────────────────────────────

  network_device: {
    group: "infrastructure",
    labelKey: "network_device",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // Switch, Router, Firewall, Industrial NAT.
  },

  wireless_access_point: {
    group: "infrastructure",
    labelKey: "wireless_access_point",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "low",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // Industrial WiFi, 868MHz AP, LoRa Gateway, Cellular Router.
  },

  remote_access: {
    group: "infrastructure",
    labelKey: "remote_access",
    attackSurfaceCategory: "network",
    defaultThreatActor: "advanced",
    defaultTrustLevel: "low",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // Jump Host, VPN Appliance, Bastion, Cellular Router.
    // Common OT compromise vector in ICS incidents.
  },

  // ── Field Device ──────────────────────────────────────────────────────────

  controller: {
    group: "field_device",
    labelKey: "controller",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "none",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    // PLC, RTU, ECU, MCU-Node. THE central OT entity type.
    // Threat model: process integrity, availability, command injection.
  },

  safety_controller: {
    group: "field_device",
    labelKey: "safety_controller",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "advanced",
    defaultTrustLevel: "high",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    safetyRelevant: true,
    // SIS, Safety-PLC (IEC 61508/IEC 62061). Different from controller:
    // security goal = Functional Safety / SIL / Life Safety.
    // Threats lead to different impact models and risk scores.
  },

  sensor: {
    group: "field_device",
    labelKey: "sensor",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "curious",
    defaultTrustLevel: "low",
    defaultAuthMethod: "none",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    // Field sensor, sensor node (e.g. another smoke detector in N:1 topology).
  },

  actuator: {
    group: "field_device",
    labelKey: "actuator",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "malicious",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "none",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    safetyRelevant: true,
    // Valve, Contactor, Siren, Relay. Safety-relevant: receives safety commands.
  },

  iot: {
    group: "field_device",
    labelKey: "iot",
    attackSurfaceCategory: "adjacent",
    defaultThreatActor: "compromised",
    defaultTrustLevel: "low",
    defaultAuthMethod: "certificate",
    requiresPhysicalAccess: false,
    remoteReachable: true,
    // Connected device — unclassified/mixed. Intentional: unknown classification
    // = own threat profile (lowest implicit trust, unknown attack surface).
    // Kept separate from controller/sensor/actuator for undocumented devices.
  },

  // ── Engineering ───────────────────────────────────────────────────────────

  debugger: {
    group: "engineering",
    labelKey: "debugger",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "insider",
    defaultTrustLevel: "low",
    defaultAuthMethod: "none",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    typicallyPrivileged: true,
    // JTAG probe, SWD adapter, Lauterbach, J-Link, ST-Link.
    // Highest embedded attack surface: memory R/W, firmware flash, CPU halt.
  },

  engineering_workstation: {
    group: "engineering",
    labelKey: "engineering_workstation",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "insider",
    defaultTrustLevel: "medium",
    defaultAuthMethod: "password",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    typicallyPrivileged: true,
    // Engineering PC, PLC programming station, Safety Logic Engineering Host.
    // If compromised: entire plant potentially compromised.
  },

  programming_tool: {
    group: "engineering",
    labelKey: "programming_tool",
    attackSurfaceCategory: "physical",
    defaultThreatActor: "insider",
    defaultTrustLevel: "low",
    defaultAuthMethod: "none",
    requiresPhysicalAccess: true,
    remoteReachable: false,
    typicallyPrivileged: true,
    // Needle adapter, In-Circuit Programmer, Flash programmer (ST-Link standalone),
    // Service dongle, Bootloader trigger, Bed-of-nails tester.
  },
};

// ==================== HELPERS ====================

/**
 * Get all entity types for a given group, in registry order.
 */
export function getEntityTypesByGroup(
  group: ExternalEntityGroup,
): ExternalEntityType[] {
  return (Object.keys(EXTERNAL_ENTITY_TYPE_META) as ExternalEntityType[]).filter(
    (type) => EXTERNAL_ENTITY_TYPE_META[type].group === group,
  );
}

/**
 * Group order for UI rendering — controls top-to-bottom group sequence.
 */
export const EXTERNAL_ENTITY_GROUP_ORDER: ExternalEntityGroup[] = [
  "human",
  "system",
  "infrastructure",
  "field_device",
  "engineering",
  "other",
];