// ==================== TRANSDUCER PROPERTIES ====================
// Cyber-physical boundary element types: Sensor and Actuator.
// See ELEMENT-sensor-actuator_v0.4.md.
//
// Self-contained: owns its cyber-physical value types. Reuses two cross-element
// types from element-shared-types.ts (SecurityControlRecord, PhysicalExposureLevel),
// which keeps this file free of any import cycle with element-properties.ts.
//
// The ElementProperties union stays in element-properties.ts (it imports the
// interfaces below) — there is NO re-export barrel.
//
// Reconciliations vs the v0.4 spec:
//   - device-tamper reachability -> reuse PhysicalExposureLevel (PEL), not a new enum
//   - safety relevance           -> reuse safetyRelevant?: boolean (undefined = unassessed)
//   - implemented controls       -> reuse securityControlOwnership?: SecurityControlRecord[]

import type {
  SecurityControlRecord,
  PhysicalExposureLevel,
} from "./element-shared-types";

// ==================== CYBER-PHYSICAL SHARED TYPES ====================

// Topological position of a transducer relative to the device/system boundary.
// DERIVED from PhysicalBoundary containment (SSOT) by the graph/derivation pass;
// only overridden manually for the rare case where physical placement differs
// from logical nesting (probe body internal, sensing tip protruding).
export type TransducerLocation = "internal" | "external" | "boundary_spanning";
export type LocationProvenance = "derived" | "override";

// The physical medium an attack couples through. This is the attack-catalog key —
// attacks couple to the DOMAIN, not just the device's transduction principle
// (camera / LiDAR / photodiode are all "optical" devices but differ by domain).
export type StimulusDomain =
  | "rf"
  | "optical"
  | "acoustic"
  | "magnetic"
  | "electric_field"
  | "chemical"
  | "mechanical"
  | "thermal"
  | "other";

// Role of a PhysicalChannel — gates which channel threats are generated.
export type CouplingMode =
  | "passive_stimulus"  // environment emits, transducer receives (camera, thermometer, mic)
  | "active_reflection" // device emits, reflection returns (radar, LiDAR, ultrasonic) → false-echo/ghost-target
  | "emission"          // device emits outward (laser, RF transmitter, speaker)
  | "actuation";        // device acts on the environment (motor, valve, heater)

// Sensing-side exposure — the REAL attack surface of the physical channel.
// Independent of device PhysicalExposureLevel: a camera can be PEL-internal
// (behind glass) yet optically "exposed".
export type SensingExposure = "shielded" | "partially_exposed" | "exposed";
export type Injectability = "none" | "difficult" | "feasible";

// How freely an attacker can shape the physical conditions of an environment.
export type Controllability = "uncontrolled" | "partially_controlled" | "controlled";

// Standard-agnostic internal severity. Projected onto SIL / ASIL / IEC 62304
// class via a separate mapping layer — never hardcode one standard's scale.
export type SafetyClassification =
  | "unassessed"
  | "minor"
  | "major"
  | "severe"
  | "catastrophic";

// Intrinsic, CONTEXT-FREE worst-case capability of an actuator (fan vs robot arm).
// Seeds prioritisation; distinct from the assessed SafetyClassification.
export type HazardPotential =
  | "unassessed"
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "catastrophic";

// Sensor device physics — gates which injection mechanisms couple in.
export type TransductionPrinciple =
  | "capacitive"
  | "resistive"
  | "piezoelectric"
  | "magnetic"
  | "optical"
  | "mems_inertial"
  | "ultrasonic"
  | "electrochemical"
  | "thermal"
  | "other"
  | "unspecified";

// Effect-based grouping of actuators — drives the hazard archetype and the
// meaning of "safe state". Concrete device kind goes in `type`.
export type ActuatorClass =
  | "motion"          // motor, servo, linear actuator, solenoid — crushing/impact; de-energize may RELEASE a brake
  | "flow"            // valve, pump, damper — overpressure, leakage, loss of cooling
  | "power_switching" // relay, contactor, breaker — unexpected energization, arc
  | "thermal"         // heater, cooler, Peltier — fire/overheat; loss of cooling can be dangerous
  | "emission"        // RF/laser/ultrasonic emitter, speaker — exposure, interference
  | "dispensing"      // dosing pump, injector, sprayer — over/under-dose, contamination
  | "signaling"       // lamp, display, buzzer, HMI — misleading indication → wrong operator action
  | "other"
  | "unspecified";

