// app/services/compliance-report.ts
//
// The IEC 62443-4-2 requirement matrix of a project, evaluated for the
// document (iec-62443-4-2-cra-coverage.md §5, §9.4) — the app layer joins
// what the features may not import from each other:
//
//   edition         the project's regulation tags (D-1, D-3)
//   property view   the DFD analysis view: leaves + decomposed multiprocesses,
//                   every drawn flow incl. excluded ones (D-24)
//   scope           the component and what belongs to it (D-7): its
//                   descendants on child pages, the boundaries around them and
//                   the interfaces their flows pass; no component = everything
//   fallback        elements of a decomposed multiprocess a flow reaches only
//                   in fallback state → neighbour checks unknown (D-24)
//   mitigations     the risk treatment, one entry per mitigation and risk
//                   (D-6, D-16)
//   planned run     IS properties overlaid with the SHOULD values of the
//                   chosen mitigations (closed-loop ControlInstances, D-4)
//
// Used by doc-transform (app) and the CLI reporter alike.

import type { Project } from "../models/project-types";
import { buildAnalysisView, buildDfdGraph, analyseLeveled, isLeveled } from "features/dfd";
import { getAllMitigations } from "features/threats";
import {
  buildPropertyView,
  countsForComponent,
  evaluateMatrix,
  FOUNDATIONAL_REQUIREMENTS,
  selectEdition,
  type ComplianceResult,
  type MitigationEvidence,
  type PropertyView,
  type ViewElement,
  type ViewFlow,
} from "features/compliance";
import type { DocCompliance } from "features/documentation";
import { controlValuePatch, meetsExpected, readControlValue } from "shared/utils/control-value-semantics";
import { deriveControlInstances } from "../hooks/use-control-instance-derivation";
import { attackPathControlTargets } from "../utils/attack-path-control-targets";
import { buildComplianceMitigationEvidence } from "../utils/build-compliance-mitigation-evidence";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ==================== SCOPE ====================

/** Elements of the component: itself, its descendants, their boundaries and interfaces. */
export function complianceScope(
  componentId: string | undefined,
  view: PropertyView,
  containmentParent: ReadonlyMap<string, string>,
  graph: {
    elementTrustBoundaries: Map<string, string[]>;
    elementChipBoundaries: Map<string, string[]>;
    elementPhysicalBoundaries: Map<string, string[]>;
    dataFlowAnalysis: Map<string, { interfaceIds?: string[] }>;
  },
): Set<string> {
  if (!componentId) return new Set(view.elements.map((e) => e.id));
  const descendsFrom = (id: string): boolean => {
    for (let p = containmentParent.get(id); p; p = containmentParent.get(p)) if (p === componentId) return true;
    return false;
  };
  const scope = new Set<string>([componentId]);
  for (const e of view.elements) if (descendsFrom(e.id)) scope.add(e.id);
  for (const id of [...scope]) {
    for (const map of [graph.elementTrustBoundaries, graph.elementChipBoundaries, graph.elementPhysicalBoundaries]) {
      for (const b of map.get(id) ?? []) scope.add(b);
    }
  }
  for (const flow of view.flows) {
    if (scope.has(flow.from) || scope.has(flow.to)) {
      for (const i of graph.dataFlowAnalysis.get(flow.id)?.interfaceIds ?? []) scope.add(i);
    }
  }
  return scope;
}

// ==================== PLANNED OVERLAY ====================

/** IS properties overlaid with the SHOULD values the chosen mitigations expect (D-4). */
function plannedView(view: PropertyView, should: readonly { elementId: string; property: string; expectedValue: unknown }[]): PropertyView {
  const patch = <T extends ViewElement | ViewFlow>(item: T): T => {
    let properties = (item.properties ?? {}) as Record<string, unknown>;
    for (const c of should) {
      if (c.elementId !== item.id) continue;
      if (meetsExpected(c.property, readControlValue(properties as Any, c.property), c.expectedValue)) continue;
      properties = controlValuePatch(properties as Any, c.property, c.expectedValue);
    }
    return { ...item, properties };
  };
  return { ...view, elements: view.elements.map(patch), flows: view.flows.map(patch) };
}

// ==================== DOCUMENT DATA ====================

/** Element / flow id → "P-6 Maintenance Authentication Service". */
export function complianceNameOf(project: Project): (id: string) => string {
  const names = new Map<string, string>();
  for (const e of [...(project.dfd?.elements ?? []), ...(project.dfd?.connections ?? [])] as Any[]) {
    names.set(e.id, [e.displayId, e.name].filter(Boolean).join(" ") || e.id);
  }
  return (id) => names.get(id) ?? id;
}

