// ==================== INTERACTION THREAT GENERATOR ====================
// STRIDE per-interaction: generates threats from sender AND/OR receiver perspective.
//
// Threat allocation rules:
//   Process-A (TB-A) → Process-B (TB-B):
//     Sender perspective  → TB-A (always)
//     Receiver perspective → TB-B (only if zeroTrustMode OR crossesTrustBoundary)
//
//   ExternalEntity → Process-B (TB-B):
//     EE has no TB → only receiver perspective → TB-B
//
//   Process-A (TB-A) → ExternalEntity:
//     EE has no TB → only sender perspective → TB-A
//
//   Internal flow (same TB):
//     Sender perspective only → that TB

import type {
  DFDGraphReference,
  DFDElementReference,
  DataFlowAnalysisReference,
  StrideCategory,
} from "shared";
import type {
  Threat,
  ThreatTable,
  ThreatProjectData,
  ThreatConfiguration,
} from "../../models/threat-types";
import {
  InteractionDirection,
  STRIDE_PER_INTERACTION,
  generateThreatIdPerInteraction,
  createInteractionContext,
} from "../../models/per-interaction-types";
import { createEmptyThreat } from "../../models/threat-types";
import { DataFlowReference, DFDAnalysisContext } from "shared";
import {
  findInteractionTemplate,
  getLocalizedInteractionThreat,
  getLocalizedInteractionAttack,
  getLocalizedInteractionCause,
} from "../threat-catalog-service";
import { createStrategy } from "../strategies/strategy-factory";
import type { IGeneratorStrategy } from "../../models/strategy-types";
import { modulesToSource } from "../../models/strategy-types";
import { shouldEliminateThreat } from "../threat-elimination-filter";
import {
  getImplementedMitigationHints,
  mergeMitigationHints,
} from "../implemented-controls-mapper";

// ==================== TYPES ====================

type Perspective = "sender" | "receiver";

// ==================== INTERACTION THREAT GENERATOR ====================

