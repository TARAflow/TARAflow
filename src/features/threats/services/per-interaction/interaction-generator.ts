// ==================== INTERACTION THREAT GENERATOR ====================
// STRIDE per-interaction: generates threats from sender AND/OR receiver perspective.
//
// Threat allocation rules — always both perspectives, one exception:
//
//   Any flow (cross-boundary or EE-involved):
//     Sender perspective  → senderTB if set, else receiverTB
//     Receiver perspective → receiverTB if set, else senderTB
//
//   Internal flow (senderTB === receiverTB, no ZeroTrust):
//     Sender perspective only → that TB  [the only exception]
//
// Rationale: both ends must verify identity of the other party.
// An EE could be spoofed (sender perspective) and a Process target
// could be spoofed too (receiver perspective). Symmetric coverage
// regardless of TB presence.

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
import {
  mergeGeneratedTables,
  interactionThreatNaturalKey,
} from "../threat-identity";

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

      // ── Special case: flow terminates at ChipBoundary ───────────────────
      // ChipBoundary has no effectiveTB → senderTB and receiverTB are both null.
      // The flow is unidirectional (e.g. Debugger → CB via JTAG) — there is no
      // modelled response channel. Generate receiver perspective only:
      // "Can the CB trust the sender?" — is the Debugger really who it claims?
      if (!senderTB && !receiverTB && df.terminatesAtChipBoundary) {
        const targetEl = graph.elementsById.get(df.toElementId);
        if (targetEl?.type === "ChipBoundary") {
          const cbId = targetEl.id;
          const cbName = targetEl.name;
          const cbDisplayId = targetEl.displayId ?? cbId;
          for (const stride of applicableStride) {
            if (shouldEliminateThreat("DataFlow", targetProps ?? {}, stride))
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
        continue; // Skip normal sender/receiver block
      }

      // ── Sender perspective ──────────────────────────────────────────────
      // Table key: senderTB if set, else receiverTB (EE source has no TB —
      // threat belongs to the boundary that owns the conversation).
      // connectionProps merged with element props: DataFlow-level properties
      // (location, safetyFunction, accessMode, protocol) are needed for
      // safety/physical DataFlow interaction templates.
      const connectionProps =
        ((connection as any)?.properties as Record<string, unknown>) ?? {};
      const senderTableKey = senderTB ?? receiverTB;
      if (senderTableKey) {
        const sourcePropsForElim = sourceProps ?? {};
        for (const stride of applicableStride) {
          if (shouldEliminateThreat("DataFlow", sourcePropsForElim, stride))
            continue;
          addThreat(
            senderTableKey,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              connection?.label || connection?.name || dfDisplayId,
              source,
              target,
              stride,
              "sender",
              senderTableKey,
              this.getTBName(graph, senderTableKey),
              this.getTBDisplayId(graph, senderTableKey),
              elementToAssets,
              project,
              strategy,
              { ...connectionProps, ...sourceProps },
            ),
          );
        }
      }

      // ── Receiver perspective ─────────────────────────────────────────────
      // Exception: internal flows (senderTB === receiverTB, no ZeroTrust)
      // get sender perspective only — both sides trust each other within same TB.
      // Table key: receiverTB if set, else senderTB (EE target has no TB).
      const skipReceiver = internalFlow && !zeroTrust;
      const receiverTableKey = receiverTB ?? senderTB;
      if (!skipReceiver && receiverTableKey) {
        const targetPropsForElim = targetProps ?? {};
        for (const stride of applicableStride) {
          if (shouldEliminateThreat("DataFlow", targetPropsForElim, stride))
            continue;
          addThreat(
            receiverTableKey,
            this.createDataFlowThreat(
              df,
              dfDisplayId,
              connection?.label || connection?.name || dfDisplayId,
              source,
              target,
              stride,
              "receiver",
              receiverTableKey,
              this.getTBName(graph, receiverTableKey),
              this.getTBDisplayId(graph, receiverTableKey),
              elementToAssets,
              project,
              strategy,
              { ...connectionProps, ...targetProps },
            ),
          );
        }
      }
    }

    // TEMP DEBUG
    let crossCount = 0,
      internalCount = 0,
      noTbCount = 0;
    for (const df of dfdContext.getDataFlows()) {
      const senderTB = df.fromEffectiveTrustBoundary ?? null;
      const receiverTB = df.toEffectiveTrustBoundary ?? null;
      if (senderTB && senderTB === receiverTB) internalCount++;
      else if (senderTB || receiverTB) crossCount++;
      else noTbCount++;
    }
    console.log(
      `[DEBUG] Cross: ${crossCount}, Internal: ${internalCount}, NoTB: ${noTbCount}`,
    );
    console.log(
      `[DEBUG] Expected max threats: ${crossCount * 12 + internalCount * 6 + noTbCount * 6}`,
    );
    // END TEMP DEBUG

    // ── Interface threats ─────────────────────────────────────────────────
    for (const element of graph.elementsById.values()) {
      if (element.type !== "Interface" && element.type !== "PhysicalInterface")
        continue;

      const elProps = element.properties ?? {};

      const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
      const tbId = effectiveTB ?? null;

      // Resolve parent boundary name: TB > PB > CB > fallback
      let tbName: string;
      let tbDisplayId: string;
      if (tbId) {
        tbName = this.getTBName(graph, tbId);
        tbDisplayId = this.getTBDisplayId(graph, tbId);
      } else {
        const pbIds = graph.elementPhysicalBoundaries?.get(element.id) ?? [];
        const cbIds = graph.elementChipBoundaries?.get(element.id) ?? [];
        const parentBoundaryId = pbIds[0] ?? cbIds[0] ?? null;
        const parentBoundary = parentBoundaryId
          ? graph.elementsById.get(parentBoundaryId)
          : null;
        tbName = parentBoundary?.name ?? "Physical Interfaces";
        tbDisplayId = parentBoundary?.displayId ?? "";
      }

      // tableKey: use PB or CB id so each boundary gets its own threat table
      const tableKey =
        tbId ??
        (() => {
          const pbIds = graph.elementPhysicalBoundaries?.get(element.id) ?? [];
          const cbIds = graph.elementChipBoundaries?.get(element.id) ?? [];
          return pbIds[0] ?? cbIds[0] ?? "__no_tb__";
        })();

      const { categories: applicableStride } = strategy.getStrideCategories(
        element,
        STRIDE_PER_INTERACTION,
        project,
        defaultConfig,
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

    // ── PhysicalBoundary threats ──────────────────────────────────────────
    // PB has no DataFlows and no interaction partners — generated unconditionally,
    // same as Interface threats. PB is always its own table key (never has a TB parent).
    for (const element of graph.elementsById.values()) {
      if (element.type !== "PhysicalBoundary") continue;

      const elProps = element.properties ?? {};
      const pbId = element.id;
      const pbName = element.name;
      const pbDisplayId = element.displayId ?? pbId;

      const { categories: applicableStride } = strategy.getStrideCategories(
        element,
        STRIDE_PER_INTERACTION,
        project,
        defaultConfig,
      );

      for (const stride of applicableStride) {
        if (shouldEliminateThreat(element.type, elProps, stride)) continue;

        const threat = this.createInterfaceThreat(
          element,
          stride,
          pbId,
          pbName,
          pbDisplayId,
          elementToAssets,
          project,
          strategy,
        );
        const existing = tableMap.get(pbId) ?? [];
        existing.push(threat);
        tableMap.set(pbId, existing);
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

    // ── Preserve analyst-owned fields across full regeneration ────────────
    // See threat-identity.ts. Match each fresh threat to its predecessor by
    // stable natural key (connectionId + strideCategory + direction for
    // data-flow threats, elementId + strideCategory for interface threats) and
    // carry the analyst fields over. No previous set → fresh tables unchanged.
    return mergeGeneratedTables(
      tables,
      project.threats?.perInteractionTables,
      interactionThreatNaturalKey,
    );
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
      threat.templateId = template.id; // ← traceability: originating catalog entry
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
        template.domain ?? "general",
      );
      threat.attackDescription = getLocalizedInteractionAttack(
        template.id,
        placeholders,
        template.domain ?? "general",
      );
      threat.causeDescription = getLocalizedInteractionCause(
        template.id,
        placeholders,
        template.domain ?? "general",
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
      threat.templateId = template.id; // ← traceability: originating catalog entry
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
        template.domain ?? "general",
      );
      threat.attackDescription = getLocalizedInteractionAttack(
        template.id,
        placeholders,
        template.domain ?? "general",
      );
      threat.causeDescription = getLocalizedInteractionCause(
        template.id,
        placeholders,
        template.domain ?? "general",
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