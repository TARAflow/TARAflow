// ==================== DFD VALIDATOR ====================
// Single Responsibility: Orchestrate DFD validation
// This is the public API for DFD validation

import type {
  DFDElement,
  DFDConnection,
  DFDAsset,
  DFDStats,
  DFDValidation,
} from "../models/dfd-types";

import {
  validateElements,
  validateDuplicateIdLabels as validateDuplicateElementIds,
} from "./validators/element-validator";
import {
  validateConnections,
  validateDuplicateConnectionIdLabels,
  validateUnconnectedDataflows,
  validateUnconnectedElements,
} from "./validators/connection-validator";
import { validateAssetsAndInterfaces } from "./validators/asset-validator";
import { validateAssetRelations } from "./validators/asset-relation-validator";
import {
  isComplete,
  validateScenario,
} from "./validators/completeness-validator";
import { dfdAnalyzer } from "../utils/dfd-analyzer";
import { ValidationMessages } from "./validators/validator-utils";
import type { DFDGraph } from "../models/dfd-graph-types";

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  /** Which scenario was detected: 'A' (external entity), 'B' (internal only), or null */
  scenario: 'A' | 'B' | null;
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
    options?: ValidateOptions,
    graph?: DFDGraph,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Im Validator vor dem Aufruf
    console.log("DfdValidator Elements:", elements);
    console.log("DfdValidator Assets:", assets);
    console.log(
      "DfdValidator Trust Boundaries:",
      elements.filter((e) => e.type === "TrustBoundary"),
    );

    // Early return if no elements
    if (stats.totalElements === 0) {
      errors.push(ValidationMessages.NO_ELEMENTS);
      return {
        isValid: false,
        isComplete: false,
        errors,
        warnings,
        scenario: null,
      };
    }

    // 1. Validate Elements
    validateElements(elements, errors, warnings);
    validateDuplicateElementIds(elements, warnings);

    // 2. Validate Connections
    validateConnections(connections, elements, errors, warnings);
    validateDuplicateConnectionIdLabels(connections, warnings);
    validateUnconnectedDataflows(options?.unconnectedDataflows, warnings);
    validateUnconnectedElements(elements, connections, warnings);

    // 3. Validate Assets & Interfaces
    validateAssetsAndInterfaces(
      assets,
      elements,
      connections,
      warnings,
      dfdAnalyzer,
      graph,
    );

    // 4. Validate Asset Relations (NEW)
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