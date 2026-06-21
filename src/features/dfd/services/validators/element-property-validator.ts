// ==================== ELEMENT PROPERTY VALIDATOR ====================
// Single Responsibility: Validate required Context properties on DFD elements.
//
// Pattern mirrors dataflow-property-validator.ts:
//   - All findings are WARNINGs (missing properties are not structural errors)
//   - Message format: ValidationMessages.KEY|displayId|elementType|field
//   - One warning per missing field per element
//
// Message parts:
//   [0] i18n key  — tabs.dfd.validation.element.missingProperty
//   [1] displayId — rendered as chip in UI, used for click-to-select
//   [2] elementType — translated via dfdValidation.elementTypes.*
//   [3] field     — resolved via element_description.{type}.fields.{field}.label

import type { DFDElement } from "../../models/dfd-types";
import type {
  ProcessProperties,
  MultiprocessProperties,
  DataStoreProperties,
  ExternalEntityProperties,
  TrustBoundaryProperties,
  ChipBoundaryProperties,
  PhysicalBoundaryProperties,
  InterfaceProperties,
} from "../../models/element-properties";
import type {
  SensorProperties,
  ActuatorProperties,
} from "../../models/transducer-properties";
import {
  isRunsAsApplicable,
  resolveDataStoreAccessModel,
  DATASTORE_TECH_DEFAULTS,
} from "../../models/element-property-defaults";
import { ValidationMessages, type ValidationFinding } from "./validator-utils";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate required Context-section properties for all DFD elements.
 * Called from validateElements() in element-validator.ts.
 */
export function validateElementProperties(
  elements: DFDElement[],
  warnings: ValidationFinding[],
): void {
  for (const element of elements) {
    switch (element.type) {
      case "Process":
        validateProcessProperties(element, warnings);
        break;
      case "Multiprocess":
        validateMultiprocessProperties(element, warnings);
        break;
      case "DataStore":
        validateDataStoreProperties(element, warnings);
        break;
      case "ExternalEntity":
        validateExternalEntityProperties(element, warnings);
        break;
      case "TrustBoundary":
        validateTrustBoundaryProperties(element, warnings);
        break;
      case "ChipBoundary":
        validateChipBoundaryProperties(element, warnings);
        break;
      case "PhysicalBoundary":
        validatePhysicalBoundaryProperties(element, warnings);
        break;
      case "Interface":
        validateInterfaceProperties(element, warnings);
        break;
      case "Sensor":
        validateSensorProperties(element, warnings);
        break;
      case "Actuator":
        validateActuatorProperties(element, warnings);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Build a finding for a missing Context-section property.
 * elementType + field are passed as separate named params — the panel
 * resolves both via i18n generically (elementType → elementTypes.*,
 * field → element_description.<ns>.fields.<field>.label), no positional
 * decoding needed.
 *
 * displayId falls back to element name so the UI chip always has a label.
 */
function missingProp(element: DFDElement, field: string): ValidationFinding {
  const displayId = element.displayId ?? element.name;
  return {
    key: ValidationMessages.ELEMENT_MISSING_PROPERTY,
    displayId,
    elementId: element.id,
    params: { elementType: element.type, field, name: element.name },
  };
}

// ---------------------------------------------------------------------------
// Per-type validators
// ---------------------------------------------------------------------------

/**
 * Process: technology, processSemantic, runsAs
 *
 * runsAs is only meaningful when an OS process context exists.
 * When processSemantic === "functional_block", the element represents a
 * bare-metal logic block, ISR, or state machine — there is no OS, no
 * privilege separation, and no applicable runsAs value. The field is
 * disabled in the UI for this semantic; do not warn about it.
 *
 * Similarly, processSemantic === "security_boundary" (HSM, OP-TEE TA)
 * has its own isolated execution model — runsAs is not applicable.
 */
function validateProcessProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as ProcessProperties;

  if (!props.technology) {
    warnings.push(missingProp(element, "technology"));
  }
  if (!props.processSemantic) {
    warnings.push(missingProp(element, "processSemantic"));
  }

  // runsAs only applies to OS-hosted processes. Embedded / no-OS technologies
  // (RTOS, bare-metal, ISR, driver, bootloader, ...) and non-execution_unit
  // semantics have no OS user model — the form disables the field for exactly
  // these cases, so the validator must not require it. isRunsAsApplicable is the
  // shared predicate (same one the form uses to disable), keeping them in sync.
  if (
    isRunsAsApplicable(props) &&
    (!props.runsAs || props.runsAs === "not_specified")
  ) {
    warnings.push(missingProp(element, "runsAs"));
  }
}

/**
 * Multiprocess: systemClass, operatingSystem
 * systemClass is critical — without it no threat generation occurs.
 */
function validateMultiprocessProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as MultiprocessProperties;

  if (!props.systemClass) {
    warnings.push(missingProp(element, "systemClass"));
  }

  // operatingSystem is not applicable for cloud_platform (PaaS/Serverless)
  const skipOs = props.systemClass === "cloud_platform";
  if (!skipOs && !props.operatingSystem) {
    warnings.push(missingProp(element, "operatingSystem"));
  }
}

/**
 * DataStore: technology, dataClassification, storedDataTypes
 * storedDataTypes is critical — without it threat templates cannot determine
 * which Information Disclosure / Tampering threats apply.
 */
function validateDataStoreProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as DataStoreProperties;

  if (!props.technology) {
    warnings.push(missingProp(element, "technology"));
  }
  if (!props.dataClassification) {
    warnings.push(missingProp(element, "dataClassification"));
  }
  if (!props.storedDataTypes || props.storedDataTypes.length === 0) {
    warnings.push(missingProp(element, "storedDataTypes"));
  }

  // accessModel deviating from the technology default needs a rationale
  // (IEC 62443-4-1 traceability — mirrors locationRationale for exposureLevel).
  // Fires on the effective contradiction regardless of how Source got set, so
  // it is robust even if a form omits accessModelSource.
  if (props.technology && props.accessModel) {
    const techDefault = DATASTORE_TECH_DEFAULTS[props.technology]?.accessModel;
    if (
      techDefault &&
      props.accessModel !== techDefault &&
      !props.accessModelRationale?.trim()
    ) {
      warnings.push({
        key: ValidationMessages.DS_ACCESSMODEL_OVERRIDE_NO_RATIONALE,
        displayId: element.displayId ?? element.name,
        elementId: element.id,
        params: {
          name: element.name,
          accessModel: props.accessModel,
          technology: props.technology,
        },
      });
    }
  }

  // mpu_protected is direct memory by nature — declaring it "communication" is
  // contradictory unless explicitly justified. Catches the hardware-signal
  // conflict even when technology is unset (resolve falls back to the default).
  if (
    props.accessControlMechanism === "mpu_protected" &&
    resolveDataStoreAccessModel(props) === "communication" &&
    !props.accessModelRationale?.trim()
  ) {
    warnings.push({
      key: ValidationMessages.DS_ACCESSMODEL_MPU_COMMUNICATION_CONFLICT,
      displayId: element.displayId ?? element.name,
      elementId: element.id,
      params: { name: element.name },
    });
  }
}

