// ==================== CONTROL PROPERTY OPTIONS ====================
// The values of the DFD properties the mitigation catalog's effects
// (`affectsProperties`) set — closed-loop review CL-1. Typed against the DFD
// property types, so a value that is not an option does not compile; the
// catalog test checks every catalog expected value against this list (a
// SHOULD the DFD cannot hold could never be met, and Apply would write it).
//
// Keyed "<targetType>.<property>"; Interface controls as
// "Interface.implementedControls.<key>". Only properties the catalog uses.

import type {
  ChipBoundaryProperties,
  DataFlowProperties,
  DataStoreProperties,
  ExternalEntityProperties,
  InterfaceProperties,
  MultiprocessProperties,
  PhysicalBoundaryProperties,
  ProcessProperties,
  TrustBoundaryProperties,
} from "./element-properties";

type Controls = NonNullable<InterfaceProperties["implementedControls"]>;
/** The listed values must be options of T. */
const o = <T,>(values: readonly NonNullable<T>[]): readonly unknown[] => values;

export const CONTROL_PROPERTY_OPTIONS: Readonly<Record<string, readonly unknown[]>> = {
  "Process.inputValidation": o<ProcessProperties["inputValidation"]>(["not_specified", "none", "basic", "strict", "schema"]),
  "Process.authenticationRequired": o<ProcessProperties["authenticationRequired"]>([
    "not_specified", "no", "yes", "optional", "oauth", "saml", "certificate", "apikey", "jwt", "mtls",
  ]),
  "Process.authenticatorStorage": o<ProcessProperties["authenticatorStorage"]>([
    "software_only", "tpm", "secure_element", "hsm", "keychain_os", "custom",
  ]),
  "Process.authorizationModel": o<ProcessProperties["authorizationModel"]>(["not_specified", "none", "rbac", "abac", "acl", "custom"]),
  "Process.malwareProtection": o<ProcessProperties["malwareProtection"]>([
    "none", "av_software", "application_whitelist", "code_signing", "nx_dep", "sandbox", "custom",
  ]),
  "Process.privilegeLevel": o<ProcessProperties["privilegeLevel"]>(["not_specified", "low", "medium", "high", "root"]),
  "Process.accountManagement": o<ProcessProperties["accountManagement"]>([
    "local_only", "ldap", "active_directory", "radius", "iam", "custom",
  ]),
  "Process.processSemantic": o<ProcessProperties["processSemantic"]>(["execution_unit", "functional_block", "security_boundary"]),
  "Process.failSafeOutputState": o<ProcessProperties["failSafeOutputState"]>([
    "not_defined", "unpowered", "hold_last_value", "fixed_value", "dynamic",
  ]),

  "Multiprocess.authenticatorStorage": o<MultiprocessProperties["authenticatorStorage"]>([
    "system_software", "tpm", "secure_element", "hsm", "custom",
  ]),
  "Multiprocess.authorizationModel": o<MultiprocessProperties["authorizationModel"]>([
    "not_specified", "none", "rbac", "abac", "acl", "capability_based",
  ]),
  "Multiprocess.malwareProtection": o<MultiprocessProperties["malwareProtection"]>([
    "none", "av_software", "application_whitelist", "code_signing", "nx_dep", "sandbox", "custom",
  ]),
  "Multiprocess.accountManagement": o<MultiprocessProperties["accountManagement"]>([
    "local_only", "ldap", "active_directory", "radius", "iam", "custom",
  ]),
  "Multiprocess.backupMechanism": o<MultiprocessProperties["backupMechanism"]>([
    "none", "manual_local", "automated_local", "automated_remote", "redundant_system", "vendor_managed",
  ]),
  "Multiprocess.updateMechanism": o<MultiprocessProperties["updateMechanism"]>([
    "none", "manual_local", "signed_local", "signed_ota", "vendor_only", "mdm_managed", "ci_cd",
  ]),
  "Multiprocess.boundaryAuthentication": o<MultiprocessProperties["boundaryAuthentication"]>([
    "not_specified", "none", "password", "mfa", "certificate", "mtls", "oauth", "apikey", "hardware_token",
  ]),

  "ExternalEntity.rateLimited": o<ExternalEntityProperties["rateLimited"]>([true, false]),

  "DataStore.encryptionAtRest": o<DataStoreProperties["encryptionAtRest"]>(["none", "yes", "aes256", "tde", "kms", "custom"]),
  "DataStore.integrityProtection": o<DataStoreProperties["integrityProtection"]>(["none", "crc", "hash", "hmac", "signature", "custom"]),
  "DataStore.accessControlMechanism": o<DataStoreProperties["accessControlMechanism"]>([
    "none", "process_enforced", "mpu_protected", "os_permissions", "crypto_erase", "custom",
  ]),

  "DataFlow.encryptionInTransit": o<DataFlowProperties["encryptionInTransit"]>(["none", "tls", "mtls", "vpn", "custom"]),
  "DataFlow.integrityProtection": o<DataFlowProperties["integrityProtection"]>([
    "none", "crc", "hash", "hmac", "signature", "aead", "custom",
  ]),
  "DataFlow.endpointAuthentication": o<DataFlowProperties["endpointAuthentication"]>([
    "none", "password", "pairing", "symmetric_key", "token", "mfa", "biometric", "certificate", "apikey", "oauth", "mutual_tls",
  ]),
  "DataFlow.physicalPathProtection": o<DataFlowProperties["physicalPathProtection"]>([
    "none", "cable_duct", "conduit", "armored_cable", "tamper_seal", "locked_cabinet", "buried",
  ]),
  "DataFlow.redundancy": o<DataFlowProperties["redundancy"]>(["none", "failover", "degraded", "buffered"]),
  "DataFlow.accessMode": o<DataFlowProperties["accessMode"]>(["read_only", "read_write", "write_only"]),

  "Interface.operationalState": o<InterfaceProperties["operationalState"]>([
    "enabled", "enabled_read_only", "sw_disabled", "hw_disabled", "permanent_disabled",
  ]),
  "Interface.implementedControls.linkAuthentication": o<Controls["linkAuthentication"]>([
    "none", "pre_shared_key", "certificate_based", "pairing", "mutual_pairing",
  ]),
  "Interface.implementedControls.debugProtection": o<Controls["debugProtection"]>([
    "none", "auth_required", "limited_commands", "readout_protection", "fused_off",
  ]),
  "Interface.implementedControls.physicalAccessProtection": o<Controls["physicalAccessProtection"]>([
    "none", "inside_enclosure", "locked_panel", "sealed", "requires_tool", "tamper_evident",
  ]),
  "Interface.implementedControls.signalProtection": o<Controls["signalProtection"]>([
    "none", "shielded", "twisted_pair", "fiber_optic", "isolated", "conduit_protected",
  ]),
  "Interface.implementedControls.serviceAccessPolicy": o<Controls["serviceAccessPolicy"]>([
    "always_enabled", "maintenance_only", "factory_only", "temporary_enable",
  ]),
  "Interface.implementedControls.monitoringControl": o<Controls["monitoringControl"]>([
    "none", "usage_logged", "tamper_logged", "alerted", "active_response",
  ]),
  "Interface.implementedControls.abuseProtection": o<Controls["abuseProtection"]>(["none", "rate_limited", "lockout", "flood_protection"]),

  "TrustBoundary.defaultDenyPolicy": o<TrustBoundaryProperties["defaultDenyPolicy"]>([
    "allow_all", "deny_all_permit_exception", "island_mode", "fail_close",
  ]),

  "ChipBoundary.secureBootEnabled": o<ChipBoundaryProperties["secureBootEnabled"]>([true, false]),
  "ChipBoundary.bitstreamEncryption": o<ChipBoundaryProperties["bitstreamEncryption"]>([true, false]),
  "ChipBoundary.debugInterfaceLocked": o<ChipBoundaryProperties["debugInterfaceLocked"]>([true, false]),
  "ChipBoundary.firmwareProtection": o<ChipBoundaryProperties["firmwareProtection"]>(["none", "rdp_level1", "rdp_level2", "locked", "encrypted"]),
  "ChipBoundary.supplyChainTrust": o<ChipBoundaryProperties["supplyChainTrust"]>(["verified", "unverified", "unknown"]),
  "ChipBoundary.tamperProtection": o<ChipBoundaryProperties["tamperProtection"]>(["none", "basic", "active"]),
  "ChipBoundary.authenticatorStorage": o<ChipBoundaryProperties["authenticatorStorage"]>([
    "software_only", "tpm", "secure_element", "hsm", "custom",
  ]),
  "ChipBoundary.cryptoStandard": o<ChipBoundaryProperties["cryptoStandard"]>([
    "not_assessed", "nist_approved", "fips_140_2", "fips_140_3", "common_criteria", "custom",
  ]),

  "PhysicalBoundary.tamperProtection": o<PhysicalBoundaryProperties["tamperProtection"]>([
    "none", "seal", "switch", "mesh", "potting", "active_detection",
  ]),
  "PhysicalBoundary.debugInterfaceAccessible": o<PhysicalBoundaryProperties["debugInterfaceAccessible"]>([true, false]),
  "PhysicalBoundary.removableMediaAccessible": o<PhysicalBoundaryProperties["removableMediaAccessible"]>([true, false]),
  "PhysicalBoundary.requiresToolAccess": o<PhysicalBoundaryProperties["requiresToolAccess"]>([true, false]),
  "PhysicalBoundary.physicalMobility": o<PhysicalBoundaryProperties["physicalMobility"]>(["fixed", "removable", "portable", "vehicle_mounted"]),
  "PhysicalBoundary.physicalAccessControl": o<PhysicalBoundaryProperties["physicalAccessControl"]>([
    "none", "key", "badge", "badge_pin", "biometric", "guard",
  ]),
  "PhysicalBoundary.monitoringType": o<PhysicalBoundaryProperties["monitoringType"]>([
    "none", "camera", "alarm", "soc", "guard_patrol", "tamper_monitoring",
  ]),
};

export function controlPropertyOptions(targetType: string, property: string): readonly unknown[] | undefined {
  return CONTROL_PROPERTY_OPTIONS[`${targetType}.${property}`];
}
