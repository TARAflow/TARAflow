// src/app/utils/safety-function-paths.ts
//
// EN 50742 A (CM-12b, user 2026-11-03): which interfaces and flows lie on a
// path to a safety function. A safety function is an asset with a physical
// impact; its DFD elements are the asset's linkedDFDElements. From them the
// search runs backwards against the flow direction — every flow that carries
// data or commands towards the safety function, transitively — and collects
// the flows and the interfaces they pass. No hop limit; the search does not
// cross a trust boundary that enforces one-way traffic (boundary control
// data_diode or unidirectional_gateway). A flow the asset itself names
// (relation "transports") is on the path with its source side.

export interface PathFlow {
  id: string;
  from: string;
  to: string;
}

export interface SafetyPathInput {
  /** The flows of the analysis view (leaf elements as endpoints). */
  flows: readonly PathFlow[];
  /** Interfaces a flow passes (DataFlowAnalysis.interfaceIds). */
  interfacesOf: (flowId: string) => readonly string[];
  /** The flow crosses a one-way boundary — the search stops there. */
  blocked: (flowId: string) => boolean;
  /** Containment parent (leveled DFD): a flow into a child reaches the parent's safety function. */
  parentOf: (id: string) => string | undefined;
}

/** Flow and interface ids on a path to the given DFD elements / flows of one safety function. */
export function pathAnchors(linkedIds: readonly string[], input: SafetyPathInput): Set<string> {
  const flowById = new Map(input.flows.map((f) => [f.id, f]));
  const anchors = new Set<string>();
  /** Elements the safety function's data or commands reach. */
  const targets = new Set<string>();
  const addFlow = (flow: PathFlow) => {
    anchors.add(flow.id);
    for (const i of input.interfacesOf(flow.id)) anchors.add(i);
    targets.add(flow.from);
  };
  for (const id of linkedIds) {
    const flow = flowById.get(id);
    if (flow) addFlow(flow);
    else targets.add(id);
  }
  /** The element or one of its containers is a target. */
  const reaches = (id: string) => {
    for (let x: string | undefined = id; x; x = input.parentOf(x)) if (targets.has(x)) return true;
    return false;
  };
  // Fixed point: every new source can make further flows reach.
  let grown = true;
  while (grown) {
    grown = false;
    for (const flow of input.flows) {
      if (anchors.has(flow.id) || input.blocked(flow.id) || !reaches(flow.to)) continue;
      addFlow(flow);
      grown = true;
    }
  }
  return anchors;
}
