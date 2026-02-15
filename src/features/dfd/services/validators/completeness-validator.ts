// ==================== COMPLETENESS VALIDATOR ====================
// Single Responsibility: Validate DFD completeness (descriptions, scenarios)

import type { DFDElement, DFDConnection, DFDAsset, DFDStats } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import type { DFDGraph } from "../../models/dfd-graph-types";

/**
 * Check if DFD is complete (all required fields filled)
 */
export function isComplete(
  elements: DFDElement[],
  connections: DFDConnection[],
  assets: DFDAsset[],
  stats: DFDStats,
  errors: string[],
  warnings: string[]
): boolean {
  // Complete if no errors and all elements/connections/assets are described
  return (
    errors.length === 0 &&
    warnings.length === 0 &&
    stats.describedElements === stats.totalElements &&
    stats.describedConnections === stats.dataFlows &&
    stats.describedAssets === stats.assets
  );
}

/**
 * Validate scenario-specific requirements
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
export function validateScenario(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: string[],
  warnings: string[],
  graph?: DFDGraph,
): "A" | "B" | null {
  // Determine which scenario applies
  const hasExternalEntities = stats.externalEntities > 0;
  const scenario = hasExternalEntities ? "A" : "B";

  if (scenario === "A") {
    validateScenarioA(elements, connections, stats, errors, warnings, graph);
  } else {
    validateScenarioB(elements, connections, stats, errors, warnings, graph);
  }

  return errors.length === 0 ? scenario : null;
}

/**
 * Validate Scenario A: Classic Threat Model
 */
function validateScenarioA(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: string[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  // 1. ≥ 1 Trust Boundary
  if (stats.trustBoundaries === 0) {
    errors.push(ValidationMessages.NO_TRUST_BOUNDARY);
    return;
  }

  const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

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

  const hasElementInsideTB = processesAndStores.some((element) => {
    const memberTBs = graph?.elementTrustBoundaries.get(element.id) || [];
    return memberTBs.length > 0;
  });

  if (!hasElementInsideTB) {
    errors.push(ValidationMessages.NO_ELEMENT_INSIDE_TB);
  }

  // 4. External Entity should be OUTSIDE all Trust Boundaries
  const externalEntities = elements.filter((e) => e.type === "ExternalEntity");
  const externalInsideTB = externalEntities.filter((ext) => {
    const memberTBs = graph?.elementTrustBoundaries.get(ext.id) || [];
    return memberTBs.length > 0;
  });

  if (externalInsideTB.length > 0) {
    externalInsideTB.forEach((ext) => {
      warnings.push(
        `${ValidationMessages.EXTERNAL_ENTITY_INSIDE_TB}:${ext.name || ext.id}`,
      );
    });
  }

  // 5. At least 1 dataflow between internal ↔ external
  const hasInternalExternalFlow = hasDataflowBetweenInternalAndExternal(
    elements,
    connections,
  );

  if (!hasInternalExternalFlow) {
    errors.push(ValidationMessages.NO_INTERNAL_EXTERNAL_FLOW);
  }

  // Optional warnings
  if (stats.dataFlows === 0) {
    warnings.push(ValidationMessages.NO_DATAFLOWS);
  }
}

/**
 * Validate Scenario B: Internal Threat Model
 */
function validateScenarioB(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: string[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  // 1. ≥ 2 Trust Boundaries
  if (stats.trustBoundaries < 2) {
    errors.push(ValidationMessages.NEED_TWO_TRUST_BOUNDARIES);
    return;
  }

  const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

  // 2. Each TB must contain at least one Process/Multiprocess/DataStore
  const processesAndStores = elements.filter(
    (e) =>
      e.type === "Process" ||
      e.type === "Multiprocess" ||
      e.type === "DataStore",
  );

  const emptyBoundaries = trustBoundaries.filter((tb) => {
    const tbElements = graph?.trustBoundaryElements.get(tb.id) || [];
    const hasProcessOrStore = tbElements.some((elemId) => {
      const elem = elements.find((e) => e.id === elemId);
      return (
        elem &&
        (elem.type === "Process" ||
          elem.type === "Multiprocess" ||
          elem.type === "DataStore")
      );
    });
    return !hasProcessOrStore;
  });

  if (emptyBoundaries.length > 0) {
    emptyBoundaries.forEach((tb) => {
      errors.push(`${ValidationMessages.EMPTY_TRUST_BOUNDARY}:${tb.name}`);
    });
  }

  // 3. At least 1 dataflow crosses a Trust Boundary
  const hasCrossBoundaryFlow = connections.some((conn) => {
    const analysis = graph?.dataFlowAnalysis.get(conn.id);
    return analysis?.crossesTrustBoundary || false;
  });

  if (!hasCrossBoundaryFlow) {
    errors.push(ValidationMessages.NO_CROSS_BOUNDARY_FLOW);
  }

  // Optional: All Process/Multiprocess/DataStore should be inside a TB
  const elementsOutside = processesAndStores.filter((element) => {
    const memberTBs = graph?.elementTrustBoundaries.get(element.id) || [];
    return memberTBs.length === 0;
  });

  if (elementsOutside.length > 0) {
    elementsOutside.forEach((element) => {
      warnings.push(
        `${ValidationMessages.ELEMENT_OUTSIDE_ALL_TB}:${element.name}`,
      );
    });
  }
}

/**
 * Helper: Check if there's a dataflow between internal and external elements
 */
function hasDataflowBetweenInternalAndExternal(
  elements: DFDElement[],
  connections: DFDConnection[]
): boolean {
  const externalIds = new Set(
    elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id)
  );

  const internalIds = new Set(
    elements
      .filter(
        (e) =>
          e.type === "Process" ||
          e.type === "Multiprocess" ||
          e.type === "DataStore"
      )
      .map((e) => e.id)
  );

  return connections.some(
    (conn) =>
      (externalIds.has(conn.from) && internalIds.has(conn.to)) ||
      (internalIds.has(conn.from) && externalIds.has(conn.to))
  );
}