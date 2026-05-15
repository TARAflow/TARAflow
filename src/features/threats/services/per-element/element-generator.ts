// ==================== ELEMENT THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-element method

import type { LinkedDFDElement, StrideCategory } from "shared";
import type {
  Threat,
  ThreatConfiguration,
  ThreatTable,
  ThreatProjectData,
  DFDElementReference,
  DFDGraphReference,
} from "../../models/threat-types";
import {
  STRIDE_PER_ELEMENT_TYPE,
  generateThreatIdPerElement,
  generateThreatIdForInterface,
} from "../../models/per-element-types";
import { createEmptyThreat } from "../../models/threat-types";
import {
  getLocalizedElementThreat,
  getLocalizedElementAttack,
  getLocalizedElementCause,
} from "../threat-catalog-service";
import { createStrategy } from "../strategies/strategy-factory";
import type { IGeneratorStrategy } from "../../models/strategy-types";
import { modulesToSource } from "../../models/strategy-types";

// ==================== ELEMENT THREAT GENERATOR ====================

export class ElementThreatGenerator {
  generateThreatsForProject(
    project: ThreatProjectData,
    configuration?: ThreatConfiguration,
  ): ThreatTable[] {
    if (!project.dfdGraph) return [];

    // Create strategy for this generation run
    const strategy = createStrategy();

    const graph = project.dfdGraph;
    const tables: ThreatTable[] = [];

    // ── Asset reverse index: elementId → assetIds[] ──────────────────────
    const elementToAssets = new Map<string, string[]>();
    if (project.assetDataRef) {
      for (const asset of project.assetDataRef.assets) {
        for (const elementId of asset.linkedElementIds ?? []) {
          const existing = elementToAssets.get(elementId) ?? [];
          existing.push(asset.id);
          elementToAssets.set(elementId, existing);
        }
      }
    }

    // ── Trust Boundary tables ─────────────────────────────────────────────
    for (const [trustBoundaryId, elementIds] of graph.trustBoundaryElements) {
      const trustBoundary = graph.elementsById.get(trustBoundaryId);
      if (!trustBoundary) continue;

      const applicableElements = elementIds
        .map((id) => graph.elementsById.get(id))
        .filter((el): el is NonNullable<typeof el> => {
          if (!el) return false;
          if (el.type === "TrustBoundary" || el.type === "ExternalEntity")
            return false;
          const stride = STRIDE_PER_ELEMENT_TYPE[el.type];
          return stride !== undefined && stride.length > 0;
        });

      if (applicableElements.length === 0) continue;

      const threats = this.generateThreatsForElements(
        applicableElements,
        trustBoundaryId,
        trustBoundary.name,
        trustBoundary.displayId ?? "",
        elementToAssets,
        project,
        strategy,
      );

      if (threats.length > 0) {
        tables.push({
          trustBoundaryId,
          trustBoundaryName: trustBoundary.name,
          displayIdentifier: `[${trustBoundary.displayId}]`,
          threats,
        });
      }
    }

    // ── Data Flows ────────────────────────────────────────────────────────
    const { tbThreats, crossBoundaryThreats } =
      this.generateDataFlowThreatsGrouped(
        graph,
        elementToAssets,
        project,
        strategy,
      );

    for (const table of tables) {
      if (!table.trustBoundaryId) continue;
      const dfThreats = tbThreats.get(table.trustBoundaryId);
      if (dfThreats?.length) table.threats = [...table.threats, ...dfThreats];
    }

    for (const [tbId, dfThreats] of tbThreats) {
      if (tables.some((t) => t.trustBoundaryId === tbId)) continue;
      const tb = graph.elementsById.get(tbId);
      if (!tb) continue;
      tables.push({
        trustBoundaryId: tbId,
        trustBoundaryName: tb.name,
        displayIdentifier: `[${tb.displayId}]`,
        threats: dfThreats,
      });
    }

    if (crossBoundaryThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Data Flows",
        displayIdentifier: "[DF]",
        threats: crossBoundaryThreats,
      });
    }

    // ── External Entities ─────────────────────────────────────────────────
    const eeThreats = this.generateExternalEntityThreats(
      graph,
      elementToAssets,
      project,
      strategy,
    );
    if (eeThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "External Entities",
        displayIdentifier: "[EE]",
        threats: eeThreats,
      });
    }

    // ── Physical Interfaces without TB ───────────────────────────────────
    const ifThreats = this.generateInterfacesWithoutTB(
      graph,
      elementToAssets,
      project,
      strategy,
    );
    if (ifThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Physical Interfaces",
        displayIdentifier: "[IF]",
        threats: ifThreats,
      });
    }

    return tables;
  }

  // ── Private generators ──────────────────────────────────────────────────

  private generateInterfacesWithoutTB(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat[] {
    const threats: Threat[] = [];
    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;
      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      if (effectiveTB !== undefined) continue;
      threats.push(
        ...this.generateThreatsForElement(
          element,
          null,
          "Physical Interfaces",
          "",
          elementToAssets,
          project,
          strategy,
        ),
      );
    }
    return threats;
  }

  generateDataFlowThreatsGrouped(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): { tbThreats: Map<string, Threat[]>; crossBoundaryThreats: Threat[] } {
    const tbThreats = new Map<string, Threat[]>();
    const crossBoundaryThreats: Threat[] = [];

    for (const connection of graph.connectionsById.values()) {
      const isExcluded =
        connection?.excludeFromThreatGen ||
        (connection as any)?.properties?.excludeFromThreatGen;
      if (isExcluded) continue;

      const dataFlowElement: DFDElementReference = {
        id: connection.id,
        type: "DataFlow",
        name: connection.name || connection.label || connection.id,
        displayId: connection.displayId,
      };

      const sourceTB = graph.effectiveElementTrustBoundary.get(connection.from);
      const targetTB = graph.effectiveElementTrustBoundary.get(connection.to);

      if (sourceTB && sourceTB === targetTB) {
        const tbId = sourceTB;
        const tb = graph.elementsById.get(tbId);
        const threats = this.generateThreatsForElement(
          dataFlowElement,
          tbId,
          tb?.name ?? "Unknown",
          tb?.displayId ?? "",
          elementToAssets,
          project,
          strategy,
        );
        const existing = tbThreats.get(tbId) ?? [];
        tbThreats.set(tbId, [...existing, ...threats]);
      } else {
        crossBoundaryThreats.push(
          ...this.generateThreatsForElement(
            dataFlowElement,
            null,
            "Data Flows",
            "",
            elementToAssets,
            project,
            strategy,
          ),
        );
      }
    }

    return { tbThreats, crossBoundaryThreats };
  }

  private generateExternalEntityThreats(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat[] {
    const threats: Threat[] = [];
    for (const element of graph.elementsById.values()) {
      if (element.type !== "ExternalEntity") continue;
      threats.push(
        ...this.generateThreatsForElement(
          element,
          null,
          "External Entities",
          "",
          elementToAssets,
          project,
          strategy,
        ),
      );
    }
    return threats;
  }

  private generateThreatsForElements(
    elements: DFDElementReference[],
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat[] {
    return elements.flatMap((el) =>
      this.generateThreatsForElement(
        el,
        trustBoundaryId,
        trustBoundaryName,
        trustBoundaryDisplayId,
        elementToAssets,
        project,
        strategy,
      ),
    );
  }

  private generateThreatsForElement(
    element: DFDElementReference,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat[] {
    const baseCategories = STRIDE_PER_ELEMENT_TYPE[element.type] || [];

    // Unified pipeline — returns categories + which modules were active
    const { categories: applicableStride } = strategy.getStrideCategories(
      element,
      baseCategories,
      project,
      project.threats?.configuration ?? {
        activeMethod: "per-element",
        zeroTrustMode: false,
        showThreatActor: false,
        forceClassicMode: false,
        customElementTemplates: [],
        customInteractionTemplates: [],
        customMitigations: [],
        customVerifications: [],
      },
    );

    const isInterface =
      element.type === "Interface" || element.type === "PhysicalInterface";

    return applicableStride.map((strideCategory) =>
      this.createThreatForElement(
        element,
        strideCategory,
        trustBoundaryId,
        trustBoundaryName,
        trustBoundaryDisplayId,
        isInterface,
        elementToAssets,
        project,
        strategy,
      ),
    );
  }

  private createThreatForElement(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    isInterface: boolean,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat {
    const threatId = isInterface
      ? generateThreatIdForInterface(
          trustBoundaryDisplayId || "TB-EXT",
          element.displayId || element.id,
          strideCategory,
          1,
        )
      : generateThreatIdPerElement(
          element.displayId || element.id,
          strideCategory,
          1,
        );

    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
    );

    threat.linkedElement = {
      elementId: element.id,
      elementName: element.name,
      elementType: element.type,
      displayId: element.displayId,
    } as LinkedDFDElement;

    threat.linkedAssetIds = elementToAssets?.get(element.id) ?? [];

    // Determine source from active modules
    const config = project.threats?.configuration;
    const defaultConfig = { activeMethod: "per-element" as const, zeroTrustMode: false, showThreatActor: false, forceClassicMode: false, customElementTemplates: [], customInteractionTemplates: [], customMitigations: [], customVerifications: [] };
    const { modules } = strategy.getStrideCategories(element, [strideCategory], project, config ?? defaultConfig);
    threat.source = modulesToSource(modules);

    // Set initial impact from CIANAAA module
    const initialImpact = strategy.getInitialImpact(element, strideCategory, project);
    if (initialImpact !== undefined) {
      threat.initialImpact = initialImpact;
    }

    // ── Catalog lookup ────────────────────────────────────────────────────
    const elementProps =
      ((element as any).properties as Record<string, unknown> | null) ?? null;
    const template = strategy.selectElementTemplate(
      strideCategory,
      element.type,
      project,
      elementProps,
    );

    if (template) {
      // Descriptions stored empty → rendered from i18n at display time.
      // Set them here so the dialog/table has immediate content without
      // requiring a separate i18n lookup call at each render.
      threat.threatDescription = getLocalizedElementThreat(template.id);
      threat.attackDescription = getLocalizedElementAttack(template.id);
      threat.causeDescription = getLocalizedElementCause(template.id);
      threat.proposedMitigations = template.mitigations.map((id) => ({ id }));
      threat.proposedVerifications = template.verifications.map((id) => ({
        id,
      }));
    }

    return threat;
  }

  /**
   * Public entry point for sync — generates threats for a single element.
   * Strategy is auto-detected from project context.
   */
  public generateThreatsForSingleElement(
    element: DFDElementReference,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
  ): Threat[] {
    const strategy = createStrategy();
    return this.generateThreatsForElement(
      element,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
      elementToAssets,
      project,
      strategy,
    );
  }
}

// ==================== EXPORT SINGLETON ====================

export const elementThreatGenerator = new ElementThreatGenerator();