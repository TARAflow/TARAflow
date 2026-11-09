// app/services/compliance-report.ts
//
// The IEC 62443-4-2 requirement matrix of a project, evaluated for the
// document (iec-62443-4-2-cra-coverage.md §5, §9.4) — the app layer joins
// what the features may not import from each other:
//
//   edition         the project's regulation tags (D-1; standard registry,
//                   one evaluation per standard, K-1)
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

import { i18n } from "i18n";
import type { Project } from "../models/project-types";
import { buildAnalysisView, buildDfdGraph, analyseLeveled, isLeveled } from "features/dfd";
import { withComponentMeasures } from "../utils/component-treatments";
import { withComponentThreats } from "../utils/component-threats";
import { getAllMitigations } from "features/threats";
import {
  buildPropertyView,
  countsForComponent,
  describeLanguageOf,
  describeRequirement,
  editionStatements,
  localizedChecklist,
  evaluateMatrix,
  FOUNDATIONAL_REQUIREMENTS,
  activeStandards,
  qualifyRequirementId,
  selectEdition,
  suggestMitigations,
  type AnyEdition,
  type MatrixClaim,
  type En50742View,
  type ComplianceResult,
  type StandardModule,
  type MitigationEvidence,
  type PropertyView,
  type ViewElement,
  type ViewFlow,
} from "features/compliance";
import type { DocCompliance, DocMitigationSuggestion } from "features/documentation";
import { complianceComponentOf, familyCompliance } from "shared";
import { controlValuePatch, meetsExpected, readControlValue } from "shared/utils/control-value-semantics";
import { deriveControlInstances } from "../hooks/use-control-instance-derivation";
import { attackPathControlTargets } from "../utils/attack-path-control-targets";
import { buildComplianceMitigationEvidence } from "../utils/build-compliance-mitigation-evidence";
import { buildEn50742View } from "../utils/build-en50742-view";
import type { SafetyPathInput } from "../utils/safety-function-paths";

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
      // The patch holds only the changed top-level key.
      properties = { ...properties, ...controlValuePatch(properties as Any, c.property, c.expectedValue) };
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

/** Element / flow id → its type ("DataFlow" for flows), for the derived requirements (D-29). */
export function complianceTypeOf(project: Project): (id: string) => string | undefined {
  const types = new Map<string, string>();
  for (const e of (project.dfd?.elements ?? []) as Any[]) types.set(e.id, e.type);
  for (const c of (project.dfd?.connections ?? []) as Any[]) types.set(c.id, "DataFlow");
  return (id) => types.get(id);
}

/** Trust boundary controls that let traffic pass one way only — a path to a safety function ends there. */
const ONE_WAY_CONTROLS: readonly string[] = ["data_diode", "unidirectional_gateway"];

/** One edition evaluated: both runs and the scope of its family's component (K-5). */
export interface EditionEvaluation {
  achieved: ComplianceResult;
  planned: ComplianceResult;
  scope: Set<string>;
  scopeName?: string;
}

/** The model side of the matrix, shared by every standard of the project. */
export interface ProjectComplianceContext {
  /** Scope of the default component (ComplianceData.componentId). */
  scope: Set<string>;
  scopeName?: string;
  /** Achieved and planned run of one edition, in its family's scope and with its family's data. */
  evaluate: (edition: AnyEdition) => EditionEvaluation;
  /** EN 50742 A: risks, safety functions with their paths, hazards, WoO (CM-12). */
  en50742View: () => En50742View;
}

/**
 * Builds what every edition reads (property view, scope, mitigations, the
 * planned overlay) once; the editions are evaluated on demand. Undefined
 * when there is no DFD.
 */
