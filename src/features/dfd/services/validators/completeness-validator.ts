// ==================== COMPLETENESS VALIDATOR ====================
// Single Responsibility: Validate DFD completeness (descriptions, scenarios)

import type {
  DFDElement,
  DFDConnection,
  DFDStats,
  ValidationFinding,
} from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
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
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
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
 * Validate scenario-specific requirements.
 *
 * Four scenarios are detected automatically from the diagram content:
 *
 * Scenario A — Classic Threat Model (External Entity present)
 *   Requires: ≥1 TrustBoundary, ≥1 internal Process/DataStore,
 *             ≥1 dataflow between internal ↔ external
 *
 * Scenario B — Internal Threat Model (no External Entity, has TrustBoundaries)
 *   Requires: ≥2 TrustBoundaries, each containing ≥1 Process/DataStore,
 *             ≥1 dataflow crossing a TrustBoundary
 *
 * Scenario C — Embedded Device (no External Entity, no TrustBoundary,
 *              but has PhysicalBoundary)
 *   Physical attack surface modelled via PB. No TB required because no
 *   trust-level or privilege change exists internally.
 *   PB ≠ TB: physical access and trust/privilege change are orthogonal.
 *   Requires: ≥1 Process/Multiprocess, ≥1 DataFlow
 *
 * Scenario D (no boundary at all) is intentionally not supported:
 *   without at least one boundary, STRIDE/TARA has no attack surface to analyse.
 *
 * Rationale for Scenario C:
 *   A digital measuring device or standalone embedded system may have no
 *   network boundary and no logical trust zones. Requiring a TrustBoundary
 *   would force analysts to add artificial boundaries.
 *   PhysicalBoundary and TrustBoundary are orthogonal: PB = physical access,
 *   TB = trust/privilege change. They must not be conflated.
 */
export function validateScenario(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
  graph?: DFDGraph,
): "A" | "B" | "C" | null {
  const hasExternalEntities = stats.externalEntities > 0;
  const hasTrustBoundaries = stats.trustBoundaries > 0;
  const hasPhysicalBoundaries = elements.some(
    (e) => e.type === "PhysicalBoundary",
  );

  if (hasExternalEntities) {
    // Scenario A: External Entity present → TrustBoundary required
    validateScenarioA(elements, connections, stats, errors, warnings, graph);
    return errors.length === 0 ? "A" : null;
  }

  if (hasTrustBoundaries) {
    // Scenario B: No External Entity but TrustBoundaries present
    validateScenarioB(elements, connections, stats, errors, warnings, graph);
    return errors.length === 0 ? "B" : null;
  }

  if (hasPhysicalBoundaries) {
    // Scenario C: No External Entity, no TrustBoundary, but PhysicalBoundary present.
    // Physical attack surface fully modelled via PB — no separate TB required.
    // PB ≠ implicit TB: physical access and trust elevation are different dimensions.
    validateScenarioC(elements, connections, stats, errors, warnings);
    return errors.length === 0 ? "C" : null;
  }

  // No boundary of any kind — not a valid threat model.
  // Without at least one boundary (TB or PB), STRIDE/TARA cannot work meaningfully:
  // there is no modelled attack surface, no physical access context, and no
  // trust change to analyze. Scenario D is intentionally not supported.
  errors.push({ key: ValidationMessages.NO_TRUST_BOUNDARY });
  return null;
}

/**
 * Validate Scenario A: Classic Threat Model
 */
function validateScenarioA(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
  graph?: DFDGraph,
): void {
  // 1. ≥ 1 Trust Boundary
  if (stats.trustBoundaries === 0) {
    errors.push({ key: ValidationMessages.NO_TRUST_BOUNDARY });
    return;
  }

  const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

  // 2. ≥ 1 internal Process, Multiprocess or DataStore
  const internalElementCount =
    stats.processes + stats.multiprocesses + stats.dataStores;
  if (internalElementCount === 0) {
    errors.push({ key: ValidationMessages.NO_PROCESS_OR_DATASTORE });
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
    errors.push({ key: ValidationMessages.NO_ELEMENT_INSIDE_TB });
  }

  // 4. External Entity should be OUTSIDE all Trust Boundaries
  const externalEntities = elements.filter((e) => e.type === "ExternalEntity");
  const externalInsideTB = externalEntities.filter((ext) => {
    const memberTBs = graph?.elementTrustBoundaries.get(ext.id) || [];
    return memberTBs.length > 0;
  });

  if (externalInsideTB.length > 0) {
    externalInsideTB.forEach((ext) => {
      warnings.push({
        key: ValidationMessages.EXTERNAL_ENTITY_INSIDE_TB,
        displayId: ext.displayId,
        elementId: ext.id,
        params: { name: ext.name || ext.id },
      });
    });
  }

  // 5. At least 1 dataflow between internal ↔ external
  const hasInternalExternalFlow = hasDataflowBetweenInternalAndExternal(
    elements,
    connections,
  );

  if (!hasInternalExternalFlow) {
    errors.push({ key: ValidationMessages.NO_INTERNAL_EXTERNAL_FLOW });
  }

  // Optional warnings
  if (stats.dataFlows === 0) {
    warnings.push({ key: ValidationMessages.NO_DATAFLOWS });
  }
}

