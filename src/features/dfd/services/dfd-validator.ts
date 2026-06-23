// ==================== DFD VALIDATOR ====================
// Single Responsibility: Orchestrate DFD validation
// This is the public API for DFD validation

import type {
  DFDElement,
  DFDConnection,
  DFDStats,
  DFDValidation,
  ValidationFinding,
} from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";

import {
  validateElements,
  validateDuplicateIdLabels as validateDuplicateElementIds,
} from "./validators/element-validator";
import {
  validateConnections,
  validateDuplicateConnectionIdLabels,
  validateUnconnectedDataflows,
  validateUnconnectedElements,
  validateChipBoundaryConnections,
  validatePhysicalBoundaryConnections,
  validateTransducerConnections,
} from "./validators/connection-validator";
import { validateDataflowLabels } from "./validators/dataflow-label-validator";
import { validateDataflowProperties } from "./validators/dataflow-property-validator";
import { validateAssetProperties } from "./validators/asset-property-validator";
import { validateAssetRelations } from "./validators/asset-relation-validator";
import {
  isComplete,
  validateScenario,
} from "./validators/completeness-validator";
import { ValidationMessages } from "./validators/validator-utils";
import type { DFDGraph } from "../models/dfd-graph-types";

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  /** Which scenario was detected:
   *  'A' (external entity → TB required),
   *  'B' (no EE, TB present → cross-boundary flow required),
   *  'C' (no EE, no TB, PhysicalBoundary present → embedded device),
   *  null (invalid — no boundary modelled or validation errors) */
  scenario: "A" | "B" | "C" | null;
}

export interface ValidateOptions {
  /** Labels of dataflows that are not connected to elements */
  unconnectedDataflows?: string[];
}

/**
 * DFDValidator - Orchestrates validation of DFD structure and completeness
 * 
 * This class delegates to specialized validator modules:
 * - element-validator: Validate elements, names, IDs
 * - connection-validator: Validate dataflows, connections
 * - asset-validator: Validate asset placement, interfaces
 * - asset-relation-validator: Validate asset-element relationships (NEW)
 * - completeness-validator: Validate scenarios and completeness
 */
export class DFDValidator {
  /**
   * Validate DFD data
   */
  validate(
    elements: DFDElement[],
    connections: DFDConnection[],
    assets: DFDAsset[],
    stats: DFDStats,
    graph: DFDGraph,
    options?: ValidateOptions,
  ): ValidationResult {
    const errors: ValidationFinding[] = [];
    const warnings: ValidationFinding[] = [];

    // Early return if no elements
    if (stats.totalElements === 0) {
      errors.push({ key: ValidationMessages.NO_ELEMENTS });
      return {
        isValid: false,
        isComplete: false,
        errors,
        warnings,
        scenario: null,
      };
    }

    // 1. Validate Elements (graph passed for Interface dataflow check)
    validateElements(elements, errors, warnings, graph);
    validateDuplicateElementIds(elements, warnings);

    // 2. Validate Connections
    validateConnections(connections, elements, errors, warnings);
    validateDuplicateConnectionIdLabels(connections, warnings);
    validateUnconnectedDataflows(options?.unconnectedDataflows, warnings);
    validateUnconnectedElements(elements, connections, warnings, graph);
    validateChipBoundaryConnections(connections, elements, errors);
    validatePhysicalBoundaryConnections(connections, elements, errors);
    validateTransducerConnections(connections, elements, errors);
    validateDataflowLabels(connections, elements, errors, warnings);
    validateDataflowProperties(connections, errors, warnings);

    // 3. Validate Asset Properties
    validateAssetProperties(assets, warnings);

    // 4. Validate Asset Relations
    validateAssetRelations(assets, elements, connections, errors, warnings);

    // 5. Validate Scenario & Completeness
    const scenario = validateScenario(
      elements,
      connections,
      stats,
      errors,
      warnings,
      graph,
    );

    const complete = isComplete(
      elements,
      connections,
      assets,
      stats,
      errors,
      warnings,
    );

    return {
      isValid: errors.length === 0,
      isComplete: complete,
      errors,
      warnings,
      scenario,
    };
  }

  /**
   * Create DFDValidation object from validation result
   */
  createValidationData(result: ValidationResult): DFDValidation {
    return {
      isComplete: result.isComplete,
      errors: result.errors,
      warnings: result.warnings,
      lastValidated: new Date().toISOString(),
    };
  }

  /**
   * Quick check if DFD has minimum required elements
   */
  hasMinimumElements(stats: DFDStats): boolean {
    return (
      stats.totalElements > 0 &&
      (stats.processes > 0 || stats.multiprocesses > 0 || stats.dataStores > 0)
    );
  }
}

// Export singleton instance
export const dfdValidator = new DFDValidator();
export default dfdValidator;