export function prepareProjectCompliance(project: Project): ProjectComplianceContext | undefined {
  const dfd = project.dfd as Any;
  if (!dfd?.elements?.length) return undefined;

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
  const scopeOf = (id: string | undefined) => (id === componentId ? scope : complianceScope(id, view, containmentParent, graph));
  const nameOf = (id: string | undefined) => (id ? complianceNameOf(project)(id) : undefined);

  const catalog = getAllMitigations();
  const anchors = attackPathControlTargets(project.attackTrees, project.assets?.assets, project.dfd);
  // Multi-project TARA (phase 4b): imported threats give their risks' measures
  // element targets, and the component's measures count only when effective
  // in the instance (unclear ones are shown, not counted).
  const componentMeasures = withComponentMeasures(project);
  const mitigations: MitigationEvidence[] = buildComplianceMitigationEvidence(
    withComponentThreats(project.threats, project) ?? null,
    componentMeasures.risks,
    catalog,
    anchors,
    complianceTypeOf(project),
    (riskId, mitigationId) => componentMeasures.unclear.has(`${riskId}|${mitigationId}`),
  );
  const should = deriveControlInstances(project.threats, project.risks, project.dfd, catalog, anchors);

  const planned = plannedView(view, should);
  // EN 50742 A (CM-12): risks, safety functions with their paths, hazards,
  // WoO — built once, on demand. One-way boundaries end a path (CM-12b).
  const oneWay = new Set(
    (dfd.elements as Any[])
      .filter((e) => e.type === "TrustBoundary" && (e.properties?.boundaryControlTypes ?? []).some((c: string) => ONE_WAY_CONTROLS.includes(c)))
      .map((e) => e.id as string),
  );
  const paths: SafetyPathInput = {
    flows: view.flows,
    interfacesOf: (id) => graph.dataFlowAnalysis.get(id)?.interfaceIds ?? [],
    blocked: (id) => {
      const flow = graph.dataFlowAnalysis.get(id);
      if (!flow || oneWay.size === 0) return false;
      const from = new Set<string>(flow.fromTrustBoundaryIds ?? []);
      const to = new Set<string>(flow.toTrustBoundaryIds ?? []);
      return [...from, ...to].some((b) => oneWay.has(b) && from.has(b) !== to.has(b));
    },
    parentOf: (id) => containmentParent.get(id),
  };
  // IEC-6 (D-5): supporting claims cover the rows whose requirements they all name.
  const supporting = (project.cybersecurityConcept?.claims ?? []).filter((c) => c.kind === "supporting");
  const matrixClaims = (edition: AnyEdition): MatrixClaim[] =>
    supporting
      .map((c) => ({
        displayId: c.displayId,
        rowLabels: edition.rows
          .filter((r) => r.requirementIds.length > 0 && r.requirementIds.every((id) => c.requirements?.includes(qualifyRequirementId(edition.family, id))))
          .map((r) => r.label),
      }))
      .filter((c) => c.rowLabels.length > 0);
  let en50742: ReturnType<typeof buildEn50742View> | undefined;
  const en50742View = () => (en50742 ??= buildEn50742View(project, paths));

  return {
    scope,
    scopeName: nameOf(componentId),
    en50742View,
    evaluate: (edition) => {
      const familyData = familyCompliance(project.compliance, edition.family);
      const familyComponent = complianceComponentOf(project.compliance, edition.family);
      const familyScope = scopeOf(familyComponent);
      const base = {
        edition,
        scope: familyScope,
        componentId: familyComponent,
        // D-31: statements per requirement, found by each row's requirement ids.
        statements: editionStatements(edition, familyData.statements),
        mitigations,
        deviceCategories: familyData.deviceCategories,
        claims: matrixClaims(edition),
        ...(edition.family === "en-50742" ? { en50742: en50742View() } : {}),
      };
      return {
        achieved: evaluateMatrix({ ...base, view, run: "achieved" }),
        planned: evaluateMatrix({ ...base, view: planned, run: "planned" }),
        scope: familyScope,
        scopeName: nameOf(familyComponent),
      };
    },
  };
}

/**
 * Evaluates one edition of the project's matrix — by default the first
 * active standard (the report shows one chapter until CM-9); undefined when
 * no edition is selected or there is no DFD.
 */
export function evaluateProjectCompliance(
  project: Project,
  edition: AnyEdition | null = selectEdition(project.info?.tags),
): EditionEvaluation | undefined {
  const context = edition ? prepareProjectCompliance(project) : undefined;
  if (!edition || !context) return undefined;
  return context.evaluate(edition);
}

/**
 * The matrix chapter's data (DocProjectData.computed.compliance): one part
 * per active standard, in registry order (CM-9); the model is prepared once.
 * EN 50742 A brings its SRSL per safety function instead of SL vectors (CM-13).
 */
export function buildDocCompliance(project: Project, language = "en"): DocCompliance[] | undefined {
  const standards = activeStandards(project.info?.tags);
  const context = standards.length > 0 ? prepareProjectCompliance(project) : undefined;
  if (!context) return undefined;
  return standards.map((standard) => docComplianceOf(project, language, standard, context.evaluate(standard.edition)));
}

