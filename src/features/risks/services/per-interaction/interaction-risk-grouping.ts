// ==================== INTERACTION RISK GROUPING SERVICE ====================
// Pure grouping logic for per-interaction risks
// Groups by Trust Boundary -> DataFlows
// Separates Interface risks into their own groups

import type { Risk, ThreatReference } from "../../models/risk-assessment-types";
import { isInterfaceThreat } from "../../utils/risk-formatting";

// ==================== TYPES ====================

export interface DataFlowGroup {
  dataFlowId: string;
  dataFlowName: string;
  sourceName?: string;
  targetName?: string;
  risks: Risk[];
}

export interface InteractionRiskTable {
  id: string;
  name: string;
  displayIdentifier?: string;
  risks: Risk[];
  dataFlows: DataFlowGroup[];
}

export interface InterfaceRiskTable {
  id: string;
  name: string;
  risks: Risk[];
}

// ==================== GROUPING LOGIC ====================

/**
 * Group per-interaction risks by Trust Boundary and then by DataFlow
 * Excludes interface risks (they have their own grouping)
 */
export function groupInteractionRisks(
  risks: Risk[],
  threats: ThreatReference[]
): InteractionRiskTable[] {
  // Create threats lookup map
  const threatsMap = new Map(threats.map((t) => [t.id, t]));

  // Filter out interface risks
  const nonInterfaceRisks = risks.filter((risk) => {
    const threat = threatsMap.get(risk.threatId);
    return !isInterfaceThreat(threat?.trustBoundaryName);
  });

  // Group by trust boundary
  const groups = new Map<string, InteractionRiskTable>();

  for (const risk of nonInterfaceRisks) {
    const threat = threatsMap.get(risk.threatId);
    const tbId = threat?.trustBoundaryId || "external";
    const tbName = threat?.trustBoundaryName || "External Entities";

    // Create trust boundary group if needed
    if (!groups.has(tbId)) {
      groups.set(tbId, {
        id: tbId,
        name: tbName,
        displayIdentifier: tbId !== "external" ? tbId : undefined,
        risks: [],
        dataFlows: [],
      });
    }

    const group = groups.get(tbId)!;
    group.risks.push(risk);

    // Group by dataflow within trust boundary
    if (threat?.dataFlowName) {
      // Extract dataflow ID from threatId (e.g., "DF1-S-1" -> "DF1")
      const dataFlowIdMatch = risk.threatId.match(/^(DF\d+)/);
      const dataFlowId = dataFlowIdMatch
        ? dataFlowIdMatch[1]
        : `DF-${threat.dataFlowName}`;

      // Find or create dataflow group
      let dataFlowGroup = group.dataFlows.find(
        (df) => df.dataFlowId === dataFlowId
      );
      if (!dataFlowGroup) {
        dataFlowGroup = {
          dataFlowId,
          dataFlowName: threat.dataFlowName,
          risks: [],
        };
        group.dataFlows.push(dataFlowGroup);
      }

      dataFlowGroup.risks.push(risk);
    }
  }

  // Sort groups: External Entities last, then by name
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.id === "external") return 1;
    if (b.id === "external") return -1;
    return a.name.localeCompare(b.name);
  });

  // Sort dataflows within each group by ID
  for (const group of sortedGroups) {
    group.dataFlows.sort((a, b) =>
      a.dataFlowId.localeCompare(b.dataFlowId, undefined, { numeric: true })
    );
  }

  return sortedGroups;
}

/**
 * Group interface risks by interface element
 * Only applicable for per-interaction mode
 */
export function groupInterfaceRisks(
  risks: Risk[],
  threats: ThreatReference[]
): InterfaceRiskTable[] | null {
  // Create threats lookup map
  const threatsMap = new Map(threats.map((t) => [t.id, t]));

  // Filter interface risks only
  const interfaceRisks = risks.filter((risk) => {
    const threat = threatsMap.get(risk.threatId);
    return isInterfaceThreat(threat?.trustBoundaryName);
  });

  if (interfaceRisks.length === 0) return null;

  // Group by interface element
  const groups = new Map<string, InterfaceRiskTable>();

  for (const risk of interfaceRisks) {
    const threat = threatsMap.get(risk.threatId);
    if (!threat) continue;

    // Extract element ID (e.g., "IF1" from "IF1-S-IN-1")
    const elementId = risk.threatId.split("-")[0];
    const elementName = threat.elementName || elementId;

    if (!groups.has(elementId)) {
      groups.set(elementId, {
        id: elementId,
        name: elementName,
        risks: [],
      });
    }

    groups.get(elementId)!.risks.push(risk);
  }

  // Sort by element ID
  return Array.from(groups.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/**
 * Extract initial expanded state for trust boundaries
 */
export function getInitialExpandedState(
  tables: InteractionRiskTable[]
): Record<string, boolean> {
  const state: Record<string, boolean> = {};

  // All trust boundaries start expanded
  for (const table of tables) {
    state[table.id] = true;
  }

  // Interface section also starts expanded
  state["interfaces"] = true;

  return state;
}