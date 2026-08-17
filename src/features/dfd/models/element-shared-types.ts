// Exposure Levels for crossing dataflows and interfaces:
// ------------------------------------------------------
// EL0 (Internal): Fully trusted, isolated environment with no external access
// EL1 (Physical): Access only through direct physical interaction with interfaces (e.g., USB, RJ45, buttons)
// EL2 (Local): Access via local OT/production network (e.g., fieldbus, SCADA systems)
// EL3 (Adjacent): Access through extended factory/enterprise network (OT–IT boundary)
// EL4 (Public): Access via untrusted external networks (e.g., Internet, remote connections
export type ExposureLevel = "EL0" | "EL1" | "EL2" | "EL3" | "EL4";

// ==================== PHYSICAL EXPOSURE LEVELS ====================
//
// PEL — Physical Exposure Level.
// Describes how physically reachable an interface or boundary is.
// Direction is aligned with network ExposureLevel: higher = more exposed.
// Designed to be combined with PhysicalBoundary.accessibility which captures
// the environmental context (public / controlled / guarded / sealed).
//
// PEL0 (Inaccessible): No access without physical destruction — potted, welded,
//                       chip-decap required. No practical attack surface.
// PEL1 (Deep Internal): Multiple physical barriers to overcome — e.g. JTAG behind
//                       two nested enclosures, or inside a sealed sub-module.
// PEL2 (Internal):      One physical barrier to bypass — open enclosure, unlock
//                       cabinet, remove screws. Tool or key access required.
// PEL3 (Externally Protected): Accessible from outside but with a barrier —
//                       locked panel, service door, badge-controlled port.
// PEL4 (Directly Exposed): No barrier — touchscreen, outdoor port, public USB.
//                       Highest physical attack surface. Combine with
//                       PB.accessibility="public" for full threat context.
//
// Example — Ticket machine:
//   Touchscreen: PEL4, PB.accessibility="public"  → maximum exposure
//   USB-Service: PEL2, PB.accessibility="public"  → one barrier, public context
//   JTAG/SWD:    PEL1, PB.accessibility="public"  → deep internal, public context
//
export type PhysicalExposureLevel = "PEL0" | "PEL1" | "PEL2" | "PEL3" | "PEL4";

// PhysicalMobility — can the device be removed from its security environment?
// This is a qualitatively different threat dimension from PEL or accessibility.
// Mobility determines whether an attacker can control the attack environment:
//
// fixed         → Attack must happen on-site, under time pressure, limited tools.
//                 Offline lab attacks, device substitution: not applicable.
// removable     → Device can be extracted (DIN-Rail module, plug-in card) with some
//                 effort. Enables Depot Attack, Maintenance Abuse, Hardware Swap.
// portable      → Device can be taken home by attacker. Enables full Lab analysis:
//                 Evil-Maid, Firmware Implant, Side-Channel, Chip-Off, Fault Injection,
//                 Device Substitution. Especially critical if safetyRelevant=true
//                 (e.g. calibration device → rogue calibration data injection).
// vehicle_mounted → Device moves with a vehicle. Mobile but not easily hand-carried.
//                 Enables: vehicle theft scenario, depot attack during maintenance.
//
// Key insight: a fixed PLC and a portable calibration device may share identical
// PEL/accessibility/tamper values but have completely different threat landscapes.
export type PhysicalMobility = "fixed" | "removable" | "portable" | "vehicle_mounted";

// ==================== PHYSICAL MONITORING TYPE ====================
//
// Structured vocabulary for physical monitoring mechanisms on PhysicalBoundary.
//
// Threat-reduction mapping (attack feasibility scoring):
//   none             -> No detection — attacker operates unobserved
//   camera           -> Post-hoc evidence only — does not prevent access
//   alarm            -> Real-time alert on breach — reduces dwell time
//   soc              -> Alarm routed to SOC — active response capability
//   guard_patrol     -> Periodic human presence — detection window varies
//   tamper_monitoring -> Electronic tamper detection (mesh, switch, sensor)
//                        often paired with zeroize response on ChipBoundary
export type PhysicalMonitoringType =
  | "none"
  | "camera"            // CCTV / IP camera — evidence, not prevention
  | "alarm"             // Motion / door alarm — real-time alert, no active response
  | "soc"               // Alarm routed to Security Operations Centre — active response
  | "guard_patrol"      // Periodic manned patrol — detection gap depends on interval
  | "tamper_monitoring"; // Electronic tamper detection (switch, mesh, voltage sensor)

// ==================== STORED DATA TYPES ====================
//
// Controlled vocabulary for DataStore.storedDataTypes[].
// Represents threat classes, not storage technologies — kept deliberately
// stable so new domains (automotive, medical, rail) extend via custom
// entries rather than breaking existing threat templates.
//
// Threat implications:
//   credentials / keys_certificates → Spoofing, Elevation of Privilege
//   firmware                        → Tampering (Secure Boot bypass)
//   pii                             → Information Disclosure (GDPR)
//   safety_params                   → Tampering + DoS (SIL-relevant)
//   calibration                     → Tampering (process accuracy)
//   config                          → Tampering (system behaviour)
//   audit_logs                      → Repudiation (log deletion/manipulation)
//   telemetry                       → Information Disclosure
//   custom                          → Analyst must describe in notes