function docComplianceOf(project: Project, language: string, standard: StandardModule, result: EditionEvaluation): DocCompliance {
  const lang = describeLanguageOf(language);
  const edition = standard.edition;
  const { achieved, planned } = result;
  const name = complianceNameOf(project);
  const familyData = familyCompliance(project.compliance, edition.family);
  const target = familyData.target ?? {};
  const rowById = new Map(edition.rows.map((r) => [r.label, r]));
  const levels = standard.header === "security-levels";

  // Catalog mitigations meeting a requirement on a type of the open elements — suggestions for gaps (D-29).
  const typeOf = complianceTypeOf(project);
  // FX-23: with their text in the document language — project mitigations carry their own.
  const mitigationT = i18n.getFixedT(language, "mitigations");
  const suggestionsOf = (label: string, openElementIds: readonly string[]): DocMitigationSuggestion[] =>
    suggestMitigations(
      getAllMitigations(),
      rowById.get(label)?.requirementIds ?? [],
      new Set(openElementIds.map(typeOf).filter((type): type is string => !!type)),
    ).map((m) => ({
      id: m.id,
      text: (m as { text?: string }).text ?? String(mitigationT(`${m.id}.mitigation`, { defaultValue: m.id })),
    }));

  const claimRows = new Map<string, string[]>();
  for (const r of achieved.rows) for (const id of r.claimIds) claimRows.set(id, [...(claimRows.get(id) ?? []), r.label]);
  const claims = (project.cybersecurityConcept?.claims ?? [])
    .filter((c) => c.kind === "supporting" && claimRows.has(c.displayId))
    .map((c) => ({
      id: c.displayId,
      statement: c.statement,
      ...(c.responsibleParty ? { responsibleParty: c.responsibleParty } : {}),
      ...(c.reviewBy ? { reviewBy: c.reviewBy } : {}),
      rows: claimRows.get(c.displayId)!,
    }));

  return {
    standardLabel: standard.label,
    ...(claims.length > 0 ? { claims } : {}),
    editionTitle: edition.title,
    draft: edition.draft,
    cra: edition.id === "en-iec-62443-4-2-praa-2026",
    ccsc2Label: edition.ccsc2Label,
    component: result.scopeName,
    levels,
    deviceCategories: edition.rows.some((r) => r.deviceCategories)
      ? {
          categories: [...(familyData.deviceCategories?.categories ?? [])],
          confirmed: familyData.deviceCategories?.source === "manual",
        }
      : undefined,
    ...(achieved.srsl
      ? {
          srsl: {
            ...(achieved.srsl.windowOfOpportunity ? { windowOfOpportunity: achieved.srsl.windowOfOpportunity } : {}),
            safetyFunctions: achieved.srsl.safetyFunctions.map((sf) => ({
              name: sf.name,
              ...(sf.srsl !== null ? { srsl: sf.srsl } : {}),
              interfaces: sf.interfaces.map(name),
            })),
          },
        }
      : {}),
    vectors: !levels ? [] : FOUNDATIONAL_REQUIREMENTS.map((fr) => ({
      fr,
      target: target[fr],
      achievedComponent: achieved.component[fr],
      achievedWithSupport: achieved.withSupport[fr],
      plannedComponent: planned.component[fr],
      plannedWithSupport: planned.withSupport[fr],
    })),
    rows: achieved.rows.map((r) => {
      const countsComponent = countsForComponent(r);
      // D-27: title and our own summary per requirement, checklists in the document language.
      const descriptions = (rowById.get(r.label)?.requirementIds ?? []).map((id) => describeRequirement(id, lang));
      return {
        label: r.label,
        fr: r.group,
        minSl: r.minSl,
        cra: rowById.get(r.label)?.cra ? [...rowById.get(r.label)!.cra!] : undefined,
        status: r.status,
        source: r.source,
        failing: r.failing.map(name),
        unknown: r.unknown.map(name),
        supporting: r.supportingElements.map(name),
        mitigations: [...new Set(r.mitigationIds)],
        ...(r.unclearMitigationIds?.length ? { unclearMitigations: [...r.unclearMitigationIds] } : {}),
        claims: r.claimIds,
        reasoning: r.reasoning,
        summary: descriptions.map((d) => `${d.title} — ${d.summary}`).join(" / "),
        checklist: localizedChecklist(descriptions, r.checklist),
        contradiction: r.contradiction,
        statementModelChanged: r.statementModelChanged,
        statementSuperseded: r.statementSuperseded,
        countsForComponent: countsComponent,
        suggestions: !levels || countsComponent || r.status === "n/a" ? [] : suggestionsOf(r.label, [...r.failing, ...r.unknown]),
        ...(r.risks?.length ? { risks: [...r.risks] } : {}),
      };
    }),
  };
}
