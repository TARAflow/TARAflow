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
import { ValidationMessages } from "./validator-utils";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate required Context-section properties for all DFD elements.
 * Called from validateElements() in element-validator.ts.
 */
export function validateElementProperties(
  elements: DFDElement[],
  warnings: string[]
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
    }
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Build a warning string in the format expected by translateMessage:
 *   KEY|displayId|elementType|field
 *
 * displayId falls back to element name so the UI chip always has a label.
 */
function missingProp(element: DFDElement, field: string): string {
  const displayId = element.displayId ?? element.name;
  return (
    `${ValidationMessages.ELEMENT_MISSING_PROPERTY}` +
    `|${displayId}|${element.type}|${field}`
  );
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
  warnings: string[],
): void {
  const props = (element.properties ?? {}) as ProcessProperties;

  if (!props.technology) {
    warnings.push(missingProp(element, "technology"));
  }
  if (!props.processSemantic) {
    warnings.push(missingProp(element, "processSemantic"));
  }

  // runsAs only applies when an OS process context exists.
  // functional_block = bare-metal / ISR / state machine — no OS, no runsAs.
  // security_boundary = HSM / OP-TEE TA — isolated execution, runsAs N/A.
  const semanticRequiresRunsAs =
    !props.processSemantic || props.processSemantic === "execution_unit";

  if (
    semanticRequiresRunsAs &&
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
  warnings: string[]
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
  warnings: string[]
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
}

/**
 * ExternalEntity: entityType, trustLevel, ownership
 */
function validateExternalEntityProperties(
  element: DFDElement,
  warnings: string[]
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
  warnings: string[],
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
  warnings: string[]
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
  warnings: string[]
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
  warnings: string[]
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