export type StoredDataType =
  | "credentials"       // Passwords, tokens, session keys, API keys
  | "keys_certificates" // Cryptographic keys, X.509 certificates, PKI material
  | "firmware"          // Firmware images, bootloader, software update packages
  | "pii"               // Personal Identifiable Information (GDPR-relevant)
  | "safety_params"     // Safety-relevant parameters (SIL, emergency stop config)
  | "calibration"       // Sensor calibration data, process parameters
  | "config"            // System or application configuration
  | "audit_logs"        // Audit trail, event logs, diagnostic data
  | "telemetry"         // Operational metrics, aggregated sensor data
  | "custom";           // Domain-specific — describe in notes

// ==================== INTERFACE LOCATION ====================
//
// Physical location of a connector/port on a device boundary.
// Mirrors DataFlow.location (the path) — Interface.location is the point.
// Used for ExposureLevel derivation and physical attack surface assessment.
//
// Semantically distinct from:
//   DataFlow.location   — the medium/path the flow traverses
//   exposureLevel       — the resulting attack surface (consequence)
//
// location is the cause; exposureLevel is the effect.

export type InterfaceLocation =
  | "on_chip"          // Internal chip pad / register — EL0 (debug interface only)
  | "on_board"         // PCB-mounted connector, same board — EL0/EL1
  | "in_enclosure"     // Port inside sealed enclosure — EL1 (requires disassembly)
  | "external_panel"   // Panel-mounted port on device exterior — EL1
  | "field_accessible" // Field-accessible connector (M12, DIN, terminal) — EL1/EL2
  | "network_port"     // Standard network port (RJ45, SFP) — EL2/EL3
  | "wireless"         // Wireless interface (antenna, built-in radio) — EL3
  | "internet_facing"  // Internet-exposed interface — EL4
  | "custom";          // Non-standard location — describe in notes

// ==================== BOUNDARY CONTROL TYPES ====================
//
// Structured vocabulary for TrustBoundary security controls.
// Intentionally kept at a stable semantic core — OT-specific or
// vendor-specific controls go in customBoundaryControls?: string.
//
// Mitigation mapping:
//   firewall / ids_ips          → Network-level threat reduction
//   data_diode                  → Unidirectional enforcement (IEC 62443 SL3+)
//   vpn_gateway                 → Encrypted tunnel across boundary
//   dmz                         → Demilitarised zone separation
//   authentication_gateway      → Identity enforcement at boundary
//   os_authentication            → Device auth gates access to OS-managed secret
//   unidirectional_gateway       → Hardware-enforced one-way data flow
//   network_segmentation        → VLAN / logical separation
//   jump_host                   → Bastion host for remote access control
//   custom                      → Describe in customBoundaryControls

export type BoundaryControlType =
  | "firewall" // Stateful packet inspection firewall
  | "ids_ips" // Intrusion Detection / Prevention System
  | "data_diode" // Hardware data diode — unidirectional enforcement
  | "vpn_gateway" // VPN concentrator / encrypted tunnel endpoint
  | "dmz" // Demilitarised zone (dual-firewall architecture)
  | "authentication_gateway" // Identity / auth enforcement at boundary (network/API)
  // Device-level authentication (biometric/passcode) required before an
  // OS-managed secure store releases a secret — e.g. iOS Keychain with
  // kSecAttrAccessControl biometryCurrentSet, Android Keystore
  // setUserAuthenticationRequired(true). Distinct from
  // "authentication_gateway": this gates a LOCAL secret release, not a
  // network/API identity check. Primarily relevant for "platform"
  // TrustBoundary type.
  | "os_authentication"
  | "unidirectional_gateway" // Software-enforced one-way gateway (e.g. Waterfall)
  | "network_segmentation" // VLAN, microsegmentation, ACL-based separation
  | "jump_host" // Bastion / jump server for admin access
  | "custom";                // Vendor/domain-specific — use customBoundaryControls

// ==================== SECURITY CONTROL RECORD ====================
 
/**
 * Audit record for a security control intentionally set on a DFD element.
 *
 * Populated when:
 *   - Analyst clicks "Apply" in DFDNotificationsPanel (setBy: "apply_suggestion")
 *   - Analyst documents an existing control manually (setBy: "analyst")
 *
 * Persisted on the element — survives project reload.
 * Basis for SecurityDrift calculation: compares SHOULD (ControlInstance)
 * vs WAS (SecurityControlRecord) vs IS (actual property value).
 */
export interface SecurityControlRecord {
  /** Property key on this element, e.g. "encryptionInTransit" */
  property: string;
 
  /** The value that was intentionally set, e.g. "tls" */
  value: unknown;
 
  /**
   * How was this control set?
   *   analyst          → manually in form, no mitigation reference
   *   apply_suggestion → via Apply button in DFDNotificationsPanel
   */
  setBy: "analyst" | "apply_suggestion";
 
  /** ISO timestamp when the control was set */
  setAt: string;
 
  /**
   * Mitigation ID that drove this control.
   * Only present when setBy = "apply_suggestion". e.g. "M-T-005"
   */
  mitigationId?: string;
 
  /**
   * Risk ID that drove this control.
   * Only present when setBy = "apply_suggestion". e.g. "R-CNA-DF1-T-IN-1"
   */
  riskId?: string;
}