export type SignalAuthentication =
  | "none"
  | "plausibility_only"
  | "source_authenticated"
  | "cryptographic";

export type CommandAuthentication =
  | "none"
  | "integrity_checked"
  | "source_authenticated"
  | "cryptographic";

export type PlausibilityCheck = "none" | "range" | "range_rate" | "model_based";

// Only "diverse" mitigates common-mode transduction; "homogeneous" covers
// random fault only.
export type SensorRedundancy = "none" | "homogeneous" | "diverse";

export type LossDetection = "none" | "detected_degraded" | "detected_failsafe";

// Determines the outcome under DoS / power loss — the central safety property.
export type SafeState =
  | "none_defined"
  | "de_energize_to_safe"
  | "energize_to_safe"
  | "hold_last";

export type FailBehavior =
  | "unassessed"
  | "fail_dangerous"
  | "fail_safe"
  | "fail_operational";

export type FeedbackVerification =
  | "none"
  | "closed_loop_shared"
  | "closed_loop_independent"; // also the Sensor side of a bidirectional element

export type HardwareInterlock =
  | "none"
  | "sw_bypassable"
  | "independent"; // bounds worst case even if the controller is compromised

// Secondary (reverse) channel capabilities. Each enabled capability pulls in
// its own threat template (firmware_update = persistent compromise; calibration
// = measurement/command integrity; diagnostics/health = info disclosure).
export type SecondaryChannelCapability =
  | "calibration"
  | "config"
  | "diagnostics"
  | "firmware_update"
  | "health_status";

// ==================== TRANSDUCER BASE PROPERTIES ====================
//
// Shared STRUCTURE only. Sensor and Actuator are kept as separate roles with
// their own Context and Security/Safety property sets and asymmetric threat
// semantics (Sensor = input integrity/authenticity; Actuator = consequence).
// This is the first shared base among element-property interfaces — intentional,
// per spec §2.2 (avoids overloading a single merged Transducer form).

export interface TransducerBaseProperties {
  description?: string;

  // ── Context ────────────────────────────────────────────────────────────────
  /** Concrete device kind (descriptive). NOT the threat classifier. */
  type?: string;

  /**
   * Effective topological location. Maintained by the derivation pass from
   * PhysicalBoundary containment — do not hand-edit unless overriding.
   * @see TransducerLocation
   */
  location?: TransducerLocation;

  /** "derived" (from boundary containment) or "override" (analyst set it). */
  locationProvenance?: LocationProvenance;

  /**
   * Device-tamper reachability (open / replace / wire). Reuses the PEL scale.
   * NOTE: sensing-side exposure is a property of the PhysicalChannel, not here.
   * @see PhysicalExposureLevel
   */
  physicalExposureLevel?: PhysicalExposureLevel;

  // ── Secondary channels ───────────────────────────────────────────────────
  /**
   * Reverse-channel capabilities present on this transducer. Each one adds its
   * own threat template. Bidirectionality is also expressed by actual reverse
   * DataFlows in the diagram; this declares what those channels carry.
   * @see SecondaryChannelCapability
   */
  secondaryChannelCapabilities?: SecondaryChannelCapability[];

  // ── Audit ──────────────────────────────────────────────────────────────────
  /** @see SecurityControlRecord */
  securityControlOwnership?: SecurityControlRecord[];

  owner?: string;
  notes?: string;
}

// ==================== SENSOR PROPERTIES ====================
//
// Transducer (physical → cyber). Threat focus: integrity / authenticity /
// availability of the measured value. Active sensors (radar/LiDAR/ultrasonic)
// are NOT flagged here — they are modelled as a dual-role element
// (Sensor + emission Actuator). See spec §2.2.

export interface SensorProperties extends TransducerBaseProperties {
  // ── Context ────────────────────────────────────────────────────────────────
  /** Physical quantity measured (descriptive). */
  measurand?:
    | "temperature"
    | "pressure"
    | "position"
    | "velocity"
    | "flow"
    | "optical"
    | "acoustic"
    | "chemical"
    | "electrical"
    | "other"
    | "unspecified";

