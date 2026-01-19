// ==================== DFD VALIDATOR ====================
// Single Responsibility: Validate DFD structure and completeness

import {
  DFDAsset,
  DFDElement,
  DFDConnection,
  DFDStats,
  DFDValidation,
} from "../models/dfd-types";
import { dfdAnalyzer } from "../utils/dfd-analyzer";

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

// ==================== VALIDATION MESSAGE KEYS ====================
// These keys are used for i18n translation in the UI layer

export const ValidationMessages = {
  // General
  NO_ELEMENTS: "dfdValidation.noElements",
  NO_PROCESS_OR_DATASTORE: "dfdValidation.noProcessOrDatastore",
  NO_DATAFLOWS: "dfdValidation.noDataflows",

  // Trust Boundary
  NO_TRUST_BOUNDARY: "dfdValidation.noTrustBoundary",
  NEED_TWO_TRUST_BOUNDARIES: "dfdValidation.needTwoTrustBoundaries",
  EMPTY_TRUST_BOUNDARY: "dfdValidation.emptyTrustBoundary",
  TRUST_BOUNDARY_MISSING_ID: "dfdValidation.trustBoundaryMissingId",

  // Element placement
  NO_ELEMENT_INSIDE_TB: "dfdValidation.noElementInsideTrustBoundary",
  ELEMENT_OUTSIDE_ALL_TB: "dfdValidation.elementOutsideAllTrustBoundaries",
  EXTERNAL_ENTITY_INSIDE_TB: "dfdValidation.externalEntityInsideTrustBoundary",

  // Connections
  NO_INTERNAL_EXTERNAL_FLOW: "dfdValidation.noInternalExternalFlow",
  NO_CROSS_BOUNDARY_FLOW: "dfdValidation.noCrossBoundaryFlow",
  UNCONNECTED_ELEMENT: "dfdValidation.unconnectedElement",
  UNCONNECTED_DATAFLOW: "dfdValidation.unconnectedDataflow",
  INVALID_DATAFLOW_SOURCE: "dfdValidation.invalidDataflowSource",
  INVALID_DATAFLOW_TARGET: "dfdValidation.invalidDataflowTarget",

  // Asset & Interface (NEW)
  ASSET_NOT_PLACED: "dfdValidation.assetNotPlaced",
  INTERFACE_UNUSED: "dfdValidation.interfaceUnused",

  // Naming & ID Labels
  ELEMENT_DEFAULT_NAME: "dfdValidation.elementDefaultName",
  ELEMENT_MISSING_IDLABEL: "dfdValidation.elementMissingIdLabel",
  DUPLICATE_IDLABEL: "dfdValidation.duplicateIdLabel",
} as const;