/**
 * ExternalEntity: entityType, trustLevel, ownership
 */
function validateExternalEntityProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as ExternalEntityProperties;

  if (!props.entityType) {
    warnings.push(missingProp(element, "entityType"));
  }
  if (!props.trustLevel) {
    warnings.push(missingProp(element, "trustLevel"));
  }
  if (!props.ownership) {
    warnings.push(missingProp(element, "ownership"));
  }
}

/**
 * TrustBoundary: boundaryType, defaultExposureLevel, boundaryControlTypes
 *
 * boundaryControlTypes is only required for network-oriented boundary types.
 * Hardware/chip/internal boundaries (e.g. MCU Secure vs Non-Secure World,
 * bare-metal zone separation) have no applicable network security controls —
 * omitting this field is structurally correct, not a gap.
 *
 * Network-oriented types: network, dmz, internet, cloud, vpn
 * Hardware-oriented types: hardware, chip, internal, embedded — exempt
 */
function validateTrustBoundaryProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as TrustBoundaryProperties;

  if (!props.boundaryType) {
    warnings.push(missingProp(element, "boundaryType"));
  }
  if (!props.defaultExposureLevel) {
    warnings.push(missingProp(element, "defaultExposureLevel"));
  }

  // boundaryControlTypes only applies to network-oriented boundaries.
  // Hardware/chip/internal boundaries have no network security controls —
  // the warning would be a false positive for embedded/MCU systems.
  // Network/software-oriented boundary types where security controls apply.
  // Embedded-specific types (peripheral, boot, debug) have no applicable
  // BoundaryControlType entries — hardware enforces the boundary, not software.
  // privilege/organization/legal/device are also typically control-free in
  // embedded contexts; only network and cloud boundaries need explicit controls.
  const CONTROLS_REQUIRED_BOUNDARY_TYPES: string[] = ["network", "cloud"];
  const isNetworkBoundary =
    !props.boundaryType ||
    CONTROLS_REQUIRED_BOUNDARY_TYPES.includes(props.boundaryType);

  if (
    isNetworkBoundary &&
    (!props.boundaryControlTypes || props.boundaryControlTypes.length === 0)
  ) {
    warnings.push(missingProp(element, "boundaryControlTypes"));
  }
}

/**
 * ChipBoundary: chipType, defaultExposureLevel
 * chipType is critical — without it no threat generation occurs.
 */
/**
 * PhysicalBoundary: boundaryType (required), physicalExposureLevel (required),
 * physicalMobility (required for device_enclosure + vehicle),
 * accessibility (required).
 *
 * physicalMobility warning is only raised when boundaryType is one that
 * can physically move (device_enclosure, vehicle) — rooms and buildings
 * are implicitly fixed.
 */
function validatePhysicalBoundaryProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as PhysicalBoundaryProperties;

  // boundaryType is the primary classifier — always required
  if (!props.boundaryType) {
    warnings.push(missingProp(element, "boundaryType"));
  }

  // physicalExposureLevel required — drives threat feasibility scoring
  if (!props.physicalExposureLevel) {
    warnings.push(missingProp(element, "physicalExposureLevel"));
  }

  // accessibility required — captures environmental/attacker context
  if (!props.accessibility) {
    warnings.push(missingProp(element, "accessibility"));
  }

  // physicalMobility only required for types that can actually move
  const mobilityRelevantTypes: PhysicalBoundaryProperties["boundaryType"][] = [
    "device_enclosure",
    "vehicle",
  ];
  if (
    props.boundaryType &&
    mobilityRelevantTypes.includes(props.boundaryType) &&
    !props.physicalMobility
  ) {
    warnings.push(missingProp(element, "physicalMobility"));
  }
}

function validateChipBoundaryProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as ChipBoundaryProperties;

  if (!props.chipType) {
    warnings.push(missingProp(element, "chipType"));
  }
  if (!props.defaultExposureLevel) {
    warnings.push(missingProp(element, "defaultExposureLevel"));
  }
}

/**
 * Interface: type, location, operationalState, exposureLevel
 *
 * location — required for ExposureLevel derivation and physical attack surface
 * operationalState — required for correct threat prioritisation:
 *   permanent_disabled → no threats generated
 *   sw_disabled        → threats at reduced priority
 *   enabled            → full threat surface
 * Only validated when type is set (type missing is already warned separately).
 */
function validateInterfaceProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as InterfaceProperties;

  if (!props.type) {
    warnings.push(missingProp(element, "type"));
  }
  if (!props.location) {
    warnings.push(missingProp(element, "location"));
  }
  // Only warn on operationalState when type is set — avoids duplicate noise
  // on completely empty interfaces
  if (props.type && !props.operationalState) {
    warnings.push(missingProp(element, "operationalState"));
  }
  if (!props.exposureLevel) {
    warnings.push(missingProp(element, "exposureLevel"));
  }
}
/**
 * Sensor: measurand, transductionPrinciple (unspecified ⇒ finding),
 * signalAuthentication, plausibilityCheck, safetyRelevant (undefined ⇒ unassessed).
 *
 * Input side of the bowtie: a forged or suppressed reading can defeat a safety
 * function, so an unassessed safetyRelevant is surfaced rather than silently
 * assumed false (reduction must be earned).
 */
function validateSensorProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as SensorProperties;

  if (!props.measurand) {
    warnings.push(missingProp(element, "measurand"));
  }
  if (
    !props.transductionPrinciple ||
    props.transductionPrinciple === "unspecified"
  ) {
    warnings.push(missingProp(element, "transductionPrinciple"));
  }
  // stimulusDomain is the attack-catalog key (optical→blinding, acoustic→injection,
  // …) — needed for physical threat generation even in Variant B (no coupling edge).
  if (!props.stimulusDomain) {
    warnings.push(missingProp(element, "stimulusDomain"));
  }
  if (!props.signalAuthentication) {
    warnings.push(missingProp(element, "signalAuthentication"));
  }
  if (!props.plausibilityCheck) {
    warnings.push(missingProp(element, "plausibilityCheck"));
  }
  if (props.safetyRelevant === undefined) {
    warnings.push(missingProp(element, "safetyRelevant"));
  }
}

/**
 * Actuator: actuatorClass (unspecified ⇒ finding), hazardPotential (unassessed),
 * safeState (none_defined ⇒ finding), commandAuthentication,
 * safetyRelevant (undefined ⇒ unassessed).
 *
 * Output side / typical bowtie top event: forced, blocked or absent actuation
 * IS the hazard. De-energize is not automatically safe — safeState must be set
 * explicitly, so none_defined is reported.
 */
function validateActuatorProperties(
  element: DFDElement,
  warnings: ValidationFinding[],
): void {
  const props = (element.properties ?? {}) as ActuatorProperties;

  if (!props.actuatorClass || props.actuatorClass === "unspecified") {
    warnings.push(missingProp(element, "actuatorClass"));
  }
  if (!props.hazardPotential || props.hazardPotential === "unassessed") {
    warnings.push(missingProp(element, "hazardPotential"));
  }
  if (!props.safeState || props.safeState === "none_defined") {
    warnings.push(missingProp(element, "safeState"));
  }
  if (!props.commandAuthentication) {
    warnings.push(missingProp(element, "commandAuthentication"));
  }
  if (props.safetyRelevant === undefined) {
    warnings.push(missingProp(element, "safetyRelevant"));
  }
}