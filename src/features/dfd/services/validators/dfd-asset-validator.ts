// ==================== ASSET VALIDATOR ====================
// Single Responsibility: Validate DFD assets and interfaces

import type { DFDElement, DFDConnection } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { ValidationMessages } from "./validator-utils";
import type { DFDGraph } from "../../models/dfd-graph-types";

/**
 * Validate assets and interfaces
 */
export function validateAssetsAndInterfaces(
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  warnings: string[],
  dfdAnalyzer: any,
  graph?: DFDGraph,
): void {
  // Separate interfaces from elements
  const interfaces = elements.filter((e) => e.type === "Interface");

  // Validate Interfaces (must have dataflow passing through)
  validateInterfaceUsage(interfaces, warnings, graph);
}

/**
 * Validate that Interfaces have at least one dataflow passing through them
 */
function validateInterfaceUsage(
  interfaces: DFDElement[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  interfaces.forEach((iface) => {
    // Check if any dataflow passes through this interface (via graph)
    let hasDataflow = false;

    if (graph) {
      // Use pre-computed graph analysis
      hasDataflow = Array.from(graph.dataFlowAnalysis.values()).some(
        (analysis) => analysis.interfaceIds.includes(iface.id),
      );
    }

    if (!hasDataflow) {
      warnings.push(
        `${ValidationMessages.INTERFACE_UNUSED}:${iface.name || iface.id}`,
      );
    }
  });
}
