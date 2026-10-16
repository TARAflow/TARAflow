// ==================== PAGE GEOMETRY ====================
// Leveled-DFD Phase 2b (leveled-dfd-multi-diagram-design.md §6.2.1, §6.3).
//
// The geometric facts of every page, computed by the existing graph builder
// on that page alone — exactly the single-page semantics TARAflow has today,
// so there is one geometry implementation, not two:
//
//   flowInterfaces   connection cell → interface cells it crosses (path
//                    through the shape, or an endpoint inside it)
//   trust/chip/physical  element cell → boundary cells it lies in
//   trustParent      trust boundary cell → the trust boundary cell that
//                    completely contains it on this page (nesting)
//
// All ids are page-local cell ids; the effective model maps them to tfIds
// with the occurrences of the same page. Context copies take part like any
// other cell — that is what makes a page's drawing count (§5.1).

import type { ParsedPageCells } from "../dfd-parser";
import { DefaultDFDGraphBuilder } from "../dfd-graph-builder";

export interface PageGeometry {
  flowInterfaces: Map<string, string[]>;
  trust: Map<string, string[]>;
  chip: Map<string, string[]>;
  physical: Map<string, string[]>;
  trustParent: Map<string, string | undefined>;
}

export function analysePageGeometry(
  pageCells: readonly ParsedPageCells[],
): Map<string, PageGeometry> {
  const builder = new DefaultDFDGraphBuilder();
  const result = new Map<string, PageGeometry>();

  for (const page of pageCells) {
    const graph = builder.build({
      elements: page.elements,
      connections: page.connections,
      assets: [],
    });
    const flowInterfaces = new Map<string, string[]>();
    for (const [cellId, analysis] of graph.dataFlowAnalysis) {
      flowInterfaces.set(cellId, [...analysis.interfaceIds]);
    }
    result.set(page.pageId, {
      flowInterfaces,
      trust: copyOf(graph.elementTrustBoundaries),
      chip: copyOf(graph.elementChipBoundaries),
      physical: copyOf(graph.elementPhysicalBoundaries),
      trustParent: new Map(
        [...graph.trustBoundaryHierarchy].map(([id, analysis]) => [
          id,
          analysis.parentTrustBoundaryId,
        ]),
      ),
    });
  }
  return result;
}

function copyOf(map: Map<string, string[]>): Map<string, string[]> {
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}
