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
 */
function validateProcessProperties(
  element: DFDElement,
  warnings: string[]
): void {
  const props = (element.properties ?? {}) as ProcessProperties;

  if (!props.technology) {
    warnings.push(missingProp(element, "technology"));
  }
  if (!props.processSemantic) {
    warnings.push(missingProp(element, "processSemantic"));
  }
  if (!props.runsAs || props.runsAs === "not_specified") {
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
 */
function validateTrustBoundaryProperties(
  element: DFDElement,
  warnings: string[]
): void {
  const props = (element.properties ?? {}) as TrustBoundaryProperties;

  if (!props.boundaryType) {
    warnings.push(missingProp(element, "boundaryType"));
  }
  if (!props.defaultExposureLevel) {
    warnings.push(missingProp(element, "defaultExposureLevel"));
  }
  if (!props.boundaryControlTypes || props.boundaryControlTypes.length === 0) {
    warnings.push(missingProp(element, "boundaryControlTypes"));
  }
}

/**
 * ChipBoundary: chipType, defaultExposureLevel
 * chipType is critical — without it no threat generation occurs.
 */
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