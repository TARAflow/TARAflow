// ==================== ELEMENT THREAT GENERATOR ====================
// Single Responsibility: Generate threats using STRIDE per-element method

import type {
  DFDElementReference,
  DFDGraphReference,
  LinkedDFDElement,
  StrideCategory,
} from "shared";
import type {
  Threat,
  ThreatConfiguration,
  ThreatTable,
  ThreatProjectData,
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
import { shouldEliminateThreat } from "../threat-elimination-filter";
import {
  getImplementedMitigationHints,
  mergeMitigationHints,
} from "../implemented-controls-mapper";

// ==================== ASSET REVERSE INDEX ====================

/**
 * Build the reverse index elementId → assetIds[] from the asset reference.
 *
 * Single source of truth for asset↔element linkage during threat generation.
 * Used by BOTH the full project generator and the incremental sync add-path
 * (element-sync.ts), so a newly synced element receives the same
 * linkedAssetIds a full regeneration would produce — no divergence.
 */
export function buildElementToAssetsIndex(
  assetDataRef: ThreatProjectData["assetDataRef"],
): Map<string, string[]> {
  const elementToAssets = new Map<string, string[]>();
  if (!assetDataRef) return elementToAssets;
  for (const asset of assetDataRef.assets) {
    for (const elementId of asset.linkedElementIds ?? []) {
      const existing = elementToAssets.get(elementId) ?? [];
      existing.push(asset.id);
      elementToAssets.set(elementId, existing);
    }
  }
  return elementToAssets;
}

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
    const elementToAssets = buildElementToAssetsIndex(project.assetDataRef);

    // ── Trust Boundary tables ─────────────────────────────────────────────
    // Build effective TB → elements map from effectiveElementTrustBoundary.
    // This uses the INNERMOST TB per element, preventing duplicates when
    // TrustBoundaries are nested (TB-B inside TB-A: element only appears in TB-B).
    const effectiveTBElements = new Map<string, string[]>();
    for (const [elementId, tbId] of graph.effectiveElementTrustBoundary) {
      if (!tbId) continue;
      const existing = effectiveTBElements.get(tbId) ?? [];
      existing.push(elementId);
      effectiveTBElements.set(tbId, existing);
    }

    for (const [trustBoundaryId, elementIds] of effectiveTBElements) {
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

    // ── Interfaces — grouped by PhysicalBoundary or ChipBoundary ─────────
    // Each PB/CB gets its own threat table. Interfaces with no parent
    // boundary fall into a shared "[IF]" fallback table.
    const ifTableMap = this.generateInterfaceThreatsGrouped(
      graph,
      elementToAssets,
      project,
      strategy,
    );
    for (const [parentId, threats] of ifTableMap) {
      if (threats.length === 0) continue;
      if (parentId === "__no_parent__") {
        tables.push({
          trustBoundaryId: null,
          trustBoundaryName: "Physical Interfaces",
          displayIdentifier: "[IF]",
          threats,
        });
      } else {
        const parent = graph.elementsById.get(parentId);
        tables.push({
          trustBoundaryId: parentId,
          trustBoundaryName: parent?.name ?? parentId,
          displayIdentifier: `[${parent?.displayId ?? parentId}]`,
          threats,
        });
      }
    }

    // ── ChipBoundary element threats — one table per ChipBoundary ─────────
    const cbTableMap = this.generateChipBoundaryThreats(
      graph,
      elementToAssets,
      project,
      strategy,
    );
    for (const [cbId, threats] of cbTableMap) {
      if (threats.length === 0) continue;
      const cb = graph.elementsById.get(cbId);
      tables.push({
        trustBoundaryId: cbId,
        trustBoundaryName: cb?.name ?? cbId,
        displayIdentifier: `[${cb?.displayId ?? cbId}]`,
        threats,
      });
    }

    // ── PhysicalBoundary element threats — one table per PhysicalBoundary ──
    const pbTableMap = this.generatePhysicalBoundaryThreats(
      graph,
      elementToAssets,
      project,
      strategy,
    );
    for (const [pbId, threats] of pbTableMap) {
      if (threats.length === 0) continue;
      const pb = graph.elementsById.get(pbId);
      tables.push({
        trustBoundaryId: pbId,
        trustBoundaryName: pb?.name ?? pbId,
        displayIdentifier: `[${pb?.displayId ?? pbId}]`,
        threats,
      });
    }

    // ── Coverage fallback: boundary-less TB-only element types ────────────
    // Process / DataStore / Multiprocess / Sensor / Actuator are otherwise
    // reached ONLY through the trust-boundary pass. An instance outside every
    // TrustBoundary (common for Sensors/Actuators in OT models) would silently
    // produce no threats. The effectiveElementTrustBoundary guard ensures we
    // only pick up what the TB pass skipped — no double emission.
    const TB_ONLY_TYPES = new Set([
      "Process",
      "Multiprocess",
      "DataStore",
      "Sensor",
      "Actuator",
    ]);
    const unboundedThreats: Threat[] = [];
    for (const element of graph.elementsById.values()) {
      if (!TB_ONLY_TYPES.has(element.type)) continue;
      if (graph.effectiveElementTrustBoundary.get(element.id)) continue;
      const stride = STRIDE_PER_ELEMENT_TYPE[element.type];
      if (!stride || stride.length === 0) continue;
      unboundedThreats.push(
        ...this.generateThreatsForElement(
          element,
          null,
          "Unbounded Elements",
          "",
          elementToAssets,
          project,
          strategy,
        ),
      );
    }
    if (unboundedThreats.length > 0) {
      tables.push({
        trustBoundaryId: null,
        trustBoundaryName: "Unbounded Elements",
        displayIdentifier: "[UB]",
        threats: unboundedThreats,
      });
    }

    // Safety net: deduplicate threat IDs across all tables.
    // Handles edge cases not covered by effectiveTBElements logic
    // (e.g. DataFlow threats that could theoretically appear twice).
    const seenThreatIds = new Set<string>();
    const deduplicatedTables = tables
      .map((table) => ({
        ...table,
        threats: table.threats.filter((threat) => {
          if (seenThreatIds.has(threat.id)) return false;
          seenThreatIds.add(threat.id);
          return true;
        }),
      }))
      .filter((table) => table.threats.length > 0);

    return deduplicatedTables;
  }

  // ── Private generators ──────────────────────────────────────────────────

  /**
   * Generate Interface threats grouped by parent PhysicalBoundary or ChipBoundary.
   * Interfaces belong exclusively to PB or CB — never to TrustBoundary.
   * Returns a Map<parentId | "__no_parent__", Threat[]> for table building.
   */
  private generateInterfaceThreatsGrouped(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Map<string, Threat[]> {
    const tableMap = new Map<string, Threat[]>();

    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      // Resolve parent: PB > CB > fallback
      const pbIds = graph.elementPhysicalBoundaries?.get(element.id) ?? [];
      const cbIds = graph.elementChipBoundaries?.get(element.id) ?? [];
      const parentId = pbIds[0] ?? cbIds[0] ?? "__no_parent__";
      const parent =
        parentId !== "__no_parent__" ? graph.elementsById.get(parentId) : null;
      const parentName = parent?.name ?? "Physical Interfaces";
      const parentDisplayId = parent?.displayId ?? "";

      const threats = this.generateThreatsForElement(
        element,
        parentId !== "__no_parent__" ? parentId : null,
        parentName,
        parentDisplayId,
        elementToAssets,
        project,
        strategy,
      );

      const existing = tableMap.get(parentId) ?? [];
      tableMap.set(parentId, [...existing, ...threats]);
    }

    return tableMap;
  }

  /**
   * Generate ChipBoundary element threats, one table per ChipBoundary.
   * Returns Map<chipBoundaryId, Threat[]>.
   */
  private generateChipBoundaryThreats(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Map<string, Threat[]> {
    const tableMap = new Map<string, Threat[]>();

    for (const element of graph.elementsById.values()) {
      if (element.type !== "ChipBoundary") continue;

      const threats = this.generateThreatsForElement(
        element,
        element.id,
        element.name,
        element.displayId ?? "",
        elementToAssets,
        project,
        strategy,
      );

      tableMap.set(element.id, threats);
    }

    return tableMap;
  }

  /**
   * Generate PhysicalBoundary element threats, one table per PhysicalBoundary.
   * PB is always its own table owner — it never has a TrustBoundary as parent.
   * Returns Map<physicalBoundaryId, Threat[]>.
   */
  private generatePhysicalBoundaryThreats(
    graph: DFDGraphReference,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Map<string, Threat[]> {
    const tableMap = new Map<string, Threat[]>();

    for (const element of graph.elementsById.values()) {
      if (element.type !== "PhysicalBoundary") continue;

      const threats = this.generateThreatsForElement(
        element,
        element.id,
        element.name,
        element.displayId ?? "",
        elementToAssets,
        project,
        strategy,
      );

      tableMap.set(element.id, threats);
    }

    return tableMap;
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

    const elementProps = (element as any).properties ?? {};
    return applicableStride
      .filter(
        (strideCategory) =>
          !shouldEliminateThreat(element.type, elementProps, strideCategory),
      )
      .map((strideCategory) =>
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

  /**
   * The STRIDE categories this element would receive a generated threat for.
   *
   * checkSyncStatus calls this for EVERY element on EVERY DFD change, against a
   * minimal project stub that lacks the enrichment context (hazards etc.) the
   * generation strategy expects — and possibly for element types the strategy
   * doesn't map. It must therefore be total: any failure inside the strategy or
   * elimination filter falls back to the raw base table rather than throwing,
   * because a throw here would discard the entire sync status (including
   * renumber/rename detection) and silently kill sync.
   *
   * On the happy path it runs the same base → strategy → elimination pipeline
   * as generation, so an element whose categories are all eliminated (e.g. an
   * internal, authenticated ExternalEntity losing both S and R) is correctly
   * NOT reported as missing.
   */
  public getEffectiveStrideCategories(
    element: DFDElementReference,
    project: ThreatProjectData,
  ): StrideCategory[] {
    const baseCategories = STRIDE_PER_ELEMENT_TYPE[element.type] || [];
    try {
      const { categories } = createStrategy().getStrideCategories(
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
      const elementProps = (element as any).properties ?? {};
      return categories.filter(
        (strideCategory) =>
          !shouldEliminateThreat(element.type, elementProps, strideCategory),
      );
    } catch {
      // Total fallback for the sync stub: treat the base table as the answer.
      return baseCategories;
    }
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
    const defaultConfig = {
      activeMethod: "per-element" as const,
      zeroTrustMode: false,
      showThreatActor: false,
      forceClassicMode: false,
      customElementTemplates: [],
      customInteractionTemplates: [],
      customMitigations: [],
      customVerifications: [],
    };
    const { modules } = strategy.getStrideCategories(
      element,
      [strideCategory],
      project,
      config ?? defaultConfig,
    );
    threat.source = modulesToSource(modules);

    // Set initial impact from CIANAAA module
    const initialImpact = strategy.getInitialImpact(
      element,
      strideCategory,
      project,
    );
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

    // Descriptions stored empty → rendered from i18n at display time.
    // Set them here so the dialog/table has immediate content without
    // requiring a separate i18n lookup call at each render.
    if (template) {
      threat.threatDescription = getLocalizedElementThreat(
        template.id,
        template.domain ?? "general",
      );
      threat.attackDescription = getLocalizedElementAttack(
        template.id,
        template.domain ?? "general",
      );
      threat.causeDescription = getLocalizedElementCause(
        template.id,
        template.domain ?? "general",
      );
      const templateMitigations = template.mitigations.map((id) => ({
        id,
      }));
      const hints = getImplementedMitigationHints(
        element.type,
        elementProps,
        strideCategory,
      );
      threat.proposedMitigations = mergeMitigationHints(
        templateMitigations,
        hints,
      );
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