  /**
   * Device physics — gates which injection mechanisms couple in.
   * "unspecified" surfaces a refinement finding rather than suppressing threats.
   * @see TransductionPrinciple
   */
  transductionPrinciple?: TransductionPrinciple;

  /**
   * Physical domain the sensor responds to — the attack-catalog key (optical →
   * blinding/projection, acoustic → ultrasonic injection, magnetic → spoofing,
   * thermal → heating, rf → EMI). Intrinsic to the sensor (a camera is optical),
   * so it lives here, not on the physical coupling — usable even when no coupling
   * edge is modelled (Variant B, e.g. a smoke detector → Process). @see StimulusDomain
   */
  stimulusDomain?: StimulusDomain;

  /**
   * Exposure of THIS sensor instance's sensing surface, independent of the
   * device-tamper PEL: a camera can be PEL-internal (behind glass) yet optically
   * "exposed". A property of the installation, not of any single channel, so it
   * seeds physical-attack feasibility even without a modelled coupling edge.
   * @see SensingExposure
   */
  sensingExposure?: SensingExposure;

  // ── Security & Safety ──────────────────────────────────────────────────────
  /** Mitigates Spoofing / Integrity of the measured value. Maps 62443-4-2 FR1/FR3. */
  signalAuthentication?: SignalAuthentication;

  /** Range / rate / model checks. Mitigates injected or spoofed values. */
  plausibilityCheck?: PlausibilityCheck;

  /** Only "diverse" mitigates common-mode transduction. @see SensorRedundancy */
  redundancy?: SensorRedundancy;

  /** Gates whether jamming / blinding (Availability) escalates to a hazard. */
  lossDetection?: LossDetection;

  // ── Safety / Compliance ────────────────────────────────────────────────────
  /**
   * A corrupted reading from this sensor can drive a hazard.
   * undefined = unassessed (validator finding); false = not relevant; true = relevant.
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  /** Assessed consequence magnitude (standard-agnostic). @see SafetyClassification */
  safetyClassification?: SafetyClassification;
}

// ==================== ACTUATOR PROPERTIES ====================
//
// Transducer (cyber → physical). Threat focus: integrity / authenticity of
// commands, availability of the safe-state function. Usually the bowtie top event.

export interface ActuatorProperties extends TransducerBaseProperties {
  // ── Context (primary classifier) ───────────────────────────────────────────
  /**
   * Effect-based class — drives the hazard archetype and safe-state semantics.
   * "unspecified" surfaces a refinement finding. @see ActuatorClass
   */
  actuatorClass?: ActuatorClass;

  /** How it is driven — orthogonal to actuatorClass. */
  energyDomain?:
    | "electrical"
    | "hydraulic"
    | "pneumatic"
    | "thermal"
    | "mechanical"
    | "other"
    | "unspecified";

  /**
   * Intrinsic, context-free worst-case capability (fan vs robot arm). Seeds
   * prioritisation; distinct from the assessed SafetyClassification.
   * @see HazardPotential
   */
  hazardPotential?: HazardPotential;

  // ── Security & Safety ──────────────────────────────────────────────────────
  /** Mitigates Tampering / Spoofing of commands. Maps 62443-4-2 FR1/FR3. */
  commandAuthentication?: CommandAuthentication;

  /**
   * Outcome under DoS / power loss — the central safety property. Read together
   * with actuatorClass (de-energize is NOT automatically safe, e.g. brake release).
   * @see SafeState
   */
  safeState?: SafeState;

  /** Behaviour on internal failure. @see FailBehavior */
  failBehavior?: FailBehavior;

  /**
   * Detects forced / failed actuation. "closed_loop_independent" is also the
   * Sensor side of a bidirectional element. @see FeedbackVerification
   */
  feedbackVerification?: FeedbackVerification;

  /**
   * Bounds the worst-case consequence independently of a compromised controller.
   * "independent" is the mechanical safety path that survives cyber compromise.
   * @see HardwareInterlock
   */
  hardwareInterlock?: HardwareInterlock;

  // ── Safety / Compliance ────────────────────────────────────────────────────
  /**
   * This actuator can drive a hazard.
   * undefined = unassessed (validator finding); false = not relevant; true = relevant.
   */
  safetyRelevant?: boolean;
  safetyRationale?: string;

  /** Assessed consequence magnitude (standard-agnostic). @see SafetyClassification */
  safetyClassification?: SafetyClassification;
}