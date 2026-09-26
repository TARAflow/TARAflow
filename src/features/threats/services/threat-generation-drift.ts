// ==================== THREAT GENERATION DRIFT ====================
//
// Threats are stored in the project file; the generation RULES are code. When
// the rules change (e.g. how security goals and element properties combine),
// stored threats do not change on their own. Two situations then stay invisible:
//
//   1. A later full regeneration silently drops every generated threat the
//      current rules no longer produce — together with the analyst's work on it
//      (relevance, notes) and, on the next risk sync, its risk assessment.
//   2. The incremental DFD sync only generates threats for NEW elements, so a
//      project ends up with mixed semantics: old elements under the old rules,
//      new elements under the current ones.
//
// detectGenerationDrift() makes both visible: it runs the current generator
// (pure, nothing is written) and compares natural keys with the stored threats.
// The resolution is always an explicit analyst action — keep a threat as a
// manual threat (survives every regeneration) or remove it. Nothing is changed
// silently.
//
// Pure: no React, no project state, no side effects.

import type {
  StrideMethod,
  Threat,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatTable,
} from "../models/threat-types";
import type { DFDAnalysisContext } from "shared";
import { elementThreatGenerator } from "./per-element/element-generator";
import { interactionThreatGenerator } from "./per-interaction/interaction-generator";
import {
  elementThreatNaturalKey,
  interactionThreatNaturalKey,
} from "./threat-identity";
import { elementThreatService } from "./per-element/element-threat-service";
import { interactionThreatService } from "./per-interaction/interaction-threat-service";

// ==================== TYPES ====================

/** A stored generated threat the current rules would no longer produce. */
export interface ObsoleteThreat {
  threatId: string;
  displayId: string;
  strideCategory: Threat["strideCategory"];
  elementName: string;
  relevance: Threat["relevance"];
}

export interface GenerationDrift {
  /** Stored generated threats the current rules no longer produce. */
  obsolete: ObsoleteThreat[];
  /** Threats the current rules would produce that are not stored yet. */
  addedCount: number;
}

export const NO_DRIFT: GenerationDrift = { obsolete: [], addedCount: 0 };

// ==================== DETECTION ====================

function keyFnFor(method: StrideMethod) {
  return method === "per-element"
    ? elementThreatNaturalKey
    : interactionThreatNaturalKey;
}

function storedTables(
  project: ThreatProjectData,
  method: StrideMethod,
): ThreatTable[] {
  return (
    (method === "per-element"
      ? project.threats?.perElementTables
      : project.threats?.perInteractionTables) ?? []
  );
}

function generateFresh(
  project: ThreatProjectData,
  dfdContext: DFDAnalysisContext,
  configuration: ThreatConfiguration,
  method: StrideMethod,
): ThreatTable[] {
  // threats: null — only the KEYS of a fresh run matter here; merging with the
  // stored set would not change them and is skipped.
  const blank: ThreatProjectData = { ...project, threats: null };
  return method === "per-element"
    ? elementThreatGenerator.generateThreatsForProject(blank, configuration, {
        keepManual: false,
      })
    : interactionThreatGenerator.generateThreatsForProject(
        blank,
        dfdContext,
        configuration,
        { keepManual: false },
      );
}

function elementNameOf(threat: Threat): string {
  return (
    threat.linkedElement?.elementName ??
    threat.dataFlow?.label ??
    threat.dataFlow?.name ??
    ""
  );
}

/**
 * Compare the stored threats of one STRIDE method with what the current
 * generation rules would produce. Manual threats are never obsolete — the
 * generator does not own them.
 *
 * Returns NO_DRIFT when nothing has been generated yet (no stored threats) or
 * there is no DFD graph: drift is only meaningful against an existing set.
 */
export function detectGenerationDrift(
  project: ThreatProjectData,
  dfdContext: DFDAnalysisContext,
  configuration: ThreatConfiguration,
  method: StrideMethod,
): GenerationDrift {
  const stored = storedTables(project, method);
  const storedGenerated = stored
    .flatMap((t) => t.threats)
    .filter((t) => t.source !== "manual");
  if (storedGenerated.length === 0 || !project.dfdGraph) return NO_DRIFT;

  const keyFn = keyFnFor(method);
  const freshKeys = new Set(
    generateFresh(project, dfdContext, configuration, method)
      .flatMap((t) => t.threats)
      .map(keyFn)
      .filter((k): k is string => k !== null),
  );

  const storedKeys = new Set<string>();
  const obsolete: ObsoleteThreat[] = [];
  for (const threat of storedGenerated) {
    const key = keyFn(threat);
    if (key === null) continue;
    storedKeys.add(key);
    if (!freshKeys.has(key)) {
      obsolete.push({
        threatId: threat.id,
        displayId: threat.displayId ?? threat.id,
        strideCategory: threat.strideCategory,
        elementName: elementNameOf(threat),
        relevance: threat.relevance,
      });
    }
  }

  let addedCount = 0;
  for (const key of freshKeys) if (!storedKeys.has(key)) addedCount++;

  return { obsolete, addedCount };
}

export function hasDrift(drift: GenerationDrift): boolean {
  return drift.obsolete.length > 0 || drift.addedCount > 0;
}

/**
 * Drift of a whole project for its active STRIDE method — for surfaces that
 * are NOT the Threats tab (e.g. the phase tab badge), so the analyst sees the
 * drift right after changing security goals, without opening the tab.
 *
 * Same gating as the Threats tab banner: only evaluated while the DFD sync is
 * clean — threats for new or deleted elements are the sync's job, not drift.
 */
export function projectGenerationDrift(
  project: ThreatProjectData,
  dfdContext: DFDAnalysisContext,
): GenerationDrift {
  const configuration = project.threats?.configuration;
  if (!configuration) return NO_DRIFT;
  const method: StrideMethod = configuration.activeMethod ?? "per-element";
  const tables = storedTables(project, method);
  if (!project.dfdElements?.length || tables.length === 0) return NO_DRIFT;

  const service =
    method === "per-element" ? elementThreatService : interactionThreatService;
  if (!service.checkSyncStatus(project, tables).inSync) return NO_DRIFT;

  return detectGenerationDrift(project, dfdContext, configuration, method);
}

/** Number of threats affected by the drift (to be removed + to be added). */
export function driftCount(drift: GenerationDrift): number {
  return drift.obsolete.length + drift.addedCount;
}

// ==================== RESOLUTION (explicit analyst actions) ====================

/**
 * Keep the given threats as manual threats. A manual threat is analyst-owned:
 * it survives every regeneration (keepManual) and keeps its id, so its risk
 * stays linked. It no longer receives generator updates — that is the point.
 */
export function keepThreatsAsManual(
  tables: ThreatTable[],
  threatIds: ReadonlySet<string>,
): ThreatTable[] {
  if (threatIds.size === 0) return tables;
  return tables.map((table) =>
    table.threats.some((t) => threatIds.has(t.id))
      ? {
          ...table,
          threats: table.threats.map((t) =>
            threatIds.has(t.id) ? { ...t, source: "manual" as const } : t,
          ),
        }
      : table,
  );
}

/** Remove the given threats; tables left empty are dropped. */
export function removeThreats(
  tables: ThreatTable[],
  threatIds: ReadonlySet<string>,
): ThreatTable[] {
  if (threatIds.size === 0) return tables;
  return tables
    .map((table) => ({
      ...table,
      threats: table.threats.filter((t) => !threatIds.has(t.id)),
    }))
    .filter((table) => table.threats.length > 0);
}