/** Evaluates the project's matrix; undefined when no edition is selected or there is no DFD. */
export function evaluateProjectCompliance(
  project: Project,
): { achieved: ComplianceResult; planned: ComplianceResult; scope: Set<string>; scopeName?: string } | undefined {
  const edition = selectEdition(project.info?.tags);
  const dfd = project.dfd as Any;
  if (!edition || !dfd?.elements?.length) return undefined;

  const source = {
    xml: dfd.xml,
    pages: dfd.pages,
    elements: dfd.elements,
    connections: dfd.connections ?? [],
    assets: dfd.assets ?? [],
  };
  const analysis = buildAnalysisView(source);
  const graph = buildDfdGraph(source, analysis) as Any;

  // Leveled DFD: containment and the elements reached only by fallback flows.
  let containmentParent = new Map<string, string>();
  const fallbackContained = new Set<string>();
  if (isLeveled(dfd.xml)) {
    const model = analyseLeveled(source).model;
    containmentParent = model.containmentParent;
    const fallbackEnds = new Set(model.flows.filter((f) => f.state === "fallback").flatMap((f) => [f.from, f.to]));
    for (const id of containmentParent.keys()) {
      for (let p = containmentParent.get(id); p; p = containmentParent.get(p)) {
        if (fallbackEnds.has(p)) fallbackContained.add(id);
      }
    }
  }

  const view = buildPropertyView({
    analysisElements: analysis.elements as unknown as ViewElement[],
    allElements: dfd.elements as ViewElement[],
    flows: analysis.validationConnections as unknown as ViewFlow[],
    fallbackContained,
  });
  const componentId = project.compliance?.componentId;
  const scope = complianceScope(componentId, view, containmentParent, graph);

  const catalog = getAllMitigations();
  const anchors = attackPathControlTargets(project.attackTrees, project.assets?.assets, project.dfd);
  const mitigations: MitigationEvidence[] = buildComplianceMitigationEvidence(project.threats, project.risks, catalog, anchors);
  const should = deriveControlInstances(project.threats, project.risks, project.dfd, catalog, anchors);

  const base = {
    edition,
    scope,
    statements: project.compliance?.statements?.[edition.id],
    mitigations,
    deviceCategories: project.compliance?.deviceCategories,
  };
  return {
    achieved: evaluateMatrix({ ...base, view, run: "achieved" }),
    planned: evaluateMatrix({ ...base, view: plannedView(view, should), run: "planned" }),
    scope,
    scopeName: componentId ? complianceNameOf(project)(componentId) : undefined,
  };
}

/** The matrix chapter's data (DocProjectData.computed.compliance). */
export function buildDocCompliance(project: Project): DocCompliance | undefined {
  const result = evaluateProjectCompliance(project);
  const edition = selectEdition(project.info?.tags);
  if (!result || !edition) return undefined;
  const { achieved, planned } = result;
  const name = complianceNameOf(project);
  const target = project.compliance?.target ?? {};
  const rowById = new Map(edition.rows.map((r) => [r.label, r]));

  // Catalog mitigations naming a requirement — suggestions for gaps.
  const suggestionsOf = (label: string): string[] => {
    const ids = new Set<string>(rowById.get(label)?.requirementIds ?? []);
    return getAllMitigations()
      .filter((m) => m.iec62443?.some((id) => ids.has(id)))
      .map((m) => m.id);
  };

  return {
    editionTitle: edition.title,
    draft: edition.draft,
    cra: edition.id === "en-iec-62443-4-2-praa-2026",
    ccsc2Label: edition.ccsc2Label,
    component: result.scopeName,
    deviceCategories: edition.rows.some((r) => r.deviceCategories)
      ? {
          categories: [...(project.compliance?.deviceCategories?.categories ?? [])],
          confirmed: project.compliance?.deviceCategories?.source === "manual",
        }
      : undefined,
    vectors: FOUNDATIONAL_REQUIREMENTS.map((fr) => ({
      fr,
      target: target[fr],
      achievedComponent: achieved.component[fr],
      achievedWithSupport: achieved.withSupport[fr],
      plannedComponent: planned.component[fr],
      plannedWithSupport: planned.withSupport[fr],
    })),
    rows: achieved.rows.map((r) => {
      const countsComponent = countsForComponent(r);
      return {
        label: r.label,
        fr: r.fr,
        minSl: r.minSl,
        cra: rowById.get(r.label)?.cra ? [...rowById.get(r.label)!.cra!] : undefined,
        status: r.status,
        source: r.source,
        failing: r.failing.map(name),
        unknown: r.unknown.map(name),
        supporting: r.supportingElements.map(name),
        mitigations: [...new Set(r.mitigationIds)],
        claims: r.claimIds,
        reasoning: r.reasoning,
        checklist: r.checklist,
        contradiction: r.contradiction,
        statementModelChanged: r.statementModelChanged,
        statementSuperseded: r.statementSuperseded,
        countsForComponent: countsComponent,
        suggestions: countsComponent || r.status === "n/a" ? [] : suggestionsOf(r.label),
      };
    }),
  };
}
