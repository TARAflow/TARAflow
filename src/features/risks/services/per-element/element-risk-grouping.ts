// ==================== ELEMENT RISK GROUPING SERVICE ====================
// Pure grouping logic for per-element risks
// Groups by Trust Boundary -> Elements

import type { Risk, ThreatReference } from "../../models/risk-assessment-types";

// ==================== TYPES ====================

export interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  risks: Risk[];
}

export interface ElementRiskTable {
  id: string;
  name: string;
  displayIdentifier?: string;
  risks: Risk[];
  elements: ElementGroup[];
}

// ==================== GROUPING LOGIC ====================

/**
 * Group per-element risks by Trust Boundary and then by Element
 * Returns structured data ready for rendering
 */
export function groupElementRisks(
  risks: Risk[],
  threats: ThreatReference[]
): ElementRiskTable[] {
  // Create threats lookup map for O(1) access
  const threatsMap = new Map(threats.map((t) => [t.id, t]));

  // Group by trust boundary
  const groups = new Map<string, ElementRiskTable>();

  for (const risk of risks) {
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
        elements: [],
      });
    }

    const group = groups.get(tbId)!;
    group.risks.push(risk);

    // Group by element within trust boundary
    if (threat?.elementName) {
      // Extract element info from threatId (e.g., "EE1-S-1" -> "EE1")
      const elementIdMatch = risk.threatId.match(/^([A-Z]+\d+)/);
      const elementId = elementIdMatch ? elementIdMatch[1] : threat.elementName;

      // Determine element type from ID prefix
      const elementType = elementId.startsWith("DF")
        ? "DataFlow"
        : elementId.startsWith("EE")
        ? "ExternalEntity"
        : elementId.startsWith("DS")
        ? "DataStore"
        : "Process";

      // Find or create element group
      let elementGroup = group.elements.find((e) => e.elementId === elementId);
      if (!elementGroup) {
        elementGroup = {
          elementId,
          elementName: threat.elementName,
          elementType,
          risks: [],
        };
        group.elements.push(elementGroup);
      }

      elementGroup.risks.push(risk);
    }
  }

  // Sort groups: External Entities last, then by name
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.id === "external") return 1;
    if (b.id === "external") return -1;
    return a.name.localeCompare(b.name);
  });

  // Sort elements within each group by ID
  for (const group of sortedGroups) {
    group.elements.sort((a, b) =>
      a.elementId.localeCompare(b.elementId, undefined, { numeric: true })
    );
  }

  return sortedGroups;
}

/**
 * Extract initial expanded state for trust boundaries
 * All trust boundaries start expanded by default
 */
export function getInitialExpandedState(
  tables: ElementRiskTable[]
): Record<string, boolean> {
  return Object.fromEntries(tables.map((table) => [table.id, true]));
}