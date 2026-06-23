// ==================== STRIDE MODIFIER ====================
// Pure functions: element/dataflow properties → STRIDE category modulation.
// Consumed by UnifiedStrategy (the sole threat-generation strategy).
//
// Design:
//   - All functions are pure (no side effects)
//   - Input: element properties + base STRIDE categories
//   - Output: modified STRIDE categories
//   - "Escalate" = keep category, mark as high priority
//   - "Add" = add category if not already present
//   - "Skip" = remove category from output
//   - "Reduce" = keep category, mark as low priority

import {
  ChipBoundaryProperties,
  DataFlowProperties,
  DataStoreProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
} from "features/dfd/models/element-properties";
import type { StrideCategory } from "shared";

export interface ProcessModifierProps {
  technology?: string;
  processSemantic?: string;
  runsAs?: string;
  authenticationRequired?: string;
  inputValidation?: string;
  exposedToInternet?: boolean;
}

export interface DataFlowModifierProps {
  excludeFromThreatGen?: boolean;
  exposureLevel?: string;
  encryptionInTransit?: string;
  endpointAuthentication?: string;
  integrityProtection?: boolean;
  safetyRelevant?: boolean;
  crossesSafetyBoundary?: boolean;
}

export interface DataStoreModifierProps {
  encryptionAtRest?: string;
  integrityProtection?: boolean;
  containsSafetyRelevantData?: boolean;
  dataClassification?: string;
  multiTenant?: boolean;
  backupEnabled?: boolean;
}

export interface TrustBoundaryModifierProps {
  boundaryType?: string;
}

export interface InterfaceModifierProps {
  type?: string;
  accessControl?: string;
  safetyRelevant?: boolean;
}

export interface ChipBoundaryModifierProps {
  chipType?: string;
  debugInterfacePresent?: string;
  debugInterfaceLocked?: boolean;
  secureBootEnabled?: boolean;
  firmwareProtection?: string;
  bitstreamEncryption?: boolean;
  supplyChainTrust?: string;
  tamperProtection?: string;
  safetyRelevant?: boolean;
}

export interface MultiprocessModifierProps {
  systemClass?: string;
  airGapped?: boolean;
  safetyRelevant?: boolean;
  updateMechanism?: string;
  boundaryAuthentication?: string;
  exposedToInternet?: boolean;
  multiTenant?: boolean;
}

// ==================== HELPERS ====================

function add(
  categories: StrideCategory[],
  ...toAdd: StrideCategory[]
): StrideCategory[] {
  const result = [...categories];
  for (const c of toAdd) {
    if (!result.includes(c)) result.push(c);
  }
  return result;
}

function skip(
  categories: StrideCategory[],
  ...toSkip: StrideCategory[]
): StrideCategory[] {
  return categories.filter((c) => !toSkip.includes(c));
}

// ==================== PROCESS RULES ====================

/**
 * Modulate STRIDE for a Process element based on its properties.
 *
 * Rules (from handover-block4__1_.md):
 *   technology = bootloader   → Add T, Add E
 *   technology = protocol_stack → Add S, Add D
 *   technology = driver        → Add T
 *   runsAs = root              → keep E (escalate priority — handled by caller)
 *   authenticationRequired = none → keep S (escalate)
 *   inputValidation = none     → keep T (escalate)
 *   processSemantic = functional_block → Skip S, Skip R
 *   processSemantic = security_boundary → keep all (escalate all)
 *   exposedToInternet = true   → keep all (escalate all)
 */
export function modifyProcessStride(
  base: StrideCategory[],
  props: ProcessModifierProps,
): StrideCategory[] {
  let result = [...base];

  // technology-based additions
  if (props.technology === "bootloader") {
    result = add(result, "T", "E");
  } else if (props.technology === "protocol_stack") {
    result = add(result, "S", "D");
  } else if (props.technology === "driver") {
    result = add(result, "T");
  }

  // processSemantic reductions
  if (props.processSemantic === "functional_block") {
    result = skip(result, "S", "R");
  }

  return result;
}

// ==================== DATAFLOW RULES ====================

/**
 * Modulate STRIDE for a DataFlow element based on its properties.
 *
 * Rules:
 *   exposureLevel = EL0           → Skip S, Skip I (internal trusted)
 *   exposureLevel = EL4           → keep all (max priority)
 *   encryptionInTransit = none    → Add T, Add I (escalate)
 *   encryptionInTransit = tls/mtls → keep T, keep I (reduce priority)
 *   endpointAuthentication = none → keep S (escalate)
 *   integrityProtection = true    → keep T (reduce priority)
 *   excludeFromThreatGen = true   → empty (skip entirely — caller handles)
 *   safetyRelevant = true         → keep all (add physical impact annotation)
 *   crossesSafetyBoundary = true  → Escalate T, I
 */
export function modifyDataFlowStride(
  base: StrideCategory[],
  props: DataFlowModifierProps,
): StrideCategory[] {
  // excludeFromThreatGen handled at generator level — not here
  if (props.excludeFromThreatGen) return [];

  let result = [...base];

  // EL0 = internal trusted — reduce attack surface
  if ((props as any).exposureLevel === "EL0") {
    result = skip(result, "S", "I");
  }

  return result;
}

// ==================== DATASTORE RULES ====================

