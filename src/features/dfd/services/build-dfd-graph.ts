// ==================== BUILD DFD GRAPH ====================
// The one entry point for the analysis graph of a DFD
// (leveled-dfd-multi-diagram-design.md §6, Phase 2c).
//
//   single page   exactly as before: the graph builder derives boundaries,
//                 nesting and crossed interfaces from the page's geometry
//   several pages the effective model (§6): only leaves as elements, every
//                 flow with its stitched endpoints, boundaries / nesting /
//                 interfaces resolved over all pages and handed to the
//                 builder as precomputed facts. Excluded flows (EE→EE,
//                 excludeFromThreatGen) are left out of the graph.
//
// The records (properties, asset relations) are the caller's — persisted or
// merged — and only fall back to the parsed ones for cells the caller does
// not know yet.

import { inspectDrawioPages } from "shared";
import type { DFDConnection, DFDElement, DFDPage } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { DFDGraph } from "../models/dfd-graph-types";
import {
  DefaultDFDGraphBuilder,
  type PrecomputedGraphFacts,
} from "./dfd-graph-builder";
import { dfdParser } from "./dfd-parser";
import {
  analysePageGeometry,
  buildEffectiveModel,
  buildPageTree,
  computeHomePages,
  type EffectiveModel,
  type HomePages,
  type PageTree,
} from "./leveled";
import {
  collectLeveledFindings,
  type LeveledFindings,
} from "./leveled/leveled-findings";
import type { ParseResult } from "./dfd-parser";

export interface DfdGraphSource {
  xml?: string;
  pages?: readonly DFDPage[];
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[];
}

/**
 * What the analysis sees of a DFD: for a single page its records as they
 * are; for a leveled DFD the leaves, the stitched (non-excluded) flows and
 * the precomputed facts. The graph AND the validator take this view, so a
 * decomposed multiprocess is neither analysed nor validated as an element,
 * and flow checks see the resolved endpoints (e.g. the TLS terminator is
 * P-11, not the multiprocess the flow is drawn to on Top).
 */
export interface AnalysisView {
  elements: DFDElement[];
  connections: DFDConnection[];
  facts?: PrecomputedGraphFacts;
  /** Leveled DFD only: findings of the page tree and the effective model
   *  (§7), handed to the validator. */
  leveledFindings?: LeveledFindings;
}

export function buildAnalysisView(source: DfdGraphSource): AnalysisView {
  if (!isLeveled(source.xml)) {
    return { elements: source.elements, connections: source.connections };
  }
  const leveled = effectiveModelOf(source);
  return {
    ...graphInputOf(leveled.model, leveled.records),
    leveledFindings: collectLeveledFindings({
      ...leveled,
      persistedPages: source.pages,
      assets: source.assets,
    }),
  };
}

/**
 * @param view the analysis view if the caller already built it (to validate
 *             with the same view); built here otherwise
 */
export function buildDfdGraph(
  source: DfdGraphSource,
  view: AnalysisView = buildAnalysisView(source),
): DFDGraph {
  return new DefaultDFDGraphBuilder().build({ ...view, assets: source.assets });
}

/** More than one draw.io page = leveled DFD. */
export function isLeveled(xml: string | undefined): boolean {
  return !!xml && inspectDrawioPages(xml).pageCount > 1;
}

/** The effective model of a leveled DFD and the records it refers to. */
export function effectiveModelOf(source: DfdGraphSource): {
  model: EffectiveModel;
  records: {
    elements: Map<string, DFDElement>;
    connections: Map<string, DFDConnection>;
  };
  parse: ParseResult;
  tree: PageTree;
  homePages: HomePages;
} {
  const parse = dfdParser.parse(source.xml ?? "", source.pages);
  const elementRecords = new Map(parse.elements.map((e) => [e.id, e]));
  for (const e of source.elements) {
    if (elementRecords.has(e.id)) elementRecords.set(e.id, e);
  }
  const connectionRecords = new Map(parse.connections.map((c) => [c.id, c]));
  for (const c of source.connections) {
    if (connectionRecords.has(c.id)) connectionRecords.set(c.id, c);
  }

  const homePages = computeHomePages(parse.occurrences);
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages: source.pages,
    elements: [...elementRecords.values()],
    occurrences: parse.occurrences,
    homePages,
  });
  const model = buildEffectiveModel({
    elements: [...elementRecords.values()],
    connections: [...connectionRecords.values()],
    occurrences: parse.occurrences,
    tree,
    homePages,
    pageGeometry: analysePageGeometry(parse.pageCells),
  });
  return {
    model,
    records: { elements: elementRecords, connections: connectionRecords },
    parse,
    tree,
    homePages,
  };
}

function graphInputOf(
  model: EffectiveModel,
  records: {
    elements: Map<string, DFDElement>;
    connections: Map<string, DFDConnection>;
  },
): AnalysisView {
  const elements = model.elements.map((e) => records.elements.get(e.tfId)!);
  const connections = model.flows
    .filter((f) => f.state !== "excluded")
    .map((f) => ({
      ...records.connections.get(f.tfId)!,
      from: f.from,
      to: f.to,
    }));

  const trust = new Map<string, string[]>();
  const chip = new Map<string, string[]>();
  const physical = new Map<string, string[]>();
  for (const e of model.elements) {
    trust.set(e.tfId, e.boundaries?.trust ?? []);
    chip.set(e.tfId, e.boundaries?.chip ?? []);
    physical.set(e.tfId, e.boundaries?.physical ?? []);
  }
  const flowInterfaces = new Map(
    model.flows.map((f) => [f.tfId, (f.interfaces ?? []).map((i) => i.tfId)]),
  );

  return {
    elements,
    connections,
    facts: {
      trust,
      chip,
      physical,
      trustBoundaryParent: model.trustBoundaryParent ?? new Map(),
      flowInterfaces,
    },
  };
}
