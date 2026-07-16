import { useMemo } from "react";
import { Risk } from "../models/risk-assessment-types";
import { isInterfaceThreat } from "../utils/risk-formatting";
import { ThreatReference } from "shared";

export interface ElementGroup {
  elementId: string;
  elementName: string;
  elementType: string;
  risks: Risk[];
}

export interface DataFlowGroup {
  dataFlowId: string;
  dataFlowName: string;
  sourceName?: string;
  targetName?: string;
  risks: Risk[];
}

export interface TrustBoundaryGroup {
  id: string;
  name: string;
  displayIdentifier?: string;
  risks: Risk[];
  elements?: ElementGroup[];
  dataFlows?: DataFlowGroup[];
}

export interface InterfaceGroup {
  id: string;
  name: string;
  risks: Risk[];
}

/**
 * Hook for grouping risks by trust boundary, element, or dataflow
 */
export const useRiskGrouping = (
  risks: Risk[],
  threats: ThreatReference[],
  isPerElement: boolean
) => {
  // Create threats lookup map for O(1) access
  const threatsMap = useMemo(() => {
    return new Map(threats.map((t) => [t.id, t]));
  }, [threats]);

  // Filter out interface risks from normal trust boundary groups
  const nonInterfaceRisks = useMemo(() => {
    if (isPerElement) return risks;

    return risks.filter((risk) => {
      const threat = threatsMap.get(risk.threatId);
      return !isInterfaceThreat(threat?.id);
    });
  }, [risks, threatsMap, isPerElement]);

  // Group by trust boundary (and optionally by element/dataflow)
  const groupedByTrustBoundary = useMemo(() => {
    const groups = new Map<string, TrustBoundaryGroup>();

    for (const risk of nonInterfaceRisks) {
      const threat = threatsMap.get(risk.threatId);
      const tbId = threat?.trustBoundaryId || "external";
      const tbName = threat?.trustBoundaryName || "External Entities";

      if (!groups.has(tbId)) {
        groups.set(tbId, {
          id: tbId,
          name: tbName,
          displayIdentifier: tbId !== "external" ? tbId : undefined,
          risks: [],
          elements: [],
          dataFlows: [],
        });
      }

      const group = groups.get(tbId)!;
      group.risks.push(risk);

      // For per-element: group by element within trust boundary
      if (isPerElement && threat?.elementName) {
        const elementIdMatch = risk.threatId.match(/^([A-Z]+\d+)/);
        const elementId = elementIdMatch
          ? elementIdMatch[1]
          : threat.elementName;
        let elementType = elementId.startsWith("DF")
          ? "DataFlow"
          : elementId.startsWith("EE")
          ? "ExternalEntity"
          : elementId.startsWith("DS")
          ? "DataStore"
          : elementId.startsWith("IF")
          ? "Interface"
          : "Process";

        if (/-IF\d+-/.test(risk.threatId)) {
          elementType = "Interface";
        }

        let elementGroup = group.elements?.find(
          (e) => e.elementId === elementId
        );
        if (!elementGroup) {
          elementGroup = {
            elementId,
            elementName: threat.elementName,
            elementType,
            risks: [],
          };
          group.elements!.push(elementGroup);
        }
        elementGroup.risks.push(risk);
      }

      // For per-interaction: group by dataflow within trust boundary
      if (!isPerElement && threat?.dataFlowName) {
        const dataFlowIdMatch = risk.threatId.match(/^(DF\d+)/);
        const dataFlowId = dataFlowIdMatch
          ? dataFlowIdMatch[1]
          : `DF-${threat.dataFlowName}`;

        let dataFlowGroup = group.dataFlows?.find(
          (df) => df.dataFlowId === dataFlowId
        );
        if (!dataFlowGroup) {
          dataFlowGroup = {
            dataFlowId,
            dataFlowName: threat.dataFlowName,
            risks: [],
          };
          group.dataFlows!.push(dataFlowGroup);
        }
        dataFlowGroup.risks.push(risk);
      }
    }

    // Sort groups: External Entities last, then by name
    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === "external") return 1;
      if (b.id === "external") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [nonInterfaceRisks, threatsMap, isPerElement]);

  // Separate interface risks (only for per-interaction mode)
  const interfaceRisks = useMemo(() => {
    if (isPerElement) return null;

    const interfaceRiskList = risks.filter((risk) => {
      const threat = threatsMap.get(risk.threatId);
      return isInterfaceThreat(threat?.id);
    });

    if (interfaceRiskList.length === 0) return null;

    // Group by interface element
    const groups = new Map<string, InterfaceGroup>();

    for (const risk of interfaceRiskList) {
      const threat = threatsMap.get(risk.threatId);
      if (!threat) continue;

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

    return Array.from(groups.values()).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
  }, [risks, threatsMap, isPerElement]);

  return {
    groupedByTrustBoundary,
    interfaceRisks,
    threatsMap,
  };
};