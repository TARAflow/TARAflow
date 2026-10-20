// ==================== LEVELED ANALYSIS ====================
// One parse and one effective model per DFD state (review finding 1).
//
// Every consumer of a leveled DFD — the save path, the validator, the app
// layout (table groups, parent-level flows), the asset roll-up and the DFD
// tab hooks — asks here instead of parsing on its own.
//
//   parse   cached per (XML, page structure). The page structure is what the
//           parser reads of dfd.pages: ids, names, decomposition, order and
//           identity links — not the thumbnails.
//   model   cached per parse and the structural signature of the records:
//           element types and the three flow properties the model reads
//           (excludeFromThreatGen, refines, abstract). A change of any other
//           property (a description, an asset relation) reuses parse and model.
//   records merged on every call (parsed records with the persisted ones) —
//           cheap, and always current.
//
// Cached results are shared: consumers must not mutate them. The caches are
// small (the current state, the previous one for comparisons, a draft).

import type { DFDConnection, DFDElement, DFDPage } from "../../models/dfd-types";
import { DFDParser, dfdParser, type ParseResult } from "../dfd-parser";
import { buildEffectiveModel, type EffectiveModel } from "./effective-model";
import { buildPageTree, type PageTree } from "./page-tree";
import { computeHomePages, type HomePages } from "./home-pages";
import { analysePageGeometry } from "./page-geometry";

export interface LeveledSource {
  xml?: string;
  pages?: readonly DFDPage[];
  elements: readonly DFDElement[];
  connections: readonly DFDConnection[];
}

export interface LeveledAnalysis {
  parse: ParseResult;
  tree: PageTree;
  homePages: HomePages;
  model: EffectiveModel;
  /** Parsed records, replaced by the persisted ones where present. */
  records: {
    elements: Map<string, DFDElement>;
    connections: Map<string, DFDConnection>;
  };
}

const CACHE_SIZE = 4;

/** Tiny LRU: most recently used last. */
class Lru<V> {
  private readonly entries = new Map<string, V>();
  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > CACHE_SIZE) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }
  clear(): void {
    this.entries.clear();
  }
}

interface Structure {
  tree: PageTree;
  homePages: HomePages;
  model: EffectiveModel;
}

const parseCaches = new WeakMap<DFDParser, Lru<ParseResult>>();
const modelCache = new Lru<Structure>();

/** What the parser reads of dfd.pages (no thumbnails). */
function pagesKey(pages: readonly DFDPage[] | undefined): string {
  if (!pages) return "-";
  return JSON.stringify(
    pages.map((p) => [p.pageId, p.name, p.decomposes ?? null, p.order ?? null, p.links ?? []]),
  );
}

function parseKey(xml: string, pages: readonly DFDPage[] | undefined): string {
  return `${pagesKey(pages)}\u0001${xml}`;
}

/** The parse of an XML state; shared with every other caller of the same state. */
export function parseDfd(
  xml: string,
  pages?: readonly DFDPage[],
  parser: DFDParser = dfdParser,
): ParseResult {
  let cache = parseCaches.get(parser);
  if (!cache) parseCaches.set(parser, (cache = new Lru<ParseResult>()));
  const key = parseKey(xml, pages);
  const cached = cache.get(key);
  if (cached) return cached;
  const parse = parser.parse(xml, pages);
  cache.set(key, parse);
  return parse;
}

/** Element types and the flow properties the effective model reads. */
function structuralSignature(
  elements: Iterable<DFDElement>,
  connections: Iterable<DFDConnection>,
): string {
  const parts: string[] = [];
  for (const e of elements) parts.push(`e:${e.id}:${e.type}`);
  for (const c of connections) {
    const p = (c.properties as Record<string, unknown> | undefined) ?? {};
    parts.push(
      `c:${c.id}:${p.excludeFromThreatGen === true ? 1 : 0}:${String(p.refines ?? "")}:${p.abstract === true ? 1 : 0}`,
    );
  }
  return parts.join("|");
}

/** Parse, page tree, home pages, effective model and records of a leveled DFD. */
export function analyseLeveled(source: LeveledSource, parser: DFDParser = dfdParser): LeveledAnalysis {
  const xml = source.xml ?? "";
  const parse = parseDfd(xml, source.pages, parser);

  const elements = new Map(parse.elements.map((e) => [e.id, e]));
  for (const e of source.elements) if (elements.has(e.id)) elements.set(e.id, e);
  const connections = new Map(parse.connections.map((c) => [c.id, c]));
  for (const c of source.connections) if (connections.has(c.id)) connections.set(c.id, c);

  const key = `${parseKey(xml, source.pages)}\u0002${structuralSignature(elements.values(), connections.values())}`;
  let structure = parser === dfdParser ? modelCache.get(key) : undefined;
  if (!structure) {
    const homePages = computeHomePages(parse.occurrences);
    const tree = buildPageTree({
      parsedPages: parse.pages,
      persistedPages: source.pages,
      elements: [...elements.values()],
      occurrences: parse.occurrences,
      homePages,
    });
    const model = buildEffectiveModel({
      elements: [...elements.values()],
      connections: [...connections.values()],
      occurrences: parse.occurrences,
      tree,
      homePages,
      pageGeometry: analysePageGeometry(parse.pageCells),
    });
    structure = { tree, homePages, model };
    if (parser === dfdParser) modelCache.set(key, structure);
  }
  return { parse, ...structure, records: { elements, connections } };
}

/** Empties the caches (tests). */
export function clearLeveledAnalysisCache(): void {
  modelCache.clear();
  parseCaches.delete(dfdParser);
}