/**
 * Validate Scenario B: Internal Threat Model (no External Entity, ≥1 TrustBoundary)
 *
 * Requires ≥1 TrustBoundary with at least one cross-boundary dataflow.
 * A single TB is valid — e.g. MCU ↔ Fieldbus, Bootloader ↔ Application,
 * Device ↔ Wireless Interface. Requiring ≥2 TB forces artificial boundaries.
 */
function validateScenarioB(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
  graph?: DFDGraph,
): void {
  const trustBoundaries = elements.filter((e) => e.type === "TrustBoundary");

  // 1. Each TB must contain at least one Process/Multiprocess/DataStore
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
      errors.push({
        key: ValidationMessages.EMPTY_TRUST_BOUNDARY,
        displayId: tb.displayId,
        elementId: tb.id,
        params: { name: tb.name },
      });
    });
  }

  // 2. At least 1 dataflow crosses a Trust Boundary
  // This is the essential requirement: a TB without any cross-boundary flow
  // has no analytical value for threat modeling.
  const hasCrossBoundaryFlow = connections.some((conn) => {
    const analysis = graph?.dataFlowAnalysis.get(conn.id);
    return analysis?.crossesTrustBoundary || false;
  });

  if (!hasCrossBoundaryFlow) {
    errors.push({ key: ValidationMessages.NO_CROSS_BOUNDARY_FLOW });
  }

  // Advisory: elements outside all TBs (not an error — partial models are valid)
  const processesAndStores = elements.filter(
    (e) =>
      e.type === "Process" ||
      e.type === "Multiprocess" ||
      e.type === "DataStore",
  );

  const elementsOutside = processesAndStores.filter((element) => {
    const memberTBs = graph?.elementTrustBoundaries.get(element.id) || [];
    return memberTBs.length === 0;
  });

  if (elementsOutside.length > 0) {
    elementsOutside.forEach((element) => {
      warnings.push({
        key: ValidationMessages.ELEMENT_OUTSIDE_ALL_TB,
        displayId: element.displayId,
        elementId: element.id,
        params: { type: element.type, name: element.name },
      });
    });
  }
}

/**
 * Validate Scenario C: Embedded Device with PhysicalBoundary, no TrustBoundary.
 *
 * Valid for embedded systems where no trust-level or privilege change exists
 * internally (e.g. vergossenes Messgerät, single-MCU device, standalone sensor).
 * The physical attack surface is fully modelled via PhysicalBoundary.
 *
 * PB ≠ implicit TB:
 *   PhysicalBoundary → who can physically reach the device/chip/port
 *   TrustBoundary    → where trust level / privileges / security assumptions change
 * These are orthogonal security dimensions and must not be conflated.
 *
 * Requires: ≥1 Process/Multiprocess, ≥1 DataFlow
 */
function validateScenarioC(
  elements: DFDElement[],
  connections: DFDConnection[],
  stats: DFDStats,
  errors: ValidationFinding[],
  warnings: ValidationFinding[],
): void {
  const hasProcess = stats.processes > 0 || stats.multiprocesses > 0;
  if (!hasProcess) {
    errors.push({ key: ValidationMessages.NO_PROCESS_OR_DATASTORE });
    return;
  }

  if (stats.dataFlows === 0) {
    warnings.push({ key: ValidationMessages.NO_DATAFLOWS });
  }

  // Advisory: no Interface means no modelled attacker entry point via the PB
  const hasInterface = elements.some((e) => e.type === "Interface");
  if (!hasInterface) {
    warnings.push({ key: ValidationMessages.INTERFACE_UNUSED });
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