/**
 * DFDValidator - Validates DFD structure and completeness
 *
 * Supports two validation scenarios:
 *
 * Scenario A – Classic Threat Model DFD (with External Entity)
 * Valid when:
 * 1. ≥ 1 Trust Boundary exists
 * 2. ≥ 1 internal Process or DataStore
 * 3. ≥ 1 External Entity (outside TB)
 * 4. At least 1 dataflow between internal ↔ external
 *
 * Scenario B – Internal Threat Modelling (without External Entity)
 * Valid when:
 * 1. ≥ 2 Trust Boundaries exist
 * 2. Each TB contains at least one Process or DataStore
 * 3. At least 1 dataflow crosses a Trust Boundary
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
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

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

    // Check for unconnected dataflows
    this.validateUnconnectedDataflows(options?.unconnectedDataflows, warnings);

    // Check basic connection validity
    this.validateConnectionsExist(connections, elements, errors);

    // Check for default/placeholder names
    this.validateElementNames(elements, warnings);

    // Check for missing ID labels
    this.validateIdLabels(elements, connections, warnings);

    // Check for duplicate ID labels
    this.validateDuplicateIdLabels(elements, connections, warnings);

    // Determine which scenario applies and validate accordingly
    const hasExternalEntities = stats.externalEntities > 0;
    const scenario = hasExternalEntities ? "A" : "B";

    if (scenario === "A") {
      this.validateScenarioA(elements, connections, stats, errors, warnings);
    } else {
      this.validateScenarioB(elements, connections, stats, errors, warnings);
    }

    // Validate Assets and Interfaces
    this.validateAssetsAndInterfaces(assets, elements, connections, warnings);

    return {
      isValid: errors.length === 0,
      isComplete: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
      scenario: errors.length === 0 ? scenario : null,
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

  // ==================== SCENARIO A: Classic Threat Model ====================

  private validateScenarioA(
    elements: DFDElement[],
    connections: DFDConnection[],
    stats: DFDStats,
    errors: string[],
    warnings: string[],
  ): void {
    // 1. ≥ 1 Trust Boundary
    if (stats.trustBoundaries === 0) {
      errors.push(ValidationMessages.NO_TRUST_BOUNDARY);
      return; // Can't validate further without TB
    }

    // Get trust boundaries for further validation
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    // 1b. Validate Trust Boundary IDs (must have [ID] suffix)
    this.validateTrustBoundaryIds(trustBoundaries, errors);

    // 2. ≥ 1 internal Process, Multiprocess or DataStore
    const internalElementCount =
      stats.processes + stats.multiprocesses + stats.dataStores;
    if (internalElementCount === 0) {
      errors.push(ValidationMessages.NO_PROCESS_OR_DATASTORE);
      return;
    }

    // 3. At least one Process/Multiprocess/DataStore must be INSIDE a Trust Boundary
    const processesAndStores = elements.filter(
      (e) =>
        e.type === "Process" ||
        e.type === "Multiprocess" ||
        e.type === "DataStore",
    );

    const hasElementInsideTB = processesAndStores.some((element) =>
      trustBoundaries.some((tb) =>
        dfdAnalyzer.isElementInsideBoundary(element, tb),
      ),
    );

    if (!hasElementInsideTB) {
      errors.push(ValidationMessages.NO_ELEMENT_INSIDE_TB);
    }

    // 4. External Entity should be OUTSIDE all Trust Boundaries
    const externalEntities = elements.filter(
      (e) => e.type === "ExternalEntity",
    );
    const externalInsideTB = externalEntities.filter((ext) =>
      trustBoundaries.some((tb) =>
        dfdAnalyzer.isElementInsideBoundary(ext, tb),
      ),
    );

    if (externalInsideTB.length > 0) {
      externalInsideTB.forEach((ext) => {
        warnings.push(
          `${ValidationMessages.EXTERNAL_ENTITY_INSIDE_TB}:${
            ext.name || ext.id
          }`,
        );
      });
    }

    // 5. At least 1 dataflow between internal ↔ external
    const hasInternalExternalFlow = this.hasDataflowBetweenInternalAndExternal(
      elements,
      connections,
    );

    if (!hasInternalExternalFlow) {
      errors.push(ValidationMessages.NO_INTERNAL_EXTERNAL_FLOW);
    }

    // 6. Check for unconnected elements (WARNING) - includes ExternalEntities
    const allConnectableElements = elements.filter(
      (e) =>
        e.type === "Process" ||
        e.type === "Multiprocess" ||
        e.type === "DataStore" ||
        e.type === "ExternalEntity",
    );
    this.validateUnconnectedElements(
      allConnectableElements,
      connections,
      warnings,
    );

    // Optional warnings
    if (stats.dataFlows === 0) {
      warnings.push(ValidationMessages.NO_DATAFLOWS);
    }
  }

  // ==================== SCENARIO B: Internal Threat Model ====================

  private validateScenarioB(
    elements: DFDElement[],
    connections: DFDConnection[],
    stats: DFDStats,
    errors: string[],
    warnings: string[],
  ): void {
    // Get trust boundaries first (needed for ID validation even if count < 2)
    const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

    // 1a. Validate Trust Boundary IDs (must have [ID] suffix)
    // Do this BEFORE checking count, so we always validate IDs
    if (trustBoundaries.length > 0) {
      this.validateTrustBoundaryIds(trustBoundaries, errors);
    }

    // 1b. ≥ 2 Trust Boundaries
    if (stats.trustBoundaries < 2) {
      errors.push(ValidationMessages.NEED_TWO_TRUST_BOUNDARIES);
      return; // Can't validate further
    }

    const processesAndStores = elements.filter(
      (e) =>
        e.type === "Process" ||
        e.type === "Multiprocess" ||
        e.type === "DataStore",
    );

    // Error if no processes/multiprocesses/datastores at all
    if (processesAndStores.length === 0) {
      errors.push(ValidationMessages.NO_PROCESS_OR_DATASTORE);
      return;
    }

    // 2. Each TB contains at least one Process/Multiprocess/DataStore
    const emptyBoundaries = this.findEmptyTrustBoundaries(
      trustBoundaries,
      processesAndStores,
    );
    if (emptyBoundaries.length > 0) {
      emptyBoundaries.forEach((tb) => {
        errors.push(
          `${ValidationMessages.EMPTY_TRUST_BOUNDARY}:${tb.name || tb.id}`,
        );
      });
    }

    // 3. Elements outside Trust Boundaries (WARNING - might be intentional)
    const elementsOutsideTB = this.findElementsOutsideAllBoundaries(
      trustBoundaries,
      processesAndStores,
    );
    if (elementsOutsideTB.length > 0) {
      elementsOutsideTB.forEach((element) => {
        warnings.push(
          `${ValidationMessages.ELEMENT_OUTSIDE_ALL_TB}:${element.type}:${
            element.name || element.id
          }`,
        );
      });
    }

    // 4. At least 1 dataflow crosses a Trust Boundary
    const hasCrossBoundaryFlow = this.hasDataflowCrossingTrustBoundary(
      elements,
      connections,
      trustBoundaries,
    );

    if (!hasCrossBoundaryFlow) {
      errors.push(ValidationMessages.NO_CROSS_BOUNDARY_FLOW);
    }

    // 5. Check for unconnected elements (WARNING)
    this.validateUnconnectedElements(processesAndStores, connections, warnings);
  }

  /**
   * Find elements that are not inside any Trust Boundary
   */
  private findElementsOutsideAllBoundaries(
    trustBoundaries: DFDElement[],
    elements: DFDElement[],
  ): DFDElement[] {
    return elements.filter((element) => {
      const isInsideAnyTB = trustBoundaries.some((tb) =>
        dfdAnalyzer.isElementInsideBoundary(element, tb),
      );
      return !isInsideAnyTB;
    });
  }

  /**
   * Check for elements that have no dataflow connections (WARNING)
   */
  private validateUnconnectedElements(
    elements: DFDElement[],
    connections: DFDConnection[],
    warnings: string[],
  ): void {
    // Get all element IDs that are connected
    const connectedIds = new Set<string>();
    connections.forEach((conn) => {
      connectedIds.add(conn.from);
      connectedIds.add(conn.to);
    });

    // Find elements with no connections
    elements.forEach((element) => {
      if (!connectedIds.has(element.id)) {
        warnings.push(
          `${ValidationMessages.UNCONNECTED_ELEMENT}:${element.type}:${
            element.name || element.id
          }`,
        );
      }
    });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if there's at least one dataflow between internal (Process/DataStore)
   * and external (ExternalEntity) elements
   */
  private hasDataflowBetweenInternalAndExternal(
    elements: DFDElement[],
    connections: DFDConnection[],
  ): boolean {
    const externalIds = new Set(
      elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id),
    );
    const internalIds = new Set(
      elements
        .filter(
          (e) =>
            e.type === "Process" ||
            e.type === "Multiprocess" ||
            e.type === "DataStore",
        )
        .map((e) => e.id),
    );

    return connections.some((conn) => {
      const fromExternal = externalIds.has(conn.from);
      const toExternal = externalIds.has(conn.to);
      const fromInternal = internalIds.has(conn.from);
      const toInternal = internalIds.has(conn.to);

      // Either: external → internal OR internal → external
      return (fromExternal && toInternal) || (fromInternal && toExternal);
    });
  }

  /**
   * Find Trust Boundaries that don't contain any Process or DataStore
   * Uses geometric containment check
   */
  private findEmptyTrustBoundaries(
    trustBoundaries: DFDElement[],
    processesAndStores: DFDElement[],
  ): DFDElement[] {
    return trustBoundaries.filter((tb) => {
      // Check if any process/store is geometrically inside this TB
      const hasContent = processesAndStores.some((element) =>
        dfdAnalyzer.isElementInsideBoundary(element, tb),
      );
      return !hasContent;
    });
  }

  /**
   * Validate that all Trust Boundaries have a valid ID in square brackets
   * Format: "Name [ID]" where ID contains only letters, numbers, -, _
   *
   * Valid examples:
   * - "Trust Boundary [TB]"
   * - "Embedded Device [ED-01]"
   * - "Cloud Environment [CLOUD_PROD]"
   *
   * Invalid examples:
   * - "Trust Boundary" (no ID)
   * - "Trust Boundary []" (empty ID)
   * - "Trust Boundary [TB!]" (invalid character)
   */
  private validateTrustBoundaryIds(
    trustBoundaries: DFDElement[],
    errors: string[],
  ): void {
    // Pattern: [ID] at the end, where ID is alphanumeric with - and _
    const idPattern = /\[([a-zA-Z0-9_-]+)\]\s*$/;

    trustBoundaries.forEach((tb) => {
      const name = tb.name || "";

      if (!idPattern.test(name)) {
        errors.push(
          `${ValidationMessages.TRUST_BOUNDARY_MISSING_ID}:${name || tb.id}`,
        );
      }
    });
  }

  /**
   * Extract the ID from a Trust Boundary name
   * Returns null if no valid ID found
   */
  public extractTrustBoundaryId(name: string): string | null {
    const idPattern = /\[([a-zA-Z0-9_-]+)\]\s*$/;
    const match = name.match(idPattern);
    return match ? match[1] : null;
  }

  /**
   * Check if there's at least one dataflow that crosses a Trust Boundary
   * (source and target are in different Trust Boundaries)
   */
  private hasDataflowCrossingTrustBoundary(
    elements: DFDElement[],
    connections: DFDConnection[],
    trustBoundaries: DFDElement[],
  ): boolean {
    if (trustBoundaries.length < 2) return false;

    // Map each element to which TB it belongs to (or null if outside)
    const elementToBoundary = new Map<string, string | null>();

    elements.forEach((element) => {
      if (element.type === "TrustBoundary") return;

      const containingTB = trustBoundaries.find((tb) =>
        dfdAnalyzer.isElementInsideBoundary(element, tb),
      );
      elementToBoundary.set(element.id, containingTB?.id || null);
    });

    // Check if any connection crosses boundaries
    return connections.some((conn) => {
      const fromBoundary = elementToBoundary.get(conn.from);
      const toBoundary = elementToBoundary.get(conn.to);

      // Crosses if they're in different boundaries (including null = outside)
      return fromBoundary !== toBoundary;
    });
  }

  /**
   * Validate that all connections reference existing elements
   */
  private validateConnectionsExist(
    connections: DFDConnection[],
    elements: DFDElement[],
    errors: string[],
  ): void {
    const elementIds = new Set(elements.map((e) => e.id));

    connections.forEach((conn) => {
      const label = conn.label || conn.id;

      if (!elementIds.has(conn.from)) {
        errors.push(`${ValidationMessages.INVALID_DATAFLOW_SOURCE}:${label}`);
      }
      if (!elementIds.has(conn.to)) {
        errors.push(`${ValidationMessages.INVALID_DATAFLOW_TARGET}:${label}`);
      }
    });
  }

  /**
   * Add warnings for unconnected dataflows
   */
  private validateUnconnectedDataflows(
    unconnectedDataflows: string[] | undefined,
    warnings: string[],
  ): void {
    if (!unconnectedDataflows || unconnectedDataflows.length === 0) return;

    unconnectedDataflows.forEach((label) => {
      warnings.push(`${ValidationMessages.UNCONNECTED_DATAFLOW}:${label}`);
    });
  }

  // ==================== ASSET & INTERFACE VALIDATION ====================

  /**
   * Validate Assets and Interfaces
   */
  private validateAssetsAndInterfaces(
    assets: DFDAsset[],
    elements: DFDElement[],
    connections: DFDConnection[],
    warnings: string[],
  ): void {
    // Separate interfaces from elements
    const interfaces = elements.filter((e) => e.type === "Interface");

    // Validate Assets (must overlap with Process, Multiprocess, DataStore, OR Dataflow)
    this.validateAssetPlacement(assets, elements, connections, warnings);

    // Validate Interfaces (must have dataflow passing through)
    this.validateInterfaceUsage(interfaces, connections, elements, warnings);
  }

  /**
   * Validate that Assets are placed on valid elements (with partial overlap)
   */
  private validateAssetPlacement(
    assets: DFDAsset[],
    allElements: DFDElement[],
    connections: DFDConnection[],
    warnings: string[],
  ): void {
    assets.forEach((asset) => {
      // Use DFDAnalyzer to check if asset has valid placement
      const hasValidPlacement = dfdAnalyzer.validateAssetPlacement(
        asset,
        allElements,
        connections,
      );

      if (!hasValidPlacement) {
        warnings.push(`${ValidationMessages.ASSET_NOT_PLACED}:${asset.id}`);
      }
    });
  }

  /**
   * Validate that Interfaces have at least one dataflow passing through them
   */
  private validateInterfaceUsage(
    interfaces: DFDElement[],
    connections: DFDConnection[],
    allElements: DFDElement[],
    warnings: string[],
  ): void {
    interfaces.forEach((iface) => {
      // Use DFDAnalyzer to find dataflows through interface
      const dataflowsThrough = dfdAnalyzer.findDataflowsThroughInterface(
        iface,
        connections,
        allElements,
      );

      if (dataflowsThrough.length === 0) {
        warnings.push(
          `${ValidationMessages.INTERFACE_UNUSED}:${iface.name || iface.id}`,
        );
      }
    });
  }

  // ==================== NAMING & ID LABEL VALIDATION ====================

  /**
   * Default/placeholder names that indicate user hasn't renamed the element
   */
  private readonly DEFAULT_NAMES = [
    // English defaults
    "process",
    "external entity",
    "data store",
    "datastore",
    "trust boundary",
    "multiprocess",
    "asset",
    "interface",
    "external",
    "entity",
    "boundary",
    // German defaults
    "prozess",
    "externe entität",
    "datenspeicher",
    "vertrauensgrenze",
    "multiprozess",
    "schnittstelle",
    // Generic
    "name",
    "label",
    "new",
    "neu",
    "untitled",
    "unbenannt",
  ];

  /**
   * Check for elements with default/placeholder names
   */
  private validateElementNames(
    elements: DFDElement[],
    warnings: string[],
  ): void {
    const connectableTypes = [
      "Process",
      "Multiprocess",
      "DataStore",
      "ExternalEntity",
      "TrustBoundary",
    ];

    for (const element of elements) {
      if (!connectableTypes.includes(element.type)) continue;

      const name = element.name.toLowerCase().trim();

      // Check if name matches a default name
      const isDefault = this.DEFAULT_NAMES.some(
        (defaultName) =>
          name === defaultName ||
          name.startsWith(defaultName + " ") ||
          name.endsWith(" " + defaultName),
      );

      // Also check for very short names (1-2 chars) that aren't ID labels
      const isTooShort = name.length <= 2 && !name.match(/^[a-z]{1,2}-?\d+$/i);

      if (isDefault || isTooShort) {
        warnings.push(
          `${ValidationMessages.ELEMENT_DEFAULT_NAME}:${element.name}`,
        );
      }
    }
  }

  /**
   * Check for elements and connections missing ID labels (displayId)
   */
  private validateIdLabels(
    elements: DFDElement[],
    connections: DFDConnection[],
    warnings: string[],
  ): void {
    // Check elements that should have ID labels (excluding TrustBoundary - they have different format)
    const typesNeedingIds = [
      "Process",
      "Multiprocess",
      "DataStore",
      "ExternalEntity",
    ];

    for (const element of elements) {
      if (!typesNeedingIds.includes(element.type)) continue;

      // Check if element has displayId or [ID] in name
      const hasDisplayId = Boolean(element.displayId);
      const hasIdInName = /\[[A-Z]+-?\d+\]/i.test(element.name);

      if (!hasDisplayId && !hasIdInName) {
        warnings.push(
          `${ValidationMessages.ELEMENT_MISSING_IDLABEL}:${element.name}`,
        );
      }
    }

    // Trust Boundaries have a different ID format - just [XX] without number is valid
    // This is already validated in validateTrustBoundaryIds()

    // Check connections (DataFlows)
    for (const connection of connections) {
      const hasDisplayId = Boolean(connection.displayId);
      const hasIdInLabel =
        connection.label && /\[DF-?\d+\]/i.test(connection.label);

      if (!hasDisplayId && !hasIdInLabel) {
        const label = connection.label || `Connection ${connection.id}`;
        warnings.push(`${ValidationMessages.ELEMENT_MISSING_IDLABEL}:${label}`);
      }
    }
  }

  /**
   * Check for duplicate ID labels
   */
  private validateDuplicateIdLabels(
    elements: DFDElement[],
    connections: DFDConnection[],
    warnings: string[],
  ): void {
    const idLabels = new Map<string, string[]>(); // id -> [element names]

    // Collect element displayIds
    for (const element of elements) {
      if (element.displayId) {
        const id = element.displayId.toUpperCase();
        if (!idLabels.has(id)) {
          idLabels.set(id, []);
        }
        idLabels.get(id)!.push(element.name);
      }

      // Also check for [ID] in name
      const match = element.name.match(/\[([A-Z]+-?\d+)\]/i);
      if (match) {
        const id = match[1].toUpperCase();
        if (!idLabels.has(id)) {
          idLabels.set(id, []);
        }
        // Only add if not already added via displayId
        if (!element.displayId || element.displayId.toUpperCase() !== id) {
          idLabels.get(id)!.push(element.name);
        }
      }
    }

    // Collect connection displayIds
    for (const connection of connections) {
      if (connection.displayId) {
        const id = connection.displayId.toUpperCase();
        if (!idLabels.has(id)) {
          idLabels.set(id, []);
        }
        idLabels.get(id)!.push(connection.label || `DataFlow ${connection.id}`);
      }

      // Also check for [DF-N] in label
      if (connection.label) {
        const match = connection.label.match(/\[(DF-?\d+)\]/i);
        if (match) {
          const id = match[1].toUpperCase();
          if (!idLabels.has(id)) {
            idLabels.set(id, []);
          }
          // Only add if not already added via displayId
          if (
            !connection.displayId ||
            connection.displayId.toUpperCase() !== id
          ) {
            idLabels.get(id)!.push(connection.label);
          }
        }
      }
    }

    // Report duplicates
    idLabels.forEach((names, id) => {
      if (names.length > 1) {
        warnings.push(`${ValidationMessages.DUPLICATE_IDLABEL}:${id}`);
      }
    });
  }
}

// Export singleton instance
export const dfdValidator = new DFDValidator();
export default dfdValidator;