export class InteractionThreatGenerator {
  generateThreatsForProject(
    project: ThreatProjectData,
    dfdContext: DFDAnalysisContext,
    configuration?: ThreatConfiguration,
  ): ThreatTable[] {
    if (!project.dfdGraph) return [];

    const strategy = createStrategy();

    const defaultConfig = {
      activeMethod: "per-interaction" as const,
      zeroTrustMode: false,
      showThreatActor: false,
      forceClassicMode: false,
      customElementTemplates: [],
      customInteractionTemplates: [],
      customMitigations: [],
      customVerifications: [],
    };

    const graph = project.dfdGraph;
    const zeroTrust = configuration?.zeroTrustMode ?? false;

    // ── Asset reverse index ───────────────────────────────────────────────
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

    // ── Table map: tbId → Threat[] ────────────────────────────────────────
    const tableMap = new Map<string, Threat[]>();
    const addThreat = (tbId: string, threat: Threat) => {
      const existing = tableMap.get(tbId) ?? [];
      existing.push(threat);
      tableMap.set(tbId, existing);
    };

    // ── DataFlow threats ──────────────────────────────────────────────────
    for (const df of dfdContext.getDataFlows()) {
      const source = dfdContext.getElement(df.fromElementId);
      const target = dfdContext.getElement(df.toElementId);
      if (!source || !target) continue;

      const connection = graph.connectionsById.get(df.connectionId);
      const dfDisplayId = connection?.displayId ?? df.connectionId;

      const isExcluded =
        connection?.excludeFromThreatGen ||
        (connection as any)?.properties?.excludeFromThreatGen;
      if (isExcluded) continue;

      const senderTB = df.fromEffectiveTrustBoundary ?? null;
      const receiverTB = df.toEffectiveTrustBoundary ?? null;
      const internalFlow = senderTB !== null && senderTB === receiverTB;

      // Element props for context-aware template matching:
      // sender → source properties, receiver → target properties
      const sourceProps =
        ((source as any).properties as Record<string, unknown>) ?? null;
      const targetProps =
        ((target as any).properties as Record<string, unknown>) ?? null;

      // Strategy modulates STRIDE based on DataFlow properties
      const dataFlowElementWithProps: DFDElementReference = {
        id: connection?.id ?? df.connectionId,
        type: "DataFlow",
        name: connection?.name || dfDisplayId,
        displayId: dfDisplayId,
        properties: (connection as any)?.properties ?? {},
      } as DFDElementReference;

      const config = configuration ?? project.threats?.configuration;
      const { categories: applicableStride } = strategy.getStrideCategories(
        dataFlowElementWithProps,
        STRIDE_PER_INTERACTION,
        project,
        config ?? defaultConfig,
      );

      if (senderTB) {
        const sourcePropsForElim = sourceProps ?? {};
        for (const stride of applicableStride) {
          if (shouldEliminateThreat("DataFlow", sourcePropsForElim, stride))
            continue;
          addThreat(
            senderTB,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              connection?.label || connection?.name || dfDisplayId,
              source,
              target,
              stride,
              "sender",
              senderTB,
              this.getTBName(graph, senderTB),
              this.getTBDisplayId(graph, senderTB),
              elementToAssets,
              project,
              strategy,
              sourceProps,
            ),
          );
        }
      }

      const needsReceiverPerspective =
        !senderTB || (!internalFlow && (zeroTrust || df.crossesTrustBoundary));

      // ── Special case: flow terminates at ChipBoundary ─────────────────
      // ChipBoundary has no effectiveTB → senderTB/receiverTB are both null.
      // Route under the ChipBoundary element as its own boundary group.
      if (!senderTB && !receiverTB && df.terminatesAtChipBoundary) {
        const targetEl = graph.elementsById.get(df.toElementId);
        const sourceEl = graph.elementsById.get(df.fromElementId);
        if (targetEl?.type === "ChipBoundary") {
          const cbId = targetEl.id;
          const cbName = targetEl.name;
          const cbDisplayId = targetEl.displayId ?? cbId;
          const targetPropsForElim = targetProps ?? {};
          for (const stride of applicableStride) {
            if (shouldEliminateThreat("DataFlow", targetPropsForElim, stride))
              continue;
            addThreat(
              cbId,
              this.createDataFlowThreat(
                df,
                dfDisplayId,
                connection?.label || connection?.name || dfDisplayId,
                source,
                target,
                stride,
                "receiver",
                cbId,
                cbName,
                cbDisplayId,
                elementToAssets,
                project,
                strategy,
                targetProps,
              ),
            );
          }
        }
      }

      if (needsReceiverPerspective && receiverTB) {
        const targetPropsForElim = targetProps ?? {};
        for (const stride of applicableStride) {
          if (shouldEliminateThreat("DataFlow", targetPropsForElim, stride))
            continue;
          addThreat(
            receiverTB,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              connection?.label || connection?.name || dfDisplayId,
              source,
              target,
              stride,
              "receiver",
              receiverTB,
              this.getTBName(graph, receiverTB),
              this.getTBDisplayId(graph, receiverTB),
              elementToAssets,
              project,
              strategy,
              targetProps,
            ),
          );
        }
      }
    }

    // ── Interface threats ─────────────────────────────────────────────────
    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      const elProps = element.properties ?? {};

      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      const tbId = effectiveTB ?? null;

      // Resolve parent boundary: TB > PB > CB > fallback.
      // tableKey uses the parent id so each PhysicalBoundary and ChipBoundary
      // gets its own threat table instead of a shared "__no_tb__" bucket.
      let tbName: string;
      let tbDisplayId: string;
      let tableKey: string;

      if (tbId) {
        tbName = this.getTBName(graph, tbId);
        tbDisplayId = this.getTBDisplayId(graph, tbId);
        tableKey = tbId;
      } else {
        const pbIds = graph.elementPhysicalBoundaries?.get(element.id) ?? [];
        const cbIds = graph.elementChipBoundaries?.get(element.id) ?? [];
        const parentId = pbIds[0] ?? cbIds[0] ?? null;
        const parent = parentId ? graph.elementsById.get(parentId) : null;
        tbName = parent?.name ?? "Physical Interfaces";
        tbDisplayId = parent?.displayId ?? "";
        tableKey = parentId ?? "__no_tb__";
      }

      const { categories: applicableStride } = strategy.getStrideCategories(
        element,
        STRIDE_PER_INTERACTION,
        project,
        project.threats?.configuration ?? defaultConfig,
      );

      for (const stride of applicableStride) {
        // shouldEliminateThreat covers permanent_disabled, fused_off,
        // sealed, fiber_optic, enabled_read_only per STRIDE category.
        if (shouldEliminateThreat(element.type, elProps, stride)) continue;

        const threat = this.createInterfaceThreat(
          element,
          stride,
          tbId,
          tbName,
          tbDisplayId,
          elementToAssets,
          project,
          strategy,
        );
        const existing = tableMap.get(tableKey) ?? [];
        existing.push(threat);
        tableMap.set(tableKey, existing);
      }
    }

    // ── Build tables ──────────────────────────────────────────────────────
    const tables: ThreatTable[] = [];
    for (const [tbId, threats] of tableMap) {
      if (threats.length === 0) continue;

      if (tbId === "__no_tb__") {
        tables.push({
          trustBoundaryId: null,
          trustBoundaryName: "Physical Interfaces",
          displayIdentifier: "[IF]",
          threats,
        });
      } else {
        const boundary = graph.elementsById.get(tbId);
        tables.push({
          trustBoundaryId: tbId,
          trustBoundaryName: boundary?.name ?? tbId,
          displayIdentifier: `[${boundary?.displayId ?? tbId}]`,
          threats,
        });
      }
    }

    return tables;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getTBName(graph: DFDGraphReference, tbId: string): string {
    return graph.elementsById.get(tbId)?.name ?? tbId;
  }

  private getTBDisplayId(graph: DFDGraphReference, tbId: string): string {
    return graph.elementsById.get(tbId)?.displayId ?? tbId;
  }

  // ── Threat creation ───────────────────────────────────────────────────────

  private createDataFlowThreat(
    dataFlow: DataFlowAnalysisReference,
    dfDisplayId: string,
    connectionLabel: string,
    source: DFDElementReference,
    target: DFDElementReference,
    strideCategory: StrideCategory,
    perspective: Perspective,
    trustBoundaryId: string,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
    elementProps: Record<string, unknown>,
  ): Threat {
    const direction: InteractionDirection =
      perspective === "sender" ? "outgoing" : "incoming";

    const dataFlowNumber = dfDisplayId.replace(/^DF-/, "");
    const dataFlowIdPart = `DF${dataFlowNumber}`;
    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      dataFlowIdPart,
      strideCategory,
      direction,
      1,
    );

    const interactionContext = createInteractionContext(
      direction,
      dataFlow.crossesTrustBoundary,
    );

    const threat = createEmptyThreat(
      threatId,
      strideCategory,
      trustBoundaryId,
      trustBoundaryName,
      trustBoundaryDisplayId,
      interactionContext,
    );

    threat.dataFlow = {
      connectionId: dataFlow.connectionId,
      dataFlowId: dfDisplayId,
      dataFlowName: connectionLabel || dfDisplayId,
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      targetId: target.id,
      targetName: target.name,
      targetType: target.type,
    } as DataFlowReference;

    const connAssets = elementToAssets.get(dataFlow.connectionId) ?? [];
    const sourceAssets = elementToAssets.get(dataFlow.fromElementId) ?? [];
    const targetAssets = elementToAssets.get(dataFlow.toElementId) ?? [];
    threat.linkedAssetIds = [
      ...new Set([...connAssets, ...sourceAssets, ...targetAssets]),
    ];

    // Determine source from active modules
    const impactElement = perspective === "sender" ? source : target;
    const defaultConfig = {
      activeMethod: "per-interaction" as const,
      zeroTrustMode: false,
      showThreatActor: false,
      forceClassicMode: false,
      customElementTemplates: [],
      customInteractionTemplates: [],
      customMitigations: [],
      customVerifications: [],
    };
    const { modules } = strategy.getStrideCategories(
      impactElement,
      [strideCategory],
      project,
      project.threats?.configuration ?? defaultConfig,
    );
    threat.source = modulesToSource(modules);

    const initialImpact = strategy.getInitialImpact(
      impactElement,
      strideCategory,
      project,
    );
    if (initialImpact !== undefined) {
      threat.initialImpact = initialImpact;
    }

    // ── Catalog lookup ────────────────────────────────────────────────────
    const template = strategy.selectInteractionTemplate(
      strideCategory,
      perspective,
      project,
      elementProps,
    );

    if (template) {
      const placeholders = {
        sourceName: source.name,
        targetName: target.name,
        sourceType: source.type,
        targetType: target.type,
        dataFlowName: dfDisplayId,
        trustBoundaryName,
      };
      threat.threatDescription = getLocalizedInteractionThreat(
        template.id,
        placeholders,
      );
      threat.attackDescription = getLocalizedInteractionAttack(
        template.id,
        placeholders,
      );
      threat.causeDescription = getLocalizedInteractionCause(
        template.id,
        placeholders,
      );
      const templateMitigations = template.mitigations.map((id) => ({ id }));
      const hints = getImplementedMitigationHints(
        perspective === "sender" ? source.type : target.type,
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

  private createInterfaceThreat(
    element: DFDElementReference,
    strideCategory: StrideCategory,
    trustBoundaryId: string | null,
    trustBoundaryName: string,
    trustBoundaryDisplayId: string,
    elementToAssets: Map<string, string[]>,
    project: ThreatProjectData,
    strategy: IGeneratorStrategy,
  ): Threat {
    const displayId = element.displayId || element.id;
    const interfaceNumber = displayId.replace(/^IF-/, "");
    const interfaceIdPart = `IF${interfaceNumber}`;

    const threatId = generateThreatIdPerInteraction(
      trustBoundaryDisplayId,
      interfaceIdPart,
      strideCategory,
      "incoming",
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
      displayId,
    };

    threat.linkedAssetIds = elementToAssets.get(element.id) ?? [];

    const defaultConfig = {
      activeMethod: "per-interaction" as const,
      zeroTrustMode: false,
      showThreatActor: false,
      forceClassicMode: false,
      customElementTemplates: [],
      customInteractionTemplates: [],
      customMitigations: [],
      customVerifications: [],
    };
    const { modules: ifModules } = strategy.getStrideCategories(
      element,
      [strideCategory],
      project,
      project.threats?.configuration ?? defaultConfig,
    );
    threat.source = modulesToSource(ifModules);

    const ifInitialImpact = strategy.getInitialImpact(
      element,
      strideCategory,
      project,
    );
    if (ifInitialImpact !== undefined) {
      threat.initialImpact = ifInitialImpact;
    }

    // Interface element properties for context matching
    const elementProps =
      ((element as any).properties as Record<string, unknown>) ?? null;

    // ── Catalog lookup (interface = receiver perspective by convention) ────
    const template = strategy.selectInteractionTemplate(
      strideCategory,
      "receiver",
      project,
      elementProps,
    );

    if (template) {
      const placeholders = {
        sourceName: element.name,
        targetName: element.name,
        sourceType: element.type,
        targetType: element.type,
        dataFlowName: displayId,
        trustBoundaryName,
      };
      threat.threatDescription = getLocalizedInteractionThreat(
        template.id,
        placeholders,
      );
      threat.attackDescription = getLocalizedInteractionAttack(
        template.id,
        placeholders,
      );
      threat.causeDescription = getLocalizedInteractionCause(
        template.id,
        placeholders,
      );
      const templateMitigations = template.mitigations.map((id) => ({ id }));
      const ifHints = getImplementedMitigationHints(
        element.type,
        elementProps,
        strideCategory,
      );
      threat.proposedMitigations = mergeMitigationHints(
        templateMitigations,
        ifHints,
      );
      threat.proposedVerifications = template.verifications.map((id) => ({
        id,
      }));
    }

    return threat;
  }
}

// ==================== EXPORT SINGLETON ====================

export const interactionThreatGenerator = new InteractionThreatGenerator();