/**
 * Modulate STRIDE for a DataStore element based on its properties.
 *
 * Rules:
 *   encryptionAtRest = none       → Escalate T, I
 *   integrityProtection = false   → Escalate T
 *   containsSafetyRelevantData = true → Add physical impact, Escalate T + D
 *   dataClassification = secret   → Escalate I
 *   multiTenant = true            → Escalate I
 *   backupEnabled = false         → Escalate D
 */
export function modifyDataStoreStride(
  base: StrideCategory[],
  props: DataStoreModifierProps,
): StrideCategory[] {
  let result = [...base];

  // Safety-relevant data escalates DoS risk
  if (props.containsSafetyRelevantData) {
    result = add(result, "T", "D");
  }

  return result;
}

// ==================== TRUST BOUNDARY / INTERFACE RULES ====================

/**
 * Modulate STRIDE for TrustBoundary / Interface elements.
 *
 * Rules:
 *   boundaryType = debug      → Add E, Add I
 *   boundaryType = boot       → Add T, Add E
 *   boundaryType = peripheral → Add T, Add S
 *   Interface type = usb + accessControl = none → Add T, Add E
 *   Interface safetyRelevant = true → Escalate T + D
 */
export function modifyTrustBoundaryStride(
  base: StrideCategory[],
  props: TrustBoundaryModifierProps,
): StrideCategory[] {
  let result = [...base];

  if (props.boundaryType === "debug") {
    result = add(result, "E", "I");
  } else if (props.boundaryType === "boot") {
    result = add(result, "T", "E");
  } else if (props.boundaryType === "peripheral") {
    result = add(result, "T", "S");
  }

  return result;
}

export function modifyInterfaceStride(
  base: StrideCategory[],
  props: InterfaceModifierProps,
): StrideCategory[] {
  let result = [...base];

  if (props.type === "usb" && props.accessControl === "none") {
    result = add(result, "T", "E");
  }

  return result;
}

// ==================== CHIPBOUNDARY RULES ====================

/**
 * Modulate STRIDE for ChipBoundary elements based on chip properties.
 *
 * Rules:
 *   debug interface present + not provably locked (locked ≠ true) → Escalate E, Add I
 *   secureBootEnabled = false                        → Add T
 *   firmwareProtection = none                        → Escalate T, Add I
 *   bitstreamEncryption = false (FPGA)               → Add I
 *   tamperProtection = none                          → Escalate T
 *   supplyChainTrust = unverified                    → Add T
 *   safetyRelevant = true                            → keep all (physical impact)
 *   chipType = se/hsm + debugInterfaceLocked = true  → Reduce E
 */
export function modifyChipBoundaryStride(
  base: StrideCategory[],
  props: ChipBoundaryModifierProps,
): StrideCategory[] {
  let result = [...base];

  // Secure boot disabled → firmware tampering risk
  if (props.secureBootEnabled === false) {
    result = add(result, "T");
  }

  // Debug interface present and not provably locked → key extraction /
  // debug-access risk. `!== true` (not `=== false`) so an UNASSESSED lock state
  // escalates too: an undefined debugInterfaceLocked must not silently behave
  // like "locked". Reduction is earned only by an explicit
  // debugInterfaceLocked === true (mirrored by the SE/HSM rule below).
  if (
    props.debugInterfacePresent &&
    props.debugInterfacePresent !== "none" &&
    props.debugInterfaceLocked !== true
  ) {
    result = add(result, "E", "I");
  }

  // Firmware not protected → readback risk
  if (props.firmwareProtection === "none") {
    result = add(result, "T", "I");
  }

  // FPGA bitstream not encrypted
  if (props.chipType === "fpga" && props.bitstreamEncryption === false) {
    result = add(result, "I");
  }

  // Supply chain unverified → hardware trojan
  if (props.supplyChainTrust === "unverified") {
    result = add(result, "T");
  }

  // SE/HSM with locked debug — reduce E (designed secure)
  if (
    (props.chipType === "se" || props.chipType === "hsm") &&
    props.debugInterfaceLocked === true
  ) {
    result = skip(result, "E");
  }

  return result;
}

/**
 * Modulate STRIDE for Multiprocess elements based on system properties.
 *
 * Rules:
 *   airGapped = true              → Skip S, Skip I (no network attack surface)
 *   safetyRelevant = true         → Add T, Add D (safety impact escalation)
 *   systemClass = safety_system   → Add T, Add D (same as above)
 *   updateMechanism = none        → Add T (no patch path = persistent vuln)
 *   boundaryAuthentication = none → keep S (escalate priority)
 *   exposedToInternet = true      → keep all (escalate all)
 *   multiTenant = true            → Add I (tenant isolation risk)
 */
export function modifyMultiprocessStride(
  base: StrideCategory[],
  props: MultiprocessModifierProps,
): StrideCategory[] {
  let result = [...base];

  // Air-gapped → no network-based threats
  if (props.airGapped === true) {
    result = skip(result, "S", "I");
  }

  // Safety system or safety-relevant → escalate T + D
  if (props.safetyRelevant === true || props.systemClass === "safety_system") {
    result = add(result, "T", "D");
  }

  // No update mechanism → firmware stays unpatched
  if (props.updateMechanism === "none") {
    result = add(result, "T");
  }

  // Multi-tenant → tenant isolation risk
  if (props.multiTenant === true) {
    result = add(result, "I");
  }

